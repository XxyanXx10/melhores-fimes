/**
 * Manda renders para o PC de casa (a estação) e traz o resultado de volta.
 *
 *   node conexao/enviar.mjs projeto/A.json [projeto/B.json ...]   renderiza e baixa em render/
 *       --still 90          um frame só (PNG), para conferir
 *       --segundos 0-10     só um trecho
 *       --alta | --gpu      as mesmas opções do render/render.mjs (a GPU liga sozinha se lá tiver NVIDIA;
 *       --sem-gpu           desliga)
 *       --sem-esperar       manda e volta; depois use --acompanhar
 *       --pasta <dir>       onde gravar o resultado (padrão: render/)
 *       --saida <arquivo>   nome exato do resultado (só com um projeto)
 *       --levar-codigo      se o template/código daqui for diferente do de lá, leva o daqui
 *       --ignorar-codigo    renderiza mesmo com o código diferente
 *       --pasta drive       grava o resultado na pasta Prontos do Google Drive
 *       --eventos           escreve o andamento em linhas "@@{json}" (é o que o painel lê)
 *
 *   node conexao/enviar.mjs --ping                    a estação está de pé? como ela está?
 *   node conexao/enviar.mjs --fila                    o que está na fila de lá
 *   node conexao/enviar.mjs --acompanhar <id> [...]   espera terminar e baixa
 *   node conexao/enviar.mjs --baixar <id>             só baixa (se já terminou)
 *   node conexao/enviar.mjs --cancelar <id>
 *   node conexao/enviar.mjs --atualizar-estacao       git pull + npm install lá (depois de dar push daqui)
 *   node conexao/enviar.mjs --script agente/x.mjs --arquivo "D:/video.mp4" -- {arquivo:0} --saida {saida}
 *   node conexao/enviar.mjs --pacote receita.json     leva pastas inteiras (sem git) e roda um comando lá
 */
import http from 'node:http';
import https from 'node:https';
import { createReadStream, createWriteStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  MemoriaDeHashes,
  aqui,
  bytesLegiveis,
  carimbo,
  cadaString,
  duracaoLegivel,
  idDoArquivo,
  lerConfigRemoto,
  manifestoDoCodigo,
  nomeSeguro,
  raiz,
} from './comum.mjs';

const PASTA_CLIENTE = path.join(aqui, '.cliente');
const ARQUIVO_ENVIOS = path.join(PASTA_CLIENTE, 'envios.json');
const TTY = process.stdout.isTTY;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- argumentos ---------- */

const argv = process.argv.slice(2);
const fimDosArgs = argv.indexOf('--');
const meus = fimDosArgs >= 0 ? argv.slice(0, fimDosArgs) : argv;
const repassados = fimDosArgs >= 0 ? argv.slice(fimDosArgs + 1) : [];
const COM_VALOR = new Set(['--still', '--segundos', '--pasta', '--saida', '--script', '--arquivo', '--acompanhar', '--baixar', '--cancelar', '--pacote']);
const opcoes = { arquivo: [] };
const soltos = [];
for (let i = 0; i < meus.length; i++) {
  const a = meus[i];
  if (a.startsWith('--')) {
    const nome = a.slice(2).replace(/-(\w)/g, (_, l) => l.toUpperCase());
    if (COM_VALOR.has(a)) {
      const v = meus[++i];
      if (v === undefined) sair(`${a} precisa de um valor`);
      if (nome === 'arquivo') opcoes.arquivo.push(v);
      else opcoes[nome] = v;
    } else opcoes[nome] = true;
  } else soltos.push(a);
}

/*
 * Com --eventos, o andamento sai também como linhas "@@{json}" para o painel
 * (conexao/painel.mjs). Progresso de upload/download vem no máximo 4x por segundo.
 */
const ultimoEvento = new Map();
function evento(obj, chave) {
  if (!opcoes.eventos) return;
  if (chave) {
    const agora = Date.now();
    if (agora - (ultimoEvento.get(chave) ?? 0) < 250 && obj.feito !== obj.total) return;
    ultimoEvento.set(chave, agora);
  }
  process.stdout.write('@@' + JSON.stringify({ ...obj, t: Date.now() }) + '\n');
}
let projetoAtual = null;

function sair(msg, codigo = 1) {
  evento({ e: 'erro', mensagem: msg, codigo });
  if (TTY) process.stdout.write('\n');
  console.error(`✗ ${msg}`);
  process.exit(codigo);
}

/* ---------- conversa com a estação ---------- */

const cfg = await lerConfigRemoto();
if (!cfg.servidor || !cfg.token) {
  sair('a conexão ainda não foi configurada neste computador. No PC de casa rode "node conexao/configurar.mjs" e, aqui, "node conexao/configurar.mjs --servidor <pc-de-casa> --codigo <código que ele mostrou>"');
}
const BASE = new URL(cfg.servidor.endsWith('/') ? cfg.servidor : cfg.servidor + '/');

function pedir(metodo, caminho, { json, corpo, cabecalhos = {}, tempo = 30000, fluxo = false } = {}) {
  const url = new URL(caminho.replace(/^\//, ''), BASE);
  const lib = url.protocol === 'https:' ? https : http;
  const headers = { authorization: `Bearer ${cfg.token}`, ...cabecalhos };
  let dados = null;
  if (json !== undefined) {
    dados = Buffer.from(JSON.stringify(json));
    headers['content-type'] = 'application/json';
    headers['content-length'] = dados.length;
  }
  return new Promise((resolve, reject) => {
    const req = lib.request(url, { method: metodo, headers }, (res) => {
      if (fluxo && res.statusCode < 300) return resolve({ status: res.statusCode, res });
      const pedacos = [];
      res.on('data', (c) => pedacos.push(c));
      res.on('error', reject);
      res.on('end', () => {
        const texto = Buffer.concat(pedacos).toString('utf8');
        let corpoJson = null;
        try {
          corpoJson = JSON.parse(texto);
        } catch {
          corpoJson = { erro: texto.slice(0, 300) };
        }
        resolve({ status: res.statusCode, dados: corpoJson });
      });
    });
    req.setTimeout(tempo, () => req.destroy(Object.assign(new Error('a estação não respondeu a tempo'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (dados) req.end(dados);
    else if (corpo) corpo.pipe(req);
    else req.end();
  });
}

async function pedirJson(metodo, caminho, op) {
  const r = await pedir(metodo, caminho, op);
  if (r.status === 401) sair('a senha (token) não bate com a da estação. Confira conexao/config.json nos dois computadores.');
  if (r.status >= 400) throw Object.assign(new Error(r.dados?.erro ?? `erro ${r.status}`), { status: r.status, dados: r.dados });
  return r.dados;
}

function explicarFalhaDeConexao(e) {
  return [
    `não consegui falar com a estação em ${BASE.origin} (${e.code ?? e.message}).`,
    'Confira, nesta ordem:',
    '  1. o PC de casa está ligado (e não dormindo)?',
    '  2. o Tailscale está conectado nos dois computadores?',
    '  3. a estação está aberta lá? (conexao/iniciar-estacao.bat)',
  ].join('\n');
}

async function conectar() {
  try {
    const info = await pedirJson('GET', '/ping', { tempo: 8000 });
    const gpu = info.gpu === true ? 'GPU ligada' : info.gpu === false ? 'GPU desligada no config' : 'GPU ?';
    console.log(`Conectado a "${info.nome}" — ${info.processador ?? '?'}, ${info.nucleos} núcleos, ${info.memoria}, ${gpu}, ${info.discoLivre ?? '?'} livres.`);
    evento({ e: 'conectado', info });
    if (info.rodando) console.log(`  Renderizando agora: ${info.rodando.nome} (${Math.round((info.rodando.progresso ?? 0) * 100)}%). Na fila: ${info.naFila}.`);
    return info;
  } catch (e) {
    if (e.status) throw e;
    sair(explicarFalhaDeConexao(e));
  }
}

/* ---------- linha de progresso (no terminal) ou marcos (no log do assistente) ---------- */

let ultimaLinha = '';
let ultimoMarco = '';
function progresso(linha, marco) {
  if (TTY) {
    process.stdout.write('\r' + linha.padEnd(Math.max(ultimaLinha.length, linha.length)));
    ultimaLinha = linha;
  } else if (marco !== ultimoMarco) {
    console.log(linha);
    ultimoMarco = marco;
  }
}
function fecharProgresso() {
  if (TTY && ultimaLinha) process.stdout.write('\n');
  ultimaLinha = '';
  ultimoMarco = '';
}

/* ---------- memória local dos envios ---------- */

async function lerEnvios() {
  try {
    return JSON.parse(await readFile(ARQUIVO_ENVIOS, 'utf8'));
  } catch {
    return {};
  }
}
async function anotarEnvio(id, dados) {
  const envios = await lerEnvios();
  envios[id] = { ...envios[id], ...dados };
  await mkdir(PASTA_CLIENTE, { recursive: true });
  await writeFile(ARQUIVO_ENVIOS, JSON.stringify(envios, null, 2), 'utf8');
}

/* ---------- quais arquivos o projeto usa ---------- */

function ehArquivo(c) {
  try {
    return statSync(c).isFile();
  } catch {
    return false;
  }
}

/**
 * Qualquer texto do projeto que seja um arquivo existente vai junto:
 * caminho absoluto (o vídeo-fonte), caminho relativo à raiz, ou
 * midia/... de dentro de public/ (fotos, sons, músicas, cenas).
 * Links http ficam como estão: a estação baixa sozinha.
 */
function acharArquivos(projeto) {
  const achados = new Map();
  cadaString(projeto, (s) => {
    if (achados.has(s) || s.length > 600 || /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || s.startsWith('data:')) return;
    if (!/\.[a-z0-9]{2,5}$/i.test(s)) return;
    if (path.isAbsolute(s) || /^[a-z]:[\\/]/i.test(s)) {
      if (ehArquivo(s)) achados.set(s, { tipo: 'absoluto', caminho: path.resolve(s) });
      return;
    }
    const rel = s.replace(/\\/g, '/').replace(/^\/+/, '');
    if (rel.startsWith('..')) return;
    const emPublic = path.join(raiz, 'public', rel);
    if (ehArquivo(emPublic)) achados.set(s, { tipo: 'public', caminho: emPublic, rel });
    else if (ehArquivo(path.join(raiz, rel))) achados.set(s, { tipo: 'absoluto', caminho: path.join(raiz, rel) });
  });
  /*
   * As cenas de logos guardam só o nome ("google" → midia/banco/logos/google.svg):
   * o caminho é montado no código da composição. Vão junto para existirem lá,
   * mas o texto do projeto não pode ser trocado.
   */
  const olharIcones = (v) => {
    if (Array.isArray(v)) return v.forEach(olharIcones);
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'icones' && Array.isArray(x)) {
        for (const nome of x) {
          if (typeof nome !== 'string' || !nome) continue;
          const arq = /\.(svg|png|jpe?g|webp)$/i.test(nome) ? nome : `${nome}.svg`;
          const rel = `midia/banco/logos/${arq}`;
          const cheio = path.join(raiz, 'public', rel);
          if (!achados.has(`\0${rel}`) && ehArquivo(cheio)) achados.set(`\0${rel}`, { tipo: 'public', caminho: cheio, rel, semTrocar: true });
        }
      } else olharIcones(x);
    }
  };
  olharIcones(projeto);
  return achados;
}

/* ---------- subir arquivos (só os que a estação ainda não tem) ---------- */

async function subir(id, caminho, tamanho, rotulo) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const estado = await pedirJson('GET', `/arquivo/${id}`);
      if (estado.tem) return false;
      const inicio = estado.parcial ?? 0;
      const t0 = Date.now();
      let enviados = 0;
      const leitura = createReadStream(caminho, { start: inicio });
      leitura.on('data', (c) => {
        enviados += c.length;
        const feito = inicio + enviados;
        const vel = enviados / Math.max(0.5, (Date.now() - t0) / 1000);
        const pct = Math.floor((feito / tamanho) * 100);
        evento({ e: 'subindo', arquivo: projetoAtual, nome: rotulo, feito, total: tamanho, vel }, 'sub');
        progresso(
          `  ↑ ${rotulo}: ${pct}% de ${bytesLegiveis(tamanho)} — ${bytesLegiveis(vel)}/s, falta ${duracaoLegivel((tamanho - feito) / vel)}`,
          `${rotulo}${Math.floor(pct / 20)}`,
        );
      });
      const r = await pedir('PUT', `/arquivo/${id}`, {
        corpo: leitura,
        cabecalhos: {
          'content-type': 'application/octet-stream',
          'content-length': tamanho - inicio,
          'x-inicio': inicio,
          'x-total': tamanho,
        },
        tempo: 120000,
      });
      if (r.status === 401) sair('a senha (token) não bate com a da estação.');
      if (r.status === 409) continue; // retomada fora de ordem: pergunta de novo onde parou
      if (r.status >= 400) throw new Error(r.dados?.erro ?? `erro ${r.status}`);
      if (r.dados.completo) {
        fecharProgresso();
        return true;
      }
    } catch (e) {
      fecharProgresso();
      if (tentativa >= 8) throw new Error(`não consegui mandar ${rotulo}: ${e.message}`);
      const s = Math.min(60, 5 * tentativa);
      console.log(`  conexão caiu mandando ${rotulo} (${e.code ?? e.message}). Retomo de onde parou em ${s}s…`);
      await espera(s * 1000);
    }
  }
}

async function prepararArquivos(achados, memoria) {
  const lista = [];
  for (const [original, a] of achados) {
    evento({ e: 'conferindo', arquivo: projetoAtual, nome: path.basename(a.caminho) }, 'conf');
    const { hash, tamanho } = await memoria.hash(a.caminho);
    lista.push({ original, ...a, hash, tamanho, id: idDoArquivo(hash, a.caminho), nome: path.basename(a.caminho) });
  }
  await memoria.salvar();
  const unicos = [...new Map(lista.map((a) => [a.id, a])).values()];
  const total = unicos.reduce((s, a) => s + a.tamanho, 0);
  let mandados = 0;
  let bytes = 0;
  for (const a of unicos) {
    if (await subir(a.id, a.caminho, a.tamanho, a.nome)) {
      mandados++;
      bytes += a.tamanho;
    }
  }
  evento({ e: 'arquivos', arquivo: projetoAtual, quantos: unicos.length, bytes: total, mandados, bytesMandados: bytes });
  console.log(
    `  ${unicos.length} arquivo(s), ${bytesLegiveis(total)}` +
      (!mandados
        ? ' — a estação já tinha todos.'
        : mandados === unicos.length
          ? ` — mandei todos (${bytesLegiveis(bytes)}).`
          : ` — mandei ${mandados} (${bytesLegiveis(bytes)}); os outros a estação já tinha.`),
  );
  return lista.map(({ original, tipo, rel, id, nome, semTrocar }) => ({ original, tipo, rel, id, nome, semTrocar }));
}

/* ---------- o código de lá é igual ao daqui? ---------- */

async function conferirCodigo() {
  const manifesto = await manifestoDoCodigo(raiz);
  const { diferentes } = await pedirJson('POST', '/codigo/comparar', { json: { manifesto } });
  evento({ e: 'codigo', diferentes, acao: !diferentes.length ? 'igual' : opcoes.levarCodigo ? 'levar' : opcoes.ignorarCodigo ? 'ignorar' : 'parar' });
  if (!diferentes.length) {
    console.log('  Código do render igual nos dois computadores.');
    return;
  }
  const lista = diferentes.slice(0, 12).map((r) => `    ${r}`).join('\n') + (diferentes.length > 12 ? `\n    … e mais ${diferentes.length - 12}` : '');
  if (opcoes.levarCodigo) {
    const arquivos = [];
    for (const rel of diferentes) arquivos.push({ rel, conteudo: (await readFile(path.join(raiz, rel))).toString('base64') });
    const r = await pedirJson('POST', '/codigo/receber', { json: { arquivos }, tempo: 60000 });
    console.log(`  Levei ${r.gravados.length} arquivo(s) de código para lá (o de lá ficou guardado em backup):\n${lista}`);
    return;
  }
  if (opcoes.ignorarCodigo) {
    console.log(`  ⚠ código diferente lá — o vídeo pode sair diferente da prévia:\n${lista}`);
    return;
  }
  sair(
    `o código que desenha o vídeo é diferente no PC de casa:\n${lista}\n` +
      'Escolha:\n' +
      '  --levar-codigo     copia estes arquivos daqui para lá (guarda backup dos de lá)\n' +
      '  --ignorar-codigo   renderiza com o código de lá mesmo\n' +
      '  ou dê commit + push aqui e rode: node conexao/enviar.mjs --atualizar-estacao',
    2,
  );
}

/* ---------- acompanhar e baixar ---------- */

async function baixar(idTarefa, r, destino) {
  await mkdir(path.dirname(destino), { recursive: true });
  const parte = `${destino}.parte`;
  for (let tentativa = 1; ; tentativa++) {
    try {
      const ja = existsSync(parte) ? (await stat(parte)).size : 0;
      if (ja >= r.tamanho) break;
      const { status, res, dados } = await pedir('GET', `/tarefas/${idTarefa}/resultado/${encodeURIComponent(r.nome)}`, {
        cabecalhos: ja ? { range: `bytes=${ja}-` } : {},
        fluxo: true,
        tempo: 120000,
      });
      if (status >= 400) throw new Error(dados?.erro ?? `erro ${status}`);
      const inicio = status === 206 ? ja : 0;
      const t0 = Date.now();
      let recebidos = 0;
      res.on('data', (c) => {
        recebidos += c.length;
        const feito = inicio + recebidos;
        const pct = Math.floor((feito / r.tamanho) * 100);
        const vel = recebidos / Math.max(0.5, (Date.now() - t0) / 1000);
        evento({ e: 'baixando', id: idTarefa, nome: r.nome, feito, total: r.tamanho, vel }, 'des' + idTarefa);
        progresso(`  ↓ ${r.nome}: ${pct}% de ${bytesLegiveis(r.tamanho)} — ${bytesLegiveis(vel)}/s`, `${r.nome}${Math.floor(pct / 25)}`);
      });
      await pipeline(res, createWriteStream(parte, { flags: inicio ? 'a' : 'w' }));
      fecharProgresso();
    } catch (e) {
      fecharProgresso();
      if (tentativa >= 8) throw new Error(`não consegui baixar ${r.nome}: ${e.message}`);
      console.log(`  conexão caiu baixando ${r.nome}. Retomo em ${5 * tentativa}s…`);
      await espera(5000 * tentativa);
    }
  }
  let final = destino;
  for (let n = 2; existsSync(final); n++) final = destino.replace(/(\.[^.]+)?$/, (ext) => `-${n}${ext}`);
  await rename(parte, final);
  return final;
}

async function trazerResultados(t, envio = {}) {
  const pasta = path.resolve(envio.pasta ?? path.join(raiz, 'render'));
  const salvos = [];
  for (const r of t.resultados ?? []) {
    const unico = (t.resultados.length === 1 && envio.destino) || path.join(pasta, r.nome);
    salvos.push(await baixar(t.id, r, path.resolve(unico)));
  }
  await anotarEnvio(t.id, { baixado: salvos });
  return salvos;
}

async function acompanhar(ids) {
  const envios = await lerEnvios();
  const faltam = new Set(ids);
  const resultado = { ok: [], falhas: [] };
  let semResposta = 0;
  while (faltam.size) {
    for (const id of [...faltam]) {
      let t;
      try {
        t = await pedirJson('GET', `/tarefas/${id}`);
        semResposta = 0;
      } catch (e) {
        if (e.status === 404) {
          fecharProgresso();
          console.log(`✗ ${id}: a estação não conhece esta tarefa.`);
          faltam.delete(id);
          resultado.falhas.push(id);
          continue;
        }
        if (e.status) throw e;
        semResposta++;
        if (semResposta === 1) {
          fecharProgresso();
          console.log(`  a estação parou de responder (${e.code ?? e.message}). Continuo tentando — o render segue lá.`);
        }
        if (semResposta > 200) sair(`desisti de esperar. Quando a estação voltar: node conexao/enviar.mjs --acompanhar ${[...faltam].join(' ')}`);
        continue;
      }
      const nome = t.nome;
      evento({ e: 'tarefa', id, status: t.status, progresso: t.progresso ?? 0, posicao: t.posicaoNaFila }, 'tar' + id);
      if (t.status === 'aguardando') {
        progresso(`  ${nome}: na fila (posição ${t.posicaoNaFila})`, `${id}fila${t.posicaoNaFila}`);
      } else if (t.status === 'rodando') {
        const pct = Math.round((t.progresso ?? 0) * 100);
        const decorrido = (Date.now() - t.inicio) / 1000;
        const falta = t.progresso > 0.02 ? ` — falta ~${duracaoLegivel(decorrido / t.progresso - decorrido)}` : '';
        progresso(`  ${nome}: renderizando no PC de casa… ${pct}%${falta}`, `${id}r${Math.floor(pct / 10)}`);
      } else {
        fecharProgresso();
        faltam.delete(id);
        for (const a of t.avisos ?? []) console.log(`  · ${a}`);
        if (t.status === 'concluida') {
          console.log(`✓ ${nome}: pronto em ${duracaoLegivel((t.fim - t.inicio) / 1000)}. Baixando…`);
          const salvos = await trazerResultados(t, envios[id]);
          for (const s of salvos) console.log(`  → ${s}`);
          evento({ e: 'baixado', id, salvos });
          resultado.ok.push(...salvos);
        } else {
          console.log(`✗ ${nome}: ${t.status}\n${(t.erro ?? '').split('\n').map((l) => `    ${l}`).join('\n')}`);
          resultado.falhas.push(id);
          evento({ e: 'falha', id, status: t.status, erro: t.erro ?? '' });
        }
      }
    }
    if (faltam.size) await espera(3000);
  }
  return resultado;
}

/* ---------- comandos ---------- */

function mostrarFila(lista) {
  if (!lista.length) return console.log('Fila vazia.');
  for (const t of lista) {
    const pct = t.status === 'rodando' ? ` ${Math.round((t.progresso ?? 0) * 100)}%` : '';
    const quando = new Date(t.criada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    console.log(`${t.id}  ${t.status.padEnd(10)}${pct.padEnd(5)}  ${quando}  ${t.nome}`);
  }
}

/* "--pasta drive" = a pasta Prontos do Google Drive (configurada por conexao/drive.mjs) */
if (opcoes.pasta && opcoes.pasta.toLowerCase() === 'drive') {
  if (!cfg.drive?.prontos) sair('a pasta do Google Drive ainda não foi configurada. Rode: node conexao/drive.mjs --configurar');
  opcoes.pasta = cfg.drive.prontos;
}

async function renderizar(arquivosProjeto) {
  if (opcoes.saida && arquivosProjeto.length > 1) sair('--saida só vale com um projeto; para vários use --pasta');
  const info = await conectar();
  /* estação com placa NVIDIA (a RTX 4060 de casa): usa a GPU, a não ser que peçam --sem-gpu */
  if (!opcoes.semGpu && !opcoes.gpu && /nvidia/i.test(info?.placa ?? '')) {
    opcoes.gpu = true;
    console.log(`  Usando a placa de vídeo de lá (${info.placa}).`);
  }
  await conferirCodigo();
  const memoria = await new MemoriaDeHashes(path.join(PASTA_CLIENTE, 'hashes.json')).carregar();
  const ids = [];
  for (const arquivo of arquivosProjeto) {
    if (!existsSync(arquivo)) sair(`projeto não encontrado: ${arquivo}`);
    const projeto = JSON.parse((await readFile(arquivo, 'utf8')).replace(/^\uFEFF/, ''));
    if (!projeto.video || !ehArquivo(path.resolve(raiz, projeto.video))) {
      sair(`${path.basename(arquivo)}: o vídeo do projeto não existe neste computador (${projeto.video})`);
    }
    const base = nomeSeguro(projeto.nome ?? path.basename(arquivo, '.json'));
    const nomeSaida = opcoes.saida
      ? path.basename(opcoes.saida)
      : opcoes.still !== undefined
        ? `${base}-frame${opcoes.still}.png`
        : opcoes.segundos
          ? `${base}-trecho${opcoes.segundos}-${carimbo()}.mp4`
          : `${base}-${carimbo()}.mp4`;
    console.log(`\n${path.basename(arquivo)}`);
    projetoAtual = path.resolve(arquivo);
    evento({ e: 'projeto', arquivo: projetoAtual, nome: base });
    const arquivos = await prepararArquivos(acharArquivos(projeto), memoria);
    const r = await pedirJson('POST', '/tarefas', {
      json: {
        tipo: 'render',
        nome: base,
        nomeSaida,
        origem: os.hostname(),
        projeto,
        arquivos,
        opcoes: { still: opcoes.still, segundos: opcoes.segundos, alta: !!opcoes.alta, gpu: !!opcoes.gpu },
      },
      tempo: 120000,
    });
    await anotarEnvio(r.id, {
      projeto: path.resolve(arquivo),
      criado: Date.now(),
      pasta: opcoes.pasta ? path.resolve(opcoes.pasta) : undefined,
      destino: opcoes.saida ? path.resolve(opcoes.saida) : undefined,
    });
    evento({ e: 'enfileirado', arquivo: projetoAtual, id: r.id, nome: base, posicao: r.posicaoNaFila });
    console.log(`  Na fila do PC de casa: ${r.id} (posição ${r.posicaoNaFila})`);
    ids.push(r.id);
  }
  return terminar(ids);
}

async function rodarScript() {
  await conectar();
  const memoria = await new MemoriaDeHashes(path.join(PASTA_CLIENTE, 'hashes.json')).carregar();
  const achados = new Map();
  for (const a of opcoes.arquivo) {
    if (!ehArquivo(a)) sair(`arquivo não encontrado: ${a}`);
    achados.set(a, { tipo: 'absoluto', caminho: path.resolve(a) });
  }
  console.log(`\n${opcoes.script}`);
  const arquivos = await prepararArquivos(achados, memoria);
  const r = await pedirJson('POST', '/tarefas', {
    json: { tipo: 'script', script: opcoes.script, args: repassados, arquivos, origem: os.hostname(), nome: path.basename(opcoes.script) },
  });
  await anotarEnvio(r.id, { script: opcoes.script, criado: Date.now(), pasta: opcoes.pasta ? path.resolve(opcoes.pasta) : undefined });
  console.log(`  Na fila do PC de casa: ${r.id}`);
  return terminar([r.id]);
}

/* ---------- pacote: pastas inteiras + um comando (ex.: os vídeos da CPS em vfx/cps) ---------- */

function globParaRegex(g) {
  const corpo = g
    .replace(/\\/g, '/')
    .split('**')
    .map((p) => p.replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]'))
    .join('.*');
  return new RegExp(`^${corpo}$`, 'i');
}

/** "quadros" ignora a pasta em qualquer nível; "edicao/previa_*" só aquele caminho */
function ignorador(padroes) {
  const res = padroes.map((p) => ({ re: globParaRegex(p.replace(/\/+$/, '')), comBarra: p.includes('/') }));
  return (rel) => {
    const partes = rel.split('/');
    return res.some(({ re, comBarra }) =>
      comBarra ? partes.some((_, i) => re.test(partes.slice(0, i + 1).join('/'))) : partes.some((p) => re.test(p)),
    );
  };
}

async function listarPasta(pasta, chave, ignorar, achados, rel = '') {
  const { readdir } = await import('node:fs/promises');
  for (const item of await readdir(path.join(pasta, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${item.name}` : item.name;
    if (ignorar(`${chave}/${r}`)) continue;
    if (item.isDirectory()) await listarPasta(pasta, chave, ignorar, achados, r);
    else if (item.isFile()) achados.push({ chave, rel: r, caminho: path.join(pasta, r) });
  }
}

/**
 * A receita (JSON) diz o que levar e o que rodar lá. Caminhos relativos são
 * relativos à pasta da receita. Exemplo em conexao/LEIAME.md, "Pacotes".
 */
async function rodarPacote(arquivoReceita) {
  if (!ehArquivo(arquivoReceita)) sair(`receita não encontrada: ${arquivoReceita}`);
  const receita = JSON.parse((await readFile(arquivoReceita, 'utf8')).replace(/^﻿/, ''));
  const base = path.dirname(path.resolve(arquivoReceita));
  const onde = (c) => path.resolve(base, c);
  if (!Array.isArray(receita.comando) || !receita.comando.length) sair('a receita não tem "comando"');
  const ignorar = ignorador([...(receita.ignorar ?? []), '__pycache__', '*.pyc', '.git', '*.parte']);

  await conectar();
  const nome = receita.nome ?? path.basename(arquivoReceita, '.json');
  console.log(`\n${nome}`);
  projetoAtual = path.resolve(arquivoReceita);
  evento({ e: 'projeto', arquivo: projetoAtual, nome });

  const itens = [];
  for (const [chave, dir] of Object.entries(receita.pastas ?? {})) {
    if (!/^[\w-]{1,40}$/.test(chave)) sair(`nome de pasta inválido na receita: "${chave}" (use letras, números, - ou _)`);
    const cheio = onde(dir);
    if (!existsSync(cheio) || !statSync(cheio).isDirectory()) sair(`pasta "${chave}" não existe: ${cheio}`);
    await listarPasta(cheio, chave, ignorar, itens);
  }
  for (const [chave, arq] of Object.entries(receita.arquivos ?? {})) {
    if (!/^[\w-]{1,40}$/.test(chave)) sair(`nome inválido na receita: "${chave}"`);
    const cheio = onde(arq);
    if (!ehArquivo(cheio)) sair(`arquivo "${chave}" não existe: ${cheio}`);
    itens.push({ chave, rel: path.basename(cheio), caminho: cheio, solto: true });
  }
  if (!itens.length) sair('a receita não leva nenhum arquivo');

  const memoria = await new MemoriaDeHashes(path.join(PASTA_CLIENTE, 'hashes.json')).carregar();
  const achados = new Map(itens.map((it) => [`${it.chave}/${it.rel}`, { tipo: 'pacote', caminho: it.caminho }]));
  const enviados = await prepararArquivos(achados, memoria);
  const porOriginal = new Map(enviados.map((a) => [a.original, a.id]));
  const arquivos = itens.map((it) => ({ chave: it.chave, rel: it.rel, solto: !!it.solto, id: porOriginal.get(`${it.chave}/${it.rel}`) }));

  const r = await pedirJson('POST', '/tarefas', {
    json: {
      tipo: 'pacote',
      nome,
      origem: os.hostname(),
      progresso: receita.progresso,
      pacote: { arquivos, comando: receita.comando, pasta: receita.pasta, trazer: receita.trazer, pastasVazias: Object.keys(receita.pastas ?? {}) },
    },
    tempo: 120000,
  });
  const entregar = opcoes.pasta ?? (receita.entregar ? onde(receita.entregar) : undefined);
  await anotarEnvio(r.id, { pacote: path.resolve(arquivoReceita), criado: Date.now(), pasta: entregar ? path.resolve(entregar) : undefined });
  evento({ e: 'enfileirado', arquivo: projetoAtual, id: r.id, nome, posicao: r.posicaoNaFila });
  console.log(`  Na fila do PC de casa: ${r.id} (posição ${r.posicaoNaFila})`);
  return terminar([r.id]);
}

async function terminar(ids) {
  if (opcoes.semEsperar) {
    console.log(`\nMandado. Para acompanhar e baixar depois:\n  node conexao/enviar.mjs --acompanhar ${ids.join(' ')}`);
    return;
  }
  console.log('');
  const { ok, falhas } = await acompanhar(ids);
  if (ids.length > 1) console.log(`\n${ok.length} pronto(s), ${falhas.length} com problema.`);
  if (falhas.length) process.exit(1);
}

try {
  if (opcoes.ping) {
    const info = await conectar();
    console.log(`  Código lá: ${info.git.ramo} @ ${info.git.commit}${info.git.alteracoesNaoSalvas ? ` (+${info.git.alteracoesNaoSalvas} alterações sem commit)` : ''}`);
  } else if (opcoes.fila) {
    mostrarFila((await pedirJson('GET', '/tarefas')).tarefas);
  } else if (opcoes.cancelar) {
    const r = await pedirJson('DELETE', `/tarefas/${opcoes.cancelar}`);
    console.log(`Pedido de cancelamento enviado (${r.status}).`);
  } else if (opcoes.baixar) {
    const t = await pedirJson('GET', `/tarefas/${opcoes.baixar}`);
    if (t.status !== 'concluida') sair(`a tarefa está "${t.status}", não "concluida".`);
    for (const s of await trazerResultados(t, (await lerEnvios())[t.id])) console.log(`→ ${s}`);
  } else if (opcoes.acompanhar) {
    await conectar();
    const ids = [opcoes.acompanhar, ...soltos];
    const { falhas } = await acompanhar(ids);
    if (falhas.length) process.exit(1);
  } else if (opcoes.atualizarEstacao) {
    console.log('Atualizando o código do PC de casa (git pull + npm install)…');
    const r = await pedirJson('POST', '/codigo/atualizar', { tempo: 15 * 60000 }).catch((e) => e.dados ?? sair(e.message));
    for (const p of r.passos ?? []) console.log(`${p.ok ? '✓' : '✗'} ${p.comando}\n${p.texto ? p.texto.split('\n').slice(-6).map((l) => `    ${l}`).join('\n') : ''}`);
    console.log(`Lá agora: ${r.ramo} @ ${r.commit}`);
    if (r.reiniciando) console.log('A estação recebeu código novo dela mesma e está reiniciando (volta em uns 10 a 30 s).');
    if (!r.ok) process.exit(1);
  } else if (opcoes.script) {
    await rodarScript();
  } else if (opcoes.pacote) {
    await rodarPacote(opcoes.pacote);
  } else if (soltos.length) {
    await renderizar(soltos);
  } else {
    console.log((await readFile(new URL(import.meta.url), 'utf8')).match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
  }
} catch (e) {
  if (e.code && !e.status) sair(explicarFalhaDeConexao(e));
  sair(e.message);
}
