/**
 * Tempos de cada palavra da narração de um vídeo longo (whisper local + grafia do roteiro).
 *
 *   node agente/longo-tempos.mjs ideias/longos/jogo-terror-ia.json
 *
 * Grava "palavras" ([{text,start,end}], em segundos dentro do segmento) em cada segmento.
 * Serve para a legenda e para cortar a imagem no tempo da frase.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { lerConfig, transcreverVideo } from './nucleo.mjs';
import { alinharComRoteiro } from './alinhar.mjs';

const arquivo = process.argv[2];
const roteiro = JSON.parse(readFileSync(arquivo, 'utf8'));
const cfg = await lerConfig();
for (const s of roteiro.segmentos) {
  if (s.palavras?.length && s.palavrasDe === s.audio) continue;
  const brutas = await transcreverVideo(cfg, s.audio);
  s.palavras = alinharComRoteiro(brutas, s.texto).map((w) => ({ text: w.text, start: +w.start.toFixed(2), end: +w.end.toFixed(2) }));
  s.palavrasDe = s.audio;
  writeFileSync(arquivo, JSON.stringify(roteiro, null, 2));
  console.log(`  ${s.id}: ${s.palavras.length} palavras`);
}
