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
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
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
 * O Remotion carrega assets de dentro de public/ ou por http.
 *
 * O vídeo de origem NÃO vai para public/: o bundler copia essa pasta
 * inteira a cada render, e um corte de 50 MB vira 50 MB de lixo em
 * disco por render (encheu o C: depois de vinte e poucos). Servimos o
 * arquivo direto do lugar onde ele já está, por um servidor efêmero.
 */
function servirVideo(origem) {
  return new Promise((resolve, reject) => {
    const servidor = createServer(async (req, res) => {
      try {
        const info = await stat(origem);
        const faixa = req.headers.range;
        if (faixa) {
          const [de, ate] = faixa.replace(/bytes=/, '').split('-');
          const inicio = Number(de);
          const fim = ate ? Number(ate) : info.size - 1;
          res.writeHead(206, {
            'content-range': `bytes ${inicio}-${fim}/${info.size}`,
            'accept-ranges': 'bytes',
            'content-length': fim - inicio + 1,
            'content-type': 'video/mp4',
          });
          createReadStream(origem, { start: inicio, end: fim }).pipe(res);
        } else {
          res.writeHead(200, {
            'content-length': info.size,
            'accept-ranges': 'bytes',
            'content-type': 'video/mp4',
          });
          createReadStream(origem).pipe(res);
        }
      } catch (e) {
        res.writeHead(500);
        res.end(e.message);
      }
    });
    servidor.on('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address();
      resolve({ url: `http://127.0.0.1:${port}/video.mp4`, fechar: () => servidor.close() });
    });
  });
}

const fonteVideo = await servirVideo(projeto.video);
console.log(`Servindo o vídeo em ${fonteVideo.url}`);

const fps = projeto.fps ?? 30;
const inputProps = {
  // servido por http a partir do disco: nada é copiado para public/
  videoSrc: fonteVideo.url,
  palavras: projeto.palavras ?? [],
  template: projeto.template ?? 'port1-autoridade',
  estiloOverride: projeto.estilo ?? {},
  movimento: projeto.movimento ?? 'off',
  forcaZoom: projeto.forcaZoom ?? 1,
  fotos: projeto.fotos ?? [],
  divisoes: projeto.divisoes ?? [],
  cortes: projeto.cortes ?? [],
  transicao: projeto.transicao ?? 'off',
  forcaTransicao: projeto.forcaTransicao ?? 1,
  duracaoTransicao: projeto.duracaoTransicao ?? 0.5,
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
  // pasta fixa: sem isto cada render deixa um bundle novo no temporário
  outDir: path.join(raiz, 'render', '.bundle'),
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
  fonteVideo.fechar();
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
