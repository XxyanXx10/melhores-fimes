/** Coração da transcrição, usado pela plataforma, pelo script e pelo vigia. */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { juntarPalavras, lerJsonWhisper } from '../server/merge.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const VIDEOS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'];

export async function lerConfig() {
  const proprio = path.join(raiz, 'server', 'config.json');
  const arquivo = existsSync(proprio) ? proprio : path.join(raiz, 'server', 'config.example.json');
  return { arquivo, ...JSON.parse(await readFile(arquivo, 'utf8')) };
}

export function conferirFerramentas(cfg) {
  const faltando = [];
  if (!existsSync(cfg.whisperCli)) faltando.push(`whisper-cli: ${cfg.whisperCli}`);
  if (!existsSync(cfg.modelo)) faltando.push(`modelo: ${cfg.modelo}`);
  return faltando;
}

/** quebra a saída do ffprobe em linhas, sem depender do fim de linha do SO */
function linhasDe(texto) {
  return texto.split(/\r?\n/).filter(Boolean);
}

/** roda um comando e devolve o stdout — usado pelo ffprobe */
function capturar(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let saida = '';
    p.stdout.on('data', (d) => (saida += d));
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve(saida) : reject(new Error(`ffprobe saiu com ${c}`))));
  });
}

function rodar(cmd, args, rotulo) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let erro = '';
    p.stderr.on('data', (d) => (erro += d));
    p.on('error', (e) => reject(new Error(`${rotulo}: ${e.message}`)));
    p.on('close', (c) =>
      c === 0 ? resolve() : reject(new Error(`${rotulo} falhou (código ${c})\n${erro.slice(-1200)}`)),
    );
  });
}

/** vídeo -> palavras com tempo, já reagrupadas */
export async function transcreverVideo(cfg, video) {
  const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
  try {
    const wav = path.join(pasta, 'audio.wav');
    await rodar(
      cfg.ffmpeg,
      ['-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav],
      'FFmpeg',
    );
    const base = path.join(pasta, 'saida');
    const args = ['-m', cfg.modelo, '-l', cfg.idioma, '-ml', '1', '-oj', '-of', base, wav];
    if (cfg.threads > 0) args.unshift('-t', String(cfg.threads));
    await rodar(cfg.whisperCli, args, 'whisper.cpp');

    const palavras = juntarPalavras(lerJsonWhisper(JSON.parse(await readFile(`${base}.json`, 'utf8'))));
    if (!palavras.length) throw new Error('O Whisper não devolveu nenhuma palavra.');
    return palavras;
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

/**
 * fps, largura e altura do vídeo de origem.
 * A composição do Remotion nasce com esses valores: se ela rodar num fps
 * diferente do arquivo, o Remotion reamostra e o zoom ganha trepidação.
 */
export async function sondarVideo(cfg, video) {
  const ffprobe = cfg.ffprobe ?? cfg.ffmpeg.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'));
  try {
    const saida = await capturar(ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,avg_frame_rate',
      '-of', 'default=noprint_wrappers=1:nokey=0',
      video,
    ]);
    const campos = new Map(
      linhasDe(saida)
        .map((l) => l.split('='))
        .filter((par) => par.length === 2)
        .map(([k, v]) => [k.trim(), v.trim()]),
    );
    const ler = (chave) => campos.get(chave);
    const taxa = ler('avg_frame_rate') ?? '';
    const [num, den] = taxa.split('/').map(Number);
    const fps = den ? Math.round((num / den) * 1000) / 1000 : 0;
    return {
      fps: fps > 0 ? Math.round(fps) : 30,
      largura: Number(ler('width')) || 1080,
      altura: Number(ler('height')) || 1920,
    };
  } catch {
    return { fps: 30, largura: 1080, altura: 1920 };
  }
}

export function montarProjeto(video, palavras, template = 'port1-autoridade', meta = {}) {
  return {
    versao: 1,
    video: path.resolve(video),
    nome: path.basename(video),
    duracao: palavras[palavras.length - 1].end,
    fps: meta.fps ?? 30,
    largura: meta.largura ?? 1080,
    altura: meta.altura ?? 1920,
    template,
    estilo: {},
    movimento: 'natural',
    forcaZoom: 1,
    fotos: [],
    palavras,
  };
}
