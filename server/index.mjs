/**
 * Serviço local de transcrição.
 * Roda na sua máquina, chama o FFmpeg e o whisper.cpp que você já usa,
 * e devolve as palavras com tempo — o mesmo formato que a plataforma consome.
 *
 *   node server/index.mjs
 *
 * Nada sai do computador: o áudio nunca é enviado para lugar nenhum.
 */
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aplicarCorrecoes,
  conferirFerramentas,
  detectarCortes,
  detectarSilencios,
  lerConfig,
  lerCorrecoes,
  sondarVideo,
  transcreverVideo,
} from '../agente/nucleo.mjs';
import { cortarSilencios } from '../agente/cortar.mjs';
import { listarTakesDaPasta, montarTakes } from '../agente/montar.mjs';
import { gerarLoteDark, listarBibliotecaDark, listarNarracoesDaPasta } from '../agente/dark.mjs';
import { buscarIdeias, definirChamada, editarRoteiro, escreverRoteiros, lerIdeias, marcar, produzir } from '../agente/ideias.mjs';
import { execFile } from 'node:child_process';
import { buscarMidiasReaisParaTranscricao } from '../agente/cenas.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Serve a própria plataforma (pasta dist), para bastar um processo só.
 *
 * Precisa entender `Range`: sem isto, todo vídeo servido daqui (tela
 * dividida, fotos com vídeo) baixa inteiro a cada pedido e o navegador não
 * consegue buscar um ponto exato do arquivo — a busca do Remotion Player
 * trava em preto. O vídeo principal já tinha isto na própria rota dele;
 * faltava aqui, que é por onde passa tudo que mora em public/.
 */
async function servirEstatico(req, res, caminho) {
  const dist = path.join(aqui, '..', 'dist');
  let alvo = path.join(dist, caminho === '/' ? 'index.html' : decodeURIComponent(caminho));
  if (!alvo.startsWith(dist)) return json(res, 403, { erro: 'caminho inválido' });
  try {
    if (!(await stat(alvo)).isFile()) alvo = path.join(dist, 'index.html');
  } catch {
    alvo = path.join(dist, 'index.html');
  }
  const tipo = TIPOS[path.extname(alvo)] ?? 'application/octet-stream';
  try {
    const info = await stat(alvo);
    const faixa = req.headers.range;
    if (faixa) {
      const [de, ate] = faixa.replace(/bytes=/, '').split('-');
      const inicio = Number(de);
      const fim = ate ? Number(ate) : info.size - 1;
      res.writeHead(206, {
        'content-type': tipo,
        'content-range': `bytes ${inicio}-${fim}/${info.size}`,
        'accept-ranges': 'bytes',
        'content-length': fim - inicio + 1,
      });
      return createReadStream(alvo, { start: inicio, end: fim }).pipe(res);
    }
    res.writeHead(200, { 'content-type': tipo, 'accept-ranges': 'bytes', 'content-length': info.size });
    createReadStream(alvo).pipe(res);
  } catch {
    json(res, 404, { erro: 'a plataforma ainda não foi construída — rode: npm run build' });
  }
}

function json(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  });
  res.end(texto);
}

const cfg = await lerConfig();

/*
 * O render roda solto e anota o andamento em render/.estado.json.
 *
 * Guardar isso na memória do serviço foi erro: qualquer reinício (o
 * --watch reinicia a cada edição) matava o render e perdia o progresso.
 * Agora o filho é destacado e o estado vive em disco.
 */
const ARQUIVO_ESTADO = path.join(aqui, '..', 'render', '.estado.json');

async function lerEstadoRender() {
  try {
    return JSON.parse(await readFile(ARQUIVO_ESTADO, 'utf8'));
  } catch {
    return { rodando: false, progresso: 0, saida: null, erro: null };
  }
}

async function escreverEstadoRender(estado) {
  await mkdir(path.dirname(ARQUIVO_ESTADO), { recursive: true });
  await writeFile(ARQUIVO_ESTADO, JSON.stringify(estado), 'utf8');
}

async function iniciarRender(arquivoProjeto, nomeSaida) {
  const filho = spawn(
    process.execPath,
    [path.join(aqui, '..', 'render', 'render.mjs'), arquivoProjeto, '--saida', nomeSaida],
    { cwd: path.join(aqui, '..'), windowsHide: true, detached: true, stdio: 'ignore' },
  );
  /* o pid vai para o estado: é por ele que o cancelar encontra o processo */
  await escreverEstadoRender({
    rodando: true,
    progresso: 0,
    saida: null,
    erro: null,
    pid: filho.pid,
    inicio: Date.now(),
  });
  filho.unref();
}

/*
 * Fila de Exportação em Lote (Render Queue).
 * Permite enfileirar vários projetos (da Tela de Projetos ou do Canal Dark)
 * e exporta os MP4s em sequência automaticamente.
 */
let filaRender = [];
let checandoFila = false;

async function sincronizarEAvancarFila() {
  if (checandoFila) return;
  checandoFila = true;
  try {
    const estado = await lerEstadoRender();
    const atual = filaRender.find((x) => x.status === 'renderizando');

    if (atual) {
      if (estado.rodando) {
        atual.progresso = estado.progresso ?? 0;
        atual.inicio = estado.inicio ?? atual.inicio;
        return;
      }
      // Terminou ou falhou
      if (estado.saida && !estado.erro) {
        atual.status = 'pronto';
        atual.progresso = 1;
        atual.saida = estado.saida;
      } else {
        atual.status = 'erro';
        atual.erro = estado.erro ?? 'Render interrompido';
      }
    }

    // Se ainda houver um render avulso rodando fora da fila, espera terminar
    if (estado.rodando) return;

    const proximo = filaRender.find((x) => x.status === 'aguardando');
    if (!proximo) return;

    const caminhoProjeto = path.join(aqui, '..', 'projeto', path.basename(proximo.arquivo));
    if (!existsSync(caminhoProjeto)) {
      proximo.status = 'erro';
      proximo.erro = 'Arquivo de projeto não encontrado';
      return;
    }

    const pJson = JSON.parse(await readFile(caminhoProjeto, 'utf8'));
    if (!pJson.video || !existsSync(pJson.video)) {
      proximo.status = 'erro';
      proximo.erro = 'Vídeo de origem não encontrado no disco';
      return;
    }

    const base = path.basename(proximo.arquivo, '.json').replace(/[^\w.-]/g, '_');
    const agora = new Date();
    const carimbo = [
      agora.getFullYear(),
      String(agora.getMonth() + 1).padStart(2, '0'),
      String(agora.getDate()).padStart(2, '0'),
      '-',
      String(agora.getHours()).padStart(2, '0'),
      String(agora.getMinutes()).padStart(2, '0'),
    ].join('');
    const saida = path.join(aqui, '..', 'render', `${base}-${carimbo}.mp4`);

    proximo.status = 'renderizando';
    proximo.progresso = 0;
    proximo.inicio = Date.now();
    await iniciarRender(caminhoProjeto, saida);
  } catch (e) {
    console.error('Erro na fila de render:', e?.message ?? e);
  } finally {
    checandoFila = false;
  }
}

setInterval(() => {
  if (filaRender.some((x) => x.status === 'aguardando' || x.status === 'renderizando')) {
    void sincronizarEAvancarFila();
  }
}, 2000);

async function enfileirarRenders(arquivos) {
  const pasta = path.join(aqui, '..', 'projeto');
  for (const arq of arquivos) {
    const limpo = path.basename(String(arq));
    if (!limpo.endsWith('.json')) continue;
    if (filaRender.some((x) => x.arquivo === limpo && (x.status === 'aguardando' || x.status === 'renderizando'))) {
      continue;
    }
    let nomeExibicao = limpo.replace(/\.json$/i, '');
    try {
      const j = JSON.parse(await readFile(path.join(pasta, limpo), 'utf8'));
      nomeExibicao = j.nomeProjeto ?? j.nome ?? nomeExibicao;
    } catch {
      /* mantém nome do arquivo */
    }
    filaRender.push({
      id: `fr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      arquivo: limpo,
      nome: nomeExibicao,
      status: 'aguardando',
      progresso: 0,
      saida: null,
      erro: null,
    });
  }
  await sincronizarEAvancarFila();
}

/*
 * Histórico de versões.
 *
 * O salvamento automático grava a cada poucos segundos; versionar tudo encheria
 * o disco de cópias iguais. Guardamos uma a cada VINTE minutos de trabalho, e
 * ficamos com as vinte últimas — o suficiente para voltar de um estrago sem
 * virar um museu.
 */
const ESPACO_ENTRE_VERSOES = 20 * 60 * 1000;
const VERSOES_GUARDADAS = 20;

function pastaDeVersoes(arquivo) {
  return path.join(aqui, '..', 'projeto', '.versoes', path.basename(arquivo, '.json'));
}

async function guardarVersao(arquivo, caminhoAtual, forcar = false) {
  if (!existsSync(caminhoAtual)) return; // primeiro salvamento: não há o que guardar
  try {
    const pasta = pastaDeVersoes(arquivo);
    await mkdir(pasta, { recursive: true });
    const existentes = (await readdir(pasta)).filter((n) => n.endsWith('.json')).sort();

    const ultima = existentes[existentes.length - 1];
    if (ultima && !forcar) {
      const quando = Number(path.basename(ultima, '.json'));
      if (Number.isFinite(quando) && Date.now() - quando < ESPACO_ENTRE_VERSOES) return;
    }

    await copyFile(caminhoAtual, path.join(pasta, `${Date.now()}.json`));

    const sobrando = [...existentes, 'novo'].length - VERSOES_GUARDADAS;
    for (let i = 0; i < sobrando; i++) {
      await rm(path.join(pasta, existentes[i]), { force: true });
    }
  } catch {
    /* não conseguir versionar nunca pode impedir o usuário de salvar */
  }
}

/** vira nome de arquivo seguro: "Reajuste ANS — gancho" -> "Reajuste ANS - gancho.json" */
function nomeDeArquivo(bruto) {
  const limpo = String(bruto)
    .replace(/\.json$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${limpo || 'projeto'}.json`;
}

/* Como nomeDeArquivo, mas nunca pisa num arquivo que já existe. */
async function nomeDeArquivoLivre(pasta, bruto) {
  const base = nomeDeArquivo(bruto).replace(/\.json$/i, '');
  let tentativa = `${base}.json`;
  let n = 2;
  while (existsSync(path.join(pasta, tentativa))) {
    tentativa = `${base}-${n}.json`;
    n++;
  }
  return tentativa;
}

/*
 * Alguns componentes codificam o endereço mais de uma vez, e "Corte 15.json"
 * chega como "Corte%2520 15.json". Decodificamos até parar de mudar, senão
 * projeto com espaço ou acento no nome simplesmente não abre o vídeo.
 */
function nomePedido(caminho) {
  let atual = caminho;
  for (let i = 0; i < 3; i++) {
    let proximo;
    try {
      proximo = decodeURIComponent(atual);
    } catch {
      break;
    }
    if (proximo === atual) break;
    atual = proximo;
  }
  return path.basename(atual);
}

/** andamento da montagem em curso — uma por vez, porque cada uma usa a máquina inteira */
let montagemEmCurso = null;

/** andamento da criação em lote do Canal Dark */
let loteDarkEmCurso = null;
/** andamento da aba Ideias (busca, roteiros, produção) */
let ideiasEmCurso = { etapa: 'parado' };

/** balão de aviso no Windows quando um trabalho longo termina */
function avisarWindows(titulo, texto) {
  const t = (x) => String(x).replace(/'/g, "''");
  const ps = `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(10000, '${t(titulo)}', '${t(texto)}', 'Info'); Start-Sleep 11; $n.Dispose()`;
  execFile('powershell', ['-NoProfile', '-Command', ps], () => {});
}

/** roda um trabalho da aba Ideias em segundo plano, um por vez */
function trabalhoIdeias(nome, fn) {
  if (ideiasEmCurso.etapa === 'rodando') return false;
  ideiasEmCurso = { etapa: 'rodando', nome, detalhe: 'Começando…' };
  fn((p) => (ideiasEmCurso = { ...ideiasEmCurso, ...p }))
    .then((r) => {
      ideiasEmCurso = { etapa: 'pronto', nome, detalhe: 'Concluído', resultado: r };
      if (nome === 'produzir') avisarWindows('Melhores Fimes', 'Áudios e vídeos base prontos — falta montar as cenas.');
    })
    .catch((e) => (ideiasEmCurso = { etapa: 'erro', nome, erro: e.message }));
  return true;
}

async function lerCorpo(req) {
  const pedacos = [];
  for await (const c of req) pedacos.push(c);
  return pedacos.length ? JSON.parse(Buffer.concat(pedacos).toString('utf8')) : {};
}

/**
 * Silêncios já medidos, por caminho de vídeo — a promessa em si, não só o
 * resultado, para duas chamadas em cima do mesmo vídeo (o React monta o
 * componente duas vezes em desenvolvimento) não disparem o FFmpeg duas
 * vezes em paralelo. Vive só na memória: se o serviço reiniciar, mede nulo.
 */
const cacheSilencios = new Map();

const servidor = createServer((req, res) => {
  /*
   * Qualquer erro solto aqui dentro derrubava o processo: o usuário perdia o
   * serviço no meio do trabalho, com a plataforma aberta na tela. Agora a
   * requisição falha sozinha e o resto continua de pé.
   */
  atender(req, res).catch((e) => {
    console.error('Erro ao atender', req.method, req.url, '→', e?.message ?? e);
    if (!res.headersSent) json(res, 500, { erro: e?.message ?? 'erro inesperado' });
    else res.end();
  });
});

async function atender(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') return json(res, 204, {});

  /* ==================================================================
   * ABA CANAL DARK & FILA DE EXPORTAÇÃO EM LOTE
   * ================================================================== */

  /* ==================== ABA IDEIAS DE CONTEÚDO ==================== */
  if (url.pathname === '/ideias' && req.method === 'GET') {
    return json(res, 200, { ...(await lerIdeias()), andamento: ideiasEmCurso });
  }
  if (url.pathname === '/ideias/buscar' && req.method === 'POST') {
    const ok = trabalhoIdeias('buscar', async (andar) => {
      andar({ detalhe: 'Lendo as notícias e pedindo notas ao Gemini…' });
      return buscarIdeias();
    });
    return json(res, ok ? 200 : 409, ok ? { ok } : { erro: 'já tem um trabalho rodando' });
  }
  if (url.pathname === '/ideias/marcar' && req.method === 'POST') {
    const { ids, status } = await lerCorpo(req);
    await marcar(ids ?? [], status);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/ideias/chamada' && req.method === 'POST') {
    const { id, comChamada } = await lerCorpo(req);
    await definirChamada(id, comChamada);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/ideias/roteiro' && req.method === 'POST') {
    const { id, roteiro } = await lerCorpo(req);
    await editarRoteiro(id, roteiro);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/ideias/roteiros' && req.method === 'POST') {
    const { ids } = await lerCorpo(req);
    const ok = trabalhoIdeias('roteiros', (andar) => escreverRoteiros(ids ?? [], andar));
    return json(res, ok ? 200 : 409, ok ? { ok } : { erro: 'já tem um trabalho rodando' });
  }
  if (url.pathname === '/ideias/produzir' && req.method === 'POST') {
    const { ids } = await lerCorpo(req);
    const ok = trabalhoIdeias('produzir', (andar) => produzir(ids ?? [], andar));
    return json(res, ok ? 200 : 409, ok ? { ok } : { erro: 'já tem um trabalho rodando' });
  }

  if (url.pathname === '/dark/biblioteca' && req.method === 'GET') {
    try {
      const pasta = url.searchParams.get('pasta')?.trim() || undefined;
      const bib = await listarBibliotecaDark(pasta);
      return json(res, 200, bib);
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/dark/narracoes' && req.method === 'GET') {
    try {
      const pasta = url.searchParams.get('pasta')?.trim();
      if (!pasta) return json(res, 400, { erro: 'informe o caminho da pasta' });
      if (!existsSync(pasta) || !(await stat(pasta)).isDirectory()) {
        return json(res, 404, { erro: 'pasta não encontrada no computador' });
      }
      const itens = await listarNarracoesDaPasta(pasta);
      return json(res, 200, { pasta, itens });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/dark/upload-narracao' && req.method === 'POST') {
    const bruto = url.searchParams.get('nome') ?? 'narracao.mp3';
    const nome = path.basename(bruto).replace(/[^\w.\- ()áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/g, '_');
    try {
      const pasta = path.join(aqui, '..', 'render', '.fontes', 'narracoes');
      await mkdir(pasta, { recursive: true });
      const alvo = path.join(pasta, `${Date.now()}-${nome}`);
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const buf = Buffer.concat(pedacos);
      await writeFile(alvo, buf);
      return json(res, 200, { caminho: alvo, nome: bruto, tamanho: buf.length });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/dark/lote' && req.method === 'POST') {
    if (loteDarkEmCurso && loteDarkEmCurso.etapa === 'processando') {
      return json(res, 409, { erro: 'já existe uma geração de lote em andamento' });
    }
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const { arquivos, opcoes } = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!Array.isArray(arquivos) || !arquivos.length) {
        return json(res, 400, { erro: 'nenhum arquivo de narração enviado' });
      }
      loteDarkEmCurso = {
        etapa: 'processando',
        atual: 0,
        total: arquivos.length,
        nome: '',
        detalhe: 'Iniciando fábrica de vídeos…',
        criados: [],
        erro: null,
      };
      json(res, 200, { ok: true, total: arquivos.length });

      gerarLoteDark(arquivos, {
        ...(opcoes ?? {}),
        aoAndar: (progresso) => {
          loteDarkEmCurso = { ...loteDarkEmCurso, ...progresso };
        },
      })
        .then(async (criados) => {
          loteDarkEmCurso = {
            etapa: 'pronto',
            atual: arquivos.length,
            total: arquivos.length,
            nome: '',
            detalhe: 'Todos os projetos foram criados!',
            criados,
            erro: null,
          };
          if (opcoes?.exportarFila && criados.length) {
            await enfileirarRenders(criados.map((c) => c.arquivoProjeto));
          }
        })
        .catch((e) => {
          loteDarkEmCurso = {
            etapa: 'erro',
            atual: loteDarkEmCurso?.atual ?? 0,
            total: arquivos.length,
            nome: loteDarkEmCurso?.nome ?? '',
            detalhe: '',
            criados: loteDarkEmCurso?.criados ?? [],
            erro: e.message ?? 'Erro ao gerar lote Dark',
          };
        });
      return;
    } catch (e) {
      loteDarkEmCurso = null;
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/dark/lote' && req.method === 'GET') {
    return json(res, 200, loteDarkEmCurso ?? { etapa: 'parado' });
  }

  if (url.pathname === '/fila-render' && req.method === 'GET') {
    await sincronizarEAvancarFila();
    return json(res, 200, { fila: filaRender });
  }

  if (url.pathname === '/fila-render' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const { arquivos } = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!Array.isArray(arquivos) || !arquivos.length) {
        return json(res, 400, { erro: 'informe ao menos um projeto para exportar' });
      }
      await enfileirarRenders(arquivos);
      return json(res, 200, { ok: true, fila: filaRender });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/fila-render' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    const limparConcluidos = url.searchParams.get('limpar') === '1';
    if (limparConcluidos) {
      filaRender = filaRender.filter((x) => x.status === 'aguardando' || x.status === 'renderizando');
      return json(res, 200, { ok: true, fila: filaRender });
    }
    if (id) {
      const item = filaRender.find((x) => x.id === id);
      if (item && item.status === 'aguardando') {
        filaRender = filaRender.filter((x) => x.id !== id);
      }
      return json(res, 200, { ok: true, fila: filaRender });
    }
    // Cancela todos os aguardando
    filaRender = filaRender.map((x) => (x.status === 'aguardando' ? { ...x, status: 'cancelado' } : x));
    return json(res, 200, { ok: true, fila: filaRender });
  }

  /*
   * Abrir um projeto inteiro pela plataforma.
   *
   * O navegador não abre arquivo do disco por caminho, mas o serviço local
   * abre. Assim o usuário escolhe o projeto numa lista e recebe legenda,
   * ajustes E o vídeo — sem precisar arrastar nada.
   */
  /*
   * Montar um vídeo a partir de vários takes.
   *
   * O usuário grava frase a frase, cada take começando com a claquete falada.
   * Aqui os arquivos já foram enviados um a um; esta rota transcreve, tira a
   * claquete e os silêncios, cola tudo em ordem e devolve o projeto pronto.
   *
   * É demorado (uma transcrição por take), então o andamento vai para disco e
   * pode ser consultado enquanto roda.
   */
  /*
   * Os takes de uma pasta, já em ordem — sem passar pelo navegador.
   *
   * Os arquivos já estão na máquina; reenviá-los por HTTP só para montar
   * seria copiar gigabytes à toa. O serviço lê a pasta direto e devolve os
   * caminhos absolutos, prontos para ir para /montar.
   */
  if (url.pathname === '/pasta-de-takes' && req.method === 'GET') {
    try {
      const pasta = url.searchParams.get('pasta')?.trim();
      if (!pasta) return json(res, 400, { erro: 'informe o caminho da pasta' });
      if (!existsSync(pasta) || !(await stat(pasta)).isDirectory()) {
        return json(res, 404, { erro: 'não encontrei essa pasta' });
      }
      const ordem = url.searchParams.get('ordem') === 'nome' ? 'nome' : 'data';
      const takes = await listarTakesDaPasta(pasta, { ordem });
      if (!takes.length) return json(res, 200, { pasta, ordem, takes: [] });
      return json(res, 200, { pasta, ordem, takes });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/montar' && req.method === 'POST') {
    if (montagemEmCurso) return json(res, 409, { erro: 'já tem uma montagem em andamento' });
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const { arquivos, nome, silencioMinimo } = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!Array.isArray(arquivos) || !arquivos.length) {
        return json(res, 400, { erro: 'nenhum take recebido' });
      }
      montagemEmCurso = { etapa: 'começando', take: 0, de: arquivos.length };
      /* responde na hora: quem chamou acompanha por /montar (GET) */
      json(res, 200, { ok: true, takes: arquivos.length });

      montarTakes(arquivos, {
        nome,
        silencioMinimo: Number(silencioMinimo) > 0 ? Number(silencioMinimo) : undefined,
        aoAndar: (e) => (montagemEmCurso = { ...e, de: e.de ?? arquivos.length }),
      })
        .then((r) => (montagemEmCurso = { etapa: 'pronto', resultado: r }))
        .catch((e) => (montagemEmCurso = { etapa: 'erro', erro: e.message }));
      return;
    } catch (e) {
      montagemEmCurso = null;
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/montar' && req.method === 'GET') {
    return json(res, 200, montagemEmCurso ?? { etapa: 'parado' });
  }

  /*
   * Os silêncios reais de um vídeo, medidos no áudio.
   *
   * Usado tanto pela prévia (o número que aparece antes de cortar) quanto,
   * por baixo, pelo corte de verdade — os dois têm que concordar. Cacheado
   * em memória pelo caminho do arquivo: o controle de limiar na tela muda o
   * que conta como "silêncio grande o bastante" sem precisar medir de novo,
   * então aqui sempre mede tudo (bem miúdo) e quem filtra é quem chamou.
   */
  if (url.pathname === '/silencios' && req.method === 'GET') {
    try {
      const video = url.searchParams.get('video')?.trim();
      if (!video) return json(res, 400, { erro: 'informe o caminho do vídeo' });
      if (!existsSync(video)) return json(res, 404, { erro: 'não encontrei esse vídeo' });

      if (!cacheSilencios.has(video)) {
        cacheSilencios.set(video, detectarSilencios(cfg, video));
      }
      const silencios = await cacheSilencios.get(video);
      return json(res, 200, { silencios });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /*
   * Corte automático dos silêncios.
   *
   * Reescreve o projeto apontando para o vídeo cortado; o original fica
   * guardado em videoOriginal, então dá para refazer o corte com outro
   * limiar sem perder nada.
   */
  if (url.pathname === '/cortar-silencios' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const { arquivo, silencioMinimo } = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      const caminho = path.join(aqui, '..', 'projeto', path.basename(arquivo ?? ''));
      if (!existsSync(caminho)) return json(res, 404, { erro: 'projeto não encontrado' });

      const r = await cortarSilencios(caminho, {
        silencioMinimo: Number(silencioMinimo) > 0 ? Number(silencioMinimo) : undefined,
      });
      return json(res, 200, r);
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Correções que se repetem em todo vídeo: "INS" -> "ANS", nomes de clientes. */
  if (url.pathname === '/correcoes' && req.method === 'GET') {
    return json(res, 200, { correcoes: await lerCorrecoes() });
  }

  if (url.pathname === '/correcoes' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const lista = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!Array.isArray(lista)) return json(res, 400, { erro: 'esperava uma lista' });
      const limpa = lista
        .filter((c) => c && typeof c.de === 'string' && typeof c.para === 'string')
        .map((c) => ({ de: c.de.trim(), para: c.para.trim() }))
        .filter((c) => c.de && c.para);
      await writeFile(path.join(aqui, '..', 'correcoes.json'), JSON.stringify(limpa, null, 2), 'utf8');
      return json(res, 200, { ok: true, correcoes: limpa });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Aplicar as correções numa legenda que já existe. */
  if (url.pathname === '/corrigir' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const { palavras } = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!Array.isArray(palavras)) return json(res, 400, { erro: 'esperava palavras' });
      return json(res, 200, { palavras: aplicarCorrecoes(palavras, await lerCorrecoes()) });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Busca imagens/cenas reais da Web correspondentes ao que está sendo falado na legenda */
  if (url.pathname === '/dark/cenas-reais' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const { palavras, duracao, intervaloCena, formato } = JSON.parse(
        Buffer.concat(pedacos).toString('utf8'),
      );
      if (!Array.isArray(palavras) || !palavras.length) {
        return json(res, 400, { erro: 'Nenhuma palavra na legenda para buscar cenas.' });
      }
      const cenas = await buscarMidiasReaisParaTranscricao(palavras, Number(duracao) || 30, {
        intervaloCena: Number(intervaloCena) || 5.2,
        formato: formato ?? '9:16',
        pexelsKey: cfg.pexelsKey,
      });
      const fotosGeradas = cenas
        .filter((c) => c.imagemWeb?.src)
        .map((c, idx) => ({
          id: `f_real_${Date.now()}_${idx}`,
          src: c.imagemWeb.src,
          start: +(c.start + 0.15).toFixed(2),
          duracao: Math.max(2.0, Math.min(3.8, +(c.duracao - 0.35).toFixed(2))),
          entrada: idx % 2 === 0 ? 'escala' : 'sobe',
          largura: formato === '16:9' ? 46 : 74,
          x: 50,
          y: formato === '16:9' ? 34 : 26,
          rotulo: c.rotulo,
        }));
      return json(res, 200, { ok: true, cenas, fotos: fotosGeradas });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Estilos de marca salvos, para aplicar em série. */
  if (url.pathname === '/presets' && req.method === 'GET') {
    try {
      const pasta = path.join(aqui, '..', 'presets');
      const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.json'));
      const lista = [];
      for (const nome of nomes) {
        try {
          lista.push(JSON.parse(await readFile(path.join(pasta, nome), 'utf8')));
        } catch {
          /* preset ilegível fica de fora */
        }
      }
      return json(res, 200, { presets: lista });
    } catch {
      return json(res, 200, { presets: [] });
    }
  }

  if (url.pathname === '/presets' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const preset = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!preset?.nome) return json(res, 400, { erro: 'o preset precisa de um nome' });
      preset.id = preset.id || `p${Date.now()}`;
      const pasta = path.join(aqui, '..', 'presets');
      await mkdir(pasta, { recursive: true });
      await writeFile(path.join(pasta, `${preset.id}.json`), JSON.stringify(preset, null, 2), 'utf8');
      return json(res, 200, { ok: true, preset });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname.startsWith('/presets/') && req.method === 'DELETE') {
    const id = path.basename(decodeURIComponent(url.pathname)).replace(/[^\w.-]/g, '');
    try {
      await rm(path.join(aqui, '..', 'presets', `${id}.json`), { force: true });
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/projetos' && req.method === 'GET') {
    try {
      const pasta = path.join(aqui, '..', 'projeto');
      const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.json'));
      const lista = [];
      for (const nome of nomes) {
        try {
          const caminho = path.join(pasta, nome);
          const j = JSON.parse(await readFile(caminho, 'utf8'));
          const info = await stat(caminho);
          const mp4 = path.join(aqui, '..', 'render', `${path.basename(nome, '.json')}.mp4`);
          lista.push({
            arquivo: nome,
            /* o nome que o usuário deu; o do vídeo é só o segundo melhor */
            nome: j.nomeProjeto ?? j.nome ?? nome,
            arquivoVideo: j.nome ?? null,
            duracao: j.duracao ?? 0,
            palavras: (j.palavras ?? []).length,
            temVideo: !!j.video && existsSync(j.video),
            atualizado: info.mtimeMs,
            exportado: existsSync(mp4),
            template: j.template ?? null,
          });
        } catch {
          /* projeto ilegível: fica de fora da lista */
        }
      }
      return json(res, 200, { projetos: lista });
    } catch {
      return json(res, 200, { projetos: [] });
    }
  }

  /*
   * Gravar o projeto na pasta da máquina.
   *
   * Antes, "Salvar projeto" só baixava um arquivo para a pasta de Downloads:
   * o trabalho saía de onde a plataforma procura e se perdia.
   */
  if (url.pathname === '/projetos' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const corpo = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      const projeto = corpo.projeto ?? corpo;
      if (!Array.isArray(projeto.palavras)) {
        return json(res, 400, { erro: 'projeto sem palavras' });
      }
      const pasta = path.join(aqui, '..', 'projeto');
      await mkdir(pasta, { recursive: true });
      /*
       * `corpo.arquivo` só vem preenchido quando o cliente já sabe em qual
       * arquivo esse projeto mora (reabriu, ou já salvou antes) — aí sim
       * sobrescreve. Sem ele, é um projeto novo que nunca foi salvo: se dois
       * vídeos tiverem o mesmo nome (ex.: "corte.mp4" de gravações
       * diferentes), o nome derivado colide, e um salvava por cima do
       * outro sem avisar. Agora gera um nome livre em vez de arriscar.
       */
      const arquivo = corpo.arquivo
        ? nomeDeArquivo(corpo.arquivo)
        : await nomeDeArquivoLivre(pasta, projeto.nomeProjeto ?? projeto.nome ?? 'projeto');
      const caminho = path.join(pasta, arquivo);
      /* voltar para uma versão antiga guarda o estado atual antes, sempre */
      await guardarVersao(arquivo, caminho, url.searchParams.get('versionar') === '1');
      await writeFile(caminho, JSON.stringify(projeto, null, 2), 'utf8');
      return json(res, 200, { ok: true, arquivo });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Apagar um projeto: vai para projeto/.lixeira, não some de vez. */
  if (url.pathname.startsWith('/projetos/') && req.method === 'DELETE') {
    const nome = nomePedido(url.pathname);
    try {
      const pasta = path.join(aqui, '..', 'projeto');
      const lixeira = path.join(pasta, '.lixeira');
      await mkdir(lixeira, { recursive: true });
      await rename(path.join(pasta, nome), path.join(lixeira, `${Date.now()}-${nome}`));
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 404, { erro: e.message });
    }
  }

  /*
   * Miniatura do projeto: um quadro do vídeo, tirado com o FFmpeg.
   *
   * Não usa o render do Remotion de propósito — abrir a lista de projetos
   * não pode depender de subir um Chrome para cada cartão.
   */
  /* As versões guardadas de um projeto, da mais nova para a mais velha. */
  if (url.pathname.startsWith('/versoes/') && req.method === 'GET') {
    const arquivo = nomePedido(url.pathname);
    try {
      const pasta = pastaDeVersoes(arquivo);
      const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.json'));
      const versoes = [];
      for (const nome of nomes) {
        const quando = Number(path.basename(nome, '.json'));
        if (!Number.isFinite(quando)) continue;
        try {
          const j = JSON.parse(await readFile(path.join(pasta, nome), 'utf8'));
          versoes.push({
            arquivo: nome,
            quando,
            palavras: (j.palavras ?? []).length,
            template: j.template ?? null,
            nome: j.nomeProjeto ?? j.nome ?? null,
          });
        } catch {
          /* versão ilegível fica de fora */
        }
      }
      versoes.sort((a, b) => b.quando - a.quando);
      return json(res, 200, { versoes });
    } catch {
      return json(res, 200, { versoes: [] });
    }
  }

  /* O conteúdo de uma versão, para voltar a ela. */
  if (url.pathname.startsWith('/versao/') && req.method === 'GET') {
    const partes = url.pathname.split('/').filter(Boolean); // versao / <projeto> / <versao>
    const projeto = path.basename(decodeURIComponent(partes[1] ?? ''));
    const versao = path.basename(decodeURIComponent(partes[2] ?? ''));
    try {
      const caminho = path.join(pastaDeVersoes(projeto), versao);
      return json(res, 200, JSON.parse(await readFile(caminho, 'utf8')));
    } catch {
      return json(res, 404, { erro: 'versão não encontrada' });
    }
  }

  if (url.pathname.startsWith('/miniatura/') && req.method === 'GET') {
    const nome = nomePedido(url.pathname);
    try {
      const cache = path.join(aqui, '..', 'projeto', '.miniaturas');
      await mkdir(cache, { recursive: true });
      const jpg = path.join(cache, `${path.basename(nome, '.json')}.jpg`);

      if (!existsSync(jpg)) {
        const j = JSON.parse(await readFile(path.join(aqui, '..', 'projeto', nome), 'utf8'));
        if (!j.video || !existsSync(j.video)) return json(res, 404, { erro: 'sem vídeo' });
        const em = Math.min(1, (j.duracao ?? 2) / 3).toFixed(2);
        await new Promise((resolve, reject) => {
          const f = spawn(
            cfg.ffmpeg,
            ['-y', '-ss', em, '-i', j.video, '-frames:v', '1', '-vf', 'scale=-2:320', jpg],
            { windowsHide: true },
          );
          f.on('error', reject);
          f.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg'))));
        });
      }
      const info = await stat(jpg);
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': info.size });
      return createReadStream(jpg).pipe(res);
    } catch (e) {
      return json(res, 404, { erro: e.message });
    }
  }

  if (url.pathname.startsWith('/projetos/') && req.method === 'GET') {
    const nome = nomePedido(url.pathname);
    try {
      return json(res, 200, JSON.parse(await readFile(path.join(aqui, '..', 'projeto', nome), 'utf8')));
    } catch {
      return json(res, 404, { erro: 'projeto não encontrado' });
    }
  }

  /* O vídeo de um projeto, direto de onde ele está no disco. */
  if (url.pathname.startsWith('/video-do-projeto/') && req.method === 'GET') {
    const nome = nomePedido(url.pathname);
    try {
      const j = JSON.parse(await readFile(path.join(aqui, '..', 'projeto', nome), 'utf8'));
      if (!j.video || !existsSync(j.video)) return json(res, 404, { erro: 'vídeo não encontrado' });
      const info = await stat(j.video);
      const faixa = req.headers.range;
      if (faixa) {
        const [de, ate] = faixa.replace(/bytes=/, '').split('-');
        const inicio = Number(de);
        const fim = ate ? Number(ate) : info.size - 1;
        res.writeHead(206, {
          'content-range': `bytes ${inicio}-${fim}/${info.size}`,
          'accept-ranges': 'bytes',
          'content-length': fim - inicio + 1,
          'content-type': 'video/mp4',
        });
        return createReadStream(j.video, { start: inicio, end: fim }).pipe(res);
      }
      res.writeHead(200, {
        'content-length': info.size,
        'accept-ranges': 'bytes',
        'content-type': 'video/mp4',
      });
      return createReadStream(j.video).pipe(res);
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /*
   * Recebe o vídeo que o usuário arrastou e guarda no disco.
   *
   * O render precisa de um arquivo; o navegador só tem um blob. Sem isto,
   * exportar só funcionava para projeto aberto por "Abrir do computador".
   */
  if (url.pathname === '/video-fonte' && req.method === 'POST') {
    const bruto = url.searchParams.get('nome') ?? 'video.mp4';
    const nome = path.basename(bruto).replace(/[^\w.-]/g, '_');
    try {
      const pasta = path.join(aqui, '..', 'render', '.fontes');
      await mkdir(pasta, { recursive: true });
      const alvo = path.join(pasta, nome);
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(alvo, Buffer.concat(pedacos));
      return json(res, 200, { caminho: alvo });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Dispara o render do projeto que está aberto na plataforma. */
  if (url.pathname === '/renderizar' && req.method === 'POST') {
    if ((await lerEstadoRender()).rodando) {
      return json(res, 409, { erro: 'já tem um render em andamento' });
    }
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const projeto = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!projeto.video || !existsSync(projeto.video)) {
        return json(res, 400, { erro: 'o projeto não aponta para um vídeo que exista no disco' });
      }
      const base = (projeto.nome ?? 'video').replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '_');
      const pastaProjeto = path.join(aqui, '..', 'projeto');
      await mkdir(pastaProjeto, { recursive: true });
      const arquivoProjeto = path.join(pastaProjeto, `${base}.render.json`);
      await writeFile(arquivoProjeto, JSON.stringify(projeto, null, 2), 'utf8');
      // carimbo de data/hora: sem isto todo export vira o mesmo 01.mp4
      // e não dá para saber se o arquivo é o novo ou o de antes
      const agora = new Date();
      const carimbo = [
        agora.getFullYear(),
        String(agora.getMonth() + 1).padStart(2, '0'),
        String(agora.getDate()).padStart(2, '0'),
        '-',
        String(agora.getHours()).padStart(2, '0'),
        String(agora.getMinutes()).padStart(2, '0'),
      ].join('');
      const saida = path.join(aqui, '..', 'render', `${base}-${carimbo}.mp4`);
      await iniciarRender(arquivoProjeto, saida);
      return json(res, 200, { ok: true, nome: `${base}.mp4` });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /*
   * Cancelar o render.
   *
   * O processo roda solto (detached), então o serviço guarda o pid no arquivo
   * de estado e mata o processo inteiro — o Chrome do Remotion é filho dele e
   * cai junto, senão ficaria consumindo memória e disco à toa.
   */
  if (url.pathname === '/renderizar' && req.method === 'DELETE') {
    const estado = await lerEstadoRender();
    if (!estado.rodando || !estado.pid) {
      return json(res, 409, { erro: 'não há render em andamento' });
    }
    if (process.platform === 'win32') {
      /* no Windows, matar o pai deixa o Chrome do Remotion vivo comendo memória */
      spawn('taskkill', ['/PID', String(estado.pid), '/T', '/F'], { windowsHide: true });
    } else {
      try {
        process.kill(-estado.pid, 'SIGTERM'); // o grupo inteiro, com os filhos
      } catch {
        try {
          process.kill(estado.pid, 'SIGTERM');
        } catch {
          /* já tinha morrido */
        }
      }
    }
    await escreverEstadoRender({
      rodando: false,
      progresso: estado.progresso ?? 0,
      saida: null,
      erro: 'Cancelado por você.',
    });
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/renderizar' && req.method === 'GET') {
    return json(res, 200, await lerEstadoRender());
  }

  /* Baixar o MP4 pronto. */
  if (url.pathname.startsWith('/render/') && req.method === 'GET') {
    const nome = path.basename(decodeURIComponent(url.pathname));
    const alvo = path.join(aqui, '..', 'render', nome);
    try {
      const info = await stat(alvo);
      res.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': info.size,
        'content-disposition': `attachment; filename="${nome}"`,
      });
      return createReadStream(alvo).pipe(res);
    } catch {
      return json(res, 404, { erro: 'arquivo não encontrado' });
    }
  }

  if (url.pathname === '/status') {
    return json(res, 200, {
      ok: true,
      config: path.basename(cfg.arquivo),
      modelo: path.basename(cfg.modelo),
      modeloEncontrado: existsSync(cfg.modelo),
      whisperEncontrado: existsSync(cfg.whisperCli),
      idioma: cfg.idioma,
    });
  }

  /*
   * Fotos e b-roll ficam em public/midia/ — a mesma pasta que o Remotion
   * empacota no render. Servimos daqui (e não do dist) para uma foto
   * recém-enviada aparecer na prévia sem precisar reconstruir a interface.
   */
  /* Tudo que já foi enviado, inclusive em subpastas. */
  if (url.pathname === '/midia' && req.method === 'GET') {
    const raiz = path.join(aqui, '..', 'public', 'midia');
    const achados = [];
    async function varrer(pasta, prefixo) {
      let itens = [];
      try {
        itens = await readdir(pasta, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of itens) {
        const rel = prefixo ? `${prefixo}/${item.name}` : item.name;
        if (item.isDirectory()) {
          await varrer(path.join(pasta, item.name), rel);
        } else if (/.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v)$/i.test(item.name)) {
          const info = await stat(path.join(pasta, item.name));
          achados.push({
            src: `midia/${rel}`,
            nome: item.name,
            tamanho: info.size,
            video: /.(mp4|webm|mov|m4v)$/i.test(item.name),
          });
        }
      }
    }
    await varrer(raiz, '');
    achados.sort((a, b) => a.src.localeCompare(b.src));
    return json(res, 200, { midia: achados });
  }

  if (url.pathname === '/midia' && req.method === 'POST') {
    const bruto = url.searchParams.get('nome') ?? 'foto.png';
    const nome = path.basename(bruto).replace(/[^\w.-]/g, '_');
    if (!/\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v|mp3|wav|m4a|aac|ogg)$/i.test(nome)) {
      return json(res, 400, { erro: 'formato não suportado' });
    }
    try {
      const pasta = path.join(aqui, '..', 'public', 'midia');
      await mkdir(pasta, { recursive: true });
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(path.join(pasta, nome), Buffer.concat(pedacos));
      console.log(`✓ mídia: ${nome}`);
      return json(res, 200, { src: `midia/${nome}` });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname.startsWith('/midia/') && req.method === 'GET') {
    // subpastas valem (midia/campanha/x.png); sair da pasta, não
    const raiz = path.join(aqui, '..', 'public', 'midia');
    const relativo = decodeURIComponent(url.pathname).slice('/midia/'.length);
    const alvo = path.join(raiz, relativo);
    if (!alvo.startsWith(raiz)) return json(res, 403, { erro: 'caminho inválido' });
    const tipo = TIPOS[path.extname(alvo)] ?? 'application/octet-stream';
    try {
      const info = await stat(alvo);
      const faixa = req.headers.range;
      /*
       * A tela dividida usa vídeo daqui, e sem `Range` o <video> do
       * navegador não busca um ponto exato do arquivo — o Remotion Player
       * trava em preto ao tentar posicionar o frame certo na prévia.
       */
      if (faixa) {
        const [de, ate] = faixa.replace(/bytes=/, '').split('-');
        const inicio = Number(de);
        const fim = ate ? Number(ate) : info.size - 1;
        res.writeHead(206, {
          'content-type': tipo,
          'access-control-allow-origin': '*',
          'content-range': `bytes ${inicio}-${fim}/${info.size}`,
          'accept-ranges': 'bytes',
          'content-length': fim - inicio + 1,
        });
        return createReadStream(alvo, { start: inicio, end: fim }).pipe(res);
      }
      res.writeHead(200, {
        'content-type': tipo,
        'access-control-allow-origin': '*',
        'accept-ranges': 'bytes',
        'content-length': info.size,
      });
      return createReadStream(alvo).pipe(res);
    } catch {
      return json(res, 404, { erro: 'mídia não encontrada' });
    }
  }

  /* Onde o vídeo já foi cortado — o FFmpeg mede a virada da imagem. */
  if (url.pathname === '/cortes' && req.method === 'POST') {
    const nome = url.searchParams.get('nome') ?? 'video.mp4';
    const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
    try {
      const entrada = path.join(pasta, path.basename(nome).replace(/[^\w.-]/g, '_'));
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(entrada, Buffer.concat(pedacos));
      const cortes = await detectarCortes(cfg, entrada);
      console.log(`✓ ${nome}: ${cortes.length} cortes`);
      return json(res, 200, { cortes });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  if (url.pathname === '/transcrever' && req.method === 'POST') {
    const nome = url.searchParams.get('nome') ?? 'video.mp4';
    const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
    try {
      const entrada = path.join(pasta, path.basename(nome).replace(/[^\w.-]/g, '_'));
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(entrada, Buffer.concat(pedacos));

      const words = await transcreverVideo(cfg, entrada);
      // o navegador não sabe o fps do arquivo; o ffprobe sabe
      const meta = await sondarVideo(cfg, entrada);
      console.log(`✓ ${nome}: ${words.length} palavras, ${meta.fps}fps`);
      return json(res, 200, { words, ...meta });
    } catch (e) {
      console.error('✗', e.message);
      return json(res, 500, { erro: e.message });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  if (req.method === 'GET') return servirEstatico(req, res, url.pathname);

  json(res, 404, { erro: 'rota desconhecida' });
}

/*
 * Ao reiniciar (o --watch reinicia a cada edição), o processo novo às vezes
 * tenta subir antes de o antigo soltar a porta. Sem repetir a tentativa, ele
 * morre e o antigo segue servindo código velho — o serviço parece no ar mas
 * responde "rota desconhecida" para tudo que foi criado depois.
 */
function subir() {
  servidor.listen(cfg.porta, () => {
    console.log(`
  Melhores Fimes: http://localhost:${cfg.porta}
`);
    console.log(`  config : ${cfg.arquivo}`);
    console.log(`  whisper: ${existsSync(cfg.whisperCli) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.whisperCli}`);
    console.log(`  modelo : ${existsSync(cfg.modelo) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.modelo}`);
  });
}

servidor.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log('  porta ocupada, tentando de novo…');
  setTimeout(() => servidor.listen(cfg.porta), 400);
});

subir();
