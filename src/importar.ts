import type { Word } from './types';

export type Cue = { start: number; end: number; text: string };

/** "00:00:01,240" | "00:01.240" | "1.24" -> segundos */
export function parseTempo(bruto: string): number {
  const s = bruto.trim().replace(',', '.');
  const partes = s.split(':').map(Number);
  if (partes.some((n) => Number.isNaN(n))) return NaN;
  return partes.reduce((acc, n) => acc * 60 + n, 0);
}

/** Aceita SRT e VTT — o que importa são as linhas com "-->". */
export function parseCues(txt: string): Cue[] {
  const cues: Cue[] = [];
  const linhas = txt.replace(/\r/g, '').split('\n');
  for (let i = 0; i < linhas.length; i++) {
    const seta = linhas[i].indexOf('-->');
    if (seta < 0) continue;
    const [a, b] = linhas[i].split('-->');
    const start = parseTempo(a);
    const end = parseTempo((b ?? '').split(/\s+/).filter(Boolean)[0] ?? '');
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const corpo: string[] = [];
    for (let j = i + 1; j < linhas.length && linhas[j].trim() !== ''; j++) corpo.push(linhas[j]);
    const text = corpo.join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

/** Distribui as palavras de cada cue dentro da janela do próprio cue. */
export function cuesParaWords(cues: Cue[]): Word[] {
  return cues.flatMap((c) => {
    const partes = c.text.split(/\s+/).filter(Boolean);
    const passo = (c.end - c.start) / Math.max(1, partes.length);
    return partes.map((text, i) => ({
      text,
      start: +(c.start + i * passo).toFixed(2),
      end: +(c.start + (i + 1) * passo - 0.02).toFixed(2),
    }));
  });
}

/** Texto corrido, sem tempos: distribui pela duração do vídeo. */
export function textoParaWords(texto: string, duracao: number): Word[] {
  const partes = texto.split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  const passo = duracao / partes.length;
  return partes.map((text, i) => ({
    text,
    start: +(i * passo).toFixed(2),
    end: +((i + 1) * passo - 0.02).toFixed(2),
  }));
}

export function importar(texto: string, duracao: number): Word[] {
  const cues = parseCues(texto);
  return cues.length ? cuesParaWords(cues) : textoParaWords(texto, duracao);
}

/**
 * Quantos caracteres cabem numa linha da prévia, dado o tamanho da fonte
 * e a margem de segurança. Serve para avisar quando o bloco vai quebrar.
 */
export function caracteresPorLinha(fontSize: number, safeMargin: number): number {
  const larguraUtil = 100 - 2 * safeMargin;
  // uma letra ocupa ~0.55 da altura da fonte em média
  return Math.max(6, Math.floor(larguraUtil / (fontSize * 0.55)));
}
