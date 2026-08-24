import type { AutoEnfase, Block } from './types';

/**
 * Ênfase decidida sozinha, para quem não quer marcar palavra por palavra.
 *  - alternada: a cada 3 palavras, revezando os dois slots
 *  - chave: a palavra mais longa do bloco (o "peso" da frase)
 *
 * Usada tanto pela legenda quanto pelo zoom, para os dois concordarem
 * sobre qual palavra é a importante.
 */
export function enfaseAuto(bloco: Block, i: number, modo: AutoEnfase): 1 | 2 | undefined {
  if (modo === 'alternada') {
    if (i % 3 !== 2) return undefined;
    return (Math.floor(i / 3) % 2 === 0 ? 1 : 2) as 1 | 2;
  }
  if (modo === 'chave') {
    let melhor = -1;
    let tamanho = 4; // palavrinha curta não carrega ênfase
    bloco.words.forEach((w, k) => {
      const limpa = w.text.replace(/\W/g, '');
      if (limpa.length > tamanho) {
        tamanho = limpa.length;
        melhor = k;
      }
    });
    return i === melhor ? 1 : undefined;
  }
  return undefined;
}

/** o bloco tem alguma palavra enfatizada, marcada à mão ou automática? */
export function blocoTemEnfase(bloco: Block, modo: AutoEnfase): boolean {
  return bloco.words.some((w, i) => w.emphasis ?? enfaseAuto(bloco, i, modo));
}
