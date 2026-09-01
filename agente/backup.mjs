/**
 * Copia o seu trabalho para uma pasta com data, fora do alcance de qualquer
 * mudança no código.
 *
 *   node agente/backup.mjs           # projetos, ajustes e estilos salvos
 *   node agente/backup.mjs --tudo    # inclui as fotos e vídeos de apoio
 *
 * Não apaga nada e não sobrescreve backup anterior: cada execução cria uma
 * pasta nova. Para voltar, é só copiar de volta por cima.
 */
import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tudo = process.argv.includes('--tudo');

function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

async function tamanhoDe(alvo) {
  let total = 0;
  const info = await stat(alvo).catch(() => null);
  if (!info) return 0;
  if (info.isFile()) return info.size;
  for (const nome of await readdir(alvo)) total += await tamanhoDe(path.join(alvo, nome));
  return total;
}

const legivel = (b) =>
  b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(0)} MB` : `${(b / 1e3).toFixed(0)} kB`;

/* dois backups no mesmo minuto não se atropelam */
let destino = path.join(raiz, 'backups', carimbo());
for (let n = 2; existsSync(destino); n++) destino = path.join(raiz, 'backups', `${carimbo()}-${n}`);

/* o que entra no backup: o trabalho, não o programa */
const itens = [
  ['projeto', 'projetos (legendas, estilos e ajustes de cada vídeo)'],
  ['server/config.json', 'caminhos do Whisper e do FFmpeg'],
  ['presets', 'estilos de marca salvos'],
];
if (tudo) itens.push(['public/midia', 'fotos e vídeos de apoio']);

await mkdir(destino, { recursive: true });

const copiados = [];
for (const [relativo, descricao] of itens) {
  const origem = path.join(raiz, relativo);
  if (!existsSync(origem)) continue;
  const alvo = path.join(destino, relativo);
  await mkdir(path.dirname(alvo), { recursive: true });
  await cp(origem, alvo, { recursive: true });
  const bytes = await tamanhoDe(origem);
  copiados.push({ relativo, descricao, bytes });
  console.log(`  ✓ ${relativo} — ${descricao} (${legivel(bytes)})`);
}

if (!copiados.length) {
  console.log('Nada para guardar ainda: nenhum projeto salvo até agora.');
  process.exit(0);
}

await writeFile(
  path.join(destino, 'LEIA-ME.txt'),
  [
    `Backup do Melhores Fimes — ${new Date().toLocaleString('pt-BR')}`,
    '',
    'O que tem aqui:',
    ...copiados.map((c) => `  ${c.relativo} — ${c.descricao} (${legivel(c.bytes)})`),
    '',
    'Como voltar: copie estas pastas de volta para a pasta do programa,',
    'por cima das que estiverem lá.',
    '',
    tudo ? '' : 'Este backup NÃO inclui fotos e vídeos de apoio (use --tudo para incluir).',
  ].join('\n'),
  'utf8',
);

const total = copiados.reduce((s, c) => s + c.bytes, 0);
console.log(`\n✓ Backup em: ${destino}`);
console.log(`  ${copiados.length} itens, ${legivel(total)}.`);
if (!tudo) console.log('  (fotos e vídeos de apoio ficaram de fora — use --tudo para incluir)');
