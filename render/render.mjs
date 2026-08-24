/**
 * Gera o MP4 a partir de um arquivo de projeto.
 *
 *   node render/render.mjs projeto/Corte.json
 *   node render/render.mjs projeto/Corte.json --still 90   (um frame só, para conferir)
 *
 * Usa a MESMA composição que o Player desenha na prévia — nada aqui
 * redesenha nada. Se sair diferente da prévia, é bug, não configuração.
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Uso: node render/render.mjs <projeto.json> [--still <frame>] [--saida <arquivo>]');
  process.exit(1);
}
if (!existsSync(arquivo)) {
  console.error(`Projeto não encontrado: ${arquivo}`);
  process.exit(1);
}

const projeto = JSON.parse(await readFile(arquivo, 'utf8'));
if (!projeto.video || !existsSync(projeto.video)) {
  console.error(`O vídeo do projeto não existe: ${projeto.video}`);
  process.exit(1);
}

/**
 * O Remotion só carrega assets de dentro de public/ (ou por http).
 * Trazemos o vídeo para cá uma vez; nas próximas vezes, se o tamanho
 * bate, reaproveitamos — copiar 50 MB a cada render seria desperdício.
 */
async function prepararVideo(origem) {
  const destinoDir = path.join(raiz, 'public', 'video');
  await mkdir(destinoDir, { recursive: true });
  const nome = path.basename(origem);
  const destino = path.join(destinoDir, nome);
  const info = await stat(origem);
  if (existsSync(destino) && (await stat(destino)).size === info.size) {
    console.log(`Vídeo já em public/video/${nome}`);
  } else {
    console.log(`Copiando o vídeo para public/video/ (${(info.size / 1e6).toFixed(0)} MB)…`);
    await copyFile(origem, destino);
  }
  return `video/${nome}`;
}

const fps = projeto.fps ?? 30;
const inputProps = {
  // caminho relativo a public/ — a composição resolve com staticFile()
  videoSrc: await prepararVideo(projeto.video),
  palavras: projeto.palavras ?? [],
  template: projeto.template ?? 'port1-autoridade',
  estiloOverride: projeto.estilo ?? {},
  movimento: projeto.movimento ?? 'off',
  forcaZoom: projeto.forcaZoom ?? 1,
  fotos: projeto.fotos ?? [],
  meta: {
    duracao: projeto.duracao,
    fps,
    largura: projeto.largura ?? 1080,
    altura: projeto.altura ?? 1920,
  },
};

console.log('Empacotando a composição…');
const servedUrl = await bundle({
  entryPoint: path.join(raiz, 'src', 'remotion', 'raiz.tsx'),
  publicDir: path.join(raiz, 'public'),
});

const composition = await selectComposition({ serveUrl: servedUrl, id: 'video', inputProps });
console.log(
  `Composição: ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames`,
);

const still = argumento('still');
if (still !== undefined) {
  const saida = argumento('saida') ?? path.join(raiz, 'render', `frame-${still}.png`);
  await renderStill({
    composition,
    serveUrl: servedUrl,
    output: saida,
    frame: Number(still),
    inputProps,
  });
  console.log(`✓ Frame ${still}: ${saida}`);
} else {
  const saida = argumento('saida') ?? path.join(raiz, 'render', `${path.basename(arquivo, '.json')}.mp4`);
  await renderMedia({
    composition,
    serveUrl: servedUrl,
    codec: 'h264',
    outputLocation: saida,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\rRenderizando… ${Math.round(progress * 100)}%`);
    },
  });
  console.log(`\n✓ MP4: ${saida}`);
}
