/**
 * Corrige a legenda usando o roteiro original.
 *
 * O Whisper acerta o TEMPO de cada palavra, mas erra a grafia ("chat de PP",
 * "link da Bill"). Quando o texto falado é conhecido (roteiro da aba Ideias),
 * alinhamos as duas sequências e ficamos com o tempo do Whisper e a palavra do
 * roteiro. Alinhamento por programação dinâmica (tipo Levenshtein) sobre
 * palavras normalizadas, com custo menor para palavras parecidas.
 */
function norm(w) {
  return String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]/g, '');
}

function parecidas(a, b) {
  if (a === b) return 0;
  if (!a || !b) return 1;
  // distância de edição relativa entre as duas palavras
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n] / Math.max(m, n);
}

/**
 * @param palavras  [{text,start,end}] do Whisper
 * @param texto     roteiro exato que foi narrado
 * @returns nova lista de palavras com a grafia do roteiro e o tempo do Whisper
 */
export function alinharComRoteiro(palavras, texto) {
  const ref = texto.split(/\s+/).filter(Boolean);
  const W = palavras.map((p) => norm(p.text));
  const R = ref.map(norm);
  const m = W.length, n = R.length;
  const custo = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
  const via = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));
  for (let i = 1; i <= m; i++) { custo[i][0] = i; via[i][0] = 1; }
  for (let j = 1; j <= n; j++) { custo[0][j] = j; via[0][j] = 2; }
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const diag = custo[i - 1][j - 1] + parecidas(W[i - 1], R[j - 1]) * 1.2;
      const del = custo[i - 1][j] + 1; // palavra do Whisper sem par (ex.: "chat de PP" → "ChatGPT")
      const ins = custo[i][j - 1] + 1; // palavra do roteiro que o Whisper juntou com outra
      if (diag <= del && diag <= ins) { custo[i][j] = diag; via[i][j] = 0; }
      else if (del <= ins) { custo[i][j] = del; via[i][j] = 1; }
      else { custo[i][j] = ins; via[i][j] = 2; }
    }
  // volta pelo caminho: cada palavra do Whisper recebe 0..n palavras do roteiro
  const grupos = palavras.map(() => []);
  let i = m, j = n;
  const pendentes = [];
  while (i > 0 || j > 0) {
    const v = via[i][j];
    if (i > 0 && j > 0 && v === 0) { grupos[i - 1].unshift(ref[j - 1], ...pendentes.splice(0)); i--; j--; }
    else if (i > 0 && (j === 0 || v === 1)) { i--; }
    else { pendentes.unshift(ref[j - 1]); j--; }
  }
  if (pendentes.length && grupos.length) grupos[0].unshift(...pendentes);

  // monta a saída: palavras do Whisper sem par ficam coladas no tempo da vizinha que tem texto
  const saida = [];
  for (const [k, p] of palavras.entries()) {
    if (grupos[k].length) saida.push({ ...p, text: grupos[k].join(' ') });
    else if (saida.length) saida[saida.length - 1].end = p.end;
    else if (palavras[k + 1]) palavras[k + 1] = { ...palavras[k + 1], start: p.start };
  }
  return saida;
}
