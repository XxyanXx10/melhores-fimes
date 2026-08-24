/**
 * whisper.cpp com -ml 1 devolve um segmento por *pedaço* de palavra:
 * "re", "aj", "uste" viram três entradas. O texto de cada segmento mantém
 * o espaço inicial quando começa uma palavra nova — é esse espaço que usamos
 * para reagrupar, em vez de adivinhar por hífen.
 */
export function juntarPalavras(pedacos) {
  const palavras = [];
  for (const p of pedacos) {
    const bruto = p.text ?? '';
    const texto = bruto.trim();
    if (!texto) continue;
    const comecaPalavra = /^\s/.test(bruto) || palavras.length === 0;
    const soPontuacao = /^[.,!?;:…)\]"»]+$/.test(texto);

    if (comecaPalavra && !soPontuacao) {
      palavras.push({ text: texto, start: p.start, end: p.end });
    } else {
      const anterior = palavras[palavras.length - 1];
      anterior.text += texto;
      anterior.end = p.end;
    }
  }
  return palavras.map((w) => ({
    text: w.text,
    start: +(w.start / 1000).toFixed(2),
    end: +(w.end / 1000).toFixed(2),
  }));
}

/** Lê o JSON do whisper.cpp (-oj) e devolve os pedaços com offsets em ms. */
export function lerJsonWhisper(json) {
  const itens = json?.transcription ?? [];
  return itens.map((t) => ({
    text: t.text ?? '',
    start: t.offsets?.from ?? 0,
    end: t.offsets?.to ?? 0,
  }));
}
