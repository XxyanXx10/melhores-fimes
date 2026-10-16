/**
 * Motor de criação em lote para Canal Dark (`agente/dark.mjs`).
 *
 * Transforma vários arquivos de áudio narrados (ou vídeos brutos) em projetos
 * completos prontos para editar ou exportar em lote:
 *   1. (Opcional) Corta silêncios longos da narração para dar ritmo dinâmico
 *   2. Transcreve com Whisper.cpp + aplica dicionário de correções
 *   3. Monta o vídeo base (9:16, 16:9 ou 1:1) com vídeos de fundo em loop ou
 *      troca dinâmica de B-roll + filtro estético Dark (escurecimento/contraste)
 *   4. Gera automaticamente cartões de impacto, imagens nos momentos-chave,
 *      efeitos sonoros (whoosh/pop/sino) e música de fundo
 *   5. Salva cada projeto em `projeto/<nome>.json`
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VIDEOS,
  conferirFerramentas,
  detectarSilencios,
  lerConfig,
  sondarVideo,
  transcreverVideo,
} from './nucleo.mjs';
import { buscarMidiasReaisParaTranscricao, gerarCenasRemotionDoRoteiro } from './cenas.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPORARIO = path.join(raiz, 'agente', '.tmp');

export const AUDIOS = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.opus'];
export const MIDIAS_ENTRADA = [...AUDIOS, ...VIDEOS];

const GATILHOS_DARK = new Set([
  'mas', 'porém', 'nunca', 'ninguém', 'segredo', 'verdade', 'problema',
  'solução', 'resultado', 'dinheiro', 'poder', 'mente', 'cérebro', 'erro',
  'regra', 'primeiro', 'segundo', 'terceiro', ' único', 'jamais', 'sempre',
  'atenção', 'cuidado', 'olhe', 'veja', 'descobriu', 'história', 'fato',
]);

function rodarFfmpeg(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let erro = '';
    p.stderr.on('data', (d) => (erro += String(d)));
    p.on('error', (e) => reject(new Error(`FFmpeg: ${e.message}`)));
    p.on('close', (c) =>
      c === 0 ? resolve() : reject(new Error(`FFmpeg falhou (${c})\n${erro.slice(-1200)}`)),
    );
  });
}

function capturarStdout(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let saida = '';
    p.stdout.on('data', (d) => (saida += String(d)));
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve(saida) : reject(new Error(`ffprobe saiu com ${c}`))));
  });
}

/** Mede a duração exata de qualquer áudio ou vídeo usando ffprobe */
export async function sondarDuracaoMidia(cfg, arquivo) {
  const ffprobe =
    cfg.ffprobe ?? cfg.ffmpeg.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'));
  try {
    const saida = await capturarStdout(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      arquivo,
    ]);
    const d = Number(saida.trim());
    return Number.isFinite(d) && d > 0 ? d : 10;
  } catch {
    return 10;
  }
}

/**
 * Lista vídeos de fundo, músicas, efeitos sonoros e imagens disponíveis
 * tanto em `public/midia` quanto em uma pasta externa opcional do computador.
 */
export async function listarBibliotecaDark(pastaFundoExterna) {
  const pastaMidia = path.join(raiz, 'public', 'midia');
  const videosFundo = [];
  const musicas = [];
  const efeitos = [];
  const imagens = [];

  async function varrerMidiaLocal(pasta, prefixo = '') {
    let itens = [];
    try {
      itens = await readdir(pasta, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of itens) {
      const rel = prefixo ? `${prefixo}/${item.name}` : item.name;
      const completo = path.join(pasta, item.name);
      if (item.isDirectory()) {
        await varrerMidiaLocal(completo, rel);
        continue;
      }
      const ext = path.extname(item.name).toLowerCase();
      const info = await stat(completo).catch(() => null);
      if (!info) continue;

      if (VIDEOS.includes(ext)) {
        videosFundo.push({
          caminho: completo,
          src: `midia/${rel}`,
          nome: item.name,
          tamanho: info.size,
          origem: 'biblioteca',
        });
      } else if (AUDIOS.includes(ext)) {
        const ehEfeito = /^sfx[_-]/i.test(item.name) || info.size < 250 * 1024;
        const obj = {
          src: `midia/${rel}`,
          nome: item.name,
          tamanho: info.size,
          tipo: ehEfeito ? 'efeito' : 'musica',
        };
        if (ehEfeito) efeitos.push(obj);
        else musicas.push(obj);
      } else if (/\.(png|jpe?g|webp|avif)$/i.test(item.name)) {
        imagens.push({
          src: `midia/${rel}`,
          nome: item.name,
          tamanho: info.size,
        });
      }
    }
  }

  await varrerMidiaLocal(pastaMidia);

  if (pastaFundoExterna && existsSync(pastaFundoExterna)) {
    try {
      const itens = await readdir(pastaFundoExterna, { withFileTypes: true });
      for (const item of itens) {
        if (!item.isFile()) continue;
        const ext = path.extname(item.name).toLowerCase();
        if (!VIDEOS.includes(ext)) continue;
        const completo = path.join(pastaFundoExterna, item.name);
        const info = await stat(completo).catch(() => null);
        if (info) {
          videosFundo.push({
            caminho: completo,
            src: null,
            nome: item.name,
            tamanho: info.size,
            origem: 'pasta',
          });
        }
      }
    } catch {
      /* pasta inacessível é ignorada */
    }
  }

  return { videosFundo, musicas, efeitos, imagens };
}

/**
 * Lista áudios ou vídeos de narração de uma pasta do computador para criação em lote.
 */
export async function listarNarracoesDaPasta(pasta) {
  const itens = await readdir(pasta, { withFileTypes: true });
  const achados = [];
  for (const item of itens) {
    if (!item.isFile()) continue;
    const ext = path.extname(item.name).toLowerCase();
    if (!MIDIAS_ENTRADA.includes(ext)) continue;
    const caminho = path.join(pasta, item.name);
    const info = await stat(caminho);
    achados.push({
      caminho,
      nome: item.name,
      tamanho: info.size,
      ehVideo: VIDEOS.includes(ext),
      criadoEm: info.birthtimeMs || info.mtimeMs,
    });
  }
  achados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  return achados;
}

/**
 * Remove silêncios longos de um arquivo de áudio e devolve o caminho de um `.wav` enxuto.
 */
async function cortarSilenciosDeAudio(cfg, entradaAudio, pastaTmp, silencioMinimo = 0.38) {
  const duracaoTotal = await sondarDuracaoMidia(cfg, entradaAudio);
  // -35 dB: só silêncio de verdade. Com -26, o fim das palavras ("s", sílaba fraca) virava "silêncio" e era cortado
  const silencios = await detectarSilencios(cfg, entradaAudio, { limiarDb: -35, duracaoMinima: 0.1 });
  if (!Array.isArray(silencios) || !silencios.length) {
    return { caminho: entradaAudio, duracao: duracaoTotal };
  }

  const relevantes = [...silencios]
    .filter((s) => s.end - s.start >= silencioMinimo)
    .sort((a, b) => a.start - b.start);

  if (!relevantes.length) {
    return { caminho: entradaAudio, duracao: duracaoTotal };
  }

  const blocosBrutos = [];
  let cursor = 0;
  for (const s of relevantes) {
    if (s.start > cursor) {
      blocosBrutos.push({ start: cursor, end: Math.min(s.start, duracaoTotal) });
    }
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < duracaoTotal) {
    blocosBrutos.push({ start: cursor, end: duracaoTotal });
  }

  // folga generosa em volta da fala: o ritmo continua rápido, mas nenhuma palavra perde o começo ou o fim
  const folgaInicio = 0.15;
  const folgaFim = 0.25;
  const trechos = [];
  for (const b of blocosBrutos) {
    if (b.end <= b.start) continue;
    const ini = Math.max(0, +(b.start - folgaInicio).toFixed(3));
    const fim = Math.min(duracaoTotal, +(b.end + folgaFim).toFixed(3));
    const ant = trechos[trechos.length - 1];
    if (ant && ini <= ant.end) {
      ant.end = Math.max(ant.end, fim);
    } else if (fim > ini) {
      trechos.push({ start: ini, end: fim });
    }
  }

  if (
    trechos.length === 0 ||
    (trechos.length === 1 && trechos[0].start === 0 && Math.abs(trechos[0].end - duracaoTotal) < 0.25)
  ) {
    return { caminho: entradaAudio, duracao: duracaoTotal };
  }

  const saidaWav = path.join(pastaTmp, 'narracao_sem_silencio.wav');
  const n = trechos.length;
  const partes = [];
  if (n === 1) {
    partes.push(
      `[0:a]atrim=start=${trechos[0].start}:end=${trechos[0].end},asetpts=PTS-STARTPTS[asaida]`,
    );
  } else {
    const aFontes = Array.from({ length: n }, (_, k) => `sa${k}`);
    partes.push(`[0:a]asplit=${n}${aFontes.map((r) => `[${r}]`).join('')}`);
    trechos.forEach((t, k) => {
      partes.push(
        // fade de 15 ms em cada ponta: a emenda não estala
        `[${aFontes[k]}]atrim=start=${t.start}:end=${t.end},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=${Math.max(0, +(t.end - t.start - 0.015).toFixed(3))}:d=0.015[a${k}]`,
      );
    });
    partes.push(`${trechos.map((_, k) => `[a${k}]`).join('')}concat=n=${n}:v=0:a=1[asaida]`);
  }

  await rodarFfmpeg(cfg.ffmpeg, [
    '-y',
    '-i', entradaAudio,
    '-filter_complex', partes.join(';'),
    '-map', '[asaida]',
    '-ac', '2',
    '-ar', '48000',
    '-c:a', 'pcm_s16le',
    saidaWav,
  ]);

  const novaDuracao = trechos.reduce((acc, t) => acc + (t.end - t.start), 0);
  return { caminho: saidaWav, duracao: +novaDuracao.toFixed(2) };
}

/**
 * Monta o MP4 base combinando o áudio da narração com os vídeos de fundo
 * (em loop único, troca dinâmica de B-roll, ou fundo escuro cinematográfico).
 */
async function montarVideoBaseDark(cfg, {
  audioCaminho,
  duracao,
  videosFundo,
  cenasReais,
  indiceLote,
  modoFundo,
  intervaloTroca,
  escurecerFundo,
  largura,
  altura,
  fps,
  saidaMp4,
}) {
  const eqFiltro = escurecerFundo
    ? `,eq=brightness=-0.16:contrast=1.12:saturation=0.88,vignette=PI/4`
    : '';
  const escalaCrop =
    `scale=${largura}:${altura}:force_original_aspect_ratio=increase,` +
    `crop=${largura}:${altura},setsar=1,fps=${fps},format=yuv420p${eqFiltro}`;

  const cortesGerados = [];

  /* Caso 0: 'contexto' — Cenas Reais do que está sendo falado (vídeos + imagens da Web) */
  const cenasComMidia = Array.isArray(cenasReais)
    ? cenasReais.filter((c) => c.videoCaminho || c.imagemWeb?.caminho)
    : [];

  if (modoFundo === 'contexto' && cenasComMidia.length >= 1) {
    const listaCenas = cenasReais.slice(0, 16);
    const totalSegs = listaCenas.length;
    const entradasArgs = [];
    const filtros = [];

    for (let s = 0; s < totalSegs; s++) {
      const c = listaCenas[s];
      const duracaoEste =
        s === totalSegs - 1
          ? Math.max(0.5, +(duracao - c.start).toFixed(2))
          : Math.max(0.5, +c.duracao.toFixed(2));

      if (c.videoCaminho && existsSync(c.videoCaminho)) {
        entradasArgs.push('-stream_loop', '-1', '-t', String(duracaoEste), '-i', c.videoCaminho);
      } else if (c.imagemWeb?.caminho && existsSync(c.imagemWeb.caminho)) {
        entradasArgs.push('-loop', '1', '-t', String(duracaoEste), '-i', c.imagemWeb.caminho);
      } else if (videosFundo.length > 0) {
        const fb = videosFundo[(indiceLote + s) % videosFundo.length];
        entradasArgs.push('-stream_loop', '-1', '-t', String(duracaoEste), '-i', fb);
      } else {
        const fbImg = cenasComMidia[s % cenasComMidia.length].imagemWeb?.caminho;
        entradasArgs.push('-loop', '1', '-t', String(duracaoEste), '-i', fbImg);
      }

      filtros.push(`[${s}:v]${escalaCrop},setpts=PTS-STARTPTS[v${s}]`);
      if (s > 0) {
        cortesGerados.push({ t: +c.start.toFixed(2), ativo: true });
      }
    }

    const idxAudio = totalSegs;
    entradasArgs.push('-i', audioCaminho);
    filtros.push(
      `${Array.from({ length: totalSegs }, (_, s) => `[v${s}]`).join('')}concat=n=${totalSegs}:v=1:a=0[vout]`,
    );

    await rodarFfmpeg(cfg.ffmpeg, [
      '-y',
      ...entradasArgs,
      '-filter_complex', filtros.join(';'),
      '-map', '[vout]',
      '-map', `${idxAudio}:a:0`,
      '-t', String(duracao),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      saidaMp4,
    ]);
    return { cortesGerados };
  }

  /* Caso 1: sem vídeo de fundo ou modo 'escuro' ou 'remotion' sem vídeos -> gera fundo escuro sólido elegante */
  if (!videosFundo.length || modoFundo === 'escuro' || modoFundo === 'remotion') {
    await rodarFfmpeg(cfg.ffmpeg, [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=#080b12:s=${largura}x${altura}:r=${fps}:d=${duracao}`,
      '-i', audioCaminho,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '21',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      saidaMp4,
    ]);
    return { cortesGerados };
  }

  /* Caso 2: 'dinamico' com múltiplos vídeos de fundo (troca de cena a cada N segundos) */
  const intervalo = Math.max(2.5, Number(intervaloTroca) || 5);
  const numSegmentos = Math.max(1, Math.ceil(duracao / intervalo));

  if (modoFundo === 'dinamico' && videosFundo.length >= 2 && numSegmentos > 1) {
    // Limita a 16 segmentos para manter o filter_complex rápido e leve
    const totalSegs = Math.min(16, numSegmentos);
    const durSeg = +(duracao / totalSegs).toFixed(2);
    const entradasArgs = [];
    const filtros = [];

    for (let s = 0; s < totalSegs; s++) {
      const fundoEscolhido = videosFundo[(indiceLote + s) % videosFundo.length];
      const duracaoEste = s === totalSegs - 1 ? Math.max(0.5, +(duracao - s * durSeg).toFixed(2)) : durSeg;
      entradasArgs.push('-stream_loop', '-1', '-t', String(duracaoEste), '-i', fundoEscolhido);
      filtros.push(`[${s}:v]${escalaCrop},setpts=PTS-STARTPTS[v${s}]`);
      if (s > 0) {
        cortesGerados.push({ t: +(s * durSeg).toFixed(2), ativo: true });
      }
    }

    const idxAudio = totalSegs;
    entradasArgs.push('-i', audioCaminho);
    filtros.push(`${Array.from({ length: totalSegs }, (_, s) => `[v${s}]`).join('')}concat=n=${totalSegs}:v=1:a=0[vout]`);

    await rodarFfmpeg(cfg.ffmpeg, [
      '-y',
      ...entradasArgs,
      '-filter_complex', filtros.join(';'),
      '-map', '[vout]',
      '-map', `${idxAudio}:a:0`,
      '-t', String(duracao),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      saidaMp4,
    ]);
    return { cortesGerados };
  }

  /* Caso 3: 'loop' (1 vídeo de fundo em loop para cada item do lote, alternando entre os vídeos da pasta) */
  const fundo = videosFundo[indiceLote % videosFundo.length];
  if (modoFundo === 'dinamico' && duracao > intervalo * 1.5) {
    // Mesmo em loop de um único vídeo, podemos registrar cortes visuais para transições de impacto!
    for (let t = intervalo; t < duracao - 1.2; t += intervalo) {
      cortesGerados.push({ t: +t.toFixed(2), ativo: true });
    }
  }

  await rodarFfmpeg(cfg.ffmpeg, [
    '-y',
    '-stream_loop', '-1',
    '-i', fundo,
    '-i', audioCaminho,
    '-filter_complex', `[0:v]${escalaCrop}[vout]`,
    '-map', '[vout]',
    '-map', '1:a:0',
    '-t', String(duracao),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    saidaMp4,
  ]);

  return { cortesGerados };
}

/**
 * Encontra momentos-chave na transcrição para inserir Cartões, Fotos B-Roll e Efeitos Sonoros.
 */
function extrairMomentosChaveDark(palavras, duracao, intervaloMinimo = 7.5) {
  if (!palavras.length) return [];
  const candidatos = [];

  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i];
    const ant = palavras[i - 1];
    const limpo = w.text.toLowerCase().replace(/[^\wáàâãéêíóôõúüç]/gi, '');
    if (!limpo) continue;

    let peso = 0;
    const pausa = ant ? w.start - ant.end : 0;
    if (i === 0 && duracao >= 4) peso += 4; // Gancho inicial!
    if (pausa >= 0.45) peso += 3;
    else if (pausa >= 0.25) peso += 2;
    if (/\d/.test(w.text) || /%|r\$/i.test(w.text)) peso += 3;
    if (GATILHOS_DARK.has(limpo)) peso += 2;
    if (ant && /[.!?]$/.test(ant.text)) peso += 2;

    if (peso >= 3 && w.start < duracao - 1.8) {
      // Monta um trecho curto de 2 a 4 palavras a partir deste ponto para o cartão
      const janela = palavras.slice(i, Math.min(palavras.length, i + 4));
      const frase = janela.map((x) => x.text).join(' ').replace(/[.,;:]+$/, '');
      candidatos.push({
        t: +w.start.toFixed(2),
        peso,
        indice: i,
        titulo: w.text.replace(/[.,;:!?]+$/, '').toUpperCase(),
        frase,
      });
    }
  }

  candidatos.sort((a, b) => b.peso - a.peso || a.t - b.t);
  const escolhidos = [];
  for (const c of candidatos) {
    if (escolhidos.every((e) => Math.abs(e.t - c.t) >= intervaloMinimo)) {
      escolhidos.push(c);
    }
  }
  return escolhidos.sort((a, b) => a.t - b.t);
}

/**
 * Gera vários projetos de Canal Dark em lote.
 */
export async function gerarLoteDark(arquivosEntrada, opcoes = {}) {
  const cfg = await lerConfig();
  const faltando = conferirFerramentas(cfg);
  if (faltando.length) throw new Error(`Ferramentas ausentes:\n  ${faltando.join('\n  ')}`);
  if (!Array.isArray(arquivosEntrada) || !arquivosEntrada.length) {
    throw new Error('Nenhum arquivo de áudio ou vídeo foi informado para o lote.');
  }

  const formato = opcoes.formato ?? '9:16';
  const dimensoes =
    formato === '16:9'
      ? { largura: 1920, altura: 1080 }
      : formato === '1:1'
        ? { largura: 1080, altura: 1080 }
        : { largura: 1080, altura: 1920 };
  const fps = 30;

  // Resolve os vídeos de fundo escolhidos
  const bib = await listarBibliotecaDark(opcoes.pastaFundoExterna);
  let caminhosFundo = [];
  if (Array.isArray(opcoes.videosFundoEscolhidos) && opcoes.videosFundoEscolhidos.length > 0) {
    caminhosFundo = opcoes.videosFundoEscolhidos.filter((c) => c && existsSync(c));
  }
  if (!caminhosFundo.length) {
    caminhosFundo = bib.videosFundo
      .filter((v) => (opcoes.pastaFundoExterna ? v.origem === 'pasta' : true))
      .map((v) => v.caminho);
  }

  const pastaSaidaVideos = path.join(raiz, 'render', '.fontes', 'dark');
  const pastaProjetos = path.join(raiz, 'projeto');
  await mkdir(pastaSaidaVideos, { recursive: true });
  await mkdir(pastaProjetos, { recursive: true });
  await mkdir(TEMPORARIO, { recursive: true });

  // Verifica quais efeitos sonoros existem em public/midia
  const temWhoosh = existsSync(path.join(raiz, 'public', 'midia', 'sfx_whoosh.mp3'));
  const temPop = existsSync(path.join(raiz, 'public', 'midia', 'sfx_pop.mp3'));
  const temSino = existsSync(path.join(raiz, 'public', 'midia', 'sfx_sino.mp3'));

  const criados = [];

  for (let i = 0; i < arquivosEntrada.length; i++) {
    const item = arquivosEntrada[i];
    const caminhoOriginal = typeof item === 'string' ? item : item.caminho;
    const nomeBaseBruto =
      (typeof item === 'object' && item.titulo ? item.titulo : path.basename(caminhoOriginal, path.extname(caminhoOriginal)))
        .replace(/[<>:"/\\|?*]/g, '-')
        .trim() || `Dark ${i + 1}`;
    const prefixo = opcoes.prefixoNome ? `${opcoes.prefixoNome.trim()} - ` : '';
    const nomeProjeto = `${prefixo}${nomeBaseBruto}`;

    opcoes.aoAndar?.({
      etapa: 'processando',
      atual: i + 1,
      total: arquivosEntrada.length,
      nome: nomeProjeto,
      detalhe: 'Preparando áudio e medindo pausas…',
    });

    const pastaTmp = await mkdtemp(path.join(TEMPORARIO, 'dark-'));
    try {
      let audioParaUsar = caminhoOriginal;
      let duracao = await sondarDuracaoMidia(cfg, caminhoOriginal);

      if (opcoes.cortarSilenciosAudio !== false) {
        const cortado = await cortarSilenciosDeAudio(
          cfg,
          caminhoOriginal,
          pastaTmp,
          Number(opcoes.silencioMinimo) || 0.35,
        );
        audioParaUsar = cortado.caminho;
        duracao = cortado.duracao;
      }

      opcoes.aoAndar?.({
        etapa: 'processando',
        atual: i + 1,
        total: arquivosEntrada.length,
        nome: nomeProjeto,
        detalhe: 'Transcrevendo narração com Whisper…',
      });

      const palavras = await transcreverVideo(cfg, audioParaUsar);
      if (palavras.length) {
        duracao = Math.max(duracao, +(palavras[palavras.length - 1].end + 0.25).toFixed(2));
      }

      // Busca cenas e imagens reais do que está sendo falado na transcrição
      const modoFundo = opcoes.modoFundo ?? 'contexto';
      const buscarReais = modoFundo === 'contexto' || opcoes.buscarImagensReaisWeb !== false;
      let cenasReais = [];
      if (buscarReais && palavras.length > 0) {
        cenasReais = await buscarMidiasReaisParaTranscricao(palavras, duracao, {
          intervaloCena: opcoes.intervaloTrocaFundo ?? 5,
          videosFundoLocais: caminhosFundo,
          pexelsKey: opcoes.pexelsKey || cfg.pexelsKey,
          formato,
          aoProgresso: (detalhe) =>
            opcoes.aoAndar?.({
              etapa: 'processando',
              atual: i + 1,
              total: arquivosEntrada.length,
              nome: nomeProjeto,
              detalhe,
            }),
        });
      }

      // Se o arquivo de entrada já for vídeo e o modoFundo for 'original', usa o próprio vídeo
      const extEntrada = path.extname(caminhoOriginal).toLowerCase();
      const usarVideoProprio = VIDEOS.includes(extEntrada) && modoFundo === 'original';

      const slugSeguro = nomeProjeto.replace(/[^\w.-]/g, '_').slice(0, 60);
      const saidaMp4 = usarVideoProprio
        ? caminhoOriginal
        : path.join(pastaSaidaVideos, `${slugSeguro}-${Date.now()}.mp4`);

      let cortes = [];
      if (!usarVideoProprio) {
        opcoes.aoAndar?.({
          etapa: 'processando',
          atual: i + 1,
          total: arquivosEntrada.length,
          nome: nomeProjeto,
          detalhe: 'Montando vídeo com as cenas reais do assunto falado…',
        });

        const resBase = await montarVideoBaseDark(cfg, {
          audioCaminho: audioParaUsar,
          duracao,
          videosFundo: caminhosFundo,
          cenasReais,
          indiceLote: i,
          modoFundo,
          intervaloTroca: opcoes.intervaloTrocaFundo ?? 5,
          escurecerFundo: opcoes.escurecerFundo !== false,
          largura: dimensoes.largura,
          altura: dimensoes.altura,
          fps,
          saidaMp4,
        });
        cortes = resBase.cortesGerados;
      }

      /* Camadas automáticas nos momentos-chave da fala */
      const momentos = extrairMomentosChaveDark(palavras, duracao, 7.5);
      const cartoes = [];
      const fotos = [];
      const sons = [];

      // 1. Música de fundo automática
      if (opcoes.musicaFundo) {
        sons.push({
          id: `mus_${Date.now()}_${i}`,
          src: opcoes.musicaFundo,
          nome: path.basename(opcoes.musicaFundo),
          tipo: 'musica',
          start: 0,
          duracao: 0,
          volume: Number(opcoes.volumeMusica) || 0.14,
          fadeIn: 1.5,
          fadeOut: 2.5,
          repetir: true,
        });
      }

      // 2. Imagens Reais da Fala (Web) ou Imagens de Apoio escolhidas manualmente
      const imgsApoio = Array.isArray(opcoes.imagensApoio) ? opcoes.imagensApoio : [];
      if (opcoes.buscarImagensReaisWeb !== false && cenasReais.length > 0) {
        cenasReais.forEach((c, idx) => {
          if (!c.imagemWeb?.src) return;
          // Se o fundo já usou a imagem estática desta cena em tela cheia (sem vídeo),
          // adicionamos como Foto B-Roll nas cenas pares para você também poder editar/arrastar na aba Fotos
          if (modoFundo === 'contexto' && !c.videoCaminho && idx % 2 === 1) return;
          fotos.push({
            id: `f_real_${Date.now()}_${idx}`,
            src: c.imagemWeb.src,
            start: +(c.start + 0.15).toFixed(2),
            duracao: Math.max(2.0, Math.min(3.6, +(c.duracao - 0.35).toFixed(2))),
            entrada: idx % 2 === 0 ? 'escala' : 'sobe',
            largura: formato === '16:9' ? 46 : 72,
            x: 50,
            y: formato === '16:9' ? 34 : 26,
          });
        });
      } else if (imgsApoio.length > 0 && momentos.length > 0) {
        momentos.forEach((m, idx) => {
          if (idx >= imgsApoio.length && !opcoes.repetirImagensApoio) return;
          const imgSrc = imgsApoio[idx % imgsApoio.length];
          fotos.push({
            id: `f_${Date.now()}_${idx}`,
            src: imgSrc,
            start: m.t,
            duracao: 2.6,
            entrada: idx % 2 === 0 ? 'escala' : 'sobe',
            largura: formato === '16:9' ? 42 : 64,
            x: 50,
            y: formato === '16:9' ? 36 : 26,
          });
        });
      }

      // 3. Cartões de destaque automáticos nos momentos-chave (quando não há foto no mesmo segundo)
      if (opcoes.gerarCartoesChave) {
        momentos.slice(0, 5).forEach((m, idx) => {
          const jaTemFoto = fotos.some((f) => Math.abs(f.start - m.t) < 1.8);
          if (jaTemFoto) return;
          cartoes.push({
            id: `c_${Date.now()}_${idx}`,
            start: m.t,
            duracao: 2.4,
            titulo: idx === 0 ? '⚡ ATENÇÃO' : `PONTO #${idx + 1}`,
            itens: [m.frase.toUpperCase()],
            cor: opcoes.cartaoCor ?? 'rgba(10, 14, 24, 0.94)',
            destaque: opcoes.cartaoDestaque ?? '#FFD60A',
            x: 50,
            y: formato === '16:9' ? 28 : 24,
            largura: formato === '16:9' ? 54 : 78,
          });
        });
      }

      // 4. Efeitos sonoros automáticos (SFX) nas viradas, cartões e fotos
      if (opcoes.efeitosAutomaticos !== false) {
        const instantesSfx = new Set();
        for (const c of cartoes) {
          if (temPop) {
            instantesSfx.add(c.start);
            sons.push({
              id: `sfx_c_${Date.now()}_${c.id}`,
              src: 'midia/sfx_pop.mp3',
              nome: 'sfx_pop.mp3',
              tipo: 'efeito',
              start: c.start,
              duracao: 1.2,
              volume: 0.55,
              fadeIn: 0,
              fadeOut: 0,
              repetir: false,
            });
          }
        }
        for (const f of fotos) {
          if (temSino && !instantesSfx.has(f.start)) {
            instantesSfx.add(f.start);
            sons.push({
              id: `sfx_f_${Date.now()}_${f.id}`,
              src: 'midia/sfx_sino.mp3',
              nome: 'sfx_sino.mp3',
              tipo: 'efeito',
              start: f.start,
              duracao: 1.5,
              volume: 0.45,
              fadeIn: 0,
              fadeOut: 0,
              repetir: false,
            });
          }
        }
        for (const [idxCorte, ct] of cortes.slice(0, 6).entries()) {
          if (temWhoosh && !instantesSfx.has(ct.t)) {
            instantesSfx.add(ct.t);
            sons.push({
              id: `sfx_w_${Date.now()}_${idxCorte}`,
              src: 'midia/sfx_whoosh.mp3',
              nome: 'sfx_whoosh.mp3',
              tipo: 'efeito',
              start: Math.max(0, +(ct.t - 0.12).toFixed(2)),
              duracao: 1.2,
              volume: 0.5,
              fadeIn: 0,
              fadeOut: 0,
              repetir: false,
            });
          }
        }
      }

      /* Caso 1: sem vídeo de fundo ou modo 'escuro' ou 'remotion' -> gera fundo escuro sólido elegante */
      // No modo 'remotion', as cenas animadas nativas do Remotion (ChatGPT, Contexto IA, Checklist, etc.)
      // brilham sobre o fundo escuro cinematográfico ou sobre vídeos suaves!
      const cenasRemotion =
        opcoes.modoFundo === 'remotion' || opcoes.gerarCenasRemotion !== false
          ? gerarCenasRemotionDoRoteiro(palavras, duracao)
          : [];

      // Se estamos com cenas Remotion em tela cheia, não sobrepomos fotos nos mesmos instantes
      const fotosFiltradas =
        cenasRemotion.length > 0
          ? fotos.filter((f) => !cenasRemotion.some((cr) => Math.abs(cr.start - f.start) < 2.5))
          : fotos;

      // Efeitos sonoros extras nas entradas das cenas Remotion
      if (opcoes.efeitosAutomaticos !== false && cenasRemotion.length > 0 && temPop) {
        cenasRemotion.forEach((cr, idxCr) => {
          if (!sons.some((s) => s.tipo === 'efeito' && Math.abs(s.start - cr.start) < 0.8)) {
            sons.push({
              id: `sfx_cr_${Date.now()}_${idxCr}`,
              src: idxCr % 2 === 0 ? 'midia/sfx_pop.mp3' : 'midia/sfx_sino.mp3',
              nome: idxCr % 2 === 0 ? 'sfx_pop.mp3' : 'sfx_sino.mp3',
              tipo: 'efeito',
              start: +cr.start.toFixed(2),
              duracao: 1.2,
              volume: 0.5,
              fadeIn: 0,
              fadeOut: 0,
              repetir: false,
            });
          }
        });
      }

      // 5. Grava o arquivo de projeto (.json)
      let nomeArquivoJson = `${nomeProjeto.replace(/[<>:"/\\|?*]/g, '-').trim()}.json`;
      let contador = 2;
      while (existsSync(path.join(pastaProjetos, nomeArquivoJson))) {
        nomeArquivoJson = `${nomeProjeto.replace(/[<>:"/\\|?*]/g, '-').trim()}-${contador}.json`;
        contador++;
      }

      const projeto = {
        versao: 1,
        video: saidaMp4,
        nome: path.basename(saidaMp4),
        nomeProjeto,
        arquivo: nomeArquivoJson,
        duracao,
        fps,
        largura: dimensoes.largura,
        altura: dimensoes.altura,
        template: opcoes.template ?? 'dark-misterio',
        estilo: opcoes.estilo ?? {},
        movimento: opcoes.movimento ?? 'natural',
        forcaZoom: Number(opcoes.forcaZoom) || 1.15,
        zoomsManuais: [],
        fotos: fotosFiltradas,
        sons,
        cartoes,
        cenasRemotion,
        divisoes: [],
        cortes,
        transicao: cortes.length ? (opcoes.transicao ?? 'variado') : 'off',
        forcaTransicao: 1,
        duracaoTransicao: 0.6,
        palavras,
      };

      await writeFile(path.join(pastaProjetos, nomeArquivoJson), JSON.stringify(projeto, null, 2), 'utf8');

      criados.push({
        arquivoProjeto: nomeArquivoJson,
        nomeProjeto,
        duracao,
        palavras: palavras.length,
        cartoes: cartoes.length + cenasRemotion.length,
        fotos: fotosFiltradas.length,
        cortes: cortes.length,
      });
    } finally {
      await rm(pastaTmp, { recursive: true, force: true });
    }
  }

  return criados;
}
