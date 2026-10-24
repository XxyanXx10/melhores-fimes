/**
 * Gera as falas do "assistente" (voz brasileira do Gemini) com um leve tratamento
 * de voz digital: corte de grave, brilho e um eco curtinho de sala.
 *
 *   node vfx/jarvis_gerar_falas.mjs vfx/jarvis_falas.json <pasta_saida>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gerarNarracao } from '../agente/voz.mjs';
import { lerConfig } from '../agente/nucleo.mjs';

const [arq, saida] = process.argv.slice(2);
const r = JSON.parse(readFileSync(arq, 'utf8'));
const ff = (await lerConfig()).ffmpeg;
mkdirSync(saida, { recursive: true });
const FILTRO = 'highpass=f=140,equalizer=f=3000:t=q:w=1:g=3,aecho=0.8:0.5:40:0.18,loudnorm=I=-16:TP=-2';
for (const [i, f] of r.falas.entries()) {
  const bruto = await gerarNarracao(f.texto, `jarvis-${i + 1}`, { voz: r.voz });
  f.arquivo = path.join(saida, `fala${i + 1}.wav`);
  execFileSync(ff, ['-y', '-loglevel', 'error', '-i', bruto, '-af', FILTRO, '-ar', '48000', f.arquivo]);
  f.duracao = Number(execFileSync(ff.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f.arquivo]).toString().trim());
  console.log(`${f.em.toFixed(1)}s (+${f.duracao.toFixed(2)}s) ${f.texto}`);
}
writeFileSync(path.join(saida, 'falas.json'), JSON.stringify(r, null, 2));
