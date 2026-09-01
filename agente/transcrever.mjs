/**
 * Transcreve um vídeo e escreve um arquivo de projeto que a plataforma abre.
 *
 *   node agente/transcrever.mjs "C:/videos/corte15.mp4"
 *   node agente/transcrever.mjs corte15.mp4 --template port1-provocativo
 *
 * Feito para ser rodado por um assistente (Claude, ChatGPT, Antigravity…),
 * não pelo usuário. Roda 100% local: o áudio não sai da máquina.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirFerramentas, lerConfig, montarProjeto, transcreverVideo } from './nucleo.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : padrao;
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

const cfg = await lerConfig();
const faltando = conferirFerramentas(cfg);
if (faltando.length) {
  console.error('Não encontrei:\n  ' + faltando.join('\n  ') + '\nAjuste server/config.json.');
  process.exit(1);
}

try {
  console.log('Extraindo o áudio e transcrevendo com o whisper.cpp (pode demorar)…');
  const palavras = await transcreverVideo(cfg, video);

  const projeto = montarProjeto(video, palavras, argumento('template', 'port1-autoridade'));
  const saida = argumento(
    'saida',
    path.join(raiz, 'projeto', `${path.basename(video, path.extname(video))}.json`),
  );
  await mkdir(path.dirname(saida), { recursive: true });
  await writeFile(saida, JSON.stringify(projeto, null, 2), 'utf8');

  console.log(`\n✓ ${palavras.length} palavras — ${projeto.duracao.toFixed(1)}s`);
  console.log(`✓ Projeto: ${saida}`);
  console.log('\nAbra a plataforma: as correções que se repetem já foram aplicadas.');
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
}
