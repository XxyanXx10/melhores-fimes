/**
 * Transcreve um vídeo e escreve um arquivo de projeto que a plataforma abre.
 *
 *   node agente/transcrever.mjs "C:/videos/corte15.mp4"
 *   node agente/transcrever.mjs corte15.mp4 --template port1-provocativo
 *
 * Feito para ser rodado por um assistente (Claude, ChatGPT, Antigravity…),
 * não pelo usuário. Roda 100% local: o áudio não sai da máquina.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { juntarPalavras, lerJsonWhisper } from '../server/merge.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : padrao;
}

async function config() {
  const proprio = path.join(raiz, 'server', 'config.json');
  const alvo = existsSync(proprio) ? proprio : path.join(raiz, 'server', 'config.example.json');
  return JSON.parse(await readFile(alvo, 'utf8'));
}

function rodar(cmd, args, rotulo) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let erro = '';
    p.stderr.on('data', (d) => (erro += d));
    p.on('error', (e) => reject(new Error(`${rotulo}: ${e.message}`)));
    p.on('close', (c) =>
      c === 0 ? resolve() : reject(new Error(`${rotulo} falhou (código ${c})\n${erro.slice(-1200)}`)),
    );
  });
}

function duracaoDe(palavras) {
  return palavras.length ? palavras[palavras.length - 1].end : 0;
}

const video = process.argv[2];
if (!video) {
  console.error('Uso: node agente/transcrever.mjs <video> [--template id] [--saida arquivo.json]');
  process.exit(1);
}
if (!existsSync(video)) {
  console.error(`Vídeo não encontrado: ${video}`);
  process.exit(1);
}

const cfg = await config();
for (const [rotulo, caminho] of [['whisper-cli', cfg.whisperCli], ['modelo', cfg.modelo]]) {
  if (!existsSync(caminho)) {
    console.error(`${rotulo} não encontrado: ${caminho}\nAjuste server/config.json.`);
    process.exit(1);
  }
}

const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
try {
  const wav = path.join(pasta, 'audio.wav');
  console.log('Extraindo o áudio…');
  await rodar(cfg.ffmpeg, ['-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], 'FFmpeg');

  console.log('Transcrevendo com o whisper.cpp (pode demorar)…');
  const base = path.join(pasta, 'saida');
  const args = ['-m', cfg.modelo, '-l', cfg.idioma, '-ml', '1', '-oj', '-of', base, wav];
  if (cfg.threads > 0) args.unshift('-t', String(cfg.threads));
  await rodar(cfg.whisperCli, args, 'whisper.cpp');

  const palavras = juntarPalavras(lerJsonWhisper(JSON.parse(await readFile(`${base}.json`, 'utf8'))));
  if (!palavras.length) throw new Error('O Whisper não devolveu nenhuma palavra.');

  const projeto = {
    versao: 1,
    video: path.resolve(video),
    nome: path.basename(video),
    duracao: duracaoDe(palavras),
    template: argumento('template', 'port1-autoridade'),
    estilo: {},
    palavras,
  };

  const saida = argumento(
    'saida',
    path.join(raiz, 'projeto', `${path.basename(video, path.extname(video))}.json`),
  );
  await mkdir(path.dirname(saida), { recursive: true });
  await writeFile(saida, JSON.stringify(projeto, null, 2), 'utf8');

  console.log(`\n✓ ${palavras.length} palavras — ${projeto.duracao.toFixed(1)}s`);
  console.log(`✓ Projeto: ${saida}`);
  console.log('\nAbra a plataforma e arraste esse arquivo para dentro dela.');
} finally {
  await rm(pasta, { recursive: true, force: true });
}
