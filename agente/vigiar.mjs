/**
 * Vigia uma pasta. Quando um vídeo novo aparece, transcreve sozinho e grava
 * o projeto em projeto/<nome>.json — sem ninguém pedir nada.
 *
 *   node agente/vigiar.mjs            # vigia a pasta ./videos
 *   node agente/vigiar.mjs "E:/Video/Cortes"
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VIDEOS,
  conferirFerramentas,
  lerConfig,
  montarProjeto,
  sondarVideo,
  transcreverVideo,
} from './nucleo.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaVideos = path.resolve(process.argv[2] ?? path.join(raiz, 'videos'));
const pastaProjetos = path.join(raiz, 'projeto');

const cfg = await lerConfig();
const faltando = conferirFerramentas(cfg);
if (faltando.length) {
  console.error('Não encontrei:\n  ' + faltando.join('\n  ') + '\nAjuste server/config.json.');
  process.exit(1);
}

await mkdir(pastaVideos, { recursive: true });
await mkdir(pastaProjetos, { recursive: true });

const fila = new Set();
/** tudo que já entrou na fila alguma vez — o Windows dispara vários eventos
 *  por cópia, e sem isso o mesmo vídeo seria transcrito duas vezes. */
const vistos = new Set();
let ocupado = false;

const projetoDe = (v) => path.join(pastaProjetos, `${path.basename(v, path.extname(v))}.json`);

/** espera o arquivo parar de crescer — cópia grande demora a terminar */
async function esperarEstabilizar(arquivo) {
  let anterior = -1;
  for (let i = 0; i < 60; i++) {
    const { size } = await stat(arquivo).catch(() => ({ size: -1 }));
    if (size < 0) return false;
    if (size === anterior && size > 0) return true;
    anterior = size;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function processar() {
  if (ocupado) return;
  const proximo = [...fila][0];
  if (!proximo) return;
  fila.delete(proximo);
  ocupado = true;
  try {
    if (!(await esperarEstabilizar(proximo))) {
      vistos.delete(proximo); // sumiu ou não terminou de copiar: pode voltar depois
      return;
    }
    const nome = path.basename(proximo);
    console.log(`\n▶ ${nome} — transcrevendo…`);
    const inicio = Date.now();
    const palavras = await transcreverVideo(cfg, proximo);
    const saida = projetoDe(proximo);
    const meta = await sondarVideo(cfg, proximo);
    await writeFile(
      saida,
      JSON.stringify(montarProjeto(proximo, palavras, 'port1-autoridade', meta), null, 2),
      'utf8',
    );
    console.log(
      `✓ ${nome} — ${palavras.length} palavras em ${((Date.now() - inicio) / 1000).toFixed(0)}s`,
    );
    console.log(`  ${saida}`);
  } catch (e) {
    vistos.delete(proximo); // deu errado: aceita nova tentativa
    console.error(`✗ ${path.basename(proximo)}: ${e.message}`);
  } finally {
    ocupado = false;
    void processar();
  }
}

function considerar(arquivo) {
  if (!VIDEOS.includes(path.extname(arquivo).toLowerCase())) return;
  if (vistos.has(arquivo)) return;
  if (existsSync(projetoDe(arquivo))) return; // já transcrito antes
  vistos.add(arquivo);
  fila.add(arquivo);
  void processar();
}

for (const nome of await readdir(pastaVideos)) considerar(path.join(pastaVideos, nome));

watch(pastaVideos, (_evento, nome) => {
  if (nome) considerar(path.join(pastaVideos, String(nome)));
});

console.log(`Vigiando: ${pastaVideos}`);
console.log(`Projetos: ${pastaProjetos}`);
console.log('Solte um vídeo na pasta e a transcrição começa sozinha. Ctrl+C para parar.\n');
