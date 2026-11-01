/**
 * Põe o personagem do canal (o dono, em 13 expressões) num projeto de Short já com cenas.
 *
 *   node agente/personagem.mjs "projeto/<nome> (cenas).json" '<reações JSON>' [--cta "VÍDEO COMPLETO NO CANAL"]
 *
 * Reações: [["palavra" | segundos, "expressão" | ["expr1", "expr2", ...], "explica" | "bolha" | "canto", duração?], ...]
 *   explica = o jeito principal: bolha de destaque no alto, COM legenda, trocando de expressão a cada
 *             ~1,3 s enquanto a narração explica (passe a lista de expressões); depois sai e o vídeo volta.
 *   bolha   = busto grande no centro, sem legenda (momento de fala direta com o público).
 *   canto   = corpo inteiro, só como reação curta (1–2 s). Nunca o vídeo inteiro: o dono rejeitou o
 *             personagem "parado no canto como um PNG".
 * Cada reação vai até a próxima (ou até a duração). Sem --sem-cta, o fim ganha o botão
 * "se inscreve" (cena 'inscrever') com o personagem feliz no canto.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [arq, json] = process.argv.slice(2);
const cta = process.argv.includes('--cta') ? process.argv[process.argv.indexOf('--cta') + 1] : 'SE INSCREVE NO CANAL!';
const semCta = process.argv.includes('--sem-cta');
const p = JSON.parse(readFileSync(arq, 'utf8'));
const vertical = (p.altura ?? 1920) > (p.largura ?? 1080);
const MODOS = vertical
  ? { explica: { pasta: 'midia/personagem/bolha', x: 50, y: 30, largura: 52, entrada: 'escala' },
      canto: { pasta: 'midia/personagem', x: 85, y: 87, largura: 20, entrada: 'pop' },
      bolha: { pasta: 'midia/personagem/bolha', x: 50, y: 68, largura: 56, entrada: 'escala' } }
  : { explica: { pasta: 'midia/personagem/bolha', x: 50, y: 40, largura: 26, entrada: 'escala' },
      canto: { pasta: 'midia/personagem', x: 89, y: 70, largura: 12, entrada: 'pop' },
      bolha: { pasta: 'midia/personagem/bolha', x: 50, y: 48, largura: 30, entrada: 'escala' } };
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const palavras = p.palavras ?? [];
const dur = p.duracao;

let cursor = 0;
const marcas = JSON.parse(json).map(([em, expr, modo, d]) => {
  let t;
  if (typeof em === 'number') t = em;
  else {
    const w = palavras.find((x) => x.start >= cursor - 0.05 && norm(x.text).startsWith(norm(em)));
    if (!w) console.warn(`  ! "${em}" não encontrada`);
    t = w ? Math.max(0, w.start - 0.1) : cursor + 1;
  }
  cursor = t + 0.3;
  return { t, expr, modo, d };
});

// fim: botão de inscrição nos últimos ~3,5 s
const inicioCta = Math.max(0, dur - 3.6);
p.fotos = (p.fotos ?? []).filter((f) => !String(f.id).startsWith('pers-'));
marcas.forEach((m, i) => {
  const prox = Math.min(marcas[i + 1]?.t ?? dur, semCta ? dur : inicioCta);
  const fim = Math.min(prox, m.d ? m.t + m.d : prox);
  if (fim - m.t < 0.6) return;
  const md = MODOS[m.modo];
  const exprs = Array.isArray(m.expr) ? m.expr : [m.expr];
  if (m.modo === 'explica') {
    // troca de cara ao longo da fala: uma imagem por pedaço, a seguinte entra por cima sem "pulo"
    const passo = Math.max(1.0, (fim - m.t) / Math.max(1, Math.round((fim - m.t) / 1.3)));
    const n = Math.max(1, Math.round((fim - m.t) / passo));
    for (let k = 0; k < n; k++) {
      const a = m.t + k * passo;
      const b = k === n - 1 ? fim : a + passo + 0.15;
      p.fotos.push({ id: `pers-${i}-${k}`, src: `${md.pasta}/${exprs[k % exprs.length]}.png`, start: +a.toFixed(2), duracao: +(b - a).toFixed(2),
        entrada: k === 0 ? md.entrada : 'fade', largura: md.largura, x: md.x, y: md.y, ...(k < n - 1 ? { saidaRapida: true } : {}) });
    }
    return;
  }
  p.fotos.push({ id: `pers-${i}`, src: `${md.pasta}/${exprs[0]}.png`, start: +m.t.toFixed(2), duracao: +(fim - m.t).toFixed(2),
    entrada: md.entrada, largura: md.largura, x: md.x, y: md.y, ...(m.modo === 'bolha' ? { semLegenda: true } : {}) });
});
p.cenasRemotion = (p.cenasRemotion ?? []).filter((c) => c.tipo !== 'inscrever');
if (!semCta) {
  // no fim ele aparece pequeno em cima do botão, feliz, pedindo a inscrição
  const md = MODOS.explica;
  // --sem-bolha-fim: o botão sem a bolha (quando o apresentador já está em cena, como na série 3D)
  if (!process.argv.includes('--sem-bolha-fim')) p.fotos.push({ id: 'pers-fim', src: `${md.pasta}/feliz.png`, start: +inicioCta.toFixed(2), duracao: +(dur - inicioCta).toFixed(2),
    entrada: 'escala', largura: md.largura * 0.6, x: md.x, y: vertical ? 24 : 22 });
  p.cenasRemotion.push({ id: 'cena-inscrever', tipo: 'inscrever', start: +inicioCta.toFixed(2), duracao: +(dur - inicioCta + 0.2).toFixed(2),
    titulo: cta, subtitulo: 'e ativa o sininho 🔔', itens: [], semLegenda: true });
}
writeFileSync(arq, JSON.stringify(p, null, 2));
console.log(`ok: ${p.fotos.filter((f) => String(f.id).startsWith('pers-')).length} reações em ${arq}`);
