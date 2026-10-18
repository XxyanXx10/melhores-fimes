/**
 * Biblioteca de mídia: tudo o que já existe para reaproveitar antes de gerar de novo
 * (música, imagem gerada, efeito de meme, vídeo baixado, logo, print, referência,
 * cena pronta e fundo animado).
 *
 *   node agente/biblioteca.mjs atualizar           → refaz o catálogo e a página
 *   node agente/biblioteca.mjs buscar praia cachorro [--tipo imagem]
 *
 * Gera biblioteca/catalogo.json e "Biblioteca de mídia.html" (abrir com dois cliques:
 * miniaturas, players e busca). Descrições, tags e prompts ficam em
 * biblioteca/descricoes.json — `registrarMidia()` acrescenta ali o que for criado.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const PUBLICO = path.join(RAIZ, 'public');
const PASTA = path.join(RAIZ, 'biblioteca');
const ARQ_DESCRICOES = path.join(PASTA, 'descricoes.json');
const ARQ_CATALOGO = path.join(PASTA, 'catalogo.json');
const ARQ_PAGINA = path.join(RAIZ, 'Biblioteca de mídia.html');

const IMAGEM = /\.(png|jpe?g|webp|avif|svg)$/i;
const AUDIO = /\.(mp3|wav|m4a|aac|ogg)$/i;
const VIDEO = /\.(mp4|mov|webm)$/i;

/* desenhos do fundo animado (cena 'fundo' / "fundoAnimado" no plano) */
const FUNDOS = [
  ['manchas', 'Manchas de luz andando devagar nas cores da receita (padrão)'],
  ['synthwave', 'Céu roxo, sol listrado e grade neon em perspectiva (futuro, 2100)'],
  ['listras', 'Faixas diagonais coloridas andando (pop, cômico, comida)'],
  ['bokeh', 'Bolhas de luz desfocadas subindo (natureza, bichos, delicado)'],
  ['pontos', 'Retícula de meio-tom sobre manchas (jornal, gibi, história)'],
  ['codigo', 'Colunas de caracteres caindo (visão de dentro da IA, hacker)'],
];

const lerJson = async (arq, padrao) => (existsSync(arq) ? JSON.parse((await readFile(arq, 'utf8')).replace(/^﻿/, '')) : padrao);

/** "caramelo-ceo.jpg" → "caramelo ceo" (descrição provisória para o que ainda não tem) */
const doNome = (arq) => path.basename(arq).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

async function listar(pasta, filtro, recursivo = false) {
  const abs = path.join(PUBLICO, pasta);
  if (!existsSync(abs)) return [];
  const saida = [];
  for (const e of await readdir(abs, { withFileTypes: true })) {
    const rel = `${pasta}/${e.name}`;
    if (e.isDirectory() || e.isSymbolicLink?.()) {
      if (recursivo) saida.push(...(await listar(rel, filtro, true)));
    } else if (filtro.test(e.name) && !/\.bruto\./.test(e.name)) saida.push(rel);
  }
  return saida;
}

export async function montarCatalogo() {
  const desc = await lerJson(ARQ_DESCRICOES, {});
  const banco = await lerJson(path.join(RAIZ, 'banco-cenas', 'banco.json'), { cenas: [] });
  const sfx = await lerJson(path.join(PUBLICO, 'midia', 'sfx-meme', 'catalogo.json'), {});
  const itens = [];
  const add = async (tipo, src, extra = {}) => {
    const d = desc[src] ?? {};
    let tamanho = 0;
    try {
      tamanho = (await stat(path.join(PUBLICO, src))).size;
    } catch {
      /* virtual (fundo/cena) */
    }
    itens.push({ tipo, src, descricao: d.descricao ?? extra.descricao ?? doNome(src), tags: [...new Set([...(d.tags ?? []), ...(extra.tags ?? [])])], prompt: d.prompt ?? extra.prompt, origem: d.origem ?? extra.origem, tamanho });
  };

  for (const src of await listar('midia/musicas', AUDIO)) await add('musica', src);
  for (const [nome, s] of Object.entries(sfx)) await add('efeito', s.src, { descricao: `${nome} (${s.duracao}s)`, tags: [nome], origem: 'pasta de efeitos do usuário' });
  for (const src of await listar('midia/formatos', IMAGEM)) await add('imagem', src, { origem: /real-/.test(src) ? 'foto real' : 'gerada (Seedream 5 Pro, Magnific)' });
  const porMidia = new Map(banco.cenas.filter((c) => c.midia).map((c) => [c.midia, c]));
  for (const src of await listar('midia/banco/videos', VIDEO)) {
    const c = porMidia.get(src);
    await add('video', src, { descricao: c?.descricao, tags: c?.tags, origem: 'Pexels (baixado)' });
  }
  for (const src of await listar('midia/banco/logos', IMAGEM)) await add('logo', src, { origem: 'Simple Icons' });
  for (const src of await listar('midia/banco/prints', IMAGEM)) await add('print', src, { descricao: `print do site ${doNome(src)}` });
  for (const src of await listar('midia/banco', IMAGEM)) if (!/\/(logos|prints)\//.test(src)) await add('imagem', src, { descricao: porMidia.get(src)?.descricao });
  // referências das notícias: capa e imagens das matérias
  const refs = path.join(PUBLICO, 'midia', 'referencias');
  if (existsSync(refs)) {
    for (const pasta of await readdir(refs)) {
      const r = await lerJson(path.join(refs, pasta, 'referencias.json'), null);
      for (const src of await listar(`midia/referencias/${pasta}`, IMAGEM)) {
        if (/fonte\.png$/.test(src)) continue;
        await add('referencia', src, { descricao: `${r?.fonte ?? pasta}: ${r?.titulo ?? doNome(src)}`, tags: [pasta], origem: r?.url });
      }
    }
  }
  // arquivos dos projetos antigos (o que está solto em midia/ e nas outras pastas)
  const conhecidas = /^midia\/(musicas|formatos|sfx-meme|banco|referencias)\//;
  for (const src of await listar('midia', /./, true)) {
    if (conhecidas.test(src) || /catalogo\.json$/.test(src)) continue;
    const tipo = IMAGEM.test(src) ? 'imagem' : AUDIO.test(src) ? (/sfx[_-]/i.test(src) ? 'efeito' : 'musica') : VIDEO.test(src) ? 'video' : null;
    if (tipo) await add(tipo, src, { origem: 'arquivos dos projetos', tags: ['projetos'] });
  }
  // cenas animadas prontas no banco e os fundos animados
  for (const c of banco.cenas.filter((x) => x.de === 'remotion')) {
    itens.push({ tipo: 'cena', src: `banco:${c.id}`, descricao: c.descricao, tags: c.tags ?? [], origem: `cena ${c.cena?.tipo ?? ''} (usar com "de": "banco", "id": "${c.id}")` });
  }
  for (const [nome, d] of FUNDOS) itens.push({ tipo: 'fundo', src: `fundoAnimado:${nome}`, descricao: d, tags: [nome], origem: `"fundoAnimado": "${nome}" no plano` });

  await mkdir(PASTA, { recursive: true });
  await writeFile(ARQ_CATALOGO, JSON.stringify({ atualizado: new Date().toISOString(), itens }, null, 2), 'utf8');
  await writeFile(ARQ_PAGINA, pagina(itens), 'utf8');
  return itens;
}

/** guarda descrição, tags e prompt de algo recém-criado (para achar depois) */
export async function registrarMidia(src, { descricao, tags = [], prompt, origem } = {}) {
  const desc = await lerJson(ARQ_DESCRICOES, {});
  desc[src] = { ...(desc[src] ?? {}), descricao, tags, ...(prompt ? { prompt } : {}), ...(origem ? { origem } : {}) };
  await mkdir(PASTA, { recursive: true });
  await writeFile(ARQ_DESCRICOES, JSON.stringify(desc, null, 2), 'utf8');
}

const normal = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function buscar(termos, { tipo } = {}) {
  const { itens } = await lerJson(ARQ_CATALOGO, { itens: [] });
  const t = termos.map(normal).filter(Boolean);
  return itens
    .filter((i) => !tipo || i.tipo === tipo)
    .map((i) => {
      const alvo = normal(`${i.descricao} ${i.tags.join(' ')} ${i.src} ${i.prompt ?? ''}`);
      return { i, pontos: t.filter((x) => alvo.includes(x)).length };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => x.i);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pagina(itens) {
  const ROTULO = { musica: '🎵 Músicas', efeito: '🔊 Efeitos de meme', imagem: '🖼️ Imagens', video: '🎬 Vídeos baixados', logo: '🏷️ Logos', print: '📸 Prints de sites', referencia: '📰 Referências de notícias', cena: '✨ Cenas prontas', fundo: '🌌 Fundos animados' };
  const ordem = ['musica', 'efeito', 'imagem', 'video', 'cena', 'fundo', 'logo', 'print', 'referencia'];
  const cartao = (i) => {
    const caminho = `public/${i.src}`;
    let midia = '';
    if (i.tipo === 'musica' || i.tipo === 'efeito') midia = `<audio controls preload="none" src="${esc(caminho)}"></audio>`;
    else if (i.tipo === 'video') midia = `<video muted preload="none" controls src="${esc(caminho)}"></video>`;
    else if (['imagem', 'logo', 'print', 'referencia'].includes(i.tipo)) midia = `<img loading="lazy" src="${esc(caminho)}" alt="">`;
    const busca = esc(normal(`${i.descricao} ${i.tags.join(' ')} ${i.src} ${i.prompt ?? ''} ${i.tipo}`));
    return `<div class="c" data-b="${busca}">${midia}<p>${esc(i.descricao)}</p>${i.tags.length ? `<small>${i.tags.map(esc).join(' · ')}</small>` : ''}<code title="${esc(i.prompt ?? '')}">${esc(i.src)}</code>${i.origem ? `<em>${esc(i.origem)}</em>` : ''}</div>`;
  };
  const secoes = ordem
    .map((t) => {
      const lista = itens.filter((i) => i.tipo === t);
      if (!lista.length) return '';
      return `<section><h2>${ROTULO[t]} <span>${lista.length}</span></h2><div class="g">${lista.map(cartao).join('')}</div></section>`;
    })
    .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Biblioteca de mídia</title>
<style>
body{margin:0;background:#0b0d12;color:#e8ecf2;font:15px/1.4 system-ui,sans-serif}
header{position:sticky;top:0;background:#0b0d12ee;padding:16px 24px;border-bottom:1px solid #222;z-index:2;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{margin:0;font-size:22px}input{flex:1;min-width:220px;padding:10px 14px;border-radius:10px;border:1px solid #333;background:#151922;color:#fff;font-size:15px}
section{padding:8px 24px}h2{font-size:18px;margin:22px 0 10px}h2 span{color:#7c8596;font-weight:400;font-size:14px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
.c{background:#151922;border:1px solid #222a36;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px}
.c img,.c video{width:100%;aspect-ratio:9/12;object-fit:cover;border-radius:8px;background:#000}.c audio{width:100%}
.c p{margin:0;font-weight:600;font-size:13px}.c small{color:#8fa0b8;font-size:12px}.c code{color:#6b7689;font-size:11px;word-break:break-all}.c em{color:#5f6b7d;font-size:11px}
.oculto{display:none}
</style></head><body>
<header><h1>📚 Biblioteca de mídia</h1><input id="q" placeholder="Buscar: praia, cachorro, futuro, comida, suspense, bruh…" autofocus><span id="n"></span></header>
${secoes}
<script>
const q=document.getElementById('q'),n=document.getElementById('n'),cs=[...document.querySelectorAll('.c')];
const norm=t=>t.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
function f(){const t=norm(q.value).split(/\\s+/).filter(Boolean);let v=0;for(const c of cs){const ok=t.every(x=>c.dataset.b.includes(x));c.classList.toggle('oculto',!ok);if(ok)v++}
for(const s of document.querySelectorAll('section')){s.classList.toggle('oculto',!s.querySelector('.c:not(.oculto)'))}n.textContent=v+' itens'}
q.addEventListener('input',f);f();
</script></body></html>`;
}

if (process.argv[1]?.endsWith('biblioteca.mjs')) {
  const [cmd, ...resto] = process.argv.slice(2);
  if (cmd === 'atualizar') {
    const itens = await montarCatalogo();
    const cont = {};
    for (const i of itens) cont[i.tipo] = (cont[i.tipo] ?? 0) + 1;
    console.log(`✓ ${itens.length} itens →`, Object.entries(cont).map(([k, v]) => `${k} ${v}`).join(' · '));
    console.log(`  página: ${ARQ_PAGINA}`);
  } else if (cmd === 'buscar') {
    const i = resto.indexOf('--tipo');
    const tipo = i >= 0 ? resto[i + 1] : undefined;
    const termos = i >= 0 ? resto.filter((_, k) => k !== i && k !== i + 1) : resto;
    const achados = await buscar(termos, { tipo });
    for (const a of achados.slice(0, 25)) console.log(`${a.tipo.padEnd(10)} ${a.src}\n           ${a.descricao}`);
    console.log(`${achados.length} encontrado(s)`);
  } else console.log('uso: node agente/biblioteca.mjs atualizar | buscar <termos> [--tipo musica|imagem|efeito|video|logo|print|referencia|cena|fundo]');
}
