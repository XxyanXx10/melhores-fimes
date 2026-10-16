/**
 * Lista as narrações do Canal Dark que ainda não ganharam plano de cenas.
 * O agente roda isto, e vai montando um por um até a lista zerar.
 *
 *   node agente/pendentes.mjs
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const pasta = path.join(RAIZ, 'projeto');
const arqFeitos = path.join(RAIZ, 'banco-cenas', 'feitos.json');
const feitos = existsSync(arqFeitos) ? JSON.parse(await readFile(arqFeitos, 'utf8')) : {};
const saidas = new Set(Object.values(feitos).map((f) => f?.saida).filter(Boolean));
const pend = [];
for (const nome of await readdir(pasta)) {
  if (!nome.endsWith('.json')) continue;
  const p = JSON.parse(await readFile(path.join(pasta, nome), 'utf8'));
  // saídas de planos também contam como feitas (o salvamento da plataforma apaga o campo planoAplicado)
  if (!String(p.template ?? '').startsWith('dark') || p.planoAplicado || feitos[nome] || saidas.has(nome)) continue;
  pend.push({ nome, duracao: p.duracao, criado: (await stat(path.join(pasta, nome))).mtime });
}
pend.sort((a, b) => a.criado - b.criado);
for (const x of pend) console.log(`${x.nome}  (${Math.round(x.duracao)} s)`);
console.log(`${pend.length} pendente(s)`);
