/**
 * Corte automático dos silêncios.
 *
 * A ideia original era usar o buraco entre o fim de uma palavra e o começo
 * da próxima — de graça, porque a transcrição já foi feita. Só que o
 * whisper.cpp, no modo de timestamp por palavra (`-ml 1`), devolve as
 * palavras coladas: o fim de uma bate exatamente com o começo da seguinte,
 * mesmo depois de uma pausa de verdade na fala. Testamos e confirmamos —
 * `end` e `start` empatados até depois de ponto de interrogação. Ou seja,
 * o buraco nunca existe nos dados, e o corte por palavra nunca acha nada.
 *
 * Por isso o silêncio agora vem de fora: `opcoes.silencios` são os
 * intervalos que o FFmpeg mediu de verdade no volume do áudio (ver
 * `detectarSilencios` em `nucleo.mjs`). As palavras continuam servindo para
 * remapear a legenda depois do corte (`remapear`), só não para achar onde
 * cortar. Sem `opcoes.silencios`, cai de volta no cálculo por palavra —
 * mantido para quem ainda não tem os silêncios medidos.
 */

const PADRAO = {
  /** só corta silêncio maior que isto (segundos) */
  silencioMinimo: 0.35,
  /** um respiro antes da palavra, para a fala não entrar cortada */
  folgaInicio: 0.12,
  /** e depois, para a última sílaba não sumir */
  folgaFim: 0.25,
};

/** blocos de fala como o complemento dos silêncios medidos no áudio */
function blocosPorAudio(silencios, silencioMinimo, duracao, inicio = 0) {
  const relevantes = [...silencios]
    .filter((s) => s.end - s.start >= silencioMinimo)
    .sort((a, b) => a.start - b.start);

  const blocos = [];
  /* `inicio`: nada antes disso entra (a claquete falada de um take) */
  let cursor = inicio;
  for (const s of relevantes) {
    if (s.start > cursor) blocos.push({ start: cursor, end: Math.min(s.start, duracao) });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < duracao) blocos.push({ start: cursor, end: duracao });
  return blocos.filter((b) => b.end > b.start);
}

/** blocos de fala pelo buraco cru entre palavras — o método antigo, de reserva */
function blocosPorPalavras(palavras, silencioMinimo) {
  const ordenadas = [...palavras].sort((a, b) => a.start - b.start);
  const blocos = [{ start: ordenadas[0].start, end: ordenadas[0].end }];
  for (const w of ordenadas.slice(1)) {
    const atual = blocos[blocos.length - 1];
    if (w.start - atual.end >= silencioMinimo) blocos.push({ start: w.start, end: w.end });
    else atual.end = Math.max(atual.end, w.end);
  }
  return blocos;
}

/**
 * Os pedaços do vídeo original que ficam, em ordem e sem se sobrepor.
 *
 * As folgas entram depois de decididos os blocos, só para a fala não sair
 * cortada: se elas entrassem antes, "cortar a partir de 0,35 s" na verdade
 * cortaria a partir de 0,72 s, e o controle mentiria para você.
 */
export function trechosDeFala(palavras, opcoes = {}) {
  const { silencioMinimo, folgaInicio, folgaFim } = { ...PADRAO, ...opcoes };
  const duracao = opcoes.duracao ?? (palavras.length ? palavras[palavras.length - 1].end : 0);
  if (!palavras.length) return [];

  const blocos = opcoes.silencios?.length
    ? blocosPorAudio(opcoes.silencios, silencioMinimo, duracao, opcoes.inicio ?? 0)
    : blocosPorPalavras(palavras, silencioMinimo);
  if (!blocos.length) return [];

  /*
   * Agora sim a folga, sem deixar um trecho invadir o outro. Quando o
   * silêncio é menor que a folga de entrada + saída, o começo com folga
   * encosta (ou passa) no fim do trecho anterior — nesse caso não sobra
   * silêncio nenhum para cortar ali, então em vez de registrar um "corte"
   * que não corta nada, o trecho gruda no anterior.
   */
  const trechos = [];
  for (const bloco of blocos) {
    const anterior = trechos[trechos.length - 1];
    const inicioComFolga = Math.max(0, bloco.start - folgaInicio);
    const end = Math.min(duracao, bloco.end + folgaFim);
    if (anterior && inicioComFolga <= anterior.end) {
      anterior.end = Math.max(anterior.end, end);
    } else if (end > inicioComFolga) {
      trechos.push({ start: inicioComFolga, end });
    }
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
