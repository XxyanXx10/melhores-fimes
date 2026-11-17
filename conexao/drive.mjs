/**
 * Pasta do Google Drive como caixa de entrada e saída dos vídeos.
 *
 * O celular sobe o vídeo bruto no Drive → o "Google Drive para computador"
 * (instalado neste PC) faz ele aparecer como arquivo normal (G:\Meu Drive\...)
 * → o Claude edita → o vídeo pronto vai para a pasta Prontos → aparece no celular.
 *
 *   node conexao/drive.mjs                         como está
 *   node conexao/drive.mjs --configurar            acha o Drive e cria as pastas Entrada e Prontos
 *       --pasta "G:/Meu Drive/Edição de vídeo"     (ou escolha a pasta)
 *   node conexao/drive.mjs --novos                 o que chegou na Entrada e ainda não foi trazido
 *   node conexao/drive.mjs --trazer [nome|tudo]    copia da Entrada para videos/drive/ (é lá que se edita)
 *   node conexao/drive.mjs --achar <nome|link>     procura um arquivo no Drive (link: mostra o id)
 *   node conexao/drive.mjs --entregar <arquivo>    copia o vídeo pronto para a pasta Prontos
 *   --json                                         saída em JSON (painel e assistentes)
 *
 * Por que trazer antes de editar: os scripts gravam arquivos ao lado do vídeo
 * (ex.: -cortado.mp4). Dentro do Drive, cada um deles subiria de novo para a nuvem.
 */
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { bytesLegiveis, gravarConfigRemoto, lerArquivoConfig, raiz } from './comum.mjs';

export const VIDEO = /\.(mp4|mov|m4v|mkv|avi|webm|3gp|mts)$/i;
export const PASTA_LOCAL = path.join(raiz, 'videos', 'drive');
const NOME_PADRAO = 'Edição de vídeo';

/** Onde o Google Drive para computador costuma montar o "Meu Drive". */
export function acharRaizDoDrive() {
  const candidatos = [];
  for (const letra of 'GHIJKLMNOPQRSTUVWXYZDEF') {
    candidatos.push(`${letra}:/Meu Drive`, `${letra}:/My Drive`);
  }
  const casa = os.homedir();
  candidatos.push(path.join(casa, 'Meu Drive'), path.join(casa, 'My Drive'), path.join(casa, 'Google Drive', 'Meu Drive'), path.join(casa, 'Google Drive'));
  return candidatos.find((c) => existsSync(c)) ?? null;
}

export async function configDoDrive() {
  const cfg = await lerArquivoConfig();
  return cfg.drive ?? null;
}

async function listarPasta(pasta) {
  try {
    return await readdir(pasta, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * O que está na Entrada: vídeos soltos e pastas de takes (uma pasta com vários vídeos).
 * `trazido` = já existe cópia igual (mesmo nome e tamanho) em videos/drive/.
 */
export async function itensDaEntrada(drive) {
  const itens = [];
  if (!drive?.entrada) return itens;
  for (const it of await listarPasta(drive.entrada)) {
    const cheio = path.join(drive.entrada, it.name);
    if (it.isFile() && VIDEO.test(it.name)) {
      const s = await stat(cheio).catch(() => null);
      if (!s) continue;
      const local = path.join(PASTA_LOCAL, it.name);
      const sl = await stat(local).catch(() => null);
      itens.push({ tipo: 'video', nome: it.name, caminho: cheio, tamanho: s.size, modificado: s.mtimeMs, trazido: !!sl && sl.size === s.size, local });
    } else if (it.isDirectory()) {
      const videos = [];
      for (const v of await listarPasta(cheio)) {
        if (!v.isFile() || !VIDEO.test(v.name)) continue;
        const s = await stat(path.join(cheio, v.name)).catch(() => null);
        if (s) videos.push({ nome: v.name, tamanho: s.size, modificado: s.mtimeMs });
      }
      if (!videos.length) continue;
      const local = path.join(PASTA_LOCAL, it.name);
      let trazido = existsSync(local);
      for (const v of videos) {
        const sl = await stat(path.join(local, v.nome)).catch(() => null);
        if (!sl || sl.size !== v.tamanho) trazido = false;
      }
      itens.push({
        tipo: 'takes',
        nome: it.name,
        caminho: cheio,
        videos: videos.length,
        tamanho: videos.reduce((a, v) => a + v.tamanho, 0),
        modificado: Math.max(...videos.map((v) => v.modificado)),
        trazido,
        local,
      });
    }
  }
  return itens.sort((a, b) => b.modificado - a.modificado);
}

export async function itensProntos(drive) {
  const itens = [];
  if (!drive?.prontos) return itens;
  for (const it of await listarPasta(drive.prontos)) {
    if (!it.isFile()) continue;
    const s = await stat(path.join(drive.prontos, it.name)).catch(() => null);
    if (s) itens.push({ nome: it.name, caminho: path.join(drive.prontos, it.name), tamanho: s.size, modificado: s.mtimeMs });
  }
  return itens.sort((a, b) => b.modificado - a.modificado);
}

/** Copia com .parte + rename: se cair no meio, não fica um vídeo pela metade com cara de inteiro. */
async function copiar(origem, destino, aoAndar) {
  await mkdir(path.dirname(destino), { recursive: true });
  const total = (await stat(origem)).size;
  let feito = 0;
  const leitura = createReadStream(origem, { highWaterMark: 4 * 1024 * 1024 });
  leitura.on('data', (c) => {
    feito += c.length;
    aoAndar?.(feito, total);
  });
  await pipeline(leitura, createWriteStream(`${destino}.parte`));
  await rename(`${destino}.parte`, destino);
  return destino;
}

export async function trazer(item, aoAndar) {
  if (item.tipo === 'video') return [await copiar(item.caminho, item.local, aoAndar)];
  const feitos = [];
  for (const v of await listarPasta(item.caminho)) {
    if (!v.isFile() || !VIDEO.test(v.name)) continue;
    const destino = path.join(item.local, v.name);
    const s = await stat(path.join(item.caminho, v.name));
    const sl = await stat(destino).catch(() => null);
    if (!sl || sl.size !== s.size) await copiar(path.join(item.caminho, v.name), destino, aoAndar);
    feitos.push(destino);
  }
  return feitos;
}

/** Tira o id de um link do Drive (arquivo ou pasta). */
export function idDoLink(texto) {
  const m = String(texto).match(/\/(?:file\/d|folders|d)\/([\w-]{20,})/) ?? String(texto).match(/[?&]id=([\w-]{20,})/);
  return m?.[1] ?? null;
}

async function procurarPorNome(pasta, nome, profundidade = 0, achados = []) {
  if (profundidade > 6 || achados.length >= 20) return achados;
  for (const it of await listarPasta(pasta)) {
    const cheio = path.join(pasta, it.name);
    if (it.name.toLowerCase().includes(nome.toLowerCase())) achados.push({ caminho: cheio, pasta: it.isDirectory() });
    if (it.isDirectory() && !it.name.startsWith('.')) await procurarPorNome(cheio, nome, profundidade + 1, achados);
  }
  return achados;
}

/* ---------- linha de comando ---------- */

async function principal() {
  const args = process.argv.slice(2);
  const valor = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const tem = (n) => args.includes(`--${n}`);
  const json = tem('json');
  const mostrar = (obj, texto) => console.log(json ? JSON.stringify(obj, null, 2) : texto);

  const cfg = await lerArquivoConfig();

  if (tem('configurar')) {
    let base = valor('pasta');
    if (!base) {
      const r = acharRaizDoDrive();
      if (!r) {
        console.error(
          '✗ Não achei o Google Drive neste computador.\n' +
            '  1. Instale o "Google Drive para computador": https://www.google.com/drive/download/\n' +
            '  2. Entre na mesma conta do celular. Ele cria uma unidade (normalmente G:) com "Meu Drive".\n' +
            '  3. Rode de novo: node conexao/drive.mjs --configurar\n' +
            '  (ou diga a pasta: --pasta "G:/Meu Drive/Edição de vídeo")',
        );
        process.exit(1);
      }
      base = path.join(r, NOME_PADRAO);
    }
    base = path.resolve(base);
    const drive = { pasta: base, entrada: path.join(base, 'Entrada'), prontos: path.join(base, 'Prontos') };
    await mkdir(drive.entrada, { recursive: true });
    await mkdir(drive.prontos, { recursive: true });
    cfg.drive = drive;
    await gravarConfigRemoto(cfg);
    return mostrar(
      { ok: true, drive },
      `✓ Pasta do Drive pronta:\n  ${drive.entrada}   ← suba os vídeos aqui pelo celular\n  ${drive.prontos}   ← os vídeos prontos aparecem aqui\n\n` +
        `No app do Drive (celular), a pasta é "${path.basename(base)}".\n` +
        'Dica: no Google Drive para computador, deixe essa pasta "Disponível off-line" para os vídeos já virem baixados.',
    );
  }

  const drive = cfg.drive;
  if (!drive) {
    const r = acharRaizDoDrive();
    return mostrar(
      { configurado: false, driveEncontrado: r },
      r ? `O Drive está em ${r}, mas a pasta ainda não foi configurada: node conexao/drive.mjs --configurar` : 'Google Drive não encontrado neste computador. Veja: node conexao/drive.mjs --configurar',
    );
  }

  if (tem('novos') || tem('trazer')) {
    const itens = await itensDaEntrada(drive);
    const novos = itens.filter((i) => !i.trazido);
    if (tem('novos')) {
      return mostrar(
        { entrada: drive.entrada, novos, todos: itens },
        novos.length
          ? `${novos.length} novo(s) na Entrada do Drive:\n` +
              novos.map((i) => `  ${i.tipo === 'takes' ? `[pasta, ${i.videos} takes]` : '[vídeo]'} ${i.nome} — ${bytesLegiveis(i.tamanho)}`).join('\n') +
              '\nPara trazer: node conexao/drive.mjs --trazer tudo'
          : `Nada novo na Entrada (${itens.length} item(ns) já trazido(s)).`,
      );
    }
    const qual = valor('trazer');
    const escolhidos = !qual || qual === 'tudo' ? novos : itens.filter((i) => i.nome.toLowerCase().includes(qual.toLowerCase()));
    if (!escolhidos.length) return mostrar({ trazidos: [] }, qual && qual !== 'tudo' ? `Nada na Entrada com "${qual}".` : 'Nada novo para trazer.');
    const trazidos = [];
    for (const it of escolhidos) {
      if (!json) process.stdout.write(`↓ ${it.nome} (${bytesLegiveis(it.tamanho)})… `);
      let marco = -1;
      const arquivos = await trazer(it, (feito, total) => {
        const pct = Math.floor((feito / total) * 4);
        if (!json && pct !== marco) {
          marco = pct;
          process.stdout.write(`${pct * 25}% `);
        }
      });
      if (!json) console.log('ok');
      trazidos.push({ nome: it.nome, tipo: it.tipo, local: it.local, arquivos });
    }
    return mostrar({ trazidos }, `\nTrazido(s) para ${PASTA_LOCAL}:\n` + trazidos.map((t) => `  ${t.local}`).join('\n'));
  }

  if (valor('achar')) {
    const alvo = valor('achar');
    const id = idDoLink(alvo);
    if (id) {
      return mostrar(
        { link: true, id },
        `Link do Drive, id ${id}.\n` +
          'O arquivo em si chega pelo Google Drive para computador. Para achar o nome dele:\n' +
          '  - o assistente pode consultar o conector do Google Drive (get_file_metadata com este id), e depois\n' +
          '  - node conexao/drive.mjs --achar "<nome do arquivo>"\n' +
          `Se o vídeo foi subido na Entrada, ele já aparece em: node conexao/drive.mjs --novos`,
      );
    }
    const base = path.dirname(drive.pasta);
    const achados = await procurarPorNome(base, alvo);
    return mostrar({ achados }, achados.length ? achados.map((a) => `${a.pasta ? '[pasta] ' : ''}${a.caminho}`).join('\n') : `Nada com "${alvo}" em ${base}.`);
  }

  if (valor('entregar')) {
    const origem = path.resolve(valor('entregar'));
    if (!existsSync(origem)) {
      console.error(`✗ não achei ${origem}`);
      process.exit(1);
    }
    const destino = path.join(drive.prontos, path.basename(origem));
    await copiar(origem, destino);
    return mostrar({ ok: true, destino }, `✓ Entregue no Drive: ${destino}\n  (o Google Drive sobe sozinho; no celular aparece em "${path.basename(drive.pasta)}/Prontos")`);
  }

  const itens = await itensDaEntrada(drive);
  const prontos = await itensProntos(drive);
  return mostrar(
    { configurado: true, drive, entrada: itens, prontos },
    `Drive configurado:\n  Entrada: ${drive.entrada} (${itens.length} item(ns), ${itens.filter((i) => !i.trazido).length} novo(s))\n  Prontos: ${drive.prontos} (${prontos.length} arquivo(s))`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  principal().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
