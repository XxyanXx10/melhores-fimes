/**
 * Projeto da plataforma (16:9) a partir de um vídeo longo montado em modo base.
 *
 *   node agente/longo-projeto.mjs ideias/longos/<nome>.montagem.json ideias/longos/<nome>.personagem.json
 *
 * Lê a linha do tempo que o `longo-montar.py --base` gravou (palavras já no tempo do vídeo
 * inteiro) e escreve projeto/<projeto>.json com: a legenda, as reações do personagem do canal
 * (corpo inteiro no canto ou "bolha" redonda no centro), as cenas animadas e a música.
 * Depois é só abrir na plataforma e ajustar.
 *
 * Reações: { "<id do segmento>" | "pausa-<n do bloco>": [[palavra|segundos, expressão, modo, duração?]] }
 * Uma reação vai até a próxima (ou até a duração dada).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const [arqM, arqP] = process.argv.slice(2);
const M = JSON.parse(readFileSync(arqM, 'utf8'));
const P = JSON.parse(readFileSync(arqP, 'utf8'));
const L = JSON.parse(readFileSync(path.join(M.trabalho, 'linha.json'), 'utf8'));

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9?]/g, '');

function quando(bloco, em, depois = 0) {
  if (/^\d+(\.\d+)?$/.test(String(em))) return bloco.t0 + Number(em);
  const alvo = norm(em);
  const w = bloco.palavras.find((p) => p.start >= depois - 0.05 && norm(p.text).startsWith(alvo));
  if (!w) {
    console.warn(`  ! "${em}" não encontrado no bloco ${bloco.bloco}`);
    return depois + 1;
  }
  return w.start - 0.1;
}

const fotos = [];
for (const b of L.blocos) {
  const chave = b.seg ?? `pausa-${b.bloco}`;
  const lista = P.reacoes[chave] ?? [];
  let cursor = b.t0;
  const marcadas = lista.map(([em, expr, modo, dur]) => {
    const t = quando(b, em, cursor);
    cursor = t + 0.3;
    return { t, expr, modo, dur };
  });
  marcadas.forEach((r, i) => {
    const prox = marcadas[i + 1]?.t ?? b.t0 + b.dur;
    const dur = Math.max(1, Math.min(r.dur ?? 99, prox - r.t));
    const m = P.modos[r.modo];
    fotos.push({
      id: `pers-${fotos.length}`,
      src: `${m.pasta}/${r.expr}.png`,
      start: +r.t.toFixed(2),
      duracao: +dur.toFixed(2),
      entrada: m.entrada,
      largura: m.largura,
      x: m.x,
      y: m.y,
      ...(r.modo === 'bolha' ? { semLegenda: true } : {}),
    });
  });
}

const cenas = P.cenas.map((c, i) => {
  const b = L.blocos.find((x) => x.seg === c.seg);
  const t = quando(b, c.em, b.t0);
  const { seg, em, dur, ...resto } = c;
  return { id: `cena-${i}`, start: +t.toFixed(2), duracao: dur, itens: [], ...resto };
});

// legenda só nos trechos escolhidos (montagem.legendaEm = ids dos segmentos); sem a lista, o vídeo todo
const trechos = (M.legendaEm ?? []).flatMap((id) => L.blocos.filter((b) => b.seg === id).map((b) => [+b.t0.toFixed(2), +(b.t0 + b.dur).toFixed(2)]));
const palavras = L.blocos.flatMap((b) => b.palavras.map((w) => ({ text: w.text, start: w.start, end: w.end })));
const projeto = {
  versao: 1,
  video: M.saidaBase,
  nome: path.basename(M.saidaBase),
  nomeProjeto: P.projeto,
  arquivo: `${P.projeto}.json`,
  duracao: L.duracao,
  fps: 30,
  largura: 1920,
  altura: 1080,
  template: P.template,
  estilo: { ...P.estilo, ...(trechos.length ? { trechos } : {}) },
  movimento: 'off',
  forcaZoom: 1,
  zoomsManuais: [],
  fotos,
  sons: [{ id: 'mus-0', src: P.musica.src, nome: path.basename(P.musica.src), tipo: 'musica', start: 0, duracao: 0, volume: P.musica.volume, fadeIn: 2, fadeOut: 3, repetir: true, quedas: [] }],
  cartoes: [],
  cenasRemotion: cenas,
  divisoes: [],
  cortes: [],
  transicao: 'off',
  palavras,
};
const destino = path.join(RAIZ, 'projeto', `${P.projeto}.json`);
writeFileSync(destino, JSON.stringify(projeto, null, 2));
console.log(`ok: ${destino} — ${palavras.length} palavras, ${fotos.length} reações, ${cenas.length} cenas, ${L.duracao}s`);
