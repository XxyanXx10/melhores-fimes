/**
 * Corte automático dos silêncios.
 *
 * A transcrição já sabe onde cada palavra começa e termina; o que sobra entre
 * elas é respiração, pausa e "éééé". Daqui saem os trechos que ficam no vídeo
 * final, e os tempos da legenda recalculados para a nova duração.
 *
 * Trabalhar sobre as palavras, e não sobre o volume do áudio, evita cortar no
 * meio de uma frase falada baixinho — e é de graça, porque a transcrição já foi
 * feita.
 */

const PADRAO = {
  /** só corta silêncio maior que isto (segundos) */
  silencioMinimo: 0.35,
  /** um respiro antes da palavra, para a fala não entrar cortada */
  folgaInicio: 0.12,
  /** e depois, para a última sílaba não sumir */
  folgaFim: 0.25,
};

/**
 * Os pedaços do vídeo original que ficam, em ordem e sem se sobrepor.
 *
 * A comparação é feita no silêncio cru — o buraco entre o fim de uma palavra e
 * o começo da próxima. As folgas entram depois, só para a fala não sair
 * cortada: se elas entrassem antes, "cortar a partir de 0,35 s" na verdade
 * cortaria a partir de 0,72 s, e o controle mentiria para você.
 */
export function trechosDeFala(palavras, opcoes = {}) {
  const { silencioMinimo, folgaInicio, folgaFim } = { ...PADRAO, ...opcoes };
  const duracao = opcoes.duracao ?? (palavras.length ? palavras[palavras.length - 1].end : 0);
  if (!palavras.length) return [];

  const ordenadas = [...palavras].sort((a, b) => a.start - b.start);

  /* primeiro os blocos de fala contínua, medidos sem folga nenhuma */
  const blocos = [{ start: ordenadas[0].start, end: ordenadas[0].end }];
  for (const w of ordenadas.slice(1)) {
    const atual = blocos[blocos.length - 1];
    if (w.start - atual.end >= silencioMinimo) blocos.push({ start: w.start, end: w.end });
    else atual.end = Math.max(atual.end, w.end);
  }

  /* agora sim a folga, sem deixar um trecho invadir o outro */
  const trechos = [];
  for (const bloco of blocos) {
    const anterior = trechos[trechos.length - 1];
    const start = Math.max(0, bloco.start - folgaInicio, anterior ? anterior.end : 0);
    const end = Math.min(duracao, bloco.end + folgaFim);
    if (end > start) trechos.push({ start, end });
  }

  return trechos.map((t) => ({ start: +t.start.toFixed(3), end: +t.end.toFixed(3) }));
}

export function duracaoDosTrechos(trechos) {
  return +trechos.reduce((s, t) => s + (t.end - t.start), 0).toFixed(3);
}

/**
 * Recalcula os tempos da legenda para o vídeo já cortado.
 *
 * Uma palavra que ficava aos 40 s, com 12 s de silêncio removidos antes dela,
 * passa a valer 28 s. Sem isto a legenda continuaria marcando o tempo do vídeo
 * antigo e sairia toda fora de lugar.
 */
export function remapear(palavras, trechos) {
  if (!trechos.length) return palavras;

  const comOffset = [];
  let acumulado = 0;
  for (const t of trechos) {
    comOffset.push({ ...t, offset: acumulado });
    acumulado += t.end - t.start;
  }

  const novo = (t) => {
    for (const trecho of comOffset) {
      if (t < trecho.start) return +trecho.offset.toFixed(3); // caiu num silêncio: encosta no próximo
      if (t <= trecho.end) return +(trecho.offset + (t - trecho.start)).toFixed(3);
    }
    return +acumulado.toFixed(3);
  };

  return palavras.map((w) => ({ ...w, start: novo(w.start), end: novo(w.end) }));
}

/** o que a interface mostra antes de cortar: quanto sai e quanto sobra */
export function resumoDoCorte(palavras, duracao, opcoes = {}) {
  const trechos = trechosDeFala(palavras, { ...opcoes, duracao });
  const nova = duracaoDosTrechos(trechos);
  return {
    trechos,
    duracaoOriginal: +duracao.toFixed(2),
    duracaoNova: nova,
    removido: +(duracao - nova).toFixed(2),
    cortes: Math.max(0, trechos.length - 1),
  };
}
