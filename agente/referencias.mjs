/**
 * Referências reais de uma notícia, para o vídeo mostrar a coisa de verdade
 * enquanto fala dela (e não um banco de imagem genérico).
 *
 *   node agente/referencias.mjs <link-da-noticia> <pasta> ["texto do roteiro"]
 *   node agente/referencias.mjs --ideia <id>
 *
 * Baixa para public/midia/referencias/<pasta>/:
 *   - capa.png        a imagem principal da matéria (og:image)
 *   - img1.png, …     as imagens de dentro da matéria (prints do produto, fotos do anúncio)
 *   - fonte.png       o ícone do site (Canaltech, The Verge…)
 * e grava referencias.json com manchete, site, data e os logos das empresas
 * citadas (os que existem em public/midia/banco/logos).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

/* palavra no texto → arquivo em public/midia/banco/logos */
const LOGOS = [
  [/\bgemini\b/, 'googlegemini.svg'],
  [/\bgoogle\b/, 'google.svg'],
  [/\b(chatgpt|openai|sora)\b/, 'openai.svg'],
  [/\banthropic\b/, 'anthropic.svg'],
  [/\bclaude\b/, 'claude.svg'],
  [/\bmeta\b|\bfacebook\b/, 'meta.svg'],
  [/\binstagram\b/, 'instagram.svg'],
  [/\bwhatsapp\b/, 'whatsapp.svg'],
  [/\bmicrosoft\b|\bcopilot\b/, 'microsoft.svg'],
  [/\bgithub\b/, 'github.svg'],
  [/\bapple\b|\biphone\b|\bsiri\b/, 'apple.svg'],
  [/\bamazon\b|\balexa\b/, 'amazon.svg'],
  [/\bnvidia\b/, 'nvidia.svg'],
  [/\btesla\b/, 'tesla.svg'],
  [/\bgrok\b/, 'grok.svg'],
  [/\bxai\b/, 'xai.svg'],
  [/\btwitter\b/, 'x.svg'],
  [/\bdeepseek\b/, 'deepseek.svg'],
  [/\bmistral\b/, 'mistralai.svg'],
  [/\bperplexity\b/, 'perplexity.svg'],
  [/\bmidjourney\b/, 'midjourney.png'],
  [/\bn8n\b/, 'n8n.svg'],
  [/\bnotion\b/, 'notion.svg'],
  [/\bzapier\b/, 'zapier.svg'],
  [/\bcanva\b/, 'canva.svg'],
  [/\byoutube\b/, 'youtube.svg'],
  [/\btiktok\b/, 'tiktok.svg'],
  [/\bhugging ?face\b/, 'huggingface.svg'],
];

async function cfg() {
  return JSON.parse((await readFile(path.join(RAIZ, 'server', 'config.json'), 'utf8')).replace(/^﻿/, ''));
}

const ACENTOS = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', cedil: '̧', uml: '̈' };

function decodificar(t = '') {
  return t
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    // &ccedil; &atilde; &eacute;… → letra com acento
    .replace(/&([a-z])(acute|grave|circ|tilde|cedil|uml);/gi, (_, letra, acento) => (letra + ACENTOS[acento.toLowerCase()]).normalize('NFC'))
    .trim();
}

function meta(html, nome) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? decodificar(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '') : '';
}

/** "1200x675" ou "?w=1200" no endereço: quanto maior, melhor a versão da imagem */
function tamanhoNoEndereco(u) {
  const m = u.match(/\/(\d{3,4})x\d*\//) ?? u.match(/[?&](?:w|width)=(\d{3,4})/);
  return m ? +m[1] : 0;
}

/** endereços de imagem da matéria: src, data-src e a maior opção do srcset */
function imagensDaMateria(html, base) {
  const corpo = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const achados = [];
  for (const tag of corpo.match(/<(?:img|source)[^>]+>/gi) ?? []) {
    const attr = (n) => decodificar(tag.match(new RegExp(`\\s${n}=["']([^"']+)["']`, 'i'))?.[1] ?? '');
    const srcset = attr('srcset') || attr('data-srcset');
    if (srcset) {
      const maior = srcset
        .split(',')
        .map((p) => p.trim().split(/\s+/))
        .map(([u, w]) => ({ u, w: parseInt(w) || tamanhoNoEndereco(u) }))
        .sort((a, b) => b.w - a.w)[0];
      if (maior?.u) achados.push(maior.u);
    }
    for (const n of ['data-src', 'data-lazy-src', 'src']) if (attr(n)) achados.push(attr(n));
  }
  // sites em React/Next guardam o corpo da matéria num JSON dentro da página, sem <img>
  const semEscape = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  for (const u of semEscape.match(/https?:\/\/[^"'\s<>\\]+?\.(?:png|jpe?g|webp|avif)(?=["'\s<>\\?])/gi) ?? []) achados.push(u);
  // uma entrada por imagem: as versões em tamanhos diferentes terminam no mesmo arquivo
  const porArquivo = new Map();
  for (const bruto of achados) {
    if (bruto.startsWith('data:')) continue;
    let u;
    try {
      u = new URL(bruto, base).href;
    } catch {
      continue;
    }
    if (/logo|avatar|icon|sprite|pixel|scorecard|gravatar|emoji|placeholder|\.svg(\?|$)|1x1|ads?[./]/i.test(u)) continue;
    const chave = u.split('?')[0].split('/').pop();
    const atual = porArquivo.get(chave);
    if (!atual || tamanhoNoEndereco(u) > tamanhoNoEndereco(atual)) porArquivo.set(chave, u);
  }
  return [...porArquivo.values()];
}

/** baixa e converte para PNG (webp/avif/jpg viram png); devolve [largura, altura] ou null */
async function baixarComoPng(c, url, destino) {
  const r = await fetch(url, { headers: { 'User-Agent': NAVEGADOR }, signal: AbortSignal.timeout(30000) }).catch(() => null);
  if (!r?.ok) return null;
  const bruto = `${destino}.bruto`;
  await writeFile(bruto, Buffer.from(await r.arrayBuffer()));
  try {
    execFileSync(c.ffmpeg, ['-v', 'error', '-y', '-i', bruto, '-frames:v', '1', destino], { timeout: 60000 });
    const ffprobe = c.ffmpeg.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'));
    const saida = execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', destino]).toString().trim();
    const [w, h] = saida.split(',').map(Number);
    return w && h ? [w, h] : null;
  } catch {
    return null;
  } finally {
    await rm(bruto, { force: true });
  }
}

function dataLegivel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * @param url    link da notícia
 * @param pasta  nome da pasta em public/midia/referencias/
 * @param texto  roteiro/título, para achar os logos das empresas citadas
 */
export async function buscarReferencias(url, pasta, texto = '') {
  const c = await cfg();
  const dir = path.join(RAIZ, 'public', 'midia', 'referencias', pasta);
  const rel = (arq) => `midia/referencias/${pasta}/${arq}`;
  await mkdir(dir, { recursive: true });

  const html = await (await fetch(url, { headers: { 'User-Agent': NAVEGADOR }, signal: AbortSignal.timeout(30000) })).text();
  const host = new URL(url).hostname.replace(/^www\./, '');
  const ref = {
    url,
    fonte: meta(html, 'og:site_name') || host,
    titulo: meta(html, 'og:title') || decodificar(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? ''),
    data: dataLegivel(meta(html, 'article:published_time') || meta(html, 'og:updated_time')),
    logoFonte: null,
    capa: null,
    imagens: [],
    logos: [],
  };

  const capaUrl = meta(html, 'og:image');
  if (capaUrl) {
    const t = await baixarComoPng(c, new URL(capaUrl, url).href, path.join(dir, 'capa.png'));
    if (t) ref.capa = { midia: rel('capa.png'), tamanho: t };
  }

  const capaArquivo = capaUrl.split('?')[0].split('/').pop();
  let n = 0;
  for (const u of imagensDaMateria(html, url)) {
    if (n >= 8) break;
    if (u.split('?')[0].split('/').pop() === capaArquivo) continue;
    const arq = `img${n + 1}.png`;
    const t = await baixarComoPng(c, u, path.join(dir, arq));
    // "canaltech-512.png": é o logo do próprio site — vira o ícone da manchete, não imagem de conteúdo
    if (t && t[0] === t[1] && u.toLowerCase().split('/').pop().includes(host.split('.')[0])) {
      await rm(path.join(dir, 'fonte.png'), { force: true });
      await writeFile(path.join(dir, 'fonte.png'), await readFile(path.join(dir, arq)));
      await rm(path.join(dir, arq), { force: true });
      ref.logoFonte = rel('fonte.png');
      continue;
    }
    // miniaturas de "leia também" e ícones ficam de fora
    if (!t || t[0] < 500 || t[1] < 280) {
      await rm(path.join(dir, arq), { force: true });
      continue;
    }
    ref.imagens.push({ midia: rel(arq), tamanho: t, origem: u });
    n++;
  }

  if (!ref.logoFonte) {
    const ico = await baixarComoPng(c, `https://www.google.com/s2/favicons?domain=${host}&sz=128`, path.join(dir, 'fonte.png'));
    if (ico) ref.logoFonte = rel('fonte.png');
  }

  const alvo = `${ref.titulo} ${texto}`.toLowerCase();
  const disponiveis = new Set(await readdir(path.join(RAIZ, 'public', 'midia', 'banco', 'logos')).catch(() => []));
  for (const [re, arq] of LOGOS) if (re.test(alvo) && disponiveis.has(arq) && !ref.logos.includes(arq)) ref.logos.push(arq);

  await writeFile(path.join(dir, 'referencias.json'), JSON.stringify(ref, null, 2), 'utf8');
  return ref;
}

/** nome de pasta seguro a partir do título */
export function pastaDe(titulo) {
  return titulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 50);
}

export function resumoReferencias(ref) {
  const linhas = [`referências: ${ref.fonte} · ${ref.data} · "${ref.titulo}"`];
  if (ref.logoFonte) linhas.push(`  ícone do site: ${ref.logoFonte}`);
  if (ref.capa) linhas.push(`  capa: ${ref.capa.midia} (${ref.capa.tamanho.join('x')})`);
  for (const i of ref.imagens) linhas.push(`  imagem: ${i.midia} (${i.tamanho.join('x')})`);
  if (ref.logos.length) linhas.push(`  logos: ${ref.logos.join(', ')}`);
  return linhas.join('\n');
}

if (process.argv[1]?.endsWith('referencias.mjs')) {
  const args = process.argv.slice(2);
  let url, pasta, texto;
  if (args[0] === '--ideia') {
    const estado = JSON.parse(await readFile(path.join(RAIZ, 'ideias', 'ideias.json'), 'utf8'));
    const i = estado.ideias.find((x) => x.id === args[1]);
    if (!i) throw new Error(`ideia ${args[1]} não encontrada`);
    url = i.link;
    pasta = pastaDe(i.roteiro?.titulo ?? i.titulo);
    texto = i.roteiro ? `${i.roteiro.gancho} ${i.roteiro.desenvolvimento} ${i.roteiro.cta}` : i.resumo;
  } else [url, pasta, texto] = args;
  if (!url || !pasta) {
    console.log('uso: node agente/referencias.mjs <link> <pasta> ["texto"] | --ideia <id>');
    process.exit(1);
  }
  if (!existsSync(path.join(RAIZ, 'public', 'midia'))) throw new Error('public/midia não existe');
  console.log(resumoReferencias(await buscarReferencias(url, pasta, texto)));
}
