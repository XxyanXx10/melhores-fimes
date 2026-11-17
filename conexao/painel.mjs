/**
 * Painel da conexão — uma página no navegador para ver e comandar tudo:
 * as duas máquinas, o que está subindo, a fila do PC de casa, o render, o
 * download, o Drive. Por baixo ele usa os mesmos scripts (enviar.mjs, drive.mjs).
 *
 *   node conexao/painel.mjs            http://localhost:5181 (só neste computador)
 *   node conexao/painel.mjs --abrir    e já abre o navegador
 *   node conexao/painel.mjs --rede     também pelo Tailscale (ver do celular: http://<este-pc>:5181)
 */
import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  aqui,
  estadoDoTailscale,
  gravarConfigRemoto,
  lerArquivoConfig,
  lerConfigRemoto,
  normalizarServidor,
  parear,
  raiz,
  usoDaMaquina,
} from './comum.mjs';
import { acharRaizDoDrive, itensDaEntrada, itensProntos } from './drive.mjs';

const args = process.argv.slice(2);
const PORTA = Number(process.env.CONEXAO_PORTA_PAINEL ?? 5181);
const PASTA_CLIENTE = path.join(aqui, '.cliente');
const ARQUIVO_ENVIOS = path.join(PASTA_CLIENTE, 'envios.json');
const ARQUIVO_MEDIDAS = path.join(PASTA_CLIENTE, 'medidas.json');
const PAGINA = path.join(aqui, 'painel', 'index.html');

/* ---------- conversa com a estação ---------- */

async function servidorEToken() {
  const cfg = await lerConfigRemoto();
  // no próprio PC de casa (sem "servidor"), o painel olha a estação local
  const servidor = cfg.servidor ?? (cfg.token ? `http://127.0.0.1:${cfg.porta}` : null);
  return { cfg, servidor, token: cfg.token, local: !cfg.servidor && !!cfg.token };
}

async function estacao(metodo, caminho, corpo, tempo = 6000) {
  const { servidor, token } = await servidorEToken();
  if (!servidor || !token) throw Object.assign(new Error('conexão não configurada'), { naoConfigurado: true });
  const r = await fetch(new URL(caminho, servidor), {
    method: metodo,
    headers: { authorization: `Bearer ${token}`, ...(corpo ? { 'content-type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(tempo),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(dados.erro ?? `erro ${r.status}`), { status: r.status });
  return dados;
}

/* a estação é consultada no máximo a cada 1,5 s, por mais abas que estejam abertas */
let ultimaConsulta = { quando: 0, valor: null, pendente: null };
function consultarEstacao() {
  if (Date.now() - ultimaConsulta.quando < 1500 && ultimaConsulta.valor) return Promise.resolve(ultimaConsulta.valor);
  if (ultimaConsulta.pendente) return ultimaConsulta.pendente;
  const t0 = Date.now();
  ultimaConsulta.pendente = Promise.all([estacao('GET', '/ping'), estacao('GET', '/tarefas')])
    .then(([info, { tarefas }]) => ({ online: true, info, tarefas, latencia: Date.now() - t0 }))
    .catch((e) => ({
      online: false,
      naoConfigurado: !!e.naoConfigurado,
      senhaErrada: e.status === 401,
      erro: e.naoConfigurado ? 'conexão não configurada' : e.status === 401 ? 'a senha não bate com a do PC de casa' : (e.cause?.code ?? e.message),
      tarefas: [],
    }))
    .then((v) => {
      ultimaConsulta = { quando: Date.now(), valor: v, pendente: null };
      return v;
    });
  return ultimaConsulta.pendente;
}

/* ---------- envios em andamento (processos do enviar.mjs) ---------- */

const processos = new Map();
let contador = 0;

async function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(await readFile(arquivo, 'utf8'));
  } catch {
    return padrao;
  }
}

async function anotarMedida(tipo, vel) {
  if (!Number.isFinite(vel) || vel <= 0) return;
  const m = await lerJson(ARQUIVO_MEDIDAS, {});
  m[tipo] = m[tipo] ? m[tipo] * 0.6 + vel * 0.4 : vel; // média que acompanha a internet de hoje
  m[`${tipo}Quando`] = Date.now();
  await mkdir(PASTA_CLIENTE, { recursive: true });
  await writeFile(ARQUIVO_MEDIDAS, JSON.stringify(m, null, 2));
}

function lancar(argumentos, rotulo, extras = {}) {
  const id = `p${++contador}`;
  const proc = {
    id,
    rotulo,
    argumentos,
    inicio: Date.now(),
    fim: null,
    codigoSaida: null,
    log: [],
    projetos: {},
    porTarefa: {},
    erro: null,
    codigoDiferente: null,
    ...extras,
  };
  processos.set(id, proc);
  const filho = spawn(process.execPath, [path.join(aqui, 'enviar.mjs'), ...argumentos, '--eventos'], {
    cwd: raiz,
    env: process.env,
    windowsHide: true,
  });
  proc.pid = filho.pid;
  let resto = '';
  const linha = (l) => {
    if (!l.trim()) return;
    if (l.startsWith('@@')) {
      try {
        aplicarEvento(proc, JSON.parse(l.slice(2)));
      } catch {
        /* linha quebrada: ignora */
      }
      return;
    }
    proc.log.push(l);
    if (proc.log.length > 300) proc.log.splice(0, proc.log.length - 300);
  };
  const ler = (c) => {
    resto += c.toString('utf8');
    const linhas = resto.split(/\r?\n|\r/);
    resto = linhas.pop();
    linhas.forEach(linha);
  };
  filho.stdout.on('data', ler);
  filho.stderr.on('data', ler);
  filho.on('close', (codigo) => {
    linha(resto);
    proc.fim = Date.now();
    proc.codigoSaida = codigo;
  });
  return proc;
}

function aplicarEvento(proc, ev) {
  const p = ev.arquivo ? (proc.projetos[ev.arquivo] ??= { arquivo: ev.arquivo, nome: path.basename(ev.arquivo, '.json') }) : null;
  switch (ev.e) {
    case 'projeto':
      p.nome = ev.nome;
      p.fase = 'conferindo';
      break;
    case 'conferindo':
      p.fase = 'conferindo';
      p.atual = ev.nome;
      break;
    case 'subindo':
      p.fase = 'enviando';
      p.sub = { nome: ev.nome, feito: ev.feito, total: ev.total, vel: ev.vel };
      p.enviados ??= {};
      p.enviados[ev.nome] = ev.total;
      if (ev.feito === ev.total && ev.total > 5 * 1024 * 1024) void anotarMedida('subida', ev.vel);
      break;
    case 'arquivos':
      p.fase = 'enviado';
      p.arquivos = { quantos: ev.quantos, bytes: ev.bytes, mandados: ev.mandados, bytesMandados: ev.bytesMandados };
      p.sub = null;
      break;
    case 'enfileirado':
      p.id = ev.id;
      p.fase = 'fila';
      proc.porTarefa[ev.id] = { arquivo: ev.arquivo };
      break;
    case 'baixando': {
      const t = (proc.porTarefa[ev.id] ??= {});
      t.desc = { nome: ev.nome, feito: ev.feito, total: ev.total, vel: ev.vel };
      if (ev.feito === ev.total && ev.total > 5 * 1024 * 1024) void anotarMedida('descida', ev.vel);
      break;
    }
    case 'baixado':
      (proc.porTarefa[ev.id] ??= {}).salvos = ev.salvos;
      (proc.porTarefa[ev.id]).desc = null;
      break;
    case 'falha':
      (proc.porTarefa[ev.id] ??= {}).erro = ev.erro;
      break;
    case 'codigo':
      if (ev.acao === 'parar') proc.codigoDiferente = ev.diferentes;
      proc.codigo = ev.acao;
      break;
    case 'erro':
      proc.erro = ev.mensagem;
      break;
  }
}

/* ---------- a lista única de "trabalhos" que a página mostra ---------- */

const ETAPA_DO_STATUS = { aguardando: 'fila', rodando: 'renderizando', concluida: 'pronto-la', erro: 'erro', cancelada: 'cancelada' };

function montarTrabalhos(tarefas, envios) {
  const trabalhos = [];
  const vistos = new Set();
  const procDaTarefa = new Map();
  for (const proc of processos.values()) for (const [id, t] of Object.entries(proc.porTarefa)) procDaTarefa.set(id, { proc, t });

  // 1) o que ainda está saindo daqui (não tem número na fila de lá)
  for (const proc of [...processos.values()].reverse()) {
    for (const p of Object.values(proc.projetos)) {
      if (p.id) continue;
      const acabou = proc.fim !== null;
      trabalhos.push({
        chave: `${proc.id}:${p.arquivo}`,
        nome: p.nome,
        projeto: p.arquivo,
        criada: proc.inicio,
        etapa: acabou ? 'erro' : 'enviando',
        progresso: p.sub ? p.sub.feito / p.sub.total : 0,
        detalhe: acabou
          ? (proc.codigoDiferente ? 'parou: o código daqui é diferente do de lá' : proc.erro ?? 'o envio parou')
          : p.fase === 'conferindo'
            ? `conferindo ${p.atual ?? 'os arquivos'}…`
            : p.sub
              ? `${p.sub.nome}`
              : 'preparando…',
        sub: p.sub ?? null,
        arquivos: p.arquivos ?? null,
        processo: proc.id,
      });
    }
    // acabou de ser mandado e ainda está conectando: aparece na hora, sem esperar o primeiro evento
    if (proc.fim === null && !Object.keys(proc.projetos).length && proc.pedido) {
      trabalhos.push({ chave: proc.id, nome: proc.rotulo, criada: proc.inicio, etapa: 'enviando', progresso: 0, detalhe: 'conectando ao PC de casa…', processo: proc.id });
    }
    if (proc.fim !== null && !Object.keys(proc.projetos).length && proc.erro && !proc.dispensado) {
      trabalhos.push({
        chave: proc.id,
        nome: proc.rotulo,
        criada: proc.inicio,
        etapa: 'erro',
        detalhe: proc.codigoDiferente ? 'parou antes de mandar: escolha abaixo qual código vale' : proc.erro,
        processo: proc.id,
      });
    }
  }

  // 2) o que está na estação
  for (const t of tarefas) {
    vistos.add(t.id);
    const local = procDaTarefa.get(t.id);
    const envio = envios[t.id] ?? {};
    let etapa = ETAPA_DO_STATUS[t.status] ?? t.status;
    let progresso = t.status === 'rodando' ? (t.progresso ?? 0) : t.status === 'concluida' ? 1 : 0;
    let detalhe = '';
    const salvos = local?.t.salvos ?? envio.baixado ?? null;
    if (t.status === 'aguardando') detalhe = t.posicaoNaFila > 1 ? `${t.posicaoNaFila}º na fila` : 'é o próximo';
    if (t.status === 'rodando') {
      const decorrido = (Date.now() - t.inicio) / 1000;
      detalhe = t.progresso > 0.02 ? `falta ~${Math.max(1, Math.round((decorrido / t.progresso - decorrido) / 60))} min` : 'começando…';
    }
    if (t.status === 'concluida') {
      if (local?.t.desc) {
        etapa = 'baixando';
        progresso = local.t.desc.feito / local.t.desc.total;
        detalhe = local.t.desc.nome;
      } else if (salvos?.length) {
        etapa = 'pronto';
        detalhe = path.basename(salvos[0]);
      } else {
        detalhe = 'pronto no PC de casa — falta baixar';
      }
    }
    if (t.status === 'erro') detalhe = (t.erro ?? '').split('\n').filter(Boolean).slice(-1)[0] ?? 'falhou';
    trabalhos.push({
      chave: t.id,
      id: t.id,
      nome: t.nome,
      tipo: t.tipo,
      origem: t.origem,
      daqui: !!envio.criado || !!local,
      projeto: envio.projeto ?? local?.t.arquivo ?? null,
      criada: t.criada,
      inicio: t.inicio,
      fim: t.fim,
      etapa,
      progresso,
      detalhe,
      desc: local?.t.desc ?? null,
      salvos,
      resultados: t.resultados ?? [],
      arquivos: local ? local.proc.projetos[local.t.arquivo]?.arquivos ?? null : null,
      baixandoAgora: !!local && local.proc.fim === null,
      erroCompleto: t.status === 'erro' ? t.erro : null,
      avisos: t.avisos ?? [],
    });
  }
  return trabalhos.sort((a, b) => b.criada - a.criada);
}

/* ---------- projetos e Drive ---------- */

const cacheDeProjetos = new Map(); // arquivo → { mtime, info }: projeto grande demora para ler

async function listarProjetos() {
  const pasta = path.join(raiz, 'projeto');
  const lista = [];
  for (const nome of await readdir(pasta).catch(() => [])) {
    if (!nome.endsWith('.json')) continue;
    const cheio = path.join(pasta, nome);
    try {
      const s = await stat(cheio);
      const guardado = cacheDeProjetos.get(cheio);
      if (guardado?.mtime === s.mtimeMs) {
        if (guardado.info) lista.push({ ...guardado.info, videoExiste: !!guardado.info.video && existsSync(guardado.info.video) });
        continue;
      }
      const p = JSON.parse((await readFile(cheio, 'utf8')).replace(/^﻿/, ''));
      if (!Array.isArray(p.palavras) && !p.video) {
        cacheDeProjetos.set(cheio, { mtime: s.mtimeMs, info: null });
        continue;
      }
      const video = p.video ? path.resolve(raiz, p.video) : null;
      const sv = video ? await stat(video).catch(() => null) : null;
      const info = {
        arquivo: cheio,
        nome: nome.replace(/\.json$/i, ''),
        duracao: p.duracao ?? null,
        modificado: s.mtimeMs,
        video,
        videoExiste: !!sv,
        tamanhoVideo: sv?.size ?? null,
      };
      cacheDeProjetos.set(cheio, { mtime: s.mtimeMs, info });
      lista.push(info);
    } catch {
      /* não é projeto */
    }
  }
  return lista.sort((a, b) => b.modificado - a.modificado);
}

let driveCache = { quando: 0, valor: null };
async function estadoDoDrive() {
  if (Date.now() - driveCache.quando < 8000 && driveCache.valor) return driveCache.valor;
  const cfg = await lerArquivoConfig();
  let valor;
  if (!cfg.drive) valor = { configurado: false, encontrado: acharRaizDoDrive() };
  else {
    const [entrada, prontos] = await Promise.all([itensDaEntrada(cfg.drive), itensProntos(cfg.drive)]);
    valor = { configurado: true, ...cfg.drive, entrada: entrada.slice(0, 30), prontos: prontos.slice(0, 15) };
  }
  driveCache = { quando: Date.now(), valor };
  return valor;
}

let tsCache = { quando: 0, valor: null };
async function tailscale() {
  if (Date.now() - tsCache.quando < 15000 && tsCache.valor) return tsCache.valor;
  tsCache = { quando: Date.now(), valor: await estadoDoTailscale() };
  return tsCache.valor;
}

/* ---------- HTTP ---------- */

function responder(res, codigo, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(texto);
}

async function corpoJson(req) {
  const pedacos = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > 1024 * 1024) throw new Error('pedido grande demais');
    pedacos.push(c);
  }
  return JSON.parse(Buffer.concat(pedacos).toString('utf8') || '{}');
}

/*
 * Só aceita pedidos feitos por esta página: nome de host conhecido (contra
 * "DNS rebinding") e, para mudar algo, o cabeçalho x-painel (um site qualquer
 * aberto no navegador não consegue mandar esse cabeçalho para cá).
 */
function hostPermitido(host) {
  const h = String(host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  if (['localhost', '127.0.0.1', '::1'].includes(h)) return true;
  if (!rede) return false;
  return /^100\.\d+\.\d+\.\d+$/.test(h) || h.endsWith('.ts.net') || /^[a-z0-9-]+$/.test(h);
}

function abrirNoExplorer(alvo) {
  if (process.platform === 'win32') execFile('explorer.exe', [`/select,${alvo}`], { windowsHide: true }, () => {});
  else execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [path.dirname(alvo)], () => {});
}

async function caminhoQuePodeAbrir(alvo) {
  const cheio = path.resolve(String(alvo ?? ''));
  if (!existsSync(cheio)) return null;
  const dentro = (base) => base && (cheio + path.sep).toLowerCase().startsWith(path.resolve(base).toLowerCase() + path.sep);
  if (dentro(path.join(raiz, 'render')) || dentro(path.join(raiz, 'projeto')) || dentro(path.join(raiz, 'videos'))) return cheio;
  const cfg = await lerArquivoConfig();
  if (cfg.drive && dentro(cfg.drive.pasta)) return cheio;
  const envios = await lerJson(ARQUIVO_ENVIOS, {});
  for (const e of Object.values(envios)) if ((e.baixado ?? []).some((b) => path.resolve(b).toLowerCase() === cheio.toLowerCase())) return cheio;
  return null;
}

/** O pedido da página vira os argumentos do enviar.mjs. */
function argumentosDoPedido(pedido) {
  const a = pedido.projetos.map((x) => path.resolve(x));
  if (pedido.modo === 'frame') a.push('--still', String(Math.max(0, Math.round(Number(pedido.frame) || 0))));
  if (pedido.modo === 'trecho') a.push('--segundos', String(pedido.segundos));
  if (pedido.alta) a.push('--alta');
  if (pedido.codigo === 'levar') a.push('--levar-codigo');
  if (pedido.codigo === 'ignorar') a.push('--ignorar-codigo');
  if (pedido.destino === 'drive') a.push('--pasta', 'drive');
  return a;
}

async function rotas(req, res) {
  if (!hostPermitido(req.headers.host)) {
    res.writeHead(403);
    return res.end('host não permitido');
  }
  const url = new URL(req.url, 'http://painel');
  const p = url.pathname;

  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(await readFile(PAGINA));
  }

  if (req.method === 'GET' && p === '/api/estado') {
    const [{ cfg, servidor, local }, est, envios, medidas, uso, drive, ts] = await Promise.all([
      servidorEToken(),
      consultarEstacao(),
      lerJson(ARQUIVO_ENVIOS, {}),
      lerJson(ARQUIVO_MEDIDAS, {}),
      usoDaMaquina(),
      estadoDoDrive(),
      tailscale(),
    ]);
    return responder(res, 200, {
      agora: Date.now(),
      eu: {
        nome: local ? (cfg.nome ?? os.hostname()) : os.hostname(),
        computador: os.hostname(),
        processador: os.cpus()[0]?.model?.trim(),
        nucleos: os.cpus().length,
        memoria: os.totalmem(),
        uso,
        papel: local ? 'estacao' : 'notebook',
      },
      config: { configurado: !!(servidor && cfg.token), servidor, local, temDrive: !!cfg.drive },
      estacao: { online: est.online, info: est.info ?? null, erro: est.erro ?? null, senhaErrada: !!est.senhaErrada, latencia: est.latencia ?? null },
      trabalhos: montarTrabalhos(est.tarefas ?? [], envios),
      processos: [...processos.values()].map(({ id, rotulo, inicio, fim, codigoSaida, erro, codigoDiferente, argumentos, dispensado }) => ({
        id, rotulo, inicio, fim, codigoSaida, erro, codigoDiferente, argumentos, dispensado,
      })),
      medidas,
      drive,
      tailscale: ts,
    });
  }

  if (req.method === 'GET' && p === '/api/projetos') return responder(res, 200, { projetos: await listarProjetos() });

  let m = p.match(/^\/api\/tarefa\/([\w-]+)$/);
  if (req.method === 'GET' && m) {
    try {
      return responder(res, 200, await estacao('GET', `/tarefas/${m[1]}`));
    } catch (e) {
      return responder(res, e.status ?? 502, { erro: e.message });
    }
  }
  m = p.match(/^\/api\/processo\/(p\d+)$/);
  if (req.method === 'GET' && m) {
    const proc = processos.get(m[1]);
    return proc ? responder(res, 200, { log: proc.log, erro: proc.erro, codigoDiferente: proc.codigoDiferente }) : responder(res, 404, { erro: 'não existe' });
  }

  if (req.method !== 'POST') return responder(res, 404, { erro: 'rota desconhecida' });
  if (req.headers['x-painel'] !== '1') return responder(res, 403, { erro: 'pedido sem o cabeçalho do painel' });
  const corpo = await corpoJson(req);

  if (p === '/api/renderizar') {
    const lista = (corpo.projetos ?? []).filter((x) => typeof x === 'string');
    if (!lista.length) return responder(res, 400, { erro: 'escolha pelo menos um projeto' });
    for (const x of lista) {
      const cheio = path.resolve(x);
      if (!existsSync(cheio) || !cheio.toLowerCase().endsWith('.json')) return responder(res, 400, { erro: `projeto não encontrado: ${x}` });
    }
    if (corpo.modo === 'trecho' && !/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(String(corpo.segundos ?? ''))) {
      return responder(res, 400, { erro: 'trecho no formato 0-10' });
    }
    const pedido = { ...corpo, projetos: lista };
    const rotulo = lista.length === 1 ? path.basename(lista[0], '.json') : `${lista.length} projetos`;
    const proc = lancar(argumentosDoPedido(pedido), rotulo, { pedido });
    ultimaConsulta.quando = 0;
    return responder(res, 200, { ok: true, processo: proc.id });
  }

  if (p === '/api/dispensar') {
    const proc = processos.get(corpo.processo);
    if (proc && proc.fim !== null) proc.dispensado = true;
    if (proc && proc.fim !== null) for (const pr of Object.values(proc.projetos)) if (!pr.id) delete proc.projetos[pr.arquivo];
    return responder(res, 200, { ok: true });
  }

  if (p === '/api/repetir') {
    const proc = processos.get(corpo.processo);
    if (!proc?.pedido) return responder(res, 404, { erro: 'não sei repetir esse' });
    proc.dispensado = true;
    for (const pr of Object.values(proc.projetos)) if (!pr.id) delete proc.projetos[pr.arquivo];
    const novo = { ...proc.pedido, codigo: corpo.codigo ?? proc.pedido.codigo };
    const p2 = lancar(argumentosDoPedido(novo), proc.rotulo, { pedido: novo });
    ultimaConsulta.quando = 0;
    return responder(res, 200, { ok: true, processo: p2.id });
  }

  if (p === '/api/cancelar') {
    try {
      const r = await estacao('DELETE', `/tarefas/${encodeURIComponent(corpo.id)}`);
      ultimaConsulta.quando = 0;
      return responder(res, 200, r);
    } catch (e) {
      return responder(res, e.status ?? 502, { erro: e.message });
    }
  }

  if (p === '/api/baixar') {
    const proc = lancar(['--acompanhar', String(corpo.id)], `baixar ${corpo.id}`);
    return responder(res, 200, { ok: true, processo: proc.id });
  }

  if (p === '/api/abrir') {
    const alvo = await caminhoQuePodeAbrir(corpo.caminho);
    if (!alvo) return responder(res, 400, { erro: 'esse arquivo não existe (ou não é deste projeto)' });
    abrirNoExplorer(alvo);
    return responder(res, 200, { ok: true });
  }

  if (p === '/api/parear') {
    try {
      const servidor = normalizarServidor(corpo.servidor ?? '');
      const r = await parear(servidor, corpo.codigo ?? '');
      const cfg = await lerArquivoConfig();
      cfg.servidor = servidor;
      cfg.token = r.token;
      await gravarConfigRemoto(cfg);
      ultimaConsulta.quando = 0;
      return responder(res, 200, { ok: true, nome: r.nome });
    } catch (e) {
      return responder(res, 400, { erro: e.status ? e.message : `não consegui falar com o PC de casa (${e.cause?.code ?? e.message})` });
    }
  }

  if (p === '/api/drive/trazer') {
    const nome = String(corpo.nome ?? '');
    if (!nome) return responder(res, 400, { erro: 'qual?' });
    execFile(process.execPath, [path.join(aqui, 'drive.mjs'), '--trazer', nome, '--json'], { cwd: raiz, windowsHide: true, timeout: 3 * 3600 * 1000 }, () => {
      driveCache.quando = 0;
    });
    return responder(res, 200, { ok: true });
  }

  return responder(res, 404, { erro: 'rota desconhecida' });
}

/* ---------- ligar ---------- */

const rede = args.includes('--rede');
const enderecos = ['127.0.0.1'];
if (rede) {
  for (const i of Object.values(os.networkInterfaces()).flat()) {
    if (i && i.family === 'IPv4' && /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address)) enderecos.push(i.address);
  }
  if (enderecos.length === 1) console.log('⚠ --rede: não achei endereço do Tailscale neste computador; só vai abrir aqui.');
}

const tratar = (req, res) =>
  rotas(req, res).catch((e) => {
    if (!res.headersSent) responder(res, 500, { erro: e.message });
    else res.destroy();
  });

let abertos = 0;
for (const host of enderecos) {
  const s = http.createServer(tratar);
  s.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && host === '127.0.0.1') {
      console.log(`O painel já está aberto: http://localhost:${PORTA}`);
      if (args.includes('--abrir')) abrirNavegador();
      process.exit(0);
    }
    console.error(`${host}: ${e.message}`);
  });
  s.listen(PORTA, host, () => {
    console.log(`Painel da conexão: http://${host === '127.0.0.1' ? 'localhost' : host}:${PORTA}`);
    if (++abertos === 1 && args.includes('--abrir')) abrirNavegador();
  });
}

function abrirNavegador() {
  const url = `http://localhost:${PORTA}`;
  if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, () => {});
  else execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], () => {});
}
