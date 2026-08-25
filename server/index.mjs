/**
 * Serviço local de transcrição.
 * Roda na sua máquina, chama o FFmpeg e o whisper.cpp que você já usa,
 * e devolve as palavras com tempo — o mesmo formato que a plataforma consome.
 *
 *   node server/index.mjs
 *
 * Nada sai do computador: o áudio nunca é enviado para lugar nenhum.
 */
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  conferirFerramentas,
  detectarCortes,
  lerConfig,
  sondarVideo,
  transcreverVideo,
} from '../agente/nucleo.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serve a própria plataforma (pasta dist), para bastar um processo só. */
async function servirEstatico(res, caminho) {
  const dist = path.join(aqui, '..', 'dist');
  let alvo = path.join(dist, caminho === '/' ? 'index.html' : decodeURIComponent(caminho));
  if (!alvo.startsWith(dist)) return json(res, 403, { erro: 'caminho inválido' });
  try {
    if (!(await stat(alvo)).isFile()) alvo = path.join(dist, 'index.html');
  } catch {
    alvo = path.join(dist, 'index.html');
  }
  try {
    const corpo = await readFile(alvo);
    res.writeHead(200, { 'content-type': TIPOS[path.extname(alvo)] ?? 'application/octet-stream' });
    res.end(corpo);
  } catch {
    json(res, 404, { erro: 'a plataforma ainda não foi construída — rode: npm run build' });
  }
}

function json(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(texto);
}

const cfg = await lerConfig();

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (url.pathname === '/status') {
    return json(res, 200, {
      ok: true,
      config: path.basename(cfg.arquivo),
      modelo: path.basename(cfg.modelo),
      modeloEncontrado: existsSync(cfg.modelo),
      whisperEncontrado: existsSync(cfg.whisperCli),
      idioma: cfg.idioma,
    });
  }

  /*
   * Fotos e b-roll ficam em public/midia/ — a mesma pasta que o Remotion
   * empacota no render. Servimos daqui (e não do dist) para uma foto
   * recém-enviada aparecer na prévia sem precisar reconstruir a interface.
   */
  if (url.pathname === '/midia' && req.method === 'POST') {
    const bruto = url.searchParams.get('nome') ?? 'foto.png';
    const nome = path.basename(bruto).replace(/[^\w.-]/g, '_');
    if (!/\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v)$/i.test(nome)) {
      return json(res, 400, { erro: 'formato não suportado' });
    }
    try {
      const pasta = path.join(aqui, '..', 'public', 'midia');
      await mkdir(pasta, { recursive: true });
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(path.join(pasta, nome), Buffer.concat(pedacos));
      console.log(`✓ mídia: ${nome}`);
      return json(res, 200, { src: `midia/${nome}` });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname.startsWith('/midia/') && req.method === 'GET') {
    const nome = path.basename(decodeURIComponent(url.pathname));
    const alvo = path.join(aqui, '..', 'public', 'midia', nome);
    try {
      const corpo = await readFile(alvo);
      res.writeHead(200, {
        'content-type': TIPOS[path.extname(alvo)] ?? 'application/octet-stream',
        'access-control-allow-origin': '*',
      });
      return res.end(corpo);
    } catch {
      return json(res, 404, { erro: 'mídia não encontrada' });
    }
  }

  /* Onde o vídeo já foi cortado — o FFmpeg mede a virada da imagem. */
  if (url.pathname === '/cortes' && req.method === 'POST') {
    const nome = url.searchParams.get('nome') ?? 'video.mp4';
    const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
    try {
      const entrada = path.join(pasta, path.basename(nome).replace(/[^w.-]/g, '_'));
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(entrada, Buffer.concat(pedacos));
      const cortes = await detectarCortes(cfg, entrada);
      console.log(`✓ ${nome}: ${cortes.length} cortes`);
      return json(res, 200, { cortes });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  if (url.pathname === '/transcrever' && req.method === 'POST') {
    const nome = url.searchParams.get('nome') ?? 'video.mp4';
    const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
    try {
      const entrada = path.join(pasta, path.basename(nome).replace(/[^\w.-]/g, '_'));
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(entrada, Buffer.concat(pedacos));

      const words = await transcreverVideo(cfg, entrada);
      // o navegador não sabe o fps do arquivo; o ffprobe sabe
      const meta = await sondarVideo(cfg, entrada);
      console.log(`✓ ${nome}: ${words.length} palavras, ${meta.fps}fps`);
      return json(res, 200, { words, ...meta });
    } catch (e) {
      console.error('✗', e.message);
      return json(res, 500, { erro: e.message });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  if (req.method === 'GET') return servirEstatico(res, url.pathname);

  json(res, 404, { erro: 'rota desconhecida' });
});

servidor.listen(cfg.porta, () => {
  console.log(`\n  Melhores Fimes: http://localhost:${cfg.porta}\n`);
  console.log(`  config : ${cfg.arquivo}`);
  console.log(`  whisper: ${existsSync(cfg.whisperCli) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.whisperCli}`);
  console.log(`  modelo : ${existsSync(cfg.modelo) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.modelo}`);
});
