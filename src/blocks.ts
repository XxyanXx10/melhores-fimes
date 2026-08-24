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

/**
 * Ênfase manual escrita no próprio texto do bloco:
 *   *palavra*   -> ênfase 1     **palavra** -> ênfase 2
 * A pontuação colada fica de fora da marcação (*simples*, mantém a vírgula normal).
 */
export function lerMarcacao(parte: string): { text: string; emphasis?: 1 | 2 } {
  const dois = parte.match(/^(\W*)\*\*(.+?)\*\*(\W*)$/);
  if (dois) return { text: dois[1] + dois[2] + dois[3], emphasis: 2 };
  const um = parte.match(/^(\W*)\*(.+?)\*(\W*)$/);
  if (um) return { text: um[1] + um[2] + um[3], emphasis: 1 };
  return { text: parte };
}

function escreverMarcacao(w: Word): string {
  if (!w.emphasis) return w.text;
  const m = /^(\W*)(.*?)(\W*)$/.exec(w.text);
  const antes = m?.[1] ?? '';
  const meio = m?.[2] || w.text;
  const depois = m?.[3] ?? '';
  const cerca = w.emphasis === 2 ? '**' : '*';
  return `${antes}${cerca}${meio}${cerca}${depois}`;
}

/** o texto editável de um bloco, já com as marcações de ênfase */
export function textoDoBloco(bloco: Block): string {
  return bloco.words.map(escreverMarcacao).join(' ');
}

/** Redistribui os tempos de um novo texto dentro da janela do bloco. */
export function reescrever(bloco: Block, texto: string): Word[] {
  const partes = texto.split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  const passo = (bloco.end - bloco.start) / partes.length;
  return partes.map((parte, i) => {
    const { text, emphasis } = lerMarcacao(parte);
    return {
      text,
      emphasis,
      start: +(bloco.start + i * passo).toFixed(2),
      end: +(bloco.start + (i + 1) * passo - 0.02).toFixed(2),
    };
  });
}

export function blocoAtivo(blocos: Block[], t: number): Block | undefined {
  return blocos.find((b) => t >= b.start && t <= b.end) ?? undefined;
}

export function palavraAtiva(bloco: Block | undefined, t: number): number {
  if (!bloco) return -1;
  const i = bloco.words.findIndex((w) => t >= w.start && t <= w.end);
  return i;
}

/**
 * Índice da última palavra que já começou — o que a entrada "palavra a palavra"
 * usa para revelar. Diferente de palavraAtiva, não volta a -1 nos silêncios,
 * senão o texto pisca entre uma palavra e outra.
 */
export function ultimaIniciada(bloco: Block | undefined, t: number): number {
  if (!bloco) return -1;
  let i = -1;
  for (let k = 0; k < bloco.words.length; k++) if (t >= bloco.words[k].start) i = k;
  return i;
}

export function formatarTempo(t: number): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${r}`;
}
