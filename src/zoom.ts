import type { AutoEnfase, Block, Movimento, Scene, Word, Zoom } from './types';
import { enfaseAuto } from './enfase';
import { afinar, pontuarPalavras } from './momentos';

/** desaceleração: rápido no começo, parando no fim — o "estalo" do corte */
function saida(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/** acelera e desacelera: o jeito que uma câmera de verdade se move */
function entradaSaida(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/**
 * Escala e ponto de foco no instante t.
 * Fora de qualquer trecho a câmera fica parada no tamanho original.
 */
export function estadoZoom(zooms: Zoom[], t: number): { escala: number; origem: string } {
  const z = zooms.find((x) => t >= x.start && t <= x.end);
  if (!z) return { escala: 1, origem: '50% 50%' };
  const dur = Math.max(0.001, z.end - z.start);
  const bruto = Math.min(1, Math.max(0, (t - z.start) / dur));
  const p =
    z.curva === 'linear' ? bruto : z.curva === 'saida' ? saida(bruto) : entradaSaida(bruto);
  return {
    escala: z.de + (z.para - z.de) * p,
    origem: `${z.origemX}% ${z.origemY}%`,
  };
}

/**
 * O enquadramento de um vídeo falado tem a cabeça na parte de cima,
 * então a câmera fecha um pouco acima do centro — nunca no meio exato.
 */
function foco(i: number): { origemX: number; origemY: number } {
  const lados = [50, 46, 54, 48];
  return { origemX: lados[i % lados.length], origemY: 38 };
}

/**
 * Movimento natural: a câmera reage aos pontos que a fala marca
 * (ver momentos.ts) e **segura** a escala entre um ponto e outro,
 * em vez de voltar ao normal. É o que separa "câmera dirigida"
 * de "zoom piscando a cada frase".
 */
function zoomNatural(words: Word[], duracao: number, forca: number): Zoom[] {
  // um momento a cada ~3,5s no máximo: mais que isso vira videoclipe
  const momentos = afinar(pontuarPalavras(words), 3.5);
  if (!momentos.length) return [];

  const trechos: Zoom[] = [];
  let escala = 1;
  let cursor = 0;

  momentos.forEach((m, i) => {
    const alvo = decidirEscala(escala, m.peso, forca);
    // pontos mais fortes movem a câmera mais rápido
    const transicao = m.peso >= 5 ? 0.5 : 0.85;
    const inicio = Math.max(cursor, m.t - 0.1);
    const fim = Math.min(duracao, inicio + transicao);
    if (fim <= inicio) return;

    if (inicio > cursor) {
      trechos.push(segurar(`zh${i}`, cursor, inicio, escala, i));
    }
    trechos.push({
      id: `zn${i}`,
      start: inicio,
      end: fim,
      de: escala,
      para: alvo,
      ...foco(i),
      curva: m.peso >= 5 ? 'saida' : 'entradaSaida',
    });
    escala = alvo;
    cursor = fim;
  });

  if (cursor < duracao) trechos.push(segurar('zhf', cursor, duracao, escala, momentos.length));
  return trechos;
}

/** trecho parado: a câmera fica onde chegou até o próximo momento */
function segurar(id: string, start: number, end: number, escala: number, i: number): Zoom {
  return { id, start, end, de: escala, para: escala, ...foco(i), curva: 'linear' };
}

/**
 * Para onde a câmera vai a partir de onde está.
 * Fechada demais, ela precisa abrir; aberta, ela fecha — e o quanto
 * ela fecha depende do peso do momento.
 */
function decidirEscala(atual: number, peso: number, forca: number): number {
  const fundo = 1 + (peso >= 5 ? 0.13 : 0.07) * forca;
  const meio = 1 + 0.04 * forca;
  if (atual > 1 + 0.05 * forca) return peso >= 5 ? meio : 1;
  return fundo;
}

/**
 * Gera os trechos de movimento a partir da fala.
 *
 *  - natural : a câmera reage aos pontos que a fala marca e segura entre eles
 *  - suave   : deriva lenta, alternando fechar e abrir a cada cena (Ken Burns)
 *  - ritmo   : um estalo curto a cada bloco de legenda
 *
 * `forca` multiplica o quanto a câmera fecha (1 = padrão).
 */
export function gerarZooms(
  modo: Movimento,
  blocos: Block[],
  cenas: Scene[],
  duracao: number,
  forca = 1,
  autoEnfase: AutoEnfase = 'off',
  words: Word[] = [],
): Zoom[] {
  if (modo === 'off' || !duracao) return [];

  if (modo === 'natural') {
    // a ênfase automática conta como sinal: a câmera e a legenda
    // precisam concordar sobre qual palavra é a importante
    const palavras = blocos.flatMap((b) =>
      b.words.map((w, i) => ({ ...w, emphasis: w.emphasis ?? enfaseAuto(b, i, autoEnfase) })),
    );
    return zoomNatural(palavras.length ? palavras : words, duracao, forca);
  }

  if (modo === 'suave') {
    return cenas.map((c, i) => {
      const fecha = 1 + 0.12 * forca;
      const fechando = i % 2 === 0;
      return {
        id: `zs${i}`,
        start: c.start,
        end: c.end,
        de: fechando ? 1 : fecha,
        para: fechando ? fecha : 1,
        ...foco(i),
        curva: 'linear' as const,
      };
    });
  }

  return blocos.map((b, i) => {
    // entra fechado e relaxa: o estalo acontece nos primeiros instantes do bloco
    const pico = 1 + 0.16 * forca;
    const descanso = 1 + 0.04 * forca;
    return {
      id: `zr${b.id}`,
      start: b.start,
      end: Math.max(b.start + 0.2, Math.min(duracao, b.end)),
      de: pico,
      para: descanso,
      ...foco(i),
      curva: 'saida' as const,
    };
  });
}
