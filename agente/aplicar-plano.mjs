/**
 * Aplica um PLANO DE CENAS (escrito pelo agente — Claude, Gemini...) num projeto.
 *
 * A plataforma não tenta adivinhar sozinha que cena combina com cada frase: o
 * agente lê a transcrição, consulta o banco de cenas, decide, e escreve o plano.
 * Este script só executa: coloca as cenas no projeto, adiciona os sons de
 * transição e guarda no banco as cenas novas marcadas para isso.
 *
 *   node agente/aplicar-plano.mjs transcricao "projeto/X.json"
 *        → frases com tempo, para o agente montar o plano
 *   node agente/aplicar-plano.mjs aplicar "projeto/X.json" plano.json [saida.json]
 *
 * Formato do plano: veja CANAL_DARK_AGENTE.md
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { adicionarAoBanco, lerBanco, marcarUso, RAIZ } from './banco-cenas.mjs';
import { videoDoPexels } from './pexels.mjs';
import { printDoSite } from './print.mjs';
import { aplicarReceita, registrar, sortearReceita } from './receita.mjs';
import { resumoReferencias } from './referencias.mjs';
import { pareceIngles } from './idioma.mjs';
import { lerConfig } from './nucleo.mjs';

function frases(palavras) {
  const out = [];
  let atual = [];
  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i];
    atual.push(w);
    const prox = palavras[i + 1];
    const fim = /[.!?]$/.test(w.text) || !prox || prox.start - w.end > 0.6 || atual.length >= 22;
    if (fim) {
      out.push({ start: atual[0].start, end: w.end, texto: atual.map((x) => x.text).join(' ') });
      atual = [];
    }
  }
  return out;
}

/* efeitos de meme: "faahhhhh", "bruh-sound-effect"… (public/midia/sfx-meme/catalogo.json) */
const ARQ_SFX = path.join(RAIZ, 'public', 'midia', 'sfx-meme', 'catalogo.json');
const CATALOGO_SFX = existsSync(ARQ_SFX) ? JSON.parse(await readFile(ARQ_SFX, 'utf8')) : {};

/**
 * "sfx" de uma cena: "faahhhhh" ou { "nome": "faahhhhh", "em": 1.2, "volume": 0.8, "pausa": 1 }.
 * "em" é quando toca (segundos depois do início da cena); "pausa" cala a música por
 * esse tempo — a piada respira e o efeito aparece sozinho.
 */
function efeitoDeMeme(id, start, sfx, avisos) {
  const cfgSfx = typeof sfx === 'string' ? { nome: sfx } : sfx;
  const item = CATALOGO_SFX[cfgSfx.nome];
  if (!item) {
    avisos.push(`efeito "${cfgSfx.nome}" não está no catálogo — pulei`);
    return null;
  }
  const t = cfgSfx.t !== undefined ? +(+cfgSfx.t).toFixed(2) : +(start + (cfgSfx.em ?? 0)).toFixed(2);
  return {
    som: { id, src: item.src, nome: cfgSfx.nome, tipo: 'efeito', start: t, duracao: Math.min(item.duracao, cfgSfx.max ?? 4), volume: cfgSfx.volume ?? 0.75, fadeIn: 0, fadeOut: 0.2, repetir: false },
    pausa: cfgSfx.pausa ? { start: Math.max(0, +(t - 0.08).toFixed(2)), duracao: cfgSfx.pausa, volume: 0.04 } : null,
  };
}

function somDeEntrada(id, start, tipo) {
  const whoosh = tipo !== 'numero' && tipo !== 'icones';
  return {
    id,
    src: whoosh ? 'midia/sfx_whoosh.mp3' : 'midia/sfx_pop.mp3',
    nome: whoosh ? 'whoosh' : 'pop',
    tipo: 'efeito',
    start: Math.max(0, +(start - (whoosh ? 0.12 : 0)).toFixed(2)),
    duracao: whoosh ? 1.2 : 0.8,
    volume: whoosh ? 0.35 : 0.3,
    fadeIn: 0,
    fadeOut: 0.25,
    repetir: false,
  };
}

function tamanhoDaImagem(cfg, midia) {
  const ffprobe = cfg.ffmpeg.replace(/ffmpeg(.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'));
  const saida = execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(RAIZ, 'public', midia)]);
  return saida.toString().trim().split(',').map(Number);
}

/**
 * "respiros": [{ "depoisDe": 26.2, "duracao": 1.5, "sfx": "faahhhhh" }]
 * Silêncio de verdade na narração depois da piada (sem voz e sem música), para a
 * pessoa entender e rir; o efeito toca sozinho nesse vão. Os tempos do plano são
 * os da transcrição original: tudo que vem depois de cada respiro anda junto.
 * Gera um vídeo base novo (fundo escuro + narração com os vãos).
 */
async function inserirRespiros(cfg, projeto, respiros, avisos) {
  // "depoisDe": "pizza." = logo depois dessa palavra (o fim dela na transcrição), sem cortar a fala
  const norm = (w) => String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  for (const r of respiros) {
    if (typeof r.depoisDe !== 'string') continue;
    const w = (projeto.palavras ?? []).find((x) => norm(x.text) === norm(r.depoisDe));
    if (!w) avisos.push(`respiro: não achei a palavra "${r.depoisDe}"`);
    r.depoisDe = w ? +(w.end + 0.05).toFixed(2) : Infinity;
  }
  const lista = respiros.filter((r) => Number.isFinite(r.depoisDe)).sort((a, b) => a.depoisDe - b.depoisDe);
  const mapear = (t) => t + lista.filter((r) => t >= r.depoisDe).reduce((acc, r) => acc + r.duracao, 0);
  const partes = [];
  const fontes = [];
  let cursor = 0;
  lista.forEach((r, k) => {
    fontes.push(`[0:a]atrim=start=${cursor}:end=${r.depoisDe},asetpts=PTS-STARTPTS[p${k}]`);
    fontes.push(`aevalsrc=0|0:d=${r.duracao}:s=48000:c=stereo[s${k}]`);
    partes.push(`[p${k}]`, `[s${k}]`);
    cursor = r.depoisDe;
  });
  fontes.push(`[0:a]atrim=start=${cursor},asetpts=PTS-STARTPTS[fim]`);
  partes.push('[fim]');
  const n = partes.length;
  const largura = projeto.largura ?? 1080;
  const altura = projeto.altura ?? 1920;
  const duracao = +(projeto.duracao + lista.reduce((a, r) => a + r.duracao, 0)).toFixed(2);
  const saida = path.join(RAIZ, 'render', '.fontes', 'dark', `${path.basename(projeto.video, '.mp4').slice(0, 50)}-respiros-${Date.now()}.mp4`);
  // pré-formata cada pedaço igual (48 kHz estéreo) para o concat aceitar
  const filtro = [
    ...fontes.map((x) => (x.startsWith('[0:a]') ? x.replace(/\[(\w+)\]$/, ',aformat=sample_rates=48000:channel_layouts=stereo[$1]') : x)),
    `${partes.join('')}concat=n=${n}:v=0:a=1[aout]`,
  ].join(';');
  execFileSync(cfg.ffmpeg, [
    '-v', 'error', '-y', '-i', projeto.video,
    '-f', 'lavfi', '-i', `color=c=#080b12:s=${largura}x${altura}:r=${projeto.fps ?? 30}:d=${duracao}`,
    '-filter_complex', filtro, '-map', '1:v:0', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '192k', '-t', String(duracao), '-movflags', '+faststart', saida,
  ]);
  projeto.video = saida;
  projeto.nome = path.basename(saida);
  projeto.duracao = duracao;
  projeto.palavras = (projeto.palavras ?? []).map((w) => ({ ...w, start: +mapear(w.start).toFixed(3), end: +mapear(w.start).toFixed(3) + (w.end - w.start) }));
  // a frase depois do respiro começa bloco novo: a legenda não mostra o que vem antes da hora
  for (const r of lista) {
    const prox = projeto.palavras.find((w) => w.start >= mapear(r.depoisDe) - 0.01);
    if (prox) prox.quebra = 'aqui';
  }
  // onde começa cada vão, já no tempo novo
  const vaos = lista.map((r, k) => ({ ...r, inicio: +(r.depoisDe + lista.slice(0, k).reduce((a, x) => a + x.duracao, 0)).toFixed(2) }));
  return { mapear, vaos };
}

async function aplicar(arqProjeto, arqPlano, arqSaida) {
  const projeto = JSON.parse(await readFile(arqProjeto, 'utf8'));
  const plano = JSON.parse(await readFile(arqPlano, 'utf8'));
  const banco = await lerBanco();
  const tema = plano.tema ?? 'geral';
  const avisos = [];
  const cfg = await lerConfig();
  // "referencias": pasta de public/midia/referencias (o produzir já grava isto no projeto)
  if (plano.referencias) {
    const arqRef = path.join(RAIZ, 'public', 'midia', 'referencias', plano.referencias, 'referencias.json');
    if (existsSync(arqRef)) projeto.referencias = JSON.parse(await readFile(arqRef, 'utf8'));
  }
  const ref = projeto.referencias;
  // reaplicar o plano mantém a receita que o vídeo já tinha (não sorteia de novo)
  const saidaPrevista = arqSaida ?? arqProjeto.replace(/.json$/, ' (plano).json');
  const receitaAnterior = existsSync(saidaPrevista) ? JSON.parse(await readFile(saidaPrevista, 'utf8')).receita : undefined;
  const receita = projeto.receita ?? receitaAnterior ?? (await sortearReceita());
  let vaos = [];
  if (plano.respiros?.length) {
    const r = await inserirRespiros(cfg, projeto, plano.respiros, avisos);
    vaos = r.vaos;
    for (const c of plano.cenas ?? []) {
      const ini = +c.start;
      const fimOrig = c.fim !== undefined ? +c.fim : ini + +(c.duracao ?? 4);
      // efeito dentro da cena: o instante absoluto anda com o resto
      const remapearSfx = (x) => (typeof x === 'string' || x.em === undefined ? x : { ...x, em: +(r.mapear(ini + x.em) - r.mapear(ini)).toFixed(2) });
      if (c.sfx) c.sfx = Array.isArray(c.sfx) ? c.sfx.map(remapearSfx) : remapearSfx(c.sfx);
      c.start = +r.mapear(ini).toFixed(2);
      // a cena que termina no respiro (ou o atravessa) fica na tela durante o vão
      c.fim = +(fimOrig + (plano.respiros ?? []).filter((x) => fimOrig >= x.depoisDe).reduce((a, x) => a + x.duracao, 0)).toFixed(2);
      delete c.duracao;
    }
    for (const p of plano.pausas ?? []) p.em = +r.mapear(p.em).toFixed(2);
  }

  let cenas = projeto.cenasRemotion ?? [];
  let fotos = projeto.fotos ?? [];
  let sons = projeto.sons ?? [];
  if (plano.substituir !== false) {
    // tira o que veio do gerador automático e de planos anteriores
    cenas = [];
    fotos = fotos.filter((f) => !String(f.id).startsWith('pl-') && !/midia\/(cenas|auto)\//.test(String(f.src)));
    sons = sons.filter((s) => s.tipo === 'musica' && !String(s.id).startsWith('pl-'));
  }

  const usados = [];
  const pausasMusica = [];
  const pexelsUsados = new Set();
  for (const [i, c] of (plano.cenas ?? []).entries()) {
    const start = +c.start;
    const fim = c.fim !== undefined ? +c.fim : start + +(c.duracao ?? 4);
    const duracao = +(fim - start).toFixed(2);
    let de = c.de;
    let corpo = c;

    if (de === 'banco') {
      const b = banco.cenas.find((x) => x.id === c.id);
      if (!b) {
        avisos.push(`cena ${i}: id ${c.id} não está no banco — pulei`);
        continue;
      }
      usados.push(b.id);
      de = b.de;
      corpo = { ...(b.cena ?? {}), midia: b.midia, ...(c.sobrescrever ?? {}) };
    }

    if (de === 'pexels') {
      const formato = projeto.largura > projeto.altura ? '16:9' : projeto.largura === projeto.altura ? '1:1' : '9:16';
      const achado = await videoDoPexels(c.busca, { formato, duracaoMin: Math.min(duracao, 8), evitar: pexelsUsados, id: c.pexelsId }).catch((e) => {
        avisos.push(`cena ${i}: Pexels falhou (${e.message})`);
        return null;
      });
      if (!achado) {
        avisos.push(`cena ${i}: nada no Pexels para "${c.busca}" — pulei`);
        continue;
      }
      de = 'video';
      corpo = { ...c, midia: achado.midia };
      const novo = await adicionarAoBanco({
        tema,
        de: 'video',
        tags: [...(c.banco?.tags ?? []), ...String(c.busca).toLowerCase().split(/\s+/)],
        descricao: c.banco?.descricao ?? `Pexels: ${c.busca}`,
        padrao: c.banco?.padrao,
        midia: achado.midia,
        prompt: `pexels ${achado.id} · ${achado.autor ?? ''}`,
      });
      usados.push(novo.id);
    }

    // "print": tela real do site (ChatGPT, Gemini, N8N...) flutuando sobre o vídeo
    if (de === 'print') {
      const nome = c.nome ?? new URL(c.url).hostname.replace(/^www\./, '').split('.')[0];
      const midia = await printDoSite(c.url, nome, { recorte: c.recorte }).catch((e) => {
        avisos.push(`cena ${i}: print de ${c.url} falhou (${e.message})`);
        return null;
      });
      if (!midia) continue;
      fotos.push({ id: `pl-${i}`, src: midia, start, duracao, entrada: 'pop', largura: c.largura ?? 78, x: 50, y: c.y ?? 40,
        saidaRapida: true, trajeto: [{ t: duracao, escala: 1.06 }] });
      if (c.fundo) {
        const formato = projeto.largura > projeto.altura ? '16:9' : projeto.largura === projeto.altura ? '1:1' : '9:16';
        const f = c.fundo.id
          ? { midia: banco.cenas.find((x) => x.id === c.fundo.id)?.midia }
          : await videoDoPexels(c.fundo.busca, { formato, duracaoMin: Math.min(duracao, 8), evitar: pexelsUsados, id: c.fundo.pexelsId }).catch(() => null);
        if (f?.midia) fotos.push({ id: `pl-f${i}`, src: f.midia, start, duracao, entrada: 'fade', largura: 101, x: 50, y: 50, camada: 'fundo', cobrir: true, saidaRapida: true });
      }
      if (c.banco) {
        const novo = await adicionarAoBanco({ tema, de: 'imagem', tags: c.banco.tags, descricao: c.banco.descricao ?? `Print: ${c.url}`, padrao: c.banco.padrao, midia, prompt: `print ${c.url}` });
        usados.push(novo.id);
      }
      corpo = { ...c, tipo: 'print' };
    }

    if (de === 'remotion') {
      const { de: _d, start: _s, fim: _f, duracao: _du, banco: _b, id: _i, sobrescrever: _o, fundo, referencia: pastaRefCena, comLegenda, ...campos } = corpo;
      const semLegenda = corpo.semLegenda ?? (plano.legendaModo === 'youtube' ? !comLegenda : undefined);
      const cena = { id: `pl-${i}`, start, duracao, itens: [], titulo: '', ...campos, ...(semLegenda !== undefined ? { semLegenda } : {}), tema };
      let refCena = ref;
      if (pastaRefCena) {
        const arqRefCena = path.join(RAIZ, 'public', 'midia', 'referencias', pastaRefCena, 'referencias.json');
        if (existsSync(arqRefCena)) refCena = JSON.parse(await readFile(arqRefCena, 'utf8'));
      }
      // manchete sem dados: vem da notícia (site, ícone, data, título e capa)
      if (cena.tipo === 'manchete' && refCena) {
        cena.fonte ??= refCena.fonte;
        cena.logo ??= refCena.logoFonte ?? undefined;
        cena.data ??= refCena.data;
        if (!cena.titulo) cena.titulo = refCena.titulo;
        if (cena.imagem === undefined && refCena.capa) cena.imagem = refCena.capa.midia;
        if (cena.imagem === false) delete cena.imagem;
      }
      // nada em inglês na tela: o público não lê
      for (const t of [cena.titulo, cena.subtitulo, ...(cena.destaques ?? []), ...(cena.itens ?? [])]) {
        if (pareceIngles(t)) avisos.push(`cena ${i}: TEXTO EM INGLÊS na tela — traduza: "${String(t).slice(0, 80)}"`);
      }
      if (cena.imagem && !cena.tamanho) {
        if (!existsSync(path.join(RAIZ, 'public', cena.imagem))) {
          avisos.push(`cena ${i}: imagem ${cena.imagem} não existe em public/ — pulei`);
          continue;
        }
        cena.tamanho = tamanhoDaImagem(cfg, cena.imagem);
      }
      cenas.push(cena);
      // "fundo": vídeo que continua passando atrás da cena (busca no Pexels, id do banco ou mídia)
      // com "fundoAnimado" no plano, só entra o fundo marcado com "manter": o resto é o fundo animado
      if (fundo && (!plano.fundoAnimado || fundo.manter)) {
        let midiaFundo = fundo.midia;
        if (fundo.id) midiaFundo = banco.cenas.find((x) => x.id === fundo.id)?.midia;
        if (!midiaFundo && fundo.busca) {
          const formato = projeto.largura > projeto.altura ? '16:9' : projeto.largura === projeto.altura ? '1:1' : '9:16';
          const achado = await videoDoPexels(fundo.busca, { formato, duracaoMin: Math.min(duracao, 8), evitar: pexelsUsados }).catch(() => null);
          if (achado) {
            midiaFundo = achado.midia;
            const novo = await adicionarAoBanco({ tema, de: 'video', tags: String(fundo.busca).toLowerCase().split(/\s+/), descricao: `Pexels: ${fundo.busca}`, midia: achado.midia });
            usados.push(novo.id);
          }
        }
        if (midiaFundo) {
          fotos.push({ id: `pl-f${i}`, src: midiaFundo, start, duracao, entrada: 'fade', largura: 101, x: 50, y: 50, camada: 'fundo', cobrir: true, saidaRapida: true });
        } else avisos.push(`cena ${i}: não achei o fundo`);
      }
    } else if (de === 'imagem' || de === 'video') {
      const midia = corpo.midia;
      if (!midia || !existsSync(path.join(RAIZ, 'public', midia))) {
        avisos.push(`cena ${i}: mídia ${midia} não existe em public/ — pulei`);
        continue;
      }
      const zoomSai = corpo.zoom === 'sai';
      const semLegenda = corpo.semLegenda ?? (plano.legendaModo === 'youtube' ? !corpo.comLegenda : undefined);
      fotos.push({
        id: `pl-${i}`,
        src: midia,
        start,
        duracao,
        entrada: c.entrada ?? receita.entrada ?? 'fade',
        largura: corpo.largura ?? 101,
        cobrir: corpo.largura === undefined,
        x: corpo.x ?? 50,
        y: corpo.y ?? 50,
        saidaRapida: true,
        ...(semLegenda !== undefined ? { semLegenda } : {}),
        // imagem parada vira "animada" com uma aproximação lenta (ou afastamento)
        trajeto:
          de === 'imagem' && corpo.zoom !== false
            ? zoomSai
              ? [{ t: 0.001, escala: 1.15 }, { t: duracao, escala: 1 }]
              : [{ t: duracao, escala: 1.15 }]
            : undefined,
      });
    } else if (de !== 'print') {
      avisos.push(`cena ${i}: tipo de origem "${de}" desconhecido — pulei`);
      continue;
    }

    // efeito de meme no lugar do whoosh/pop padrão (se tocar logo na entrada; se for no meio/fim, mantém o som de entrada)
    const listaSfx = c.sfx ? (Array.isArray(c.sfx) ? c.sfx : [c.sfx]) : [];
    for (const [k, sfx] of listaSfx.entries()) {
      const e = efeitoDeMeme(`pl-m${i}-${k}`, start, sfx, avisos);
      if (!e) continue;
      sons.push(e.som);
      if (e.pausa) pausasMusica.push(e.pausa);
    }
    const temSfxNaEntrada = listaSfx.some((s) => typeof s === 'string' || (s.t !== undefined ? s.t - start < 0.5 : (s.em ?? 0) < 0.5));
    if (!temSfxNaEntrada && plano.sons !== false && c.som !== false) sons.push(somDeEntrada(`pl-s${i}`, start, corpo.tipo));

    if (c.banco && c.de !== 'banco' && c.de !== 'pexels' && c.de !== 'print') {
      const novo = await adicionarAoBanco({
        tema,
        de,
        tags: c.banco.tags,
        descricao: c.banco.descricao ?? corpo.titulo ?? '',
        padrao: c.banco.padrao,
        prompt: c.prompt,
        midia: de === 'remotion' ? undefined : corpo.midia,
        cena: de === 'remotion' ? cenas[cenas.length - 1] : undefined,
      });
      usados.push(novo.id);
    }
  }
  if (usados.length) await marcarUso(usados);
  for (const [k, v] of vaos.entries()) {
    if (v.sfx) {
      const e = efeitoDeMeme(`pl-r${k}`, v.inicio, typeof v.sfx === 'string' ? { nome: v.sfx } : v.sfx, avisos);
      if (e) sons.push(e.som);
    }
    // vão sem música nenhuma (um respiro de 0,15 s a mais para a música voltar macia)
    pausasMusica.push({ start: Math.max(0, +(v.inicio - 0.05).toFixed(2)), duracao: +(v.duracao + 0.15).toFixed(2), volume: 0 });
  }
  if (plano.fundoAnimado) {
    // "fundoAnimado": true (manchas) ou o nome do desenho: synthwave, listras, bokeh, pontos, codigo
    const estiloFundo = typeof plano.fundoAnimado === 'string' ? plano.fundoAnimado : 'manchas';
    receita.fundo = estiloFundo;
    cenas.unshift({ id: 'pl-fundo', tipo: 'fundo', estilo: estiloFundo, start: 0, duracao: projeto.duracao, titulo: '', itens: [], destaque: receita.cores?.[0], subtitulo: receita.cores?.[1] ?? '#0ea5e9', tema });
  }

  projeto.cenasRemotion = cenas.sort((a, b) => (a.tipo === 'fundo' ? -1 : b.tipo === 'fundo' ? 1 : a.start - b.start));
  projeto.fotos = fotos.sort((a, b) => a.start - b.start);
  projeto.sons = sons.sort((a, b) => a.start - b.start);
  // o plano pode fixar legenda e posição; o resto vem da receita sorteada
  if (plano.template) receita.template = plano.template;
  if (plano.legendaY) receita.legendaY = plano.legendaY;
  // "musica": { "src": "midia/musicas/x.mp3", "volume": 0.07 } ou "musicas": [{ "src", "start", "fim", "volume" }]
  if (plano.musica === false) receita.musica = null;
  else if (plano.musica?.src) receita.musica = plano.musica.src;
  else if (Array.isArray(plano.musicas) && plano.musicas[0]?.src) receita.musica = plano.musicas[0].src;
  aplicarReceita(projeto, receita);
  if (plano.musica === false) {
    projeto.sons = projeto.sons.filter((x) => x.tipo !== 'musica');
  } else if (Array.isArray(plano.musicas) && plano.musicas.length > 0) {
    projeto.sons = projeto.sons.filter((x) => x.tipo !== 'musica');
    for (const [idxM, mCfg] of plano.musicas.entries()) {
      const iniM = +(mCfg.start ?? 0);
      const fimM = mCfg.fim !== undefined ? +mCfg.fim : projeto.duracao;
      projeto.sons.push({
        id: `pl-mus-${idxM}`,
        src: mCfg.src,
        nome: path.basename(mCfg.src),
        tipo: 'musica',
        start: iniM,
        duracao: Math.max(1, +(fimM - iniM).toFixed(2)),
        volume: mCfg.volume ?? 0.07,
        fadeIn: mCfg.fadeIn ?? 1.5,
        fadeOut: mCfg.fadeOut ?? 2.0,
        repetir: true,
      });
    }
  }
  for (const m of projeto.sons.filter((x) => x.tipo === 'musica')) {
    m.volume = m.volume ? Math.min(m.volume, plano.musica?.volume ?? 0.07) : (plano.musica?.volume ?? 0.07);
    // "pausas": [{ "em": 6.4, "duracao": 0.8 }] + as pausas dos efeitos: a música cala e volta
    m.quedas = [...pausasMusica, ...(plano.pausas ?? []).map((p) => ({ start: p.em, duracao: p.duracao ?? 0.8, volume: p.volume ?? 0.04 }))];
  }
  // "corrigir": { "pergonto.": "perguntas." } troca palavras erradas da transcrição
  // "corrigirIndice": { "7": "a", "78": null } troca (ou apaga, com null) a palavra pela posição
  if (plano.corrigirIndice && projeto.palavras) {
    const idx = Object.keys(plano.corrigirIndice).map(Number).sort((x, y) => y - x);
    for (const i of idx) {
      const v = plano.corrigirIndice[i];
      if (v === null) projeto.palavras.splice(i, 1);
      else if (projeto.palavras[i]) projeto.palavras[i].text = v;
    }
  }
  if (plano.corrigir) {
    for (const w of projeto.palavras ?? []) if (plano.corrigir[w.text] !== undefined) w.text = plano.corrigir[w.text];
  }

  const saida = arqSaida ?? arqProjeto.replace(/\.json$/, ' (plano).json');
  projeto.arquivo = path.basename(saida);
  projeto.nomeProjeto = path.basename(saida, '.json');
  projeto.planoAplicado = path.basename(arqPlano);
  await writeFile(saida, JSON.stringify(projeto, null, 2), 'utf8');
  avisos.push(...(await registrar(projeto, path.basename(arqProjeto))));
  // registra que este projeto de origem já foi montado (o comando "pendentes" usa isto)
  const arqFeitos = path.join(RAIZ, 'banco-cenas', 'feitos.json');
  const feitos = existsSync(arqFeitos) ? JSON.parse(await readFile(arqFeitos, 'utf8')) : {};
  feitos[path.basename(arqProjeto)] = { saida: path.basename(saida), plano: path.basename(arqPlano), quando: new Date().toISOString() };
  await writeFile(arqFeitos, JSON.stringify(feitos, null, 2), 'utf8');
  console.log(`receita: ${receita.template} · legenda ${receita.legendaY} · ${path.basename(receita.musica)} · zoom ${receita.movimento} ${receita.forcaZoom} · ${receita.paleta} · entrada ${receita.entrada}`);
  console.log(`✓ ${projeto.cenasRemotion.length} cena(s) Remotion, ${projeto.fotos.length} imagem(ns), ${projeto.sons.length} som(ns) → ${saida}`);
  for (const a of avisos) console.log('  aviso:', a);
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'transcricao') {
  const p = JSON.parse(await readFile(a, 'utf8'));
  console.log(`duração ${p.duracao}s · ${p.largura}x${p.altura}`);
  for (const f of frases(p.palavras ?? [])) console.log(`${f.start.toFixed(2)}–${f.end.toFixed(2)}  ${f.texto}`);
  if (p.referencias) console.log(`
${resumoReferencias(p.referencias)}`);
  if (p.receita) console.log(`
receita: abrir com "${p.receita.abertura}" · paleta ${p.receita.paleta} (${p.receita.cores.join(', ')})`);
} else if (cmd === 'aplicar') {
  await aplicar(a, b, c);
} else {
  console.log('uso: node agente/aplicar-plano.mjs transcricao <projeto.json> | aplicar <projeto.json> <plano.json> [saida.json]');
}
