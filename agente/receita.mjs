/**
 * Receita de edição por vídeo: sorteia o "jeito" de cada vídeo para 300 vídeos
 * não saírem iguais — e registra o que cada um usou, para depois cruzar com
 * visualizações e retenção e descobrir o que funciona.
 *
 *   node agente/receita.mjs sortear "projeto/X.json"   → grava a receita no projeto
 *   node agente/receita.mjs historico                  → o que cada vídeo usou
 *
 * Cada item evita repetir o que os dois últimos vídeos usaram. O aplicar-plano
 * aplica a receita (legenda, música, zoom, cores) e o agente segue a `abertura`
 * e a `paleta` ao escrever o plano de cenas.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';

const ARQ = path.join(RAIZ, 'banco-cenas', 'receitas.json');

export const OPCOES = {
  template: ['dark-misterio', 'dark-motivacional', 'dark-retencao', 'dark-cinema'],
  legendaY: [70, 74, 78],
  musica: [
    'midia/magnific-cachito.mp3',
    'midia/magnific-million-dollar-babe.mp3',
    'midia/magnific-psycho-girls.mp3',
    'midia/magnific-stonecutters.mp3',
    'midia/musica_daylight.mp3',
  ],
  movimento: ['natural', 'suave', 'ritmo'],
  forcaZoom: [0.9, 1.1, 1.3],
  /* [destaque principal, destaque secundário] das cenas animadas */
  paleta: {
    ambar: ['#f5b301', '#ffd60a'],
    ciano: ['#00e5ff', '#38bdf8'],
    verde: ['#22c55e', '#a3e635'],
    rosa: ['#ec4899', '#f472b6'],
    violeta: ['#a78bfa', '#c084fc'],
  },
  /* como o b-roll e os prints entram */
  entrada: ['fade', 'escala', 'sobe', 'varre'],
  /* que cena abre o vídeo (o gancho) */
  abertura: ['manchete', 'print', 'frase', 'logos'],
};

export async function lerHistorico() {
  return existsSync(ARQ) ? JSON.parse(await readFile(ARQ, 'utf8')) : [];
}

/** escolhe ao acaso, fugindo do que os últimos vídeos usaram (se sobrar opção) */
function escolher(opcoes, usados) {
  const livres = opcoes.filter((o) => !usados.includes(o));
  const lista = livres.length ? livres : opcoes;
  return lista[Math.floor(Math.random() * lista.length)];
}

export async function sortearReceita() {
  const ultimos = (await lerHistorico()).slice(-2).map((h) => h.receita ?? {});
  const usados = (k) => ultimos.map((r) => r[k]).filter((v) => v !== undefined);
  const paleta = escolher(Object.keys(OPCOES.paleta), usados('paleta'));
  return {
    template: escolher(OPCOES.template, usados('template')),
    legendaY: escolher(OPCOES.legendaY, usados('legendaY')),
    musica: escolher(OPCOES.musica, usados('musica')),
    movimento: escolher(OPCOES.movimento, usados('movimento')),
    forcaZoom: escolher(OPCOES.forcaZoom, usados('forcaZoom')),
    paleta,
    cores: OPCOES.paleta[paleta],
    entrada: escolher(OPCOES.entrada, usados('entrada')),
    abertura: escolher(OPCOES.abertura, usados('abertura')),
  };
}

/** aplica a receita no objeto do projeto (não grava) */
export function aplicarReceita(projeto, receita) {
  projeto.receita = receita;
  projeto.template = receita.template;
  projeto.estilo = { ...(projeto.estilo ?? {}), positionY: receita.legendaY };
  projeto.movimento = receita.movimento;
  projeto.forcaZoom = receita.forcaZoom;
  for (const s of projeto.sons ?? []) {
    if (s.tipo !== 'musica') continue;
    s.src = receita.musica;
    s.nome = path.basename(receita.musica);
  }
  // cena sem cor própria fica com as cores da receita, alternando as duas
  (projeto.cenasRemotion ?? []).forEach((c, i) => {
    if (!c.destaque) c.destaque = receita.cores[i % 2];
  });
  return projeto;
}

/** guarda no histórico o que este vídeo usou (receita + sequência de cenas) */
export async function registrar(projeto, origem) {
  const historico = (await lerHistorico()).filter((h) => h.projeto !== origem);
  const sequencia = (projeto.cenasRemotion ?? []).map((c) => c.tipo);
  // compara com o vídeo anterior de verdade, não com uma aplicação antiga deste mesmo
  const anterior = historico.filter((h) => h.projeto !== projeto.arquivo && h.sequencia?.length).at(-1);
  const avisos = [];
  if (anterior && anterior.sequencia?.join() === sequencia.join()) avisos.push('mesma sequência de cenas do vídeo anterior');
  if (anterior && anterior.sequencia?.[0] === sequencia[0]) avisos.push(`abre com "${sequencia[0]}" igual ao vídeo anterior`);
  const semAnterior = historico.filter((h) => h.projeto !== projeto.arquivo);
  semAnterior.push({ projeto: projeto.arquivo, quando: new Date().toISOString(), receita: projeto.receita, sequencia });
  await writeFile(ARQ, JSON.stringify(semAnterior, null, 2), 'utf8');
  return avisos;
}

if (process.argv[1]?.endsWith('receita.mjs')) {
  const [cmd, arq] = process.argv.slice(2);
  if (cmd === 'sortear' && arq) {
    const projeto = JSON.parse(await readFile(arq, 'utf8'));
    projeto.receita = await sortearReceita();
    await writeFile(arq, JSON.stringify(projeto, null, 2), 'utf8');
    // reserva no histórico: o próximo sorteio (de outro pendente do lote) já foge desta receita
    const historico = (await lerHistorico()).filter((h) => h.projeto !== path.basename(arq));
    historico.push({ projeto: path.basename(arq), quando: new Date().toISOString(), provisoria: true, receita: projeto.receita, sequencia: [] });
    await writeFile(ARQ, JSON.stringify(historico, null, 2), 'utf8');
    console.log(JSON.stringify(projeto.receita, null, 2));
  } else if (cmd === 'historico') {
    for (const h of await lerHistorico())
      console.log(`${h.projeto}\n  ${Object.entries(h.receita ?? {}).filter(([k]) => k !== 'cores').map(([k, v]) => `${k}=${v}`).join(' · ')}\n  cenas: ${h.sequencia.join(' → ')}`);
  } else console.log('uso: node agente/receita.mjs sortear <projeto.json> | historico');
}
