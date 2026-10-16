import type { CenaRemotion, TipoCenaRemotion, Word } from './types';

/**
 * Agrupa as palavras transcritas em frases/cenas naturais de 5 a 8 segundos
 * respeitando pontuação final (`.`, `?`, `!`) ou pausas na fala.
 */
function segmentarEmFrases(palavras: Word[], duracaoTotal: number) {
  if (!palavras.length) return [];

  const trechos: Array<{ start: number; end: number; duracao: number; texto: string; palavras: Word[] }> = [];
  let atual: Word[] = [];

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
        palavras: atual,
      });
      atual = [];
    }
  }

  return trechos;
}

/**
 * Quebra uma frase em 2 ou 3 tópicos curtos (por vírgulas ou conjunções "e", "ou", "como")
 * para alimentar os cards animados do Remotion.
 */
function extrairItensDaFrase(texto: string, prefixo = ''): string[] {
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

  // Fallback: divide a frase em até 3 blocos equilibrados de palavras
  const ws = limpo.split(/\s+/).filter(Boolean);
  if (ws.length <= 6) {
    const cap = limpo.charAt(0).toUpperCase() + limpo.slice(1);
    return [prefixo ? `${prefixo} ${cap}` : cap];
  }
  const terco = Math.ceil(ws.length / 3);
  const res: string[] = [];
  for (let i = 0; i < ws.length; i += terco) {
    const pedaco = ws.slice(i, i + terco).join(' ');
    const cap = pedaco.charAt(0).toUpperCase() + pedaco.slice(1);
    res.push(prefixo ? `${prefixo} ${cap}` : cap);
  }
  return res.slice(0, 3);
}

/**
 * Lê a transcrição do vídeo e gera Cenas Nativas do Remotion (`CenaRemotion[]`)
 * baseadas no contexto do roteiro (ChatGPT conversando, O que a IA sabe/não sabe,
 * Checklist de passos, Privacidade/Segurança, Código ou Comparativo).
 */
export function gerarCenasRemotionDoRoteiro(
  palavras: Word[],
  duracaoTotal: number,
  modoForcado?: TipoCenaRemotion,
): CenaRemotion[] {
  const segmentos = segmentarEmFrases(palavras, duracaoTotal);
  if (!segmentos.length) return [];

  return segmentos.map((seg, idx) => {
    const txt = seg.texto;
    const lower = txt.toLowerCase();

    let tipo: TipoCenaRemotion = modoForcado ?? 'chatgpt';

    if (!modoForcado) {
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
      } else {
        tipo = 'chatgpt';
      }
    }

    // 1. Cena estilo ChatGPT conversando ao vivo
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

      const pils = extrairItensDaFrase(txt).slice(0, 3);
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'chatgpt',
        start: seg.start,
        duracao: seg.duracao,
        titulo: /gemini|google/i.test(lower) ? 'Gemini AI · Chat' : 'ChatGPT 4o',
        promptUsuario,
        respostaIa: txt,
        itens: pils.map((p) => (p.length > 34 ? `${p.slice(0, 34)}…` : p)),
        destaque: '#10a37f',
      };
    }

    // 2. Cena Contexto da IA (❌ O que ela não sabe sozinha)
    if (tipo === 'contexto-ia') {
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'contexto-ia',
        start: seg.start,
        duracao: seg.duracao,
        titulo: 'O Que a IA Não Sabe Sozinha',
        subtitulo: 'Sem você explicar na conversa:',
        itens: extrairItensDaFrase(txt, '❌'),
        destaque: '#ef4444',
      };
    }

    // 3. Cena Checklist (✅ Passo a passo prático)
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
        itens: extrairItensDaFrase(txt),
        destaque: '#10b981',
      };
    }

    // 4. Cena Privacidade & Segurança
    if (tipo === 'privacidade') {
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'privacidade',
        start: seg.start,
        duracao: seg.duracao,
        titulo: 'Privacidade e Dados Pessoais',
        subtitulo: 'Use inteligência artificial com segurança:',
        itens: extrairItensDaFrase(txt),
        destaque: '#38bdf8',
      };
    }

    // 5. Cena Código / Análise Técnica
    if (tipo === 'codigo') {
      return {
        id: `cr_${Date.now()}_${idx}`,
        tipo: 'codigo',
        start: seg.start,
        duracao: seg.duracao,
        titulo: 'agente_ia_analise.ts',
        itens: extrairItensDaFrase(txt),
        destaque: '#58a6ff',
      };
    }

    // 6. Cena Versus / Comparativo
    return {
      id: `cr_${Date.now()}_${idx}`,
      tipo: 'versus',
      start: seg.start,
      duracao: seg.duracao,
      titulo: 'Análise e Desempenho da IA',
      itens: extrairItensDaFrase(txt),
      destaque: '#a855f7',
    };
  });
}
