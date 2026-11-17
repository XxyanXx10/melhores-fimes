/**
 * Estação de render — roda no PC de casa (o que tem placa de vídeo).
 *
 *   node conexao/estacao.mjs
 *
 * Fica esperando pedidos do notebook (conexao/enviar.mjs). Cada pedido traz
 * o projeto e os arquivos que ele usa; a estação guarda os arquivos, põe o
 * pedido numa fila e roda o MESMO render/render.mjs de sempre, um por vez.
 * O resultado fica guardado até o notebook baixar.
 *
 * Só atende quem manda a senha (token) do conexao/config.json.
 */
import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import {
  copyFile,
  link,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  statfs,
  truncate,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  ID_VALIDO,
  MemoriaDeHashes,
  aqui,
  bytesLegiveis,
  caminhoDeCodigoPermitido,
  carimbo,
  gravarConfigRemoto,
  hashDeArquivo,
  lerArquivoConfig,
  lerConfigRemoto,
  manifestoDoCodigo,
  raiz,
  tokenConfere,
  trocarStrings,
  usoDaMaquina,
} from './comum.mjs';

const cfg = await lerConfigRemoto();
if (!cfg.token) {
  console.error('Falta a senha da conexão. Rode antes: node conexao/configurar.mjs');
  process.exit(1);
}

const PASTA = process.env.CONEXAO_ESTADO ? path.resolve(process.env.CONEXAO_ESTADO) : path.join(aqui, '.estacao');
const CACHE = path.join(PASTA, 'cache');
const TAREFAS = path.join(PASTA, 'tarefas');
const BACKUP_CODIGO = path.join(PASTA, 'backup-codigo');
const PUBLIC_REMOTO = path.join(raiz, 'public', 'midia', '_remoto');
const DIAS_GUARDAR = Number(cfg.diasGuardar ?? 15);
const NOME = cfg.nome || os.hostname();

await mkdir(CACHE, { recursive: true });
await mkdir(TAREFAS, { recursive: true });
const hashes = await new MemoriaDeHashes(path.join(PASTA, 'hashes.json')).carregar();

/* ---------- tarefas (persistidas em disco: a estação pode reiniciar) ---------- */

/** @type {Map<string, any>} */
const tarefas = new Map();
let emExecucao = null; // { id, filho, cancelar }
let errosDePareamento = 0;

const pastaDa = (id) => path.join(TAREFAS, id);

async function salvar(t) {
  await writeFile(path.join(pastaDa(t.id), 'tarefa.json'), JSON.stringify(t, null, 2), 'utf8');
}

async function carregarTarefas() {
  for (const id of await readdir(TAREFAS).catch(() => [])) {
    try {
      const t = JSON.parse(await readFile(path.join(pastaDa(id), 'tarefa.json'), 'utf8'));
      if (t.status === 'rodando') {
        t.status = 'erro';
        t.erro = 'A estação foi fechada no meio do render. Mande de novo.';
        t.fim = Date.now();
        await salvar(t);
      }
      tarefas.set(t.id, t);
    } catch {
      /* pasta sem tarefa.json: sobra de pedido que não chegou a nascer */
    }
  }
}

function resumo(t) {
  const { pedido, ...resto } = t;
  return { ...resto, posicaoNaFila: posicaoNaFila(t) };
}

function posicaoNaFila(t) {
  if (t.status !== 'aguardando') return 0;
  return [...tarefas.values()].filter((x) => x.status === 'aguardando' && x.criada <= t.criada).length;
}

/* ---------- arquivos que chegam do notebook ---------- */

function relSeguro(rel) {
  const r = path.posix.normalize(String(rel).replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!r || r.startsWith('..') || path.isAbsolute(r) || /^[a-z]:/i.test(r)) throw new Error(`caminho inválido: ${rel}`);
  return r;
}

async function ligarOuCopiar(origem, destino) {
  await mkdir(path.dirname(destino), { recursive: true });
  try {
    await link(origem, destino);
  } catch {
    await copyFile(origem, destino);
  }
}

async function tocar(arquivo) {
  const agora = new Date();
  await utimes(arquivo, agora, agora).catch(() => {});
}

/**
 * Prepara os arquivos de um pedido no disco daqui e devolve o que trocar
 * nas strings do projeto.
 *
 * - "absoluto" (o vídeo-fonte, que mora em qualquer lugar do notebook):
 *   usa direto a cópia guardada em cache.
 * - "public" (midia/... dentro de public/): se o PC de casa não tem, copia
 *   para o mesmo lugar. Se tem um arquivo DIFERENTE com o mesmo nome, não
 *   mexe no dele: põe a versão do notebook em midia/_remoto/ e aponta para lá.
 */
async function prepararArquivos(t) {
  const troca = new Map();
  const avisos = [];
  const entrada = path.join(pastaDa(t.id), 'entrada');
  for (const a of t.pedido.arquivos ?? []) {
    if (!ID_VALIDO.test(a.id)) throw new Error(`arquivo com id inválido: ${a.id}`);
    const noCache = path.join(CACHE, a.id);
    if (!existsSync(noCache)) throw new Error(`o arquivo ${a.nome} não chegou inteiro — mande de novo`);
    await tocar(noCache);
    const hash = a.id.slice(0, 64);
    if (a.tipo === 'public') {
      const rel = relSeguro(a.rel);
      const destino = path.join(raiz, 'public', rel);
      if (!existsSync(destino)) {
        await mkdir(path.dirname(destino), { recursive: true });
        await copyFile(noCache, destino);
        avisos.push(`copiei ${rel} (não existia aqui)`);
      } else if (a.semTrocar) {
        // o caminho é montado pelo código da composição: não dá para apontar para outro lugar
        if ((await hashes.hash(destino)).hash !== hash) avisos.push(`${rel} é diferente aqui (usei o daqui)`);
      } else if ((await hashes.hash(destino)).hash !== hash) {
        const alternativo = `midia/_remoto/${hash.slice(0, 12)}/${path.posix.basename(rel)}`;
        const destinoAlt = path.join(raiz, 'public', alternativo);
        if (!existsSync(destinoAlt)) {
          await mkdir(path.dirname(destinoAlt), { recursive: true });
          await copyFile(noCache, destinoAlt);
        }
        troca.set(a.original, a.original.startsWith('/') ? `/${alternativo}` : alternativo);
        avisos.push(`${rel} é diferente aqui: usei a versão do notebook, sem mexer na daqui`);
      }
    } else if (t.tipo === 'script') {
      // script pode gravar ao lado do arquivo de entrada: cada tarefa tem a sua cópia
      const destino = path.join(entrada, path.basename(a.nome));
      await ligarOuCopiar(noCache, destino);
      troca.set(a.original, destino);
    } else {
      troca.set(a.original, noCache);
    }
  }
  await hashes.salvar();
  return { troca, avisos };
}

/* ---------- rodar ---------- */

/*
 * Com o PC "dormindo" o render para. Enquanto uma tarefa roda, pedimos ao
 * Windows para não suspender (o mesmo que um player de vídeo faz).
 */
function manterAcordado() {
  if (process.platform !== 'win32') return () => {};
  const ps = spawn(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `$t = Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);' -Name K -Namespace W -PassThru; while ($true) { [void]$t::SetThreadExecutionState(0x80000001); Start-Sleep 30 }`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  ps.on('error', () => {});
  return () => {
    try {
      ps.kill();
    } catch {
      /* já tinha saído */
    }
  };
}

function matarArvore(pid) {
  if (process.platform === 'win32') {
    // matar só o pai deixa o Chrome do Remotion vivo comendo memória
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* já tinha morrido */
      }
    }
  }
}

function substituirMarcadores(arg, t, troca, pastaSaida) {
  return String(arg)
    .replace(/\{saida\}/g, pastaSaida)
    .replace(/\{arquivo:(\d+)\}/g, (_, n) => {
      const a = t.pedido.arquivos?.[Number(n)];
      if (!a) throw new Error(`{arquivo:${n}} não existe no pedido`);
      return troca.get(a.original) ?? path.join(raiz, 'public', relSeguro(a.rel));
    });
}

async function montarComando(t, troca, pastaSaida) {
  const pasta = pastaDa(t.id);
  if (t.tipo === 'render') {
    const projeto = trocarStrings(t.pedido.projeto, (s) => troca.get(s));
    const arquivoProjeto = path.join(pasta, 'projeto.json');
    await writeFile(arquivoProjeto, JSON.stringify(projeto, null, 2), 'utf8');
    const saida = path.join(pastaSaida, path.basename(t.pedido.nomeSaida));
    const args = [path.join(raiz, 'render', 'render.mjs'), arquivoProjeto, '--saida', saida];
    const o = t.pedido.opcoes ?? {};
    if (o.still !== undefined && o.still !== null) args.push('--still', String(Math.max(0, Math.floor(Number(o.still)))));
    if (o.segundos) {
      if (!/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(o.segundos)) throw new Error(`--segundos inválido: ${o.segundos}`);
      args.push('--segundos', o.segundos);
    }
    if (o.alta) args.push('--alta');
    if (o.gpu) args.push('--gpu');
    return { programa: process.execPath, args };
  }
  if (t.tipo === 'script') {
    const rel = relSeguro(t.pedido.script);
    const cheio = path.join(raiz, rel);
    if (!existsSync(cheio)) throw new Error(`o script ${rel} não existe no PC de casa (falta git pull?)`);
    const args = (t.pedido.args ?? []).map((a) => substituirMarcadores(a, t, troca, pastaSaida));
    if (/\.py$/i.test(rel)) return { programa: cfg.python || 'python', args: [cheio, ...args] };
    if (/\.(mjs|cjs|js)$/i.test(rel)) return { programa: process.execPath, args: [cheio, ...args] };
    throw new Error('só sei rodar scripts .mjs, .js ou .py');
  }
  throw new Error(`tipo de tarefa desconhecido: ${t.tipo}`);
}

async function listarResultados(t, pastaSaida) {
  const achados = [];
  const olhar = async (pasta, ignorar) => {
    for (const nome of await readdir(pasta).catch(() => [])) {
      if (ignorar.has(nome)) continue;
      const info = await stat(path.join(pasta, nome)).catch(() => null);
      if (info?.isFile()) achados.push({ nome, tamanho: info.size, pasta: path.relative(pastaDa(t.id), pasta) });
    }
  };
  await olhar(pastaSaida, new Set());
  // scripts que gravam ao lado da entrada (ex.: <nome>-cortado.mp4)
  const entradas = new Set((t.pedido.arquivos ?? []).map((a) => path.basename(a.nome)));
  await olhar(path.join(pastaDa(t.id), 'entrada'), entradas);
  return achados;
}

async function executar(t) {
  const pasta = pastaDa(t.id);
  const pastaSaida = path.join(pasta, 'saida');
  await mkdir(pastaSaida, { recursive: true });
  t.status = 'rodando';
  t.inicio = Date.now();
  t.progresso = 0;
  await salvar(t);

  const { troca, avisos } = await prepararArquivos(t);
  t.avisos = [...(t.avisos ?? []), ...avisos];
  const { programa, args } = await montarComando(t, troca, pastaSaida);

  const log = createWriteStream(path.join(pasta, 'log.txt'), { flags: 'a' });
  log.write(`$ ${programa} ${args.map((a) => JSON.stringify(a)).join(' ')}\n\n`);
  const soltar = manterAcordado();
  console.log(`▶ ${t.id}  ${t.nome}`);

  let cauda = '';
  const codigo = await new Promise((resolve) => {
    const filho = spawn(programa, args, {
      cwd: raiz,
      windowsHide: true,
      detached: process.platform !== 'win32',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    emExecucao.filho = filho;
    if (emExecucao.cancelado) matarArvore(filho.pid);
    let ultimoSalvo = 0;
    const ouvir = (pedaco) => {
      const texto = pedaco.toString('utf8');
      log.write(pedaco);
      cauda = (cauda + texto).slice(-4000);
      const pcts = [...texto.matchAll(/(\d{1,3})%/g)];
      if (pcts.length) {
        const p = Math.min(100, Number(pcts[pcts.length - 1][1])) / 100;
        if (p >= t.progresso) t.progresso = p;
        if (Date.now() - ultimoSalvo > 3000) {
          ultimoSalvo = Date.now();
          void salvar(t);
        }
      }
    };
    filho.stdout.on('data', ouvir);
    filho.stderr.on('data', ouvir);
    filho.on('error', (e) => {
      cauda += `\n${e.message}`;
      resolve(-1);
    });
    filho.on('close', (c) => resolve(c ?? -1));
  });
  soltar();
  log.end();

  const cancelado = emExecucao?.cancelado;
  t.fim = Date.now();
  t.resultados = await listarResultados(t, pastaSaida);
  if (cancelado) {
    t.status = 'cancelada';
    t.erro = 'Cancelada por você.';
  } else if (codigo === 0 && t.resultados.length) {
    t.status = 'concluida';
    t.progresso = 1;
  } else {
    t.status = 'erro';
    const linhas = cauda.replace(/\r/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
    t.erro = (codigo === 0 ? 'Terminou sem gerar arquivo. ' : '') + linhas.slice(-8).join('\n');
  }
  await salvar(t);
  console.log(`${t.status === 'concluida' ? '✓' : '✗'} ${t.id}  ${t.status}  (${Math.round((t.fim - t.inicio) / 1000)}s)`);
}

async function avancarFila() {
  if (emExecucao) return;
  const proxima = [...tarefas.values()]
    .filter((t) => t.status === 'aguardando')
    .sort((a, b) => a.criada - b.criada)[0];
  if (!proxima) return;
  emExecucao = { id: proxima.id, filho: null, cancelado: false };
  try {
    await executar(proxima);
  } catch (e) {
    proxima.status = 'erro';
    proxima.erro = e.message;
    proxima.fim = Date.now();
    await salvar(proxima).catch(() => {});
    console.log(`✗ ${proxima.id}  ${e.message}`);
  } finally {
    emExecucao = null;
    setImmediate(avancarFila);
  }
}

/* ---------- limpeza: o cache não pode encher o disco do PC de casa ---------- */

async function limparAntigos() {
  const limite = Date.now() - DIAS_GUARDAR * 24 * 3600 * 1000;
  const emUso = new Set();
  for (const t of tarefas.values()) {
    if (t.status === 'aguardando' || t.status === 'rodando') for (const a of t.pedido?.arquivos ?? []) emUso.add(a.id);
    if (t.status !== 'aguardando' && t.status !== 'rodando' && (t.fim ?? t.criada) < limite) {
      await rm(pastaDa(t.id), { recursive: true, force: true });
      tarefas.delete(t.id);
    }
  }
  for (const nome of await readdir(CACHE).catch(() => [])) {
    const cheio = path.join(CACHE, nome);
    const info = await stat(cheio).catch(() => null);
    if (info && info.mtimeMs < limite && !emUso.has(nome.replace(/\.parte$/, ''))) await rm(cheio, { force: true });
  }
  for (const nome of await readdir(PUBLIC_REMOTO).catch(() => [])) {
    const cheio = path.join(PUBLIC_REMOTO, nome);
    const info = await stat(cheio).catch(() => null);
    if (info && info.mtimeMs < limite) await rm(cheio, { recursive: true, force: true });
  }
}

/* ---------- informações da máquina ---------- */

function git(args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: raiz, timeout: 60000, windowsHide: true }, (erro, saida, saidaErro) =>
      resolve({ ok: !erro, texto: String(saida || saidaErro || erro?.message || '').trim() }),
    );
  });
}

async function infoDaMaquina() {
  let gpu = null;
  try {
    gpu = JSON.parse((await readFile(path.join(raiz, 'server', 'config.json'), 'utf8')).replace(/^﻿/, '')).gpu ?? null;
  } catch {
    /* sem config do projeto */
  }
  let livre = null;
  try {
    const s = await statfs(raiz);
    livre = s.bavail * s.bsize;
  } catch {
    /* sem statfs */
  }
  const [uso, commit, ramo, sujos] = await Promise.all([
    usoDaMaquina(),
    git(['rev-parse', '--short', 'HEAD']),
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['status', '--porcelain']),
  ]);
  const lista = [...tarefas.values()];
  return {
    ok: true,
    nome: NOME,
    computador: os.hostname(),
    nucleos: os.cpus().length,
    processador: os.cpus()[0]?.model?.trim(),
    memoria: bytesLegiveis(os.totalmem()),
    gpu,
    discoLivre: livre === null ? null : bytesLegiveis(livre),
    uso,
    placa: uso.gpu?.nome ?? null,
    git: { commit: commit.texto, ramo: ramo.texto, alteracoesNaoSalvas: sujos.ok ? sujos.texto.split('\n').filter(Boolean).length : null },
    rodando: emExecucao ? resumo(tarefas.get(emExecucao.id)) : null,
    naFila: lista.filter((t) => t.status === 'aguardando').length,
  };
}

/* ---------- HTTP ---------- */

function responder(res, codigo, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(texto) });
  res.end(texto);
}

async function lerJson(req, limite = 200 * 1024 * 1024) {
  const pedacos = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > limite) throw Object.assign(new Error('pedido grande demais'), { codigo: 413 });
    pedacos.push(c);
  }
  return JSON.parse(Buffer.concat(pedacos).toString('utf8') || '{}');
}

async function receberArquivo(req, res, id) {
  const final = path.join(CACHE, id);
  if (existsSync(final)) {
    req.resume();
    return responder(res, 200, { ok: true, completo: true });
  }
  const parte = `${final}.parte`;
  const inicio = Number(req.headers['x-inicio'] ?? 0);
  const total = Number(req.headers['x-total']);
  if (!Number.isFinite(total) || total < 0) return responder(res, 400, { erro: 'falta x-total' });
  const atual = existsSync(parte) ? (await stat(parte)).size : 0;
  if (inicio > atual) {
    req.resume();
    return responder(res, 409, { erro: 'retomada fora de ordem', parcial: atual });
  }
  if (inicio === 0) await writeFile(parte, '');
  else await truncate(parte, inicio);
  await pipeline(req, createWriteStream(parte, { flags: 'r+', start: inicio }));
  const tamanho = (await stat(parte)).size;
  if (tamanho < total) return responder(res, 200, { ok: true, completo: false, parcial: tamanho });
  const hash = await hashDeArquivo(parte);
  if (hash !== id.slice(0, 64) || tamanho !== total) {
    await rm(parte, { force: true });
    return responder(res, 422, { erro: 'o arquivo chegou corrompido — mande de novo' });
  }
  await rename(parte, final);
  return responder(res, 200, { ok: true, completo: true });
}

async function servirArquivo(req, res, alvo) {
  const info = await stat(alvo);
  const faixa = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (faixa) {
    const inicio = faixa[1] ? Number(faixa[1]) : 0;
    const fim = faixa[2] ? Number(faixa[2]) : info.size - 1;
    if (inicio >= info.size) {
      res.writeHead(416, { 'content-range': `bytes */${info.size}` });
      return res.end();
    }
    res.writeHead(206, {
      'content-range': `bytes ${inicio}-${fim}/${info.size}`,
      'accept-ranges': 'bytes',
      'content-length': fim - inicio + 1,
      'content-type': 'application/octet-stream',
    });
    return pipeline(createReadStream(alvo, { start: inicio, end: fim }), res).catch(() => {});
  }
  res.writeHead(200, { 'content-length': info.size, 'accept-ranges': 'bytes', 'content-type': 'application/octet-stream' });
  return pipeline(createReadStream(alvo), res).catch(() => {});
}

async function rotas(req, res) {
  const url = new URL(req.url, 'http://estacao');
  const p = url.pathname;

  if (p === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Estação de render do Melhores Fimes. Use conexao/enviar.mjs.\n');
  }

  /*
   * Pareamento: o notebook manda o código de 6 dígitos que o configurar.mjs
   * mostrou aqui e recebe a senha. Vale uma vez, por 15 minutos, 5 tentativas.
   */
  if (p === '/parear' && req.method === 'POST') {
    const { codigo } = await lerJson(req, 10000).catch(() => ({}));
    const arquivo = await lerArquivoConfig();
    const par = arquivo.pareamento;
    if (!par || Date.now() > par.ate) {
      return responder(res, 410, { erro: 'não há código de pareamento ativo no PC de casa. Lá, rode: node conexao/configurar.mjs --parear' });
    }
    if (String(codigo ?? '') !== par.codigo) {
      errosDePareamento++;
      await new Promise((r) => setTimeout(r, 1500));
      if (errosDePareamento >= 5) {
        delete arquivo.pareamento;
        await gravarConfigRemoto(arquivo);
        errosDePareamento = 0;
        return responder(res, 403, { erro: 'código errado 5 vezes; o código foi cancelado. Gere outro no PC de casa.' });
      }
      return responder(res, 403, { erro: 'código errado' });
    }
    delete arquivo.pareamento;
    await gravarConfigRemoto(arquivo);
    errosDePareamento = 0;
    console.log(`${carimbo()}  🔗 novo computador pareado (${req.socket.remoteAddress})`);
    return responder(res, 200, { token: cfg.token, nome: NOME });
  }

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!tokenConfere(token, cfg.token)) {
    req.resume();
    return responder(res, 401, { erro: 'senha errada (token do conexao/config.json)' });
  }

  if (p === '/ping' && req.method === 'GET') return responder(res, 200, await infoDaMaquina());

  /* arquivos */
  let m = p.match(/^\/arquivo\/([^/]+)$/);
  if (m) {
    const id = m[1];
    if (!ID_VALIDO.test(id)) return responder(res, 400, { erro: 'id inválido' });
    if (req.method === 'GET') {
      const final = path.join(CACHE, id);
      if (existsSync(final)) return responder(res, 200, { tem: true });
      const parte = `${final}.parte`;
      return responder(res, 200, { tem: false, parcial: existsSync(parte) ? (await stat(parte)).size : 0 });
    }
    if (req.method === 'PUT') return receberArquivo(req, res, id);
  }

  /* código */
  if (p === '/codigo/comparar' && req.method === 'POST') {
    const { manifesto = {} } = await lerJson(req);
    const daqui = await manifestoDoCodigo(raiz);
    const diferentes = Object.keys(manifesto).filter((rel) => caminhoDeCodigoPermitido(rel) && daqui[rel] !== manifesto[rel]);
    const soAqui = Object.keys(daqui).filter((rel) => !(rel in manifesto));
    return responder(res, 200, { diferentes, soAqui });
  }
  if (p === '/codigo/receber' && req.method === 'POST') {
    if (emExecucao) return responder(res, 409, { erro: 'tem um render rodando agora; tente quando acabar' });
    const { arquivos = [] } = await lerJson(req);
    const pastaBackup = path.join(BACKUP_CODIGO, `${carimbo()}-${randomBytes(2).toString('hex')}`);
    const gravados = [];
    for (const { rel, conteudo } of arquivos) {
      if (!caminhoDeCodigoPermitido(rel)) return responder(res, 400, { erro: `não recebo ${rel}` });
      const destino = path.join(raiz, relSeguro(rel));
      if (existsSync(destino)) {
        await mkdir(path.dirname(path.join(pastaBackup, rel)), { recursive: true });
        await copyFile(destino, path.join(pastaBackup, rel));
      }
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, Buffer.from(conteudo, 'base64'));
      gravados.push(rel);
    }
    console.log(`↓ código do notebook: ${gravados.length} arquivo(s); backup em ${pastaBackup}`);
    return responder(res, 200, { ok: true, gravados, backup: pastaBackup });
  }
  if (p === '/codigo/atualizar' && req.method === 'POST') {
    if (emExecucao) return responder(res, 409, { erro: 'tem um render rodando agora; tente quando acabar' });
    const passos = [];
    for (const args of [['fetch', '--quiet'], ['pull', '--ff-only']]) {
      const r = await git(args);
      passos.push({ comando: `git ${args.join(' ')}`, ...r });
      if (!r.ok) break;
    }
    const ok = passos.every((x) => x.ok);
    if (ok) {
      const npm = await new Promise((resolve) =>
        execFile(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: raiz, timeout: 600000, windowsHide: true, shell: process.platform === 'win32' }, (e, o, se) =>
          resolve({ comando: 'npm install', ok: !e, texto: String(o || se || e?.message || '').trim().slice(-1500) }),
        ),
      );
      passos.push(npm);
    }
    return responder(res, ok ? 200 : 500, { ok, passos, ...(await infoDaMaquina()).git });
  }

  /* tarefas */
  if (p === '/tarefas' && req.method === 'GET') {
    const lista = [...tarefas.values()].sort((a, b) => b.criada - a.criada).slice(0, 50).map(resumo);
    return responder(res, 200, { tarefas: lista });
  }
  if (p === '/tarefas' && req.method === 'POST') {
    const pedido = await lerJson(req);
    if (!['render', 'script'].includes(pedido.tipo)) return responder(res, 400, { erro: 'tipo deve ser render ou script' });
    if (pedido.tipo === 'render' && (!pedido.projeto || !pedido.nomeSaida)) {
      return responder(res, 400, { erro: 'pedido de render sem projeto ou sem nomeSaida' });
    }
    if (pedido.tipo === 'script') {
      try {
        const rel = relSeguro(pedido.script ?? '');
        if (!existsSync(path.join(raiz, rel))) return responder(res, 400, { erro: `o script ${rel} não existe no PC de casa (falta git pull?)` });
      } catch (e) {
        return responder(res, 400, { erro: e.message });
      }
    }
    for (const a of pedido.arquivos ?? []) {
      if (!ID_VALIDO.test(a.id) || !existsSync(path.join(CACHE, a.id))) {
        return responder(res, 400, { erro: `o arquivo ${a.nome} ainda não chegou` });
      }
    }
    const id = `${carimbo()}-${randomBytes(3).toString('hex')}`;
    const t = {
      id,
      tipo: pedido.tipo,
      nome: String(pedido.nome ?? pedido.nomeSaida ?? pedido.script ?? id).slice(0, 120),
      origem: String(pedido.origem ?? '').slice(0, 80),
      criada: Date.now(),
      status: 'aguardando',
      progresso: 0,
      avisos: [],
      pedido,
    };
    await mkdir(pastaDa(id), { recursive: true });
    await salvar(t);
    tarefas.set(id, t);
    console.log(`+ ${id}  ${t.nome}  (de ${t.origem || '?'})`);
    setImmediate(avancarFila);
    return responder(res, 200, { ok: true, id, posicaoNaFila: posicaoNaFila(t) });
  }
  m = p.match(/^\/tarefas\/([\w-]+)$/);
  if (m) {
    const t = tarefas.get(m[1]);
    if (!t) return responder(res, 404, { erro: 'tarefa não encontrada' });
    if (req.method === 'GET') {
      let log = '';
      try {
        log = (await readFile(path.join(pastaDa(t.id), 'log.txt'), 'utf8')).slice(-3000);
      } catch {
        /* ainda sem log */
      }
      return responder(res, 200, { ...resumo(t), log });
    }
    if (req.method === 'DELETE') {
      if (t.status === 'aguardando') {
        t.status = 'cancelada';
        t.fim = Date.now();
        await salvar(t);
      } else if (t.status === 'rodando' && emExecucao?.id === t.id) {
        emExecucao.cancelado = true;
        if (emExecucao.filho) matarArvore(emExecucao.filho.pid);
      }
      return responder(res, 200, { ok: true, status: t.status });
    }
  }
  m = p.match(/^\/tarefas\/([\w-]+)\/resultado\/(.+)$/);
  if (m && req.method === 'GET') {
    const t = tarefas.get(m[1]);
    const nome = path.basename(decodeURIComponent(m[2]));
    const r = t?.resultados?.find((x) => x.nome === nome);
    if (!r) return responder(res, 404, { erro: 'resultado não encontrado' });
    return servirArquivo(req, res, path.join(pastaDa(t.id), r.pasta, r.nome));
  }

  return responder(res, 404, { erro: 'rota desconhecida' });
}

await carregarTarefas();
await limparAntigos().catch((e) => console.log('limpeza:', e.message));
setInterval(() => limparAntigos().catch(() => {}), 6 * 3600 * 1000).unref();

const servidor = http.createServer((req, res) => {
  rotas(req, res).catch((e) => {
    console.error('Erro:', req.method, req.url, '→', e.message);
    if (!res.headersSent) responder(res, e.codigo ?? 500, { erro: e.message });
    else res.destroy();
  });
});
// upload de vídeo grande pela internet de casa demora: sem limite de tempo por pedido
servidor.requestTimeout = 0;
servidor.timeout = 0;
servidor.keepAliveTimeout = 65000;

const host = cfg.escutar || '0.0.0.0';
servidor.listen(cfg.porta, host, () => {
  console.log(`\nEstação de render "${NOME}" pronta na porta ${cfg.porta}.`);
  const enderecos = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal);
  for (const i of enderecos) {
    const tailscale = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address);
    console.log(`  http://${i.address}:${cfg.porta}${tailscale ? '   ← Tailscale (use este de fora de casa)' : ''}`);
  }
  console.log(`  Pasta de trabalho: ${PASTA}`);
  console.log(`  Guardando arquivos por ${DIAS_GUARDAR} dias.\n`);
  void avancarFila();
});
servidor.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `A porta ${cfg.porta} já está em uso: a estação já está aberta?` : e.message);
  process.exit(1);
});
