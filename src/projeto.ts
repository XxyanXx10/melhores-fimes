import type { CaptionStyle, Divisao, Foto, Movimento, TipoTransicao, Word } from './types';

export type Projeto = {
  versao: 1;
  video?: string;
  nome?: string;
  duracao: number;
  /** do vídeo de origem, preenchido pelo ffprobe na transcrição */
  fps?: number;
  largura?: number;
  altura?: number;
  template: string;
  estilo: Partial<CaptionStyle>;
  /** movimento de câmera: modo e intensidade */
  movimento?: Movimento;
  forcaZoom?: number;
  /** fotos e b-roll por cima do vídeo */
  fotos?: Foto[];
  /** telas divididas (layout de reação) */
  divisoes?: Divisao[];
  /** instantes dos cortes que o vídeo já tem, achados pelo FFmpeg */
  cortes?: number[];
  transicao?: TipoTransicao;
  forcaTransicao?: number;
  palavras: Word[];
};

export function validar(dado: unknown): Projeto {
  const p = dado as Partial<Projeto>;
  if (!p || !Array.isArray(p.palavras) || !p.palavras.length) {
    throw new Error('Arquivo de projeto sem palavras — não parece um projeto da plataforma.');
  }
  const palavras = p.palavras.map((w) => {
    if (typeof w?.text !== 'string' || typeof w?.start !== 'number' || typeof w?.end !== 'number') {
      throw new Error('Cada palavra precisa ter text, start e end.');
    }
    // emphasis é opcional, mas não pode ser perdido ao salvar e reabrir
    const emphasis = w.emphasis === 1 || w.emphasis === 2 ? w.emphasis : undefined;
    return { text: w.text, start: w.start, end: w.end, emphasis };
  });
  return {
    versao: 1,
    video: p.video,
    nome: p.nome,
    duracao: p.duracao || palavras[palavras.length - 1].end,
    fps: p.fps && p.fps > 0 ? p.fps : 30,
    largura: p.largura && p.largura > 0 ? p.largura : 1080,
    altura: p.altura && p.altura > 0 ? p.altura : 1920,
    template: p.template ?? 'port1-autoridade',
    estilo: p.estilo ?? {},
    movimento: p.movimento ?? 'off',
    forcaZoom: typeof p.forcaZoom === 'number' ? p.forcaZoom : 1,
    fotos: Array.isArray(p.fotos) ? p.fotos : [],
    divisoes: Array.isArray(p.divisoes) ? p.divisoes : [],
    cortes: Array.isArray(p.cortes) ? p.cortes : [],
    transicao: p.transicao ?? 'off',
    forcaTransicao: typeof p.forcaTransicao === 'number' ? p.forcaTransicao : 1,
    palavras,
  };
}

export async function lerArquivo(f: File): Promise<Projeto> {
  return validar(JSON.parse(await f.text()));
}

export function baixar(projeto: Projeto, nome: string) {
  const blob = new Blob([JSON.stringify(projeto, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
