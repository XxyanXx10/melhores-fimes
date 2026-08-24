import type { Block, Word } from './types';

export function agrupar(words: Word[], porBloco: number): Block[] {
  const blocos: Block[] = [];
  for (let i = 0; i < words.length; i += porBloco) {
    const fatia = words.slice(i, i + porBloco);
    if (!fatia.length) continue;
    blocos.push({
      id: `b${i}`,
      start: fatia[0].start,
      end: fatia[fatia.length - 1].end,
      words: fatia,
      highlight: 0,
    });
  }
  return blocos;
}

/** Redistribui os tempos de um novo texto dentro da janela do bloco. */
export function reescrever(bloco: Block, texto: string): Word[] {
  const partes = texto.split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  const passo = (bloco.end - bloco.start) / partes.length;
  return partes.map((text, i) => ({
    text,
    start: +(bloco.start + i * passo).toFixed(2),
    end: +(bloco.start + (i + 1) * passo - 0.02).toFixed(2),
  }));
}

export function blocoAtivo(blocos: Block[], t: number): Block | undefined {
  return blocos.find((b) => t >= b.start && t <= b.end) ?? undefined;
}

export function palavraAtiva(bloco: Block | undefined, t: number): number {
  if (!bloco) return -1;
  const i = bloco.words.findIndex((w) => t >= w.start && t <= w.end);
  return i;
}

export function formatarTempo(t: number): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${r}`;
}
