/**
 * Corta os silêncios do vídeo e grava um arquivo novo.
 *
 *   node agente/cortar.mjs projeto/Corte15.json
 *   node agente/cortar.mjs projeto/Corte15.json --silencio 0.5
 *
 * Escreve <nome>-cortado.mp4 ao lado do vídeo original, recalcula os tempos da
 * legenda e aponta o projeto para o arquivo novo. O original não é tocado: se
 * o corte ficar apertado, é só voltar o campo `videoOriginal`.
 *
 * De quebra, o vídeo fica mais curto — e o render, que custa por quadro, cai na
 * mesma proporção.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { lerConfig, sondarVideo } from './nucleo.mjs';
import { remapear, resumoDoCorte } from './cortes.mjs';

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : padrao;
}

/**
 * Um filtro que fatia vídeo e áudio nos trechos de fala e cola tudo de volta.
 *
 * `setpts`/`asetps` são obrigatórios depois do trim: sem eles cada pedaço
 * mantém o carimbo de tempo do original e o vídeo sai com buracos parados.
 */
export function filtroDeCorte(trechos) {
  const n = trechos.length;
  const partes = [];

  /*
   * Uma entrada só pode ser consumida uma vez: para tirar cinco pedaços do
   * mesmo vídeo é preciso dividi-lo em cinco antes. Sem o split, o FFmpeg
   * recusa o comando inteiro.
   */
  const v = Array.from({ length: n }, (_, i) => (n === 1 ? '0:v' : `sv${i}`));
  const a = Array.from({ length: n }, (_, i) => (n === 1 ? '0:a' : `sa${i}`));
  if (n > 1) {
    partes.push(`[0:v]split=${n}${v.map((r) => `[${r}]`).join('')}`);
    partes.push(`[0:a]asplit=${n}${a.map((r) => `[${r}]`).join('')}`);
  }

  trechos.forEach((t, i) => {
    partes.push(`[${v[i]}]trim=start=${t.start}:end=${t.end},setpts=PTS-STARTPTS[v${i}]`);
    partes.push(`[${a[i]}]atrim=start=${t.start}:end=${t.end},asetpts=PTS-STARTPTS[a${i}]`);
  });

  const entradas = trechos.map((_, i) => `[v${i}][a${i}]`).join('');
  partes.push(`${entradas}concat=n=${n}:v=1:a=1[vsaida][asaida]`);
  return partes.join(';');
}

function rodar(cmd, args, aoProgresso) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let erro = '';
    p.stderr.on('data', (d) => {
      const texto = String(d);
      erro += texto;
      const m = texto.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m && aoProgresso) aoProgresso(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
    p.on('error', (e) => reject(new Error(`FFmpeg: ${e.message}`)));
    p.on('close', (c) =>
      c === 0 ? resolve() : reject(new Error(`FFmpeg falhou (${c})\n${erro.slice(-1200)}`)),
    );
  });
}

export async function cortarSilencios(arquivoProjeto, opcoes = {}) {
  const cfg = await lerConfig();
  const projeto = JSON.parse(await readFile(arquivoProjeto, 'utf8'));
  const origem = projeto.videoOriginal ?? projeto.video;

  if (!origem || !existsSync(origem)) throw new Error('O projeto não aponta para um vídeo que exista.');
  if (!projeto.palavras?.length) throw new Error('Sem transcrição não dá para saber onde está a fala.');

  const info = await sondarVideo(cfg, origem).catch(() => null);
  const duracao = info?.duracao ?? projeto.duracao;
  const resumo = resumoDoCorte(projeto.palavras, duracao, opcoes);

  if (!resumo.cortes) {
    return { ...resumo, saida: null, semCortes: true };
  }

  const saida = path.join(
    path.dirname(origem),
    `${path.basename(origem, path.extname(origem))}-cortado.mp4`,
  );

  await rodar(
    cfg.ffmpeg,
    [
      '-y',
      '-i', origem,
      '-filter_complex', filtroDeCorte(resumo.trechos),
      '-map', '[vsaida]',
      '-map', '[asaida]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      saida,
    ],
    opcoes.aoProgresso,
  );

  const palavras = remapear(projeto.palavras, resumo.trechos);
  const atualizado = {
    ...projeto,
    videoOriginal: origem,
    video: saida,
    nome: path.basename(saida),
    duracao: resumo.duracaoNova,
    palavras,
    /* os cortes achados no vídeo antigo não valem mais nada aqui */
    cortes: [],
  };
  await writeFile(arquivoProjeto, JSON.stringify(atualizado, null, 2), 'utf8');

  return { ...resumo, saida };
}

/* rodando direto pela linha de comando */
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const alvo = process.argv[2];
  if (!alvo) {
    console.error('Uso: node agente/cortar.mjs <projeto.json> [--silencio 0.35]');
    process.exit(1);
  }
  try {
    const r = await cortarSilencios(alvo, {
      silencioMinimo: Number(argumento('silencio', 0.35)),
      aoProgresso: (s) => process.stdout.write(`\rCortando… ${s.toFixed(1)}s`),
    });
    if (r.semCortes) {
      console.log('Nada a cortar: não há silêncio grande o bastante.');
    } else {
      console.log(`\n✓ ${r.cortes} cortes, ${r.removido}s a menos (${r.duracaoOriginal}s → ${r.duracaoNova}s)`);
      console.log(`✓ ${r.saida}`);
    }
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
    process.exit(1);
  }
}
