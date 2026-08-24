import type { Word } from './types';

/**
 * Palavras que costumam carregar o peso numa fala de corte:
 * viradas de raciocínio, absolutos, e o vocabulário de resultado.
 * Não é análise de linguagem — é uma lista curta que erra pouco.
 */
const GATILHOS = new Set([
  'mas',
  'porém',
  'entretanto',
  'só',
  'nunca',
  'ninguém',
  'nada',
  'tudo',
  'sempre',
  'jamais',
  'imagina',
  'olha',
  'veja',
  'atenção',
  'segredo',
  'verdade',
  'problema',
  'solução',
  'resultado',
  'economia',
  'economizou',
  'grana',
  'dinheiro',
  'real',
  'melhor',
  'pior',
  'maior',
  'primeiro',
  'único',
  'grátis',
  'errado',
  'certo',
  'importante',
  'principal',
]);

function limpar(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\wáàâãéêíóôõúüç]/gi, '');
}

export type Momento = {
  /** instante em que a câmera deve reagir */
  t: number;
  /** o quanto o momento pede — quanto maior, mais fundo o zoom */
  peso: number;
  indice: number;
};

/**
 * Onde a fala pede movimento de câmera.
 *
 * Os sinais, em ordem de confiança:
 *  - pausa antes da palavra (quem fala guarda silêncio antes do que importa)
 *  - número ou valor (dado concreto sempre merece close)
 *  - palavra-gatilho da lista acima
 *  - começo de frase nova (a anterior terminou em . ! ?)
 *  - palavra arrastada: durou muito para o tamanho que tem
 */
export function pontuarPalavras(words: Word[]): Momento[] {
  const momentos: Momento[] = [];

  words.forEach((w, i) => {
    const anterior = words[i - 1];
    const texto = limpar(w.text);
    if (!texto) return;

    let peso = 0;
    const pausa = anterior ? w.start - anterior.end : 0;

    if (pausa >= 0.5) peso += 3;
    else if (pausa >= 0.28) peso += 2;

    if (/\d/.test(w.text) || /%|r\$/i.test(w.text)) peso += 3;
    if (GATILHOS.has(texto)) peso += 2;
    if (anterior && /[.!?]$/.test(anterior.text)) peso += 2;
    if (w.emphasis) peso += 2;

    // arrastada: mais de 90 ms por letra é fala enfática, não fala corrida
    const porLetra = (w.end - w.start) / Math.max(1, texto.length);
    if (porLetra > 0.09 && texto.length >= 4) peso += 1;

    if (peso >= 3) momentos.push({ t: w.start, peso, indice: i });
  });

  return momentos;
}

/**
 * Afina a lista para o vídeo não virar uma sequência de zooms.
 * Mantém o momento mais forte de cada janela de `intervalo` segundos.
 */
export function afinar(momentos: Momento[], intervalo: number): Momento[] {
  const ordenados = [...momentos].sort((a, b) => b.peso - a.peso || a.t - b.t);
  const escolhidos: Momento[] = [];
  for (const m of ordenados) {
    if (escolhidos.every((e) => Math.abs(e.t - m.t) >= intervalo)) escolhidos.push(m);
  }
  return escolhidos.sort((a, b) => a.t - b.t);
}
