/**
 * Diálogo com vozes diferentes → um áudio só, pronto para virar vídeo.
 *
 *   node agente/dialogo.mjs ideias/roteiros-livres/ep01-estagiario-inventava.json
 *
 * O arquivo tem "elenco" (personagem → voz do Gemini; vazio = voz do canal) e
 * "falas" ([{ quem, texto }]). Cada fala é narrada com a voz do personagem; o
 * robô ganha voz mais aguda e um eco metálico curto. As falas são niveladas no
 * volume, coladas com uma pausa curta, e o resultado vai para "audio" e "texto"
 * no próprio arquivo — aí o roteiro-livre.mjs monta o vídeo base como sempre.
 * Áudios de cada fala ficam em cache: refazer uma fala = apagar o "arquivo" dela.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';
import { lerConfig } from './nucleo.mjs';
import { gerarNarracao } from './voz.mjs';

const PAUSA = 0.22; // segundos entre uma fala e outra
const ROBO = 'asetrate=24000*1.22,aresample=24000,atempo=0.9,aecho=0.8:0.55:14:0.25';

export async function montarDialogo(arquivo) {
  const r = JSON.parse(await readFile(arquivo, 'utf8'));
  const ff = (await lerConfig()).ffmpeg || 'ffmpeg';
  const pasta = path.join(RAIZ, 'render', '.fontes', 'narracoes', 'dialogos', path.basename(arquivo, '.json'));
  await mkdir(pasta, { recursive: true });

  const partes = [];
  for (const [i, f] of r.falas.entries()) {
    if (!f.arquivo || !existsSync(f.arquivo)) {
      const voz = r.elenco?.[f.quem] || undefined;
      console.log(`  fala ${i + 1} (${f.quem}): ${f.texto.slice(0, 50)}`);
      const bruto = await gerarNarracao(f.texto, `${path.basename(arquivo, '.json')}-${i + 1}-${f.quem}`, { voz });
      const saida = path.join(pasta, `${String(i + 1).padStart(2, '0')}-${f.quem}.wav`);
      const filtro = [f.quem === 'robo' ? ROBO : null, 'loudnorm=I=-18:TP=-2:LRA=9', 'aresample=24000'].filter(Boolean).join(',');
      execFileSync(ff, ['-y', '-loglevel', 'error', '-i', bruto, '-af', filtro, '-ac', '1', saida]);
      f.arquivo = saida;
      await writeFile(arquivo, JSON.stringify(r, null, 2), 'utf8');
    }
    partes.push(f.arquivo);
  }

  // cola as falas com uma pausa curta entre elas
  const silencio = path.join(pasta, 'pausa.wav');
  execFileSync(ff, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono`, '-t', String(PAUSA), silencio]);
  const lista = partes.flatMap((p, i) => (i ? [silencio, p] : [p]));
  const txt = path.join(pasta, 'lista.txt');
  await writeFile(txt, lista.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
  const final = path.join(pasta, 'dialogo.wav');
  execFileSync(ff, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', txt, '-c:a', 'pcm_s16le', final]);

  r.audio = final;
  r.texto = r.falas.map((f) => f.texto).join(' ');
  await writeFile(arquivo, JSON.stringify(r, null, 2), 'utf8');
  return final;
}

if (process.argv[1]?.endsWith('dialogo.mjs')) {
  for (const a of process.argv.slice(2)) console.log('✓', await montarDialogo(a));
}
