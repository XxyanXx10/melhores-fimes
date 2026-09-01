/**
 * Baixa as fontes do Google uma vez e guarda dentro do projeto.
 *
 *   node agente/fontes.mjs
 *
 * Depois disso a plataforma não conversa mais com a internet para desenhar
 * legenda: o que você vê na prévia é exatamente o que sai no MP4, mesmo com
 * a máquina desconectada.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, 'public', 'fontes');

/* o mesmo conjunto que o index.html pedia ao Google */
const PEDIDO =
  'family=Inter:wght@400;600;800;900&family=Anton&family=Archivo+Black&family=Bebas+Neue' +
  '&family=Caveat:wght@700&family=Montserrat:wght@700;800;900' +
  '&family=Playfair+Display:ital,wght@0,700;1,700&family=Poppins:wght@600;800' +
  '&family=Roboto+Condensed:wght@700&display=swap';

/* sem User-Agent de navegador o Google devolve .ttf, que pesa três vezes mais */
const NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

await mkdir(destino, { recursive: true });

console.log('Pedindo a lista de fontes ao Google…');
const resposta = await fetch(`https://fonts.googleapis.com/css2?${PEDIDO}`, {
  headers: { 'user-agent': NAVEGADOR },
});
if (!resposta.ok) throw new Error(`Google respondeu ${resposta.status}`);
let css = await resposta.text();

const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]))];
console.log(`${urls.length} arquivos de fonte a baixar.`);

let baixados = 0;
let bytes = 0;
for (const url of urls) {
  const nome = path.basename(new URL(url).pathname);
  const dados = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(path.join(destino, nome), dados);
  css = css.split(url).join(`/fontes/${nome}`);
  baixados++;
  bytes += dados.length;
  process.stdout.write(`\r  ${baixados}/${urls.length}`);
}

await writeFile(path.join(destino, 'fontes.css'), css, 'utf8');

/* troca o <link> do Google pelo arquivo local, se ainda não estiver trocado */
const indexHtml = path.join(raiz, 'index.html');
const html = await readFile(indexHtml, 'utf8');
if (html.includes('fonts.googleapis.com')) {
  const semGoogle = html
    .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.g[^>]*>/g, '')
    .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '')
    .replace('</head>', '    <link rel="stylesheet" href="/fontes/fontes.css" />\n  </head>');
  await writeFile(indexHtml, semGoogle, 'utf8');
  console.log('\nindex.html agora aponta para as fontes locais.');
}

console.log(`\n✓ ${baixados} arquivos, ${(bytes / 1e6).toFixed(1)} MB em public/fontes/`);
