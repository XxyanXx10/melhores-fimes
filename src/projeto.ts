import type { CaptionStyle, Movimento, Word } from './types';

export type Projeto = {
  versao: 1;
  video?: string;
  nome?: string;
  duracao: number;
  template: string;
  estilo: Partial<CaptionStyle>;
  /** movimento de câmera: modo e intensidade */
  movimento?: Movimento;
  forcaZoom?: number;
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
    return { text: w.text, start: w.start, end: w.end };
  });
  return {
    versao: 1,
    video: p.video,
    nome: p.nome,
    duracao: p.duracao || palavras[palavras.length - 1].end,
    template: p.template ?? 'port1-autoridade',
    estilo: p.estilo ?? {},
    movimento: p.movimento ?? 'off',
    forcaZoom: typeof p.forcaZoom === 'number' ? p.forcaZoom : 1,
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
