/**
 * Banco de cenas reaproveitáveis do Canal Dark.
 *
 * Cada vez que um vídeo usa uma cena boa (animação do Remotion, imagem gerada
 * por IA ou clipe), ela fica guardada aqui com tema e etiquetas. Antes de criar
 * uma cena nova, o agente procura no banco: reaproveitar é grátis e mantém o
 * padrão visual do canal.
 *
 *   node agente/banco-cenas.mjs listar [tema]
 *   node agente/banco-cenas.mjs buscar "<texto da fala>" [tema]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.join(aqui, '..');
export const ARQUIVO_BANCO = path.join(RAIZ, 'banco-cenas', 'banco.json');
/** mídias do banco ficam em public/ para o Remotion achar no render */
export const PASTA_MIDIA_BANCO = path.join(RAIZ, 'public', 'midia', 'banco');

const PALAVRAS_VAZIAS = new Set(
  'a o as os de da do das dos e é em no na nos nas um uma uns umas para pra por com que se seu sua seus suas mais muito ele ela eles elas isso esse essa este esta você vocês não sim já ou como ao à também só mas quando onde qual quais tem ter foi ser está estão vai vão'.split(' '),
);

export function palavrasChave(texto) {
  return [
    ...new Set(
      String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s%]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !PALAVRAS_VAZIAS.has(w)),
    ),
  ];
}

export async function lerBanco() {
  if (!existsSync(ARQUIVO_BANCO)) return { versao: 1, cenas: [] };
  return JSON.parse(await readFile(ARQUIVO_BANCO, 'utf8'));
}

export async function salvarBanco(banco) {
  await mkdir(path.dirname(ARQUIVO_BANCO), { recursive: true });
  await writeFile(ARQUIVO_BANCO, JSON.stringify(banco, null, 2), 'utf8');
}

/**
 * Guarda uma cena. `entrada`:
 *  { tema, tags[], descricao, de: 'remotion'|'imagem'|'video', cena?, midia? }
 * Cenas iguais (mesmo tipo + mesmo título, ou mesma mídia) não são duplicadas.
 */
export async function adicionarAoBanco(entrada) {
  const banco = await lerBanco();
  const igual = banco.cenas.find(
    (c) =>
      c.de === entrada.de &&
      ((entrada.midia && c.midia === entrada.midia) ||
        (entrada.cena && c.cena?.tipo === entrada.cena.tipo && c.cena?.titulo === entrada.cena.titulo)),
  );
  if (igual) return igual;
  const nova = {
    id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    tema: entrada.tema ?? 'geral',
    tags: [...new Set([...(entrada.tags ?? []), ...palavrasChave(entrada.descricao ?? '')])],
    descricao: entrada.descricao ?? '',
    de: entrada.de,
    cena: entrada.cena ? limparCena(entrada.cena) : undefined,
    midia: entrada.midia,
    prompt: entrada.prompt,
    padrao: Boolean(entrada.padrao),
    usos: 0,
    criado: new Date().toISOString(),
  };
  banco.cenas.push(nova);
  await salvarBanco(banco);
  return nova;
}

/** a cena guardada não carrega o tempo do vídeo de onde saiu */
function limparCena(cena) {
  const { id, start, duracao, ...resto } = cena;
  return resto;
}

/** Procura cenas parecidas com o texto da fala. Padrões e mais usadas ganham peso. */
export async function buscarNoBanco(texto, tema, limite = 5) {
  const banco = await lerBanco();
  const chave = new Set(palavrasChave(texto));
  return banco.cenas
    .filter((c) => !tema || c.tema === tema || c.tema === 'geral')
    .map((c) => {
      const comum = c.tags.filter((t) => chave.has(t)).length;
      return { cena: c, pontos: comum * 10 + (c.padrao ? 5 : 0) + Math.min(5, c.usos) };
    })
    .filter((x) => x.pontos >= 10)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite);
}

export async function marcarUso(ids) {
  const banco = await lerBanco();
  for (const c of banco.cenas) if (ids.includes(c.id)) c.usos += 1;
  await salvarBanco(banco);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'listar') {
    const banco = await lerBanco();
    const lista = banco.cenas.filter((c) => !a || c.tema === a);
    for (const c of lista)
      console.log(`${c.id}  [${c.tema}] ${c.de}${c.cena ? `:${c.cena.tipo}` : ''}  ${c.padrao ? '★ ' : ''}${c.descricao}  (usos ${c.usos})`);
    console.log(`${lista.length} cena(s)`);
  } else if (cmd === 'buscar') {
    for (const r of await buscarNoBanco(a ?? '', b))
      console.log(`${r.cena.id}  pontos ${r.pontos}  [${r.cena.tema}] ${r.cena.descricao}`);
  } else {
    console.log('uso: node agente/banco-cenas.mjs listar [tema] | buscar "<texto>" [tema]');
  }
}
