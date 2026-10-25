/**
 * Vídeo longo (16:9) juntando Shorts prontos — o caminho das horas assistidas.
 *
 *   node agente/compilado.mjs ideias/compilados/ia-deu-errado-1.json
 *
 * O JSON: { "titulo": "7 VEZES QUE A IA DEU MUITO ERRADO", "subtitulo": "histórias reais",
 *           "saida": "C:/.../arquivo.mp4", "clipes": [{ "arquivo": "C:/.../video.mp4", "titulo": "A IA que…" }] }
 * Cada Short vertical entra no meio da tela com o próprio vídeo desfocado de fundo; antes de cada um
 * aparece um cartão "#1 / título" de 2 s com whoosh. No fim, masteriza o áudio.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';
import { masterizar } from './masterizar.mjs';

const cfg = JSON.parse(readFileSync(path.join(RAIZ, 'server', 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const FF = cfg.ffmpeg ?? 'ffmpeg';
const FONTE = 'C\\:/Windows/Fonts/ariblk.ttf';
const WHOOSH = path.join(RAIZ, 'public', 'midia', 'sfx-meme', 'whoosh-sound-effect.mp3');
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];

const esc = (t) => t.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%');

function cartao(saida, grande, pequeno, dur, cor = '0x0b1020') {
  const linhas = [
    `drawtext=fontfile='${FONTE}':text='${esc(grande)}':fontsize=150:fontcolor=0xffd21f:x=(w-tw)/2:y=(h-th)/2-90`,
    `drawtext=fontfile='${FONTE}':text='${esc(pequeno)}':fontsize=64:fontcolor=white:x=(w-tw)/2:y=(h/2)+70`,
  ];
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${cor}:s=1920x1080:d=${dur}:r=30`,
    '-i', WHOOSH, '-filter_complex', `[0:v]${linhas.join(',')},fade=t=in:d=0.2,fade=t=out:st=${dur - 0.2}:d=0.2[v];` +
    `[1:a]atrim=0:${dur},volume=0.5,apad=whole_dur=${dur}[a]`, '-map', '[v]', '-map', '[a]', '-t', String(dur), ...ENC, saida]);
}

function clipe(entrada, saida) {
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', entrada, '-filter_complex',
    '[0:v]split[a][b];[a]scale=1920:-2,crop=1920:1080,boxblur=30:3,eq=brightness=-0.18[fundo];' +
    '[b]scale=-2:1080[frente];[fundo][frente]overlay=(W-w)/2:0[v]', '-map', '[v]', '-map', '0:a', ...ENC, saida]);
}

export async function compilar(arquivo) {
  const c = JSON.parse(readFileSync(arquivo, 'utf8'));
  const tmp = path.join(RAIZ, 'render', '.tmp', 'compilado');
  mkdirSync(tmp, { recursive: true });
  const partes = [];
  const intro = path.join(tmp, '00-intro.mp4');
  cartao(intro, c.titulo, c.subtitulo ?? '', 3);
  partes.push(intro);
  c.clipes.forEach((k, i) => {
    if (!existsSync(k.arquivo)) throw new Error(`não achei ${k.arquivo}`);
    const n = String(i + 1).padStart(2, '0');
    const cap = path.join(tmp, `${n}-cartao.mp4`);
    cartao(cap, `#${i + 1}`, k.titulo, 2);
    const v = path.join(tmp, `${n}-video.mp4`);
    console.log(`  ${n} ${k.titulo}`);
    clipe(k.arquivo, v);
    partes.push(cap, v);
  });
  const fim = path.join(tmp, '99-fim.mp4');
  cartao(fim, 'INSCREVA-SE', c.fim ?? 'toda semana tem mais histórias assim', 3);
  partes.push(fim);
  const lista = path.join(tmp, 'lista.txt');
  writeFileSync(lista, partes.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', c.saida]);
  await masterizar(c.saida);
  console.log(`✓ ${c.saida}`);
}

if (process.argv[1]?.endsWith('compilado.mjs')) {
  for (const a of process.argv.slice(2)) await compilar(a);
}
