/**
 * Roteiro → áudio com a voz do Yan (voz personalizada no Gemini/AI Studio).
 *
 *   node agente/voz.mjs "titulo do video" roteiro.txt
 *
 * O WAV vai para render/.fontes/narracoes/, pronto para a aba Canal Dark.
 * O texto aceita as marcas do AI Studio, como <short pause>.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

async function cfg() {
  return JSON.parse((await readFile(path.join(RAIZ, 'server', 'config.json'), 'utf8')).replace(/^\uFEFF/, ''));
}

/** PCM cru → WAV (a API devolve áudio sem cabeçalho em alguns modelos) */
function comoWav(buf, taxa = 24000) {
  if (buf.subarray(0, 4).toString() === 'RIFF') return buf;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + buf.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(taxa, 24);
  h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(buf.length, 40);
  return Buffer.concat([h, buf]);
}

export async function gerarNarracao(texto, titulo, { estilo } = {}) {
  const c = await cfg();
  if (!c.geminiKey) throw new Error('falta "geminiKey" em server/config.json');
  const modelo = c.geminiModeloVoz ?? 'gemini-3.8-flash-tts';
  const prompt = estilo ? `${estilo}\n\n${texto}` : texto;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${c.geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: c.geminiVoz } } },
    }),
    signal: AbortSignal.timeout(300000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const dados = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!dados) throw new Error('a API não devolveu áudio');
  const pasta = path.join(RAIZ, 'render', '.fontes', 'narracoes');
  await mkdir(pasta, { recursive: true });
  const nome = `${Date.now()}-${titulo.replace(/[^\w\- áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_')}.wav`;
  const destino = path.join(pasta, nome);
  await writeFile(destino, comoWav(Buffer.from(dados.data, 'base64')));
  return destino;
}

if (process.argv[1]?.endsWith('voz.mjs')) {
  const [titulo, arq] = process.argv.slice(2);
  const texto = await readFile(arq, 'utf8');
  console.log(await gerarNarracao(texto, titulo ?? 'narracao'));
}
