/**
 * Motor Inteligente de Cenas Reais (`agente/cenas.mjs`).
 *
 * Analisa o que realmente está sendo falado na transcrição (frase por frase)
 * e busca mídias visuais reais correspondentes ao assunto falado:
 *   1. Extrai entidades (nomes próprios, marcas, tecnologias, lugares) e temas
 *      visuais de cada trecho da locução.
 *   2. Tenta casar primeiro com vídeos/imagens da biblioteca local do usuário
 *      pelo nome do arquivo.
 *   3. Se houver chave gratuita do Pexels configurada (`pexelsKey`), baixa
 *      vídeos de B-roll reais para cada trecho falado.
 *   4. Sem precisar de nenhuma chave de API, busca imagens reais na Web
 *      (logos, telas, fotos de contexto real do que está sendo dito) via
 *      Bing Image Search CDN, salva em `public/midia/auto/` e:
 *        - Pode gerar cenas de vídeo de fundo animadas (Ken Burns) com a imagem real
 *        - E/ou inserir imagens B-Roll (`Foto`) sincronizadas com cada frase!
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_MIDIA_AUTO = path.join(raiz, 'public', 'midia', 'auto');
const PASTA_VIDEOS_AUTO = path.join(raiz, 'render', '.fontes', 'auto_pexels');

const STOPWORDS_PT = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sob', 'sobre',
  'e', 'ou', 'mas', 'porém', 'todavia', 'contudo', 'que', 'se', 'como', 'quando',
  'onde', 'quem', 'qual', 'quais', 'quanto', 'é', 'são', 'foi', 'foram', 'era',
  'ser', 'estar', 'está', 'estão', 'ter', 'tem', 'tinha', 'pode', 'podem', 'vai',
  'vão', 'ir', 'fazer', 'faz', 'feita', 'feito', 'ficar', 'fica', 'ficando',
  'fazendo', 'cada', 'muito', 'mais', 'menos', 'tão', 'só', 'não', 'sim', 'já',
  'ainda', 'também', 'até', 'isso', 'isto', 'aquilo', 'este', 'esta', 'esse',
  'essa', 'aquele', 'aquela', 'ele', 'ela', 'eles', 'elas', 'nós', 'você', 'vocês',
  'seu', 'sua', 'seus', 'suas', 'meu', 'minha', ' nosso', 'nossa', 'vez', 'olhe',
  'olha', 'veja', 'então', 'assim', 'lá', 'aqui', 'aí', 'ali', 'bem', 'mal',
  'tudo', 'nada', 'todo', 'toda', 'todos', 'todas', 'outro', 'outra', 'outros',
  'outras', 'mesmo', 'mesma', 'há', 'ao', 'aos', 'à', 'às', 'pelo', 'pela',
  'pelos', 'pelas', 'num', 'numa', 'dá', 'dar', 'quer', 'ver', 'conseguir',
  'trabalhar', 'ajudar', 'pedir', 'colocando', 'descobrir', 'realmente',
]);

/**
 * Mapa de expansão visual: quando a fala menciona determinados conceitos,
 * enriquecemos a busca para trazer cenas muito mais visuais e concretas.
 */
const MAPA_VISUAL = [
  { regex: /\b(google|gemini|gemini4\w*)\b/i, query: 'Google Gemini AI artificial intelligence logo interface', pexels: 'artificial intelligence technology' },
  { regex: /\b(chatgpt|openai|gpt)\b/i, query: 'OpenAI ChatGPT artificial intelligence interface', pexels: 'artificial intelligence screen' },
  { regex: /\b(claude|anthropic)\b/i, query: 'Claude AI Anthropic artificial intelligence', pexels: 'artificial intelligence futuristic' },
  { regex: /\b(ia|ias|intelig[êe]ncias?\s+artificia(?:l|is))\b/i, query: 'inteligencia artificial tecnologia robo neural', pexels: 'artificial intelligence robot brain' },
  { regex: /\b(c[óo]digos?|program\w+|desenvolv\w+|software)\b/i, query: 'programador desenvolvendo codigo computador tela dark', pexels: 'programmer coding computer screen' },
  { regex: /\b(informa[çc][õo]es|dados|analis\w+|an[áa]lise)\b/i, query: 'analise de dados dashboard graficos tecnologia', pexels: 'data analysis dashboard screen' },
  { regex: /\b(ci[êe]ncia|cient[íi]fic\w+|pesquisa)\b/i, query: 'ciencia tecnologia laboratorio futuro pesquisa', pexels: 'science laboratory technology' },
  { regex: /\b(finan[çc]as|dinheiro|mercado|invest\w+|economia|lucro)\b/i, query: 'mercado financeiro graficos trading investimentos', pexels: 'stock market finance chart' },
  { regex: /\b(seguran[çc]a\s+digital|cyber\w*|hacker|prote[çc][ãa]o)\b/i, query: 'seguranca digital ciberseguranca tecnologia rede', pexels: 'cybersecurity hacker network' },
  { regex: /\b(racioc[íi]nio|mente|c[ée]rebro|pensar|profundo)\b/i, query: 'cerebro digital conexoes neurais inteligencia', pexels: 'neural network brain digital' },
  { regex: /\b(projeto|solu[çc][ãa]o|problema|etapas|tarefas)\b/i, query: 'equipe tecnologia projeto planejamento computador', pexels: 'software engineering workflow' },
  { regex: /\b(teste|prova|supera|contra|compet\w*)\b/i, query: 'comparacao inteligencia artificial tecnologia versus', pexels: 'futuristic technology comparison' },
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Divide as palavras da transcrição em cenas semânticas (a cada `intervaloAlvo` segundos)
 * e gera a consulta de busca ideal para o que está sendo dito naquele trecho.
 */
export function extrairCenasDaFala(palavras, duracaoTotal, intervaloAlvo = 4.8) {
  if (!Array.isArray(palavras) || !palavras.length) return [];

  const numCenas = Math.max(1, Math.min(18, Math.ceil(duracaoTotal / intervaloAlvo)));
  const durCena = duracaoTotal / numCenas;
  const cenas = [];
  const queriesUsadas = new Set();

  for (let i = 0; i < numCenas; i++) {
    const inicio = +(i * durCena).toFixed(2);
    const fim = i === numCenas - 1 ? +duracaoTotal.toFixed(2) : +((i + 1) * durCena).toFixed(2);

    // Pega as palavras faladas dentro desta janela (ou vizinhas se houver pausa)
    let palavrasTrecho = palavras.filter((w) => w.start >= inicio - 0.3 && w.start < fim + 0.3);
    if (!palavrasTrecho.length) {
      palavrasTrecho = palavras.filter((w) => w.end >= inicio && w.start <= fim);
    }

    const fraseOriginal = palavrasTrecho.map((w) => w.text).join(' ').trim();

    // 1. Verifica se bate com algum conceito visual enriquecido
    let queryWeb = '';
    let queryPexels = '';
    let rotuloCurto = '';

    for (const Regra of MAPA_VISUAL) {
      const m = fraseOriginal.match(Regra.regex);
      if (m && !queriesUsadas.has(Regra.query)) {
        queryWeb = Regra.query;
        queryPexels = Regra.pexels;
        rotuloCurto = m[0];
        queriesUsadas.add(Regra.query);
        break;
      }
    }

    // 2. Se não bateu em regra pronta (ou se já usou aquela regra), extrai as palavras mais fortes da frase
    if (!queryWeb) {
      const tokens = palavrasTrecho
        .map((w) => w.text.replace(/[.,;:!?()"'“”]/g, '').trim())
        .filter((t) => t.length >= 3 && !STOPWORDS_PT.has(t.toLowerCase()));

      // Prioriza palavras com inicial maiúscula (nomes próprios/marcas) e palavras longas
      const nomesProprios = tokens.filter((t, idx) => idx > 0 && /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(t));
      const escolhidas = [...new Set([...nomesProprios, ...tokens])].slice(0, 4);

      if (escolhidas.length > 0) {
        rotuloCurto = escolhidas.slice(0, 2).join(' ');
        queryWeb = `${escolhidas.join(' ')} tecnologia fotografia`;
        queryPexels = escolhidas.join(' ');
      } else {
        rotuloCurto = `Cena ${i + 1}`;
        queryWeb = 'artificial intelligence futuristic technology dark';
        queryPexels = 'technology futuristic abstract';
      }
    }

    cenas.push({
      indice: i,
      start: inicio,
      end: fim,
      duracao: +(fim - inicio).toFixed(2),
      frase: fraseOriginal,
      rotulo: rotuloCurto,
      queryWeb,
      queryPexels,
    });
  }

  return cenas;
}

/**
 * Tenta encontrar um vídeo local cujo nome case com as palavras faladas no trecho.
 */
export function casarVideoLocalPorContexto(cena, videosFundoLocais, usados = new Set()) {
  if (!Array.isArray(videosFundoLocais) || !videosFundoLocais.length) return null;

  const termos = `${cena.frase} ${cena.queryWeb}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\W+/)
    .filter((t) => t.length >= 4 && !STOPWORDS_PT.has(t));

  if (!termos.length) return null;

  let melhor = null;
  let maiorPontos = 0;

  for (const caminho of videosFundoLocais) {
    const base = path
      .basename(caminho, path.extname(caminho))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Evita casar com vídeos hospitalares padrão quando o assunto não é hospital/médico
    const ehVideoHospitalPadrao = /einstein|sirio|alemao|moinhos|hcor|santa_catarina|hc_usp|quinta_d_or|medicina/i.test(base);
    const falaDeSaude = /hospital|m[ée]dic\w+|sa[úu]de|cirurgia|paciente|cl[íi]nica/i.test(cena.frase);
    if (ehVideoHospitalPadrao && !falaDeSaude) continue;

    let pontos = 0;
    for (const termo of termos) {
      if (base.includes(termo)) pontos += 3;
    }
    if (usados.has(caminho)) pontos -= 1;

    if (pontos > maiorPontos) {
      maiorPontos = pontos;
      melhor = caminho;
    }
  }

  return maiorPontos >= 3 ? melhor : null;
}

/**
 * Busca e baixa uma imagem real da Web correspondente à query da cena
 * usando o CDN rápido do Bing Images (`turl` + `murl`).
 * Não exige nenhuma chave de API e funciona para marcas, notícias, conceitos e pessoas.
 */
export async function baixarImagemRealDaWeb(query, urlsJaUsadas = new Set()) {
  await mkdir(PASTA_MIDIA_AUTO, { recursive: true });

  const urlBusca = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  let html = '';
  try {
    const resp = await fetch(urlBusca, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!resp.ok) return null;
    html = await resp.text();
  } catch {
    return null;
  }

  // Coleta as URLs do CDN rápido da Microsoft (turl) com alta resolução (&w=1080&qlt=90)
  const turls = [...html.matchAll(/turl&quot;:&quot;(https?:\/\/.*?)&quot;/gi)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((u) => !urlsJaUsadas.has(u));

  for (const turlBase of turls.slice(0, 8)) {
    const urlAltaRes = `${turlBase}&w=1080&qlt=92`;
    try {
      const r = await fetch(urlAltaRes, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 4000) continue; // ignora ícones minúsculos

      urlsJaUsadas.add(turlBase);
      const hash = createHash('md5').update(turlBase).digest('hex').slice(0, 10);
      const slug = query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 28);
      const nomeArq = `cena_${slug}_${hash}.jpg`;
      const caminhoCompleto = path.join(PASTA_MIDIA_AUTO, nomeArq);

      if (!existsSync(caminhoCompleto)) {
        await writeFile(caminhoCompleto, buf);
      }
      return {
        caminho: caminhoCompleto,
        src: `midia/auto/${nomeArq}`,
        nome: nomeArq,
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Opcional: se o usuário tiver configurado `pexelsKey` em `server/config.json`,
 * busca e baixa um vídeo MP4 real do Pexels correspondente à frase falada!
 */
export async function baixarVideoRealPexels(query, pexelsKey, formato = '9:16', idsUsados = new Set()) {
  if (!pexelsKey || typeof pexelsKey !== 'string' || !pexelsKey.trim()) return null;
  await mkdir(PASTA_VIDEOS_AUTO, { recursive: true });

  const orientacao = formato === '16:9' ? 'landscape' : formato === '1:1' ? 'square' : 'portrait';
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientacao}&per_page=8&size=medium`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: pexelsKey.trim() },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const dados = await r.json();
    const videos = Array.isArray(dados?.videos) ? dados.videos : [];

    for (const v of videos) {
      if (!v?.id || idsUsados.has(v.id)) continue;
      const arquivos = Array.isArray(v.video_files) ? v.video_files : [];
      const escolhido =
        arquivos.find((f) => f.file_type === 'video/mp4' && f.height >= 720 && f.height <= 1920) ||
        arquivos.find((f) => f.file_type === 'video/mp4');
      if (!escolhido?.link) continue;

      const caminhoLocal = path.join(PASTA_VIDEOS_AUTO, `pexels_${v.id}.mp4`);
      if (existsSync(caminhoLocal)) {
        const info = await stat(caminhoLocal).catch(() => null);
        if (info && info.size > 50_000) {
          idsUsados.add(v.id);
          return caminhoLocal;
        }
      }

      const dl = await fetch(escolhido.link, { signal: AbortSignal.timeout(15000) });
      if (!dl.ok) continue;
      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < 50_000) continue;

      await writeFile(caminhoLocal, buf);
      idsUsados.add(v.id);
      return caminhoLocal;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Para uma lista de palavras transcritas, busca automaticamente mídias reais
 * (imagens da Web e/ou vídeos do Pexels/locais) para cada trecho da fala.
 */
export async function buscarMidiasReaisParaTranscricao(palavras, duracaoTotal, opcoes = {}) {
  const intervalo = Number(opcoes.intervaloCena) || 5.2;
  const cenas = extrairCenasDaFala(palavras, duracaoTotal, intervalo);
  const urlsUsadas = new Set();
  const pexelsIdsUsados = new Set();
  const locaisUsados = new Set();

  const resultadoCenas = [];

  for (const cena of cenas) {
    opcoes.aoProgresso?.(`Buscando cena real para: “${cena.rotulo}” (${cena.start}s)…`);

    // 1. Tenta vídeo local que tenha nome compatível com o assunto
    let videoLocal = casarVideoLocalPorContexto(cena, opcoes.videosFundoLocais ?? [], locaisUsados);
    if (videoLocal) locaisUsados.add(videoLocal);

    // 2. Se tiver chave Pexels, tenta vídeo real do Pexels
    let videoPexels = null;
    if (!videoLocal && opcoes.pexelsKey) {
      videoPexels = await baixarVideoRealPexels(
        cena.queryPexels,
        opcoes.pexelsKey,
        opcoes.formato ?? '9:16',
        pexelsIdsUsados,
      );
    }

    // 3. Sempre busca a imagem real da Web (para servir tanto de B-Roll quanto de cena de fundo se não houver vídeo específico)
    const imagemWeb = await baixarImagemRealDaWeb(cena.queryWeb, urlsUsadas);

    resultadoCenas.push({
      ...cena,
      videoCaminho: videoLocal ?? videoPexels ?? null,
      imagemWeb,
    });
  }

  return resultadoCenas;
}

/**
 * Gera Cenas Nativas do Remotion (`CenaRemotion[]`) baseadas no contexto do roteiro
 * (ChatGPT conversando, O que a IA não sabe, Checklist de passos, Privacidade, Código, Versus).
 */
export function gerarCenasRemotionDoRoteiro(palavras, duracaoTotal) {
  if (!Array.isArray(palavras) || !palavras.length) return [];

  const trechos = [];
  let atual = [];
  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i];
    atual.push(w);
    const ini = atual[0].start;
    const dur = w.end - ini;
    const pontuacaoForte = /[.!?]$/.test(w.text);
    const prox = palavras[i + 1];
    const pausaGrande = prox ? prox.start - w.end >= 0.45 : true;

    if ((dur >= 5.2 && (pontuacaoForte || pausaGrande)) || dur >= 8.2 || i === palavras.length - 1) {
      const fim = prox ? +(prox.start - 0.04).toFixed(2) : Math.max(w.end, +duracaoTotal.toFixed(2));
      trechos.push({
        start: +ini.toFixed(2),
        end: +fim.toFixed(2),
        duracao: Math.max(1.8, +(fim - ini).toFixed(2)),
        texto: atual.map((x) => x.text).join(' ').trim(),
      });
      atual = [];
    }
  }

  function extrairItens(texto, prefixo = '') {
    const limpo = texto
      .replace(/^quer respostas melhores\??\s*/i, '')
      .replace(/^isso significa que\s*/i, '')
      .replace(/^ela pode n[ãa]o conhecer\s*/i, '')
      .trim();

    const partes = limpo
      .split(/,|;|\s+e\s+|\s+ou\s+|\s+como\s+/i)
      .map((p) => p.replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '').trim())
      .filter((p) => p.length >= 6);

    if (partes.length >= 2) {
      return partes.slice(0, 4).map((p) => {
        const cap = p.charAt(0).toUpperCase() + p.slice(1);
        return prefixo ? `${prefixo} ${cap}` : cap;
      });
    }

    const ws = limpo.split(/\s+/).filter(Boolean);
    if (ws.length <= 6) {
      const cap = limpo.charAt(0).toUpperCase() + limpo.slice(1);
      return [prefixo ? `${prefixo} ${cap}` : cap];
    }
    const terco = Math.ceil(ws.length / 3);
    const res = [];
    for (let i = 0; i < ws.length; i += terco) {
      const pedaco = ws.slice(i, i + terco).join(' ');
      const cap = pedaco.charAt(0).toUpperCase() + pedaco.slice(1);
      res.push(prefixo ? `${prefixo} ${cap}` : cap);
    }
    return res.slice(0, 3);
  }

  return trechos.map((seg, idx) => {
    const txt = seg.texto;
    const lower = txt.toLowerCase();
    let tipo = 'chatgpt';

    if (
      /privacidade|dados\s+pessoais|seguran[çc]a\s+digital|compartilhar\s+dados|consci[êe]ncia|prote[çc][ãa]o/i.test(
        lower,
      )
    ) {
      tipo = 'privacidade';
    } else if (
      /n[ãa]o\s+conhec\w+|prefer[êe]ncias|aconteceu\s+ontem|n[ãa]o\s+lembra|sem\s+contexto/i.test(lower)
    ) {
      tipo = 'contexto-ia';
    } else if (
      /respostas\s+melhores|explique|informe|revise|etapas|passo|dica|como\s+usar|construir\s+uma\s+solu[çc][ãa]o/i.test(
        lower,
      )
    ) {
      tipo = 'checklist';
    } else if (/c[óo]digo|program\w+|desenvolv\w+\s+c[óo]digo|software|script|algoritmo/i.test(lower)) {
      tipo = 'codigo';
    } else if (/supera|contra\s+outras|teste\s+real|compar\w+|finan[çc]as|ci[êe]ncia/i.test(lower)) {
      tipo = 'versus';
    }

    if (tipo === 'chatgpt') {
      let promptUsuario = 'Como você funciona para responder minhas perguntas?';
      if (/n[ãa]o\s+sabe\s+automaticamente|tudo\s+sobre\s+voc[êe]/i.test(lower)) {
        promptUsuario = 'Você já sabe tudo sobre mim automaticamente?';
      } else if (/google|gemini/i.test(lower)) {
        promptUsuario = 'O que a nova IA do Google consegue fazer na prática?';
      } else if (/conversa|informa[çc][õo]es\s+dispon[íi]veis/i.test(lower)) {
        promptUsuario = 'De onde vêm as respostas que você me dá no chat?';
      } else if (idx > 0) {
        promptUsuario = `Me explique na prática sobre: "${txt.split(/[,.?!]/)[0].slice(0, 48)}…"`;
      }
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'chatgpt',
        start: seg.start,
        duracao: seg.duracao,
        titulo: /gemini|google/i.test(lower) ? 'Gemini AI · Chat' : 'ChatGPT 4o',
        promptUsuario,
        respostaIa: txt,
        itens: extrairItens(txt).map((p) => (p.length > 34 ? `${p.slice(0, 34)}…` : p)),
        destaque: '#10a37f',
      };
    }

    if (tipo === 'contexto-ia') {
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'contexto-ia',
        start: seg.start,
        duracao: seg.duracao,
        titulo: 'O Que a IA Não Sabe Sozinha',
        subtitulo: 'Sem você explicar na conversa:',
        itens: extrairItens(txt, '❌'),
        destaque: '#ef4444',
      };
    }

    if (tipo === 'checklist') {
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'checklist',
        start: seg.start,
        duracao: seg.duracao,
        titulo: /respostas\s+melhores/i.test(lower)
          ? 'Como Ter Respostas Melhores'
          : 'Passo a Passo Inteligente',
        subtitulo: 'Aplique isto nas suas conversas com a IA:',
        itens: extrairItens(txt),
        destaque: '#10b981',
      };
    }

    if (tipo === 'privacidade') {
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'privacidade',
        start: seg.start,
        duracao: seg.duracao,
        titulo: 'Privacidade e Dados Pessoais',
        subtitulo: 'Use inteligência artificial com segurança:',
        itens: extrairItens(txt),
        destaque: '#38bdf8',
      };
    }

    if (tipo === 'codigo') {
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'codigo',
        start: seg.start,
        duracao: seg.duracao,
        titulo: 'agente_ia_analise.ts',
        itens: extrairItens(txt),
        destaque: '#58a6ff',
      };
    }

    return {
      id: `cr_${Date.now()}_${idx}`,
      tipo: 'versus',
      start: seg.start,
      duracao: seg.duracao,
      titulo: 'Análise e Desempenho da IA',
      itens: extrairItens(txt),
      destaque: '#a855f7',
    };
  });
}

