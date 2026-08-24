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

export function montarProjeto(video, palavras, template = 'port1-autoridade') {
  return {
    versao: 1,
    video: path.resolve(video),
    nome: path.basename(video),
    duracao: palavras[palavras.length - 1].end,
    template,
    estilo: {},
    palavras,
  };
}
