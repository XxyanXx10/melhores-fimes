/**
 * Monta um vídeo a partir dos takes de uma pasta.
 *
 *   node agente/montar.mjs "E:/Video/Cortes/Reajuste" --nome "Reajuste ANS"
 *
 * O caminho inteiro: transcreve cada take, joga fora a claquete falada
 * ("um, dois, três, gravando"), tira os silêncios, cola tudo em ordem e grava
 * um projeto com a legenda já no tempo do vídeo montado.
 *
 * A legenda vem depois do corte de propósito: não adianta legendar pausa que
 * não vai existir no vídeo final.
 */
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIDEOS, conferirFerramentas, lerConfig, sondarVideo, transcreverVideo } from './nucleo.mjs';
import { montar, ordemNatural } from './takes.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : padrao;
}

/**
 * O filtro que fatia cada take nos trechos que ficam e cola tudo.
 *
 * Os takes podem vir com tamanhos e taxas diferentes (celular de pé, câmera
 * deitada, 30 e 60 fps). Sem normalizar antes, o concat recusa ou sai tremido —
 * então tudo é levado para o formato do primeiro take.
 */
export function filtroDeMontagem(takes, { largura, altura, fps }) {
  const partes = [];
  const rotulos = [];

  for (const [i, take] of takes.entries()) {
    const n = take.trechos.length;
    if (!n) continue;

    /*
     * Uma entrada só pode ser consumida uma vez no filtro. Um take com três
     * trechos precisa ser dividido em três antes — sem isto o FFmpeg recusa o
     * comando inteiro, e é o erro mais fácil de cometer aqui.
     */
    const vFontes = [];
    const aFontes = [];
    if (n === 1) {
      vFontes.push(`${i}:v`);
      aFontes.push(`${i}:a`);
    } else {
      const v = Array.from({ length: n }, (_, k) => `sv${i}_${k}`);
      const a = Array.from({ length: n }, (_, k) => `sa${i}_${k}`);
      partes.push(`[${i}:v]split=${n}${v.map((r) => `[${r}]`).join('')}`);
      partes.push(`[${i}:a]asplit=${n}${a.map((r) => `[${r}]`).join('')}`);
      vFontes.push(...v);
      aFontes.push(...a);
    }

    take.trechos.forEach((t, k) => {
      const id = `${i}_${k}`;
      partes.push(
        `[${vFontes[k]}]trim=start=${t.start}:end=${t.end},setpts=PTS-STARTPTS,` +
          `scale=${largura}:${altura}:force_original_aspect_ratio=decrease,` +
          `pad=${largura}:${altura}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${id}]`,
      );
      partes.push(
        `[${aFontes[k]}]atrim=start=${t.start}:end=${t.end},asetpts=PTS-STARTPTS,` +
          `aformat=sample_rates=48000:channel_layouts=stereo[a${id}]`,
      );
      rotulos.push(id);
    });
  }

  const entradas = rotulos.map((id) => `[v${id}][a${id}]`).join('');
  partes.push(`${entradas}concat=n=${rotulos.length}:v=1:a=1[vsaida][asaida]`);
  return { filtro: partes.join(';'), pedacos: rotulos.length };
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
      c === 0 ? resolve() : reject(new Error(`FFmpeg falhou (${c})\n${erro.slice(-1500)}`)),
    );
  });
}

/** os arquivos de vídeo de uma pasta, na ordem em que uma pessoa os leria */
export async function takesDaPasta(pasta) {
  const nomes = (await readdir(pasta)).filter((n) => VIDEOS.includes(path.extname(n).toLowerCase()));
  return nomes.sort(ordemNatural).map((n) => path.join(pasta, n));
}

export async function montarTakes(arquivos, opcoes = {}) {
  const cfg = await lerConfig();
  const faltando = conferirFerramentas(cfg);
  if (faltando.length) throw new Error(`Não encontrei:\n  ${faltando.join('\n  ')}`);
  if (!arquivos.length) throw new Error('Nenhum take para montar.');

  /* 1. cada take é transcrito e medido */
  const takes = [];
  for (const [i, arquivo] of arquivos.entries()) {
    opcoes.aoAndar?.({ etapa: 'transcrevendo', take: i + 1, de: arquivos.length, arquivo });
    const info = await sondarVideo(cfg, arquivo).catch(() => null);
    const palavras = await transcreverVideo(cfg, arquivo);
    takes.push({
      arquivo,
      palavras,
      duracao: info?.duracao ?? (palavras.length ? palavras[palavras.length - 1].end : 0),
      largura: info?.largura,
      altura: info?.altura,
      fps: info?.fps,
    });
  }

  /* 2. as contas: claquete fora, silêncios fora, tempos corridos */
  const plano = montar(takes, opcoes);
  if (!plano.takes.length) throw new Error('Nenhum take tinha fala depois da claquete.');

  /* 3. o vídeo montado */
  const primeiro = plano.takes[0];
  const formato = {
    largura: opcoes.largura ?? primeiro.largura ?? 1080,
    altura: opcoes.altura ?? primeiro.altura ?? 1920,
    fps: opcoes.fps ?? Math.round(primeiro.fps ?? 30),
  };
  const { filtro } = filtroDeMontagem(plano.takes, formato);

  const nome = opcoes.nome ?? path.basename(path.dirname(arquivos[0])) ?? 'montagem';
  const pastaSaida = opcoes.pastaSaida ?? path.dirname(arquivos[0]);
  const saida = path.join(pastaSaida, `${nome}-montado.mp4`);

  opcoes.aoAndar?.({ etapa: 'montando', de: plano.takes.length });
  await rodar(
    cfg.ffmpeg,
    [
      '-y',
      ...plano.takes.flatMap((t) => ['-i', t.arquivo]),
      '-filter_complex', filtro,
      '-map', '[vsaida]',
      '-map', '[asaida]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      saida,
    ],
    (s) => opcoes.aoAndar?.({ etapa: 'montando', segundos: s, total: plano.duracao }),
  );

  /* 4. o projeto, já com a legenda no tempo do vídeo montado */
  const projeto = {
    versao: 1,
    video: saida,
    nome: path.basename(saida),
    nomeProjeto: nome,
    duracao: plano.duracao,
    fps: formato.fps,
    largura: formato.largura,
    altura: formato.altura,
    template: opcoes.template ?? 'port1-autoridade',
    estilo: {},
    palavras: plano.palavras,
    takes: plano.takes.map((t) => ({
      arquivo: t.arquivo,
      claquete: t.claquete,
      duracao: t.duracao,
      duracaoUtil: t.duracaoUtil,
    })),
  };

  const arquivoProjeto = path.join(raiz, 'projeto', `${nome}.json`);
  await mkdir(path.dirname(arquivoProjeto), { recursive: true });
  await writeFile(arquivoProjeto, JSON.stringify(projeto, null, 2), 'utf8');

  return {
    saida,
    arquivoProjeto: path.basename(arquivoProjeto),
    takes: plano.takes.length,
    descartados: plano.descartados,
    duracao: plano.duracao,
    duracaoBruta: plano.duracaoBruta,
    palavras: plano.palavras.length,
  };
}

/* linha de comando */
if (process.argv[1] && process.argv[1].endsWith('montar.mjs')) {
  const alvo = process.argv[2];
  if (!alvo || !existsSync(alvo)) {
    console.error('Uso: node agente/montar.mjs <pasta com os takes> [--nome "Reajuste ANS"]');
    process.exit(1);
  }
  try {
    const arquivos = await takesDaPasta(alvo);
    console.log(`${arquivos.length} takes encontrados.`);
    const r = await montarTakes(arquivos, {
      nome: argumento('nome'),
      silencioMinimo: Number(argumento('silencio', 0.35)),
      aoAndar: (e) =>
        e.etapa === 'transcrevendo'
          ? console.log(`  [${e.take}/${e.de}] ${path.basename(e.arquivo)}`)
          : undefined,
    });
    console.log(`\n✓ ${r.takes} takes montados (${r.descartados} descartados)`);
    console.log(`✓ ${r.duracaoBruta}s de gravação viraram ${r.duracao}s`);
    console.log(`✓ ${r.saida}`);
    console.log(`✓ projeto/${r.arquivoProjeto}`);
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
    process.exit(1);
  }
}
