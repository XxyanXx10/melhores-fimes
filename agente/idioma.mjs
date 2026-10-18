/**
 * Texto na tela é sempre em português: o público do canal não lê inglês.
 *
 * `pareceIngles` é uma régua simples de palavras comuns — serve para avisar,
 * não para decidir sozinha. `traduzirTitulo` usa o Gemini e devolve null se
 * ele não responder (limite de gasto, sem rede): quem chama decide o que fazer.
 */
const EN = new Set(
  'the and of to is are was were its it with for from says said after new how why what your you can will be by on at this that these those keep keeps shows show becomes become latest report reports into about than their they who has have had not just now more most like make makes made using use offers offer allegedly free if first all get gets top best wants want could would should may might there here been being does did'.split(' '),
);
const PT = new Set(
  'o a os as de do da dos das e é que em no na nos nas para pra com um uma por se não como mais ao à sua seu são foi ser ter tem já quando'.split(' '),
);

export function pareceIngles(texto) {
  const palavras = String(texto ?? '')
    .toLowerCase()
    .replace(/[^a-zà-ú'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (palavras.length < 3) return false;
  let en = 0;
  let pt = 0;
  for (const p of palavras) {
    if (EN.has(p)) en++;
    if (PT.has(p)) pt++;
  }
  return en >= 2 && en > pt;
}

export async function traduzirTitulo(texto) {
  try {
    const { gemini } = await import('./ideias.mjs');
    const r = await gemini(
      `Traduza este título de notícia para português do Brasil, natural e curto, como manchete de site brasileiro. Mantenha nomes próprios e de produtos. Responda só com o título traduzido, sem aspas.\n\n${texto}`,
    );
    const t = String(r ?? '').trim().replace(/^["“]|["”]$/g, '');
    return t && !pareceIngles(t) ? t : null;
  } catch {
    return null;
  }
}
