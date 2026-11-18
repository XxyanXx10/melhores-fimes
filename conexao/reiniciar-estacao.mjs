/**
 * Reinicia a estação de render para ela carregar código novo — sem ninguém
 * em casa para fechar e abrir a janela.
 *
 *   node conexao/reiniciar-estacao.mjs            (rodado PELA estação, como tarefa)
 *   node conexao/reiniciar-estacao.mjs --pid 1234 (fecha a estação desse processo)
 *
 * Deixa um vigia solto que espera a estação fechar. Se em 25 s ela não voltar
 * sozinha (o iniciar-estacao.bat reabre em 10 s), o vigia abre outra, escondida,
 * com o log em conexao/.estacao/estacao.log. Depois fecha a estação atual.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { mkdirSync, openSync } from 'node:fs';
import { aqui, lerConfigRemoto, raiz } from './comum.mjs';

const args = process.argv.slice(2);
const cfg = await lerConfigRemoto();
const porta = Number(cfg.porta);

function portaAberta() {
  return new Promise((resolve) => {
    const s = net.connect({ port: porta, host: '127.0.0.1' });
    s.setTimeout(2000);
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('timeout', () => (s.destroy(), resolve(false)));
    s.once('error', () => resolve(false));
  });
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

if (args.includes('--vigia')) {
  // 1. espera a estação atual fechar (até 60 s)
  for (let i = 0; i < 60 && (await portaAberta()); i++) await espera(1000);
  // 2. dá tempo para o iniciar-estacao.bat reabrir
  for (let i = 0; i < 25; i++) {
    await espera(1000);
    if (await portaAberta()) process.exit(0);
  }
  // 3. ninguém reabriu: abre uma, solta e escondida
  const pasta = process.env.CONEXAO_ESTADO ? path.resolve(process.env.CONEXAO_ESTADO) : path.join(aqui, '.estacao');
  mkdirSync(pasta, { recursive: true });
  const log = openSync(path.join(pasta, 'estacao.log'), 'a');
  spawn(process.execPath, [path.join(aqui, 'estacao.mjs')], { cwd: raiz, detached: true, windowsHide: true, stdio: ['ignore', log, log] }).unref();
  process.exit(0);
}

const i = args.indexOf('--pid');
const alvo = i >= 0 ? Number(args[i + 1]) : process.ppid;
if (!alvo) {
  console.error('não sei qual processo é a estação');
  process.exit(1);
}

spawn(process.execPath, [path.join(aqui, 'reiniciar-estacao.mjs'), '--vigia'], {
  cwd: raiz,
  detached: true,
  windowsHide: true,
  stdio: 'ignore',
  env: process.env,
}).unref();

console.log(`Reiniciando a estação (processo ${alvo}). Ela volta em uns 10 a 30 segundos.`);
await espera(500);
try {
  process.kill(alvo);
} catch (e) {
  console.error(`não consegui fechar o processo ${alvo}: ${e.message}`);
  process.exit(1);
}
