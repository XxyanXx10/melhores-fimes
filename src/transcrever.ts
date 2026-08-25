import type { Word } from './types';

/**
 * Servido pelo próprio serviço local (npm start) -> mesma origem.
 * Em desenvolvimento (vite, porta 5173) ou fora do navegador -> porta do serviço.
 */
const emDesenvolvimento =
  typeof location === 'undefined' || location.protocol === 'file:' || location.port === '5173';

export const SERVIDOR = emDesenvolvimento ? 'http://localhost:5175' : '';

export type StatusServidor = {
  ok: boolean;
  modelo: string;
  modeloEncontrado: boolean;
  whisperEncontrado: boolean;
  idioma: string;
};

export async function verificarServidor(): Promise<StatusServidor | null> {
  try {
    const r = await fetch(`${SERVIDOR}/status`);
    return r.ok ? ((await r.json()) as StatusServidor) : null;
  } catch {
    return null;
  }
}

export type Transcricao = { words: Word[]; fps: number; largura: number; altura: number };

export async function transcreverArquivo(arquivo: File): Promise<Transcricao> {
  const r = await fetch(`${SERVIDOR}/transcrever?nome=${encodeURIComponent(arquivo.name)}`, {
    method: 'POST',
    body: arquivo,
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Falha ao transcrever.');
  return {
    words: corpo.words as Word[],
    fps: Number(corpo.fps) || 30,
    largura: Number(corpo.largura) || 1080,
    altura: Number(corpo.altura) || 1920,
  };
}

/** envia uma imagem ou vídeo para public/midia e devolve o caminho que a composição usa */
export async function enviarMidia(arquivo: File): Promise<string> {
  const r = await fetch(`${SERVIDOR}/midia?nome=${encodeURIComponent(arquivo.name)}`, {
    method: 'POST',
    body: arquivo,
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui guardar esse arquivo.');
  return corpo.src as string;
}

/** pede ao serviço local os instantes em que o vídeo já foi cortado */
export async function detectarCortes(arquivo: File): Promise<number[]> {
  const r = await fetch(`${SERVIDOR}/cortes?nome=${encodeURIComponent(arquivo.name)}`, {
    method: 'POST',
    body: arquivo,
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui procurar os cortes.');
  return (corpo.cortes ?? []) as number[];
}

export type ProjetoNoDisco = {
  arquivo: string;
  nome: string;
  duracao: number;
  palavras: number;
  temVideo: boolean;
};

/** os projetos que já existem na pasta projeto/ da máquina */
export async function listarProjetos(): Promise<ProjetoNoDisco[]> {
  try {
    const r = await fetch(`${SERVIDOR}/projetos`);
    if (!r.ok) return [];
    return ((await r.json()).projetos ?? []) as ProjetoNoDisco[];
  } catch {
    return [];
  }
}

/**
 * Abre um projeto do disco: o JSON e o vídeo.
 *
 * O navegador não abre arquivo por caminho, mas o serviço local abre e
 * entrega por http — então dá para carregar tudo com um clique, sem
 * arrastar nada.
 */
export async function abrirDoDisco(arquivo: string): Promise<{ projeto: unknown; videoUrl: string }> {
  const r = await fetch(`${SERVIDOR}/projetos/${encodeURIComponent(arquivo)}`);
  if (!r.ok) throw new Error('Não consegui abrir esse projeto.');
  return {
    projeto: await r.json(),
    videoUrl: `${SERVIDOR}/video-do-projeto/${encodeURIComponent(arquivo)}`,
  };
}
