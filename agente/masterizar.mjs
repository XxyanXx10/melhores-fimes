/**
 * Masteriza o áudio de um MP4: tira o grave embolado, realça a presença da fala
 * e normaliza em duas passadas para -14 LUFS (padrão do YouTube). O vídeo é
 * copiado sem recodificar, então leva poucos segundos.
 *
 *   node agente/masterizar.mjs "C:/.../video.mp4" [mais.mp4 ...]
 *
 * O render.mjs chama isto sozinho no fim de cada render. Antes, os vídeos
 * saíam em -22 LUFS: metade do volume dos outros Shorts e com a voz "abafada".
 */
import { spawnSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import { lerConfig } from './nucleo.mjs';

const EQ = 'highpass=f=80,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3500:t=q:w=1.2:g=3';
const ALVO = 'I=-14:TP=-1.5:LRA=11';

export async function masterizar(arquivo) {
  const ff = (await lerConfig()).ffmpeg || 'ffmpeg';
  const medir = spawnSync(ff, ['-hide_banner', '-nostats', '-i', arquivo, '-af', `${EQ},loudnorm=${ALVO}:print_format=json`, '-f', 'null', '-'], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  // o FFmpeg escreve mais coisa depois do JSON: pega só o bloco com as medidas
  const bloco = String(medir.stderr).match(/\{[^{}]*"input_i"[^{}]*\}/)?.[0];
  if (!bloco) throw new Error('não consegui medir o volume');
  const m = JSON.parse(bloco);
  const filtro = `${EQ},loudnorm=${ALVO}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const tmp = arquivo.replace(/\.mp4$/i, '') + '.master.mp4';
  const r = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', arquivo, '-c:v', 'copy', '-af', filtro, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-300));
  renameSync(tmp, arquivo);
  return Number(m.input_i);
}

if (process.argv[1]?.endsWith('masterizar.mjs')) {
  for (const a of process.argv.slice(2)) {
    try {
      const antes = await masterizar(a);
      console.log(`✓ ${a}: ${antes.toFixed(1)} → -14 LUFS`);
    } catch (e) {
      console.log(`✗ ${a}: ${e.message}`);
    }
  }
}
