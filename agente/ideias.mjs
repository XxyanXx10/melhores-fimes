/**
 * Ideias de conteúdo → roteiro → voz do Yan → vídeo base do Canal Dark.
 *
 *  1. buscarIdeias(): lê as notícias do dia (RSS de blogs oficiais e sites de
 *     tecnologia) e o Gemini dá nota e um ângulo para o canal.
 *  2. A pessoa aprova as que quer (na aba Ideias).
 *  3. produzir(ids): para cada aprovada, o Gemini escreve o roteiro no padrão
 *     Gancho → Desenvolvimento → CTA, a voz do Yan narra e a fábrica Dark monta
 *     o projeto base. Fica "pendente" para o agente montar as cenas.
 *
 * Estado em ideias/ideias.json.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';
import { gerarNarracao } from './voz.mjs';
import { gerarLoteDark } from './dark.mjs';
import { alinharComRoteiro } from './alinhar.mjs';
import { buscarReferencias, pastaDe, textoDaMateria } from './referencias.mjs';

const ARQ = path.join(RAIZ, 'ideias', 'ideias.json');
const ARQ_ESTILO = path.join(RAIZ, 'ideias', 'estilo-roteiro.md');

export const FONTES = [
  { nome: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
  { nome: 'Google AI', url: 'https://blog.google/technology/ai/rss/' },
  { nome: 'The Verge IA', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { nome: 'TechCrunch IA', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { nome: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },
  { nome: 'Canaltech', url: 'https://canaltech.com.br/rss/' },
  { nome: 'Electrek Tesla', url: 'https://electrek.co/guides/tesla/feed/' },
  { nome: 'Google Notícias IA', url: 'https://news.google.com/rss/search?q=intelig%C3%AAncia+artificial&hl=pt-BR&gl=BR&ceid=BR:pt-419' },
];

async function cfg() {
  return JSON.parse((await readFile(path.join(RAIZ, 'server', 'config.json'), 'utf8')).replace(/^﻿/, ''));
}

export async function lerIdeias() {
  if (!existsSync(ARQ)) return { atualizado: null, ideias: [] };
  return JSON.parse(await readFile(ARQ, 'utf8'));
}
async function salvar(estado) {
  await mkdir(path.dirname(ARQ), { recursive: true });
  await writeFile(ARQ, JSON.stringify(estado, null, 2), 'utf8');
}

function limpar(t = '') {
  return t
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}
function tag(bloco, nome) {
  const m = bloco.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'i'));
  return m ? limpar(m[1]) : '';
}

async function lerFeed(fonte) {
  const r = await fetch(fonte.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  const xml = await r.text();
  const blocos = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  return blocos.slice(0, 40).map((b) => {
    const link = tag(b, 'link') || (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
    const data = new Date(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || Date.now());
    return { fonte: fonte.nome, titulo: tag(b, 'title'), link, data: data.toISOString(), resumo: (tag(b, 'description') || tag(b, 'summary')).slice(0, 400) };
  });
}

/** Chamada de texto no Gemini; com `json`, já devolve o objeto */
export async function gemini(prompt, { json = false, modelo = 'gemini-2.5-flash' } = {}) {
  const c = await cfg();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${c.geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: json ? { responseMimeType: 'application/json', temperature: 0.8 } : { temperature: 0.8 },
    }),
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const texto = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return json ? JSON.parse(texto) : texto;
}

/** Busca notícias das últimas `horas` e pede ao Gemini nota (0–10) e ângulo para o canal */
export async function buscarIdeias({ horas = 48 } = {}) {
  const estado = await lerIdeias();
  const conhecidos = new Set(estado.ideias.map((i) => i.link));
  const limite = Date.now() - horas * 3600_000;
  const novas = [];
  for (const f of FONTES) {
    try {
      for (const it of await lerFeed(f))
        if (it.link && !conhecidos.has(it.link) && new Date(it.data).getTime() >= limite) {
          conhecidos.add(it.link);
          novas.push(it);
        }
    } catch {
      /* uma fonte fora do ar não derruba as outras */
    }
  }
  if (novas.length) {
    const lista = novas.map((n, i) => `${i}. [${n.fonte}] ${n.titulo} — ${n.resumo.slice(0, 160)}`).join('\n');
    const notas = await gemini(
      `Você escolhe pautas para um canal brasileiro de vídeos curtos (Reels/Shorts) sobre inteligência artificial, automação, ferramentas de IA, big techs e tecnologia que impacta o dia a dia.
Para cada notícia abaixo, dê uma nota de 0 a 10 de potencial de viralizar para esse público e um ângulo curto em português (como o vídeo abordaria).
Notícias sem relação com IA/tecnologia relevante ganham nota baixa.
Responda JSON: [{"i":0,"nota":8,"angulo":"..."}]

${lista}`,
      { json: true },
    ).catch(() => []);
    for (const n of Array.isArray(notas) ? notas : []) {
      if (novas[n.i]) Object.assign(novas[n.i], { nota: n.nota, angulo: n.angulo });
    }
    for (const n of novas)
      estado.ideias.push({ id: `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, status: 'nova', nota: 0, ...n });
  }
  estado.ideias.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0) || b.data.localeCompare(a.data));
  estado.atualizado = new Date().toISOString();
  await salvar(estado);
  return { novas: novas.length, total: estado.ideias.length };
}

/* fórmulas de gancho (detalhadas em ideias/estilo-roteiro.md); cada vídeo sorteia uma */
export const GANCHOS = ['alerta', 'revelacao', 'contraste', 'numero', 'consequencia', 'cena', 'pergunta', 'citacao'];

/* frases de virada do guia; as que os últimos roteiros usaram vão no pedido para variar */
const VIRADAS = ['Mas o mais curioso', 'E aqui tá o problema', 'Só que tem um detalhe', 'E não para por aí', 'Agora vem a parte estranha', 'Mas olha o que aconteceu', 'E sabe o que é pior', 'Só que ninguém esperava'];

/* frases que deixavam todo vídeo igual: se aparecerem, o roteiro é refeito uma vez */
const CLICHES = [
  /o segredo n[ãa]o [ée]/i,
  /^\s*(voc[êe] sabia|aten[çc][ãa]o:|cuidado:|imagina s[óo])/i,
  /chegou ao fim|dias contados|revolucionando|no mundo da tecnologia|insights/i,
  /deix[ea] (a )?sua opini[ãa]o nos coment[áa]rios e sig/i,
];

/** sorteia a fórmula do gancho fugindo das três últimas usadas */
function sortearGancho(estado) {
  const ultimas = estado.ideias
    .filter((i) => i.roteiro?.tipoGancho)
    .sort((a, b) => String(b.roteiro.quando ?? '').localeCompare(String(a.roteiro.quando ?? '')))
    .slice(0, 3)
    .map((i) => i.roteiro.tipoGancho);
  const livres = GANCHOS.filter((g) => !ultimas.includes(g));
  return livres[Math.floor(Math.random() * livres.length)];
}

/**
 * Roteiro no padrão do canal (Gancho → Desenvolvimento → Fechamento, ~30 s).
 * Recebe a matéria inteira (não só o resumo do RSS), a fórmula de gancho
 * sorteada e os últimos ganchos, para não repetir estrutura nem palavras.
 */
export async function gerarRoteiro(ideia, { tipoGancho = 'revelacao', recentes = [], viradas = [] } = {}) {
  const arqEstilo = ideia.comChamada ? path.join(RAIZ, 'ideias', 'estilo-roteiro-vendas.md') : ARQ_ESTILO;
  const estilo = existsSync(arqEstilo) ? await readFile(arqEstilo, 'utf8') : '';
  const materia = await textoDaMateria(ideia.link);
  const c = await cfg();
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const pedido = (aviso = '') => `${estilo}

---
Hoje é ${hoje}. Escreva UM roteiro novo sobre a notícia abaixo.
FÓRMULA DE GANCHO: ${tipoGancho}
${recentes.length ? `Ganchos dos últimos vídeos (não repita a estrutura nem as palavras):
${recentes.map((g) => `- ${g}`).join('\n')}
` : ''}
${viradas.length ? `Viradas já usadas nos últimos vídeos (escolha outra): ${viradas.join(' · ')}
` : ''}Fonte: ${ideia.fonte}
Título: ${ideia.titulo}
Resumo: ${ideia.resumo}
Ângulo sugerido: ${ideia.angulo ?? ''}
${materia ? `Texto da matéria (use os fatos daqui; ignore menus e propaganda que vierem junto):
${materia}` : '(o site não deixou ler a matéria: fique só no título e no resumo, sem detalhes inventados)'}
${
  ideia.comChamada
    ? 'FINAL COM CHAMADA: o campo "cta" oferece o material do canal e manda para o link na bio, como nos exemplos.'
    : 'FINAL SEM CHAMADA DE PRODUTO: NÃO ofereça material, guia, templates nem link na bio. O campo "cta" é o fechamento descrito no guia.'
}
${aviso}
Responda JSON: {"titulo":"título curto do vídeo","gancho":"...","desenvolvimento":"...","cta":"..."}`;
  const opcoes = { json: true, modelo: c.geminiModeloRoteiro ?? 'gemini-2.5-flash' };
  const texto = (x) => `${x.gancho} ${x.desenvolvimento} ${x.cta}`;
  // o que faz o roteiro ser refeito uma vez: clichê do canal ou longo demais pra ~30 s
  const problema = (x) => {
    const cliche = CLICHES.find((re) => re.test(texto(x)) || re.test(x.gancho ?? ''));
    if (cliche) return `a versão anterior usou um clichê proibido (${cliche.source}). Reescreva sem ele.`;
    const n = texto(x).split(/\s+/).filter(Boolean).length;
    if (n > 98) return `a versão anterior tinha ${n} palavras. Reescreva com no máximo 95, cortando o menos importante.`;
    return null;
  };
  let r = await gemini(pedido(), opcoes);
  const aviso = problema(r);
  if (aviso) r = await gemini(pedido(`ATENÇÃO: ${aviso}`), opcoes);
  // asterisco e marcação: a voz leria e a legenda mostraria
  for (const k of ['titulo', 'gancho', 'desenvolvimento', 'cta']) if (typeof r[k] === 'string') r[k] = r[k].replace(/[*_#]+/g, '').replace(/\s+/g, ' ').trim();
  return { ...r, tipoGancho, quando: new Date().toISOString(), comMateria: Boolean(materia) };
}

/** liga/desliga a chamada de produto no final do roteiro (padrão: sem chamada) */
export async function definirChamada(id, comChamada) {
  const estado = await lerIdeias();
  const i = estado.ideias.find((x) => x.id === id);
  if (i) i.comChamada = Boolean(comChamada);
  await salvar(estado);
}

export async function marcar(ids, status) {
  const estado = await lerIdeias();
  for (const i of estado.ideias) if (ids.includes(i.id)) i.status = status;
  await salvar(estado);
}

export async function editarRoteiro(id, roteiro) {
  const estado = await lerIdeias();
  const i = estado.ideias.find((x) => x.id === id);
  if (i) i.roteiro = { ...(i.roteiro ?? {}), ...roteiro };
  await salvar(estado);
}

/** Etapa 1 da produção: roteiros das aprovadas (para revisar antes de gastar voz) */
export async function escreverRoteiros(ids, aoAndar = () => {}) {
  const estado = await lerIdeias();
  const alvo = estado.ideias.filter((i) => ids.includes(i.id));
  for (const [k, i] of alvo.entries()) {
    aoAndar({ atual: k + 1, total: alvo.length, detalhe: `Escrevendo roteiro: ${i.titulo}` });
    // um de cada vez: o próximo já foge da fórmula e do gancho deste
    const recentes = estado.ideias
      .filter((x) => x.roteiro?.gancho && x.id !== i.id)
      .sort((a, b) => String(b.roteiro.quando ?? '').localeCompare(String(a.roteiro.quando ?? '')))
      .slice(0, 6)
      .map((x) => x.roteiro.gancho);
    // viradas ("Mas o mais curioso é…") que os últimos roteiros usaram
    const textosRecentes = estado.ideias
      .filter((x) => x.roteiro?.desenvolvimento && x.id !== i.id)
      .sort((a, b) => String(b.roteiro.quando ?? '').localeCompare(String(a.roteiro.quando ?? '')))
      .slice(0, 4)
      .map((x) => x.roteiro.desenvolvimento.toLowerCase());
    const viradas = VIRADAS.filter((v) => textosRecentes.some((txt) => txt.includes(v.toLowerCase())));
    i.roteiro = await gerarRoteiro(i, { tipoGancho: sortearGancho(estado), recentes, viradas });
    i.status = 'roteiro';
    await salvar(estado);
  }
}

/** Etapa 2: voz do Yan + vídeo base do Canal Dark */
export async function produzir(ids, aoAndar = () => {}) {
  const estado = await lerIdeias();
  const alvo = estado.ideias.filter((i) => ids.includes(i.id) && i.roteiro);
  const narracoes = [];
  for (const [k, i] of alvo.entries()) {
    // áudio já gerado antes não é refeito (economiza a cota da voz)
    if (i.audio && i.status === 'audio') {
      narracoes.push({ caminho: i.audio, titulo: i.roteiro.titulo, id: i.id });
      continue;
    }
    aoAndar({ atual: k + 1, total: alvo.length, detalhe: `Gerando a voz: ${i.roteiro.titulo}` });
    const r = i.roteiro;
    const texto = `${r.gancho}\n\n${r.desenvolvimento}\n\n${r.cta}`;
    // sem instrução de estilo: o modelo de voz lê em voz alta tudo o que recebe
    i.audio = await gerarNarracao(texto, r.titulo);
    i.status = 'audio';
    await salvar(estado);
    narracoes.push({ caminho: i.audio, titulo: r.titulo, id: i.id });
  }
  if (!narracoes.length) return [];
  const c = await cfg();
  const criados = [];
  // um por vez: se um falhar (transcrição, áudio...), os outros continuam
  for (const [k, n] of narracoes.entries()) {
    const i = estado.ideias.find((x) => x.id === n.id);
    aoAndar({ atual: k + 1, total: narracoes.length, detalhe: `Vídeo base: ${n.titulo}` });
    try {
      const [criado] = await gerarLoteDark([{ caminho: n.caminho, titulo: n.titulo }], {
        formato: '9:16',
        template: c.darkTemplate ?? 'dark-misterio',
        modoFundo: 'escuro',
        gerarCenasRemotion: false,
        buscarImagensReaisWeb: false,
        gerarCartoesChave: false,
        efeitosAutomaticos: false,
        escurecerFundo: true,
        cortarSilenciosAudio: true,
        musicaFundo: c.darkMusica ?? 'midia/magnific-cachito.mp3',
        volumeMusica: 0.1,
      });
      if (i && criado) {
        // legenda com a grafia exata do roteiro (o Whisper só dá o tempo)
        const arqP = path.join(RAIZ, 'projeto', criado.arquivoProjeto);
        const proj = JSON.parse(await readFile(arqP, 'utf8'));
        const r = i.roteiro;
        proj.palavras = alinharComRoteiro(proj.palavras ?? [], `${r.gancho} ${r.desenvolvimento} ${r.cta}`);
        // manchete, imagens da matéria e logos: o plano de cenas mostra a coisa de verdade
        try {
          proj.referencias = await buscarReferencias(i.link, pastaDe(r.titulo), `${r.gancho} ${r.desenvolvimento} ${r.cta}`);
        } catch (e) {
          proj.avisoReferencias = e.message;
        }
        await writeFile(arqP, JSON.stringify(proj, null, 2), 'utf8');
        i.projeto = criado.arquivoProjeto;
        i.status = 'pendente-cenas';
        delete i.erro;
        criados.push(criado);
      }
    } catch (e) {
      if (i) i.erro = e.message;
    }
    await salvar(estado);
  }
  await salvar(estado);
  return criados;
}

if (process.argv[1]?.endsWith('ideias.mjs')) {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'buscar') console.log(await buscarIdeias());
  else if (cmd === 'listar') {
    for (const i of (await lerIdeias()).ideias.slice(0, 30)) console.log(`${i.id} [${i.status}] ${i.nota ?? '-'} ${i.fonte}: ${i.titulo}`);
  } else console.log('uso: node agente/ideias.mjs buscar | listar');
}
