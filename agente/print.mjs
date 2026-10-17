/**
 * Print de um site real (ChatGPT, Gemini, N8N…) para aparecer no vídeo quando a
 * narração fala dele. Captura com o Chrome em modo celular e guarda em
 * public/midia/banco/prints/ — só captura de novo se pedir.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PASTA = path.join(RAIZ, 'public', 'midia', 'banco', 'prints');
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * @param url site
 * @param nome nome do arquivo (sem extensão)
 * @param recorte fração de cima que fica (0.6 = 60% do topo), tira avisos de cookie do rodapé
 * @returns 'midia/banco/prints/<nome>.png'
 */
export async function printDoSite(url, nome, { recorte = 0.62, novo = false } = {}) {
  await mkdir(PASTA, { recursive: true });
  const bruto = path.join(PASTA, `${nome}.bruto.png`);
  const final = path.join(PASTA, `${nome}.png`);
  if (existsSync(final) && !novo) return `midia/banco/prints/${nome}.png`;
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=432,960',
    '--force-device-scale-factor=2.5', '--virtual-time-budget=8000', `--user-agent=${IPHONE}`,
    `--screenshot=${bruto}`, url,
  ], { stdio: 'ignore', timeout: 60000 });
  // recorta o topo com o ffmpeg (já instalado para a plataforma)
  const cfg = JSON.parse((await readFile(path.join(RAIZ, 'server', 'config.json'), 'utf8')).replace(/^﻿/, ''));
  execFileSync(cfg.ffmpeg || 'ffmpeg', ['-v', 'error', '-y', '-i', bruto, '-vf', `crop=iw:ih*${recorte}:0:0`, final]);
  return `midia/banco/prints/${nome}.png`;
}

if (process.argv[1]?.endsWith('print.mjs')) {
  const [url, nome, recorte] = process.argv.slice(2);
  console.log(await printDoSite(url, nome, { recorte: recorte ? +recorte : undefined, novo: true }));
}
