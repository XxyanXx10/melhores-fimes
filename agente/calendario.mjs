/**
 * Gera "Calendário de postagem.html" na pasta dos vídeos prontos, a partir de
 * ideias/calendario.json: dia, hora, arquivo, título, descrição e o comentário
 * para fixar, cada um com botão de copiar. Marca se o MP4 já existe na pasta.
 *
 *   node agente/calendario.mjs
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const PASTA = 'C:/Users/yaned/Desktop/Vídeos Canal Dark';
const cal = JSON.parse(await readFile(path.join(RAIZ, 'ideias', 'calendario.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let diaAnterior = '';
const linhas = cal.itens
  .map((i) => {
    const pronto = i.arquivo && existsSync(path.join(PASTA, i.arquivo));
    const estado = !i.arquivo ? '<span class="e livre">vaga</span>' : pronto ? '<span class="e ok">pronto</span>' : '<span class="e fazendo">em produção</span>';
    const desc = i.descricao ? `${i.descricao}\n\n${cal.hashtags}` : '';
    const cab = i.dia !== diaAnterior ? `<h2>${esc(i.dia)}</h2>` : '';
    diaAnterior = i.dia;
    const campo = (rotulo, texto) =>
      texto ? `<div class="campo"><b>${rotulo}</b><p>${esc(texto)}</p><button data-t="${esc(texto)}">copiar</button></div>` : '';
    return `${cab}<div class="item"><div class="topo"><span class="hora">${esc(i.hora)}</span><span class="fmt">${esc(i.formato)}</span>${i.novo ? '<span class="novo">novo</span>' : ''}${estado}</div>
<div class="arq">${esc(i.arquivo || '—')}</div>${campo('Título', i.titulo)}${campo('Descrição', desc)}${campo('Comentário fixado', i.fixar)}</div>`;
  })
  .join('\n');

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Calendário de postagem</title><style>
body{margin:0;background:#0f1115;color:#e8e8ea;font:15px/1.45 system-ui,Segoe UI,sans-serif}
main{max-width:760px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:0 0 4px}.regras{color:#9aa0aa;margin:0 0 18px}
h2{font-size:15px;color:#ffd166;margin:26px 0 8px;text-transform:uppercase;letter-spacing:.04em}
.item{background:#181b22;border:1px solid #262a33;border-radius:12px;padding:12px 14px;margin:8px 0}
.topo{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hora{font-weight:700;font-size:16px}
.fmt,.novo,.e{font-size:12px;padding:2px 8px;border-radius:99px;background:#262a33}.novo{background:#3a2a6b}
.ok{background:#14532d}.fazendo{background:#713f12}.livre{background:#374151}.arq{color:#9aa0aa;font-size:13px;margin:6px 0}
.campo{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin-top:8px}.campo b{grid-column:1/3;font-size:12px;color:#9aa0aa}
.campo p{margin:0;white-space:pre-wrap}button{background:#2b6cb0;color:#fff;border:0;border-radius:8px;padding:6px 10px;cursor:pointer;align-self:start}
button.feito{background:#15803d}</style></head><body><main>
<h1>${esc(cal.titulo)}</h1><p class="regras">${esc(cal.regras)}</p>
${linhas}
</main><script>
document.querySelectorAll('button[data-t]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.t)}catch(e){const t=document.createElement('textarea');t.value=b.dataset.t;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}b.textContent='copiado ✓';b.classList.add('feito');setTimeout(()=>{b.textContent='copiar';b.classList.remove('feito')},1500)});
</script></body></html>`;

await writeFile(path.join(PASTA, 'Calendário de postagem.html'), html, 'utf8');
const prontos = cal.itens.filter((i) => i.arquivo && existsSync(path.join(PASTA, i.arquivo))).length;
console.log(`✓ ${PASTA}/Calendário de postagem.html — ${prontos} de ${cal.itens.filter((i) => i.arquivo).length} vídeos já na pasta`);
