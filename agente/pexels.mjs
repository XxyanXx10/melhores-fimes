/**
 * Busca e baixa um vídeo do Pexels (gratuito) para usar como b-roll.
 * O arquivo fica em public/midia/banco/videos/ — dentro de public/ para o
 * Remotion achar no render — e só é baixado uma vez.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const PASTA = path.join(RAIZ, 'public', 'midia', 'banco', 'videos');

async function chave() {
  const cfg = JSON.parse((await readFile(path.join(RAIZ, 'server', 'config.json'), 'utf8')).replace(/^﻿/, ''));
  if (!cfg.pexelsKey) throw new Error('falta "pexelsKey" em server/config.json');
  return cfg.pexelsKey.trim();
}

/**
 * @param busca termos em inglês funcionam melhor ("doctor tablet hospital")
 * @param opcoes { formato: '9:16'|'16:9'|'1:1', duracaoMin: segundos, evitar: Set de ids }
 * @returns { midia: 'midia/banco/videos/pexels_X.mp4', id, autor, url, duracao } ou null
 */
export async function videoDoPexels(busca, { formato = '9:16', duracaoMin = 4, evitar = new Set(), id } = {}) {
  const orientacao = formato === '16:9' ? 'landscape' : formato === '1:1' ? 'square' : 'portrait';
  // com `id`, pega exatamente aquele vídeo (ex.: o celular com o ChatGPT aberto)
  const r = await fetch(
    id
      ? `https://api.pexels.com/videos/videos/${id}`
      : `https://api.pexels.com/videos/search?query=${encodeURIComponent(busca)}&orientation=${orientacao}&per_page=15`,
    { headers: { Authorization: await chave() }, signal: AbortSignal.timeout(15000) },
  );
  if (!r.ok) throw new Error(`Pexels respondeu ${r.status}`);
  const dados = await r.json();
  const videos = id ? [dados] : dados.videos ?? [];
  if (id) duracaoMin = 0;
  const vertical = orientacao === 'portrait';
  for (const v of videos) {
    if (evitar.has(v.id) || v.duration < duracaoMin) continue;
    // 1080 no lado menor basta: 4K só pesa no render e no disco
    const arquivos = (v.video_files ?? []).filter((f) => f.file_type === 'video/mp4' && f.width && f.height);
    const lado = (f) => (vertical ? f.width : f.height);
    const escolhido =
      arquivos.filter((f) => lado(f) >= 1000 && lado(f) <= 1200).sort((a, b) => lado(a) - lado(b))[0] ??
      arquivos.filter((f) => lado(f) >= 700).sort((a, b) => lado(a) - lado(b))[0];
    if (!escolhido) continue;
    await mkdir(PASTA, { recursive: true });
    const nome = `pexels_${v.id}.mp4`;
    const destino = path.join(PASTA, nome);
    if (!existsSync(destino)) {
      const dl = await fetch(escolhido.link, { signal: AbortSignal.timeout(120000) });
      if (!dl.ok) continue;
      const bruto = destino.replace(/\.mp4$/, '.bruto.mp4');
      await writeFile(bruto, Buffer.from(await dl.arrayBuffer()));
      // 30 fps, quadro-chave a cada 0,5 s, sem áudio: a prévia pula para o clipe sem engasgar
      const cfg = JSON.parse((await readFile(path.join(RAIZ, 'server', 'config.json'), 'utf8')).replace(/^﻿/, ''));
      try {
        execFileSync(cfg.ffmpeg || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', bruto, '-an', '-vf', 'fps=30',
          '-c:v', 'libx264', '-crf', '22', '-preset', 'veryfast', '-g', '15', '-keyint_min', '15', '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart', destino]);
        await rm(bruto, { force: true });
      } catch {
        await rename(bruto, destino);
      }
    }
    evitar.add(v.id);
    return { midia: `midia/banco/videos/${nome}`, id: v.id, autor: v.user?.name, url: v.url, duracao: v.duration };
  }
  return null;
}

if (process.argv[1]?.endsWith('pexels.mjs')) {
  const [busca, formato] = process.argv.slice(2);
  console.log(await videoDoPexels(busca ?? 'artificial intelligence', { formato }));
}
