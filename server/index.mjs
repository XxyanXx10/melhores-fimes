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
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { juntarPalavras, lerJsonWhisper } from './merge.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));

async function lerConfig() {
  const proprio = path.join(aqui, 'config.json');
  const alvo = existsSync(proprio) ? proprio : path.join(aqui, 'config.example.json');
  return { arquivo: alvo, ...JSON.parse(await readFile(alvo, 'utf8')) };
}

function rodar(cmd, args, rotulo) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let erro = '';
    p.stderr.on('data', (d) => (erro += d));
    p.on('error', (e) => reject(new Error(`${rotulo}: ${e.message}`)));
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${rotulo} terminou com código ${code}\n${erro.slice(-1500)}`)),
    );
  });
}

/** vídeo -> wav 16 kHz mono, que é o que o Whisper espera */
async function extrairAudio(cfg, entrada, saida) {
  await rodar(
    cfg.ffmpeg,
    ['-y', '-i', entrada, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', saida],
    'FFmpeg',
  );
}

async function transcrever(cfg, wav, base) {
  const args = ['-m', cfg.modelo, '-l', cfg.idioma, '-ml', '1', '-oj', '-of', base, wav];
  if (cfg.threads > 0) args.unshift('-t', String(cfg.threads));
  await rodar(cfg.whisperCli, args, 'whisper.cpp');
  const json = JSON.parse(await readFile(`${base}.json`, 'utf8'));
  return juntarPalavras(lerJsonWhisper(json));
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

  if (url.pathname === '/transcrever' && req.method === 'POST') {
    const nome = url.searchParams.get('nome') ?? 'video.mp4';
    const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
    try {
      const entrada = path.join(pasta, path.basename(nome).replace(/[^\w.-]/g, '_'));
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(entrada, Buffer.concat(pedacos));

      const wav = path.join(pasta, 'audio.wav');
      await extrairAudio(cfg, entrada, wav);
      const words = await transcrever(cfg, wav, path.join(pasta, 'saida'));

      if (!words.length) throw new Error('O Whisper não devolveu nenhuma palavra.');
      console.log(`✓ ${nome}: ${words.length} palavras`);
      return json(res, 200, { words });
    } catch (e) {
      console.error('✗', e.message);
      return json(res, 500, { erro: e.message });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  json(res, 404, { erro: 'rota desconhecida' });
});

servidor.listen(cfg.porta, () => {
  console.log(`Transcrição local ouvindo em http://localhost:${cfg.porta}`);
  console.log(`  config : ${cfg.arquivo}`);
  console.log(`  whisper: ${existsSync(cfg.whisperCli) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.whisperCli}`);
  console.log(`  modelo : ${existsSync(cfg.modelo) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.modelo}`);
});
