import type { Block, Word } from './types';

/**
 * Corta a legenda em blocos.
 *
 * O tamanho vem do modelo, mas o corte manual manda: uma palavra marcada com
 * 'aqui' começa bloco mesmo no meio, e uma marcada com 'nunca' nunca começa —
 * é assim que "juntar" e "separar" funcionam sem mexer nos tempos.
 */
export function agrupar(words: Word[], porBloco: number): Block[] {
  const blocos: Block[] = [];
  let atual: Word[] = [];
  let inicio = 0;

  const fechar = () => {
    if (!atual.length) return;
    blocos.push({
      id: `b${inicio}`,
      start: atual[0].start,
      end: atual[atual.length - 1].end,
      words: atual,
      highlight: 0,
    });
    atual = [];
  };

  words.forEach((w, i) => {
    const comecaAqui = w.quebra === 'aqui';
    const nuncaComeca = w.quebra === 'nunca';
    if (atual.length && (comecaAqui || (atual.length >= porBloco && !nuncaComeca))) fechar();
    if (!atual.length) inicio = i;
    atual.push(w);
  });
  fechar();

  return blocos;
}

/**
 * Ênfase manual escrita no próprio texto do bloco:
 *   *palavra*   -> ênfase 1     **palavra** -> ênfase 2
 * A pontuação colada fica de fora da marcação (*simples*, mantém a vírgula normal).
 */
export function lerMarcacao(parte: string): { text: string; emphasis?: 1 | 2 } {
  const dois = parte.match(/^(\W*)\*\*(.+?)\*\*(\W*)$/);
  if (dois) return { text: dois[1] + dois[2] + dois[3], emphasis: 2 };
  const um = parte.match(/^(\W*)\*(.+?)\*(\W*)$/);
  if (um) return { text: um[1] + um[2] + um[3], emphasis: 1 };
  return { text: parte };
}

function escreverMarcacao(w: Word): string {
  if (!w.emphasis) return w.text;
  const m = /^(\W*)(.*?)(\W*)$/.exec(w.text);
  const antes = m?.[1] ?? '';
  const meio = m?.[2] || w.text;
  const depois = m?.[3] ?? '';
  const cerca = w.emphasis === 2 ? '**' : '*';
  return `${antes}${cerca}${meio}${cerca}${depois}`;
}

/** o texto editável de um bloco, já com as marcações de ênfase */
export function textoDoBloco(bloco: Block): string {
  return bloco.words.map(escreverMarcacao).join(' ');
}

/** Redistribui os tempos de um novo texto dentro da janela do bloco. */
export function reescrever(bloco: Block, texto: string): Word[] {
  const partes = texto.split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  const passo = (bloco.end - bloco.start) / partes.length;
  return partes.map((parte, i) => {
    const { text, emphasis } = lerMarcacao(parte);
    return {
      text,
      emphasis,
      start: +(bloco.start + i * passo).toFixed(2),
      end: +(bloco.start + (i + 1) * passo - 0.02).toFixed(2),
    };
  });
}

export function blocoAtivo(blocos: Block[], t: number): Block | undefined {
  return blocos.find((b) => t >= b.start && t <= b.end) ?? undefined;
}

export function palavraAtiva(bloco: Block | undefined, t: number): number {
  if (!bloco) return -1;
  const i = bloco.words.findIndex((w) => t >= w.start && t <= w.end);
  return i;
}

/**
 * Índice da última palavra que já começou — o que a entrada "palavra a palavra"
 * usa para revelar. Diferente de palavraAtiva, não volta a -1 nos silêncios,
 * senão o texto pisca entre uma palavra e outra.
 */
export function ultimaIniciada(bloco: Block | undefined, t: number): number {
  if (!bloco) return -1;
  let i = -1;
  for (let k = 0; k < bloco.words.length; k++) if (t >= bloco.words[k].start) i = k;
  return i;
}

export function formatarTempo(t: number): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${r}`;
}

/** o índice, na legenda inteira, em que cada bloco começa */
export function inicioDoBloco(words: Word[], bloco: Block): number {
  return words.indexOf(bloco.words[0]);
}

/** legenda no formato .srt, para subir no YouTube ou reaproveitar */
export function paraSrt(blocos: Block[]): string {
  const carimbo = (t: number) => {
    const ms = Math.max(0, Math.round(t * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
  };
  return blocos
    .map((b, i) => {
      /* a marcação de ênfase é da plataforma; num .srt ela só atrapalha */
      const texto = b.words.map((w) => w.text).join(' ').replace(/\*/g, '');
      return `${i + 1}\n${carimbo(b.start)} --> ${carimbo(b.end)}\n${texto}\n`;
    })
    .join('\n');
}

/** a legenda inteira como texto: um bloco por linha */
export function textoCorrido(blocos: Block[]): string {
  return blocos.map((b) => textoDoBloco(b)).join('\n');
}

/**
 * Devolve as palavras a partir do texto corrido editado.
 *
 * Se o número de linhas não mudou, cada linha volta para a janela do seu
 * bloco — os tempos ficam exatos, como na edição bloco a bloco. Se você
 * juntou ou quebrou linhas, não há mais a quem pertencer: aí o texto é
 * espalhado pelo mesmo intervalo, cada palavra ganhando tempo conforme o
 * tamanho. A sincronia fica aproximada, e a interface avisa antes.
 */
export function deTextoCorrido(blocos: Block[], texto: string): Word[] {
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!linhas.length || !blocos.length) return [];

  if (linhas.length === blocos.length) {
    return blocos.flatMap((b, i) => reescrever(b, linhas[i]));
  }

  const inicio = blocos[0].start;
  const fim = blocos[blocos.length - 1].end;

  /* cada linha vira um bloco: foi assim que você escreveu */
  const porLinha = linhas.map((l) => l.split(/\s+/).filter(Boolean));
  const pesos = porLinha.flat().map((p) => Math.max(2, p.length));
  const total = pesos.reduce((s, n) => s + n, 0);

  const saida: Word[] = [];
  let t = inicio;
  let k = 0;
  porLinha.forEach((linha, iLinha) => {
    linha.forEach((parte, iPalavra) => {
      const fatia = ((fim - inicio) * pesos[k]) / total;
      const { text, emphasis } = lerMarcacao(parte);
      saida.push({
        text,
        emphasis,
        start: +t.toFixed(2),
        end: +(t + fatia - 0.02).toFixed(2),
        /* a primeira palavra abre a linha; as outras nunca abrem, senão o
           tamanho do modelo quebraria a linha que você acabou de montar */
        quebra: iPalavra === 0 ? (iLinha === 0 ? undefined : 'aqui') : 'nunca',
      });
      t += fatia;
      k++;
    });
  });
  return saida;
}
