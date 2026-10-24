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

/** Extrai apenas os bytes PCM crus (remove cabeçalho RIFF/WAV de 44 bytes se vier) */
function extrairPcm(buf) {
  return buf.subarray(0, 4).toString() === 'RIFF' ? buf.subarray(44) : buf;
}

/** Divide roteiros longos (> 190 palavras) em blocos de ~150 palavras respeitando fim de frase */
function dividirEmBlocos(texto, maxPalavras = 155) {
  const palavrasTotal = texto.trim().split(/\s+/).filter(Boolean).length;
  if (palavrasTotal <= 190) return [texto.trim()];
  const sentencas = texto
    .replace(/\r?\n+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const blocos = [];
  let atual = [];
  let cont = 0;
  for (const s of sentencas) {
    const n = s.split(/\s+/).filter(Boolean).length;
    if (cont + n > maxPalavras && atual.length > 0) {
      blocos.push(atual.join(' '));
      atual = [s];
      cont = n;
    } else {
      atual.push(s);
      cont += n;
    }
  }
  if (atual.length) blocos.push(atual.join(' '));
  return blocos;
}

async function requisitarAudioBloco(c, modelo, textoBloco, estilo, voz) {
  const prompt = estilo ? `${estilo}\n\n${textoBloco}` : textoBloco;
  for (let tent = 1; tent <= 3; tent++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${c.geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: voz || c.geminiVoz } } },
      }),
      signal: AbortSignal.timeout(300000),
    });
    const j = await r.json();
    if (j.error) {
      if (tent < 3) {
        await new Promise((res) => setTimeout(res, 2000 * tent));
        continue;
      }
      throw new Error(j.error.message);
    }
    const dados = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!dados) {
      if (tent < 3) {
        await new Promise((res) => setTimeout(res, 2000 * tent));
        continue;
      }
      throw new Error('a API não devolveu áudio');
    }
    return extrairPcm(Buffer.from(dados.data, 'base64'));
  }
}

// `voz` troca a voz só desta narração (personagens: "pt-br-advisor-8"...); sem ela, a voz do canal
export async function gerarNarracao(texto, titulo, { estilo, voz } = {}) {
  const c = await cfg();
  if (!c.geminiKey) throw new Error('falta "geminiKey" em server/config.json');
  const modelo = c.geminiModeloVoz ?? 'gemini-3.8-flash-tts';
  const blocos = dividirEmBlocos(texto);
  const pcms = [];
  // pausa natural curta (0.16s em 24kHz 16-bit mono) entre blocos de vídeos longos
  const pausaPcm = Buffer.alloc(Math.floor(24000 * 0.16) * 2);
  for (let i = 0; i < blocos.length; i++) {
    if (blocos.length > 1) {
      console.log(`    [voz ${i + 1}/${blocos.length}] narrando trecho (${blocos[i].split(/\s+/).length} palavras)...`);
    }
    const pcm = await requisitarAudioBloco(c, modelo, blocos[i], estilo, voz);
    if (i > 0) pcms.push(pausaPcm);
    pcms.push(pcm);
  }
  const pasta = path.join(RAIZ, 'render', '.fontes', 'narracoes');
  await mkdir(pasta, { recursive: true });
  const nome = `${Date.now()}-${titulo.replace(/[^\w\- áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_')}.wav`;
  const destino = path.join(pasta, nome);
  await writeFile(destino, comoWav(Buffer.concat(pcms)));
  return destino;
}

if (process.argv[1]?.endsWith('voz.mjs')) {
  const [titulo, arq] = process.argv.slice(2);
  const texto = await readFile(arq, 'utf8');
  console.log(await gerarNarracao(texto, titulo ?? 'narracao'));
}
