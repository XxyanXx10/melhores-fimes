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
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { adicionarAoBanco, lerBanco, marcarUso, RAIZ } from './banco-cenas.mjs';
import { videoDoPexels } from './pexels.mjs';
import { printDoSite } from './print.mjs';

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

async function aplicar(arqProjeto, arqPlano, arqSaida) {
  const projeto = JSON.parse(await readFile(arqProjeto, 'utf8'));
  const plano = JSON.parse(await readFile(arqPlano, 'utf8'));
  const banco = await lerBanco();
  const tema = plano.tema ?? 'geral';

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
  const pexelsUsados = new Set();
  const avisos = [];
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
      const { de: _d, start: _s, fim: _f, duracao: _du, banco: _b, id: _i, sobrescrever: _o, fundo, ...campos } = corpo;
      cenas.push({ id: `pl-${i}`, start, duracao, itens: [], titulo: '', ...campos, tema });
      // "fundo": vídeo que continua passando atrás da cena (busca no Pexels, id do banco ou mídia)
      if (fundo) {
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
      fotos.push({
        id: `pl-${i}`,
        src: midia,
        start,
        duracao,
        entrada: 'fade',
        largura: corpo.largura ?? 101,
        cobrir: corpo.largura === undefined,
        x: corpo.x ?? 50,
        y: corpo.y ?? 50,
        saidaRapida: true,
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

    if (plano.sons !== false && c.som !== false) sons.push(somDeEntrada(`pl-s${i}`, start, corpo.tipo));

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

  projeto.cenasRemotion = cenas.sort((a, b) => a.start - b.start);
  projeto.fotos = fotos.sort((a, b) => a.start - b.start);
  projeto.sons = sons.sort((a, b) => a.start - b.start);
  if (plano.template) projeto.template = plano.template;
  // a legenda vai para a parte de baixo: o meio da tela fica para as cenas
  projeto.estilo = { ...(projeto.estilo ?? {}), positionY: plano.legendaY ?? 74 };
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
  // registra que este projeto de origem já foi montado (o comando "pendentes" usa isto)
  const arqFeitos = path.join(RAIZ, 'banco-cenas', 'feitos.json');
  const feitos = existsSync(arqFeitos) ? JSON.parse(await readFile(arqFeitos, 'utf8')) : {};
  feitos[path.basename(arqProjeto)] = { saida: path.basename(saida), plano: path.basename(arqPlano), quando: new Date().toISOString() };
  await writeFile(arqFeitos, JSON.stringify(feitos, null, 2), 'utf8');
  console.log(`✓ ${projeto.cenasRemotion.length} cena(s) Remotion, ${projeto.fotos.length} imagem(ns), ${projeto.sons.length} som(ns) → ${saida}`);
  for (const a of avisos) console.log('  aviso:', a);
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'transcricao') {
  const p = JSON.parse(await readFile(a, 'utf8'));
  console.log(`duração ${p.duracao}s · ${p.largura}x${p.altura}`);
  for (const f of frases(p.palavras ?? [])) console.log(`${f.start.toFixed(2)}–${f.end.toFixed(2)}  ${f.texto}`);
} else if (cmd === 'aplicar') {
  await aplicar(a, b, c);
} else {
  console.log('uso: node agente/aplicar-plano.mjs transcricao <projeto.json> | aplicar <projeto.json> <plano.json> [saida.json]');
}
