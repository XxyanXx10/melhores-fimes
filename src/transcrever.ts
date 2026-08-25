import type { Preset, Word } from './types';

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

export type EstadoRender = {
  rodando: boolean;
  progresso: number;
  saida: string | null;
  erro: string | null;
};

/** manda o serviço local gerar o MP4 do projeto que está aberto */
export async function pedirRender(projeto: unknown): Promise<void> {
  const r = await fetch(`${SERVIDOR}/renderizar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projeto),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui começar o render.');
}

export async function estadoRender(): Promise<EstadoRender | null> {
  try {
    const r = await fetch(`${SERVIDOR}/renderizar`);
    return r.ok ? ((await r.json()) as EstadoRender) : null;
  } catch {
    return null;
  }
}

/** o endereço do MP4 pronto, para abrir ou baixar */
export function enderecoDoRender(nome: string): string {
  return `${SERVIDOR}/render/${encodeURIComponent(nome)}`;
}

export type ItemMidia = { src: string; nome: string; tamanho: number; video: boolean };

/** tudo que já foi enviado para public/midia, inclusive em subpastas */
export async function listarMidia(): Promise<ItemMidia[]> {
  try {
    const r = await fetch(`${SERVIDOR}/midia`);
    if (!r.ok) return [];
    return ((await r.json()).midia ?? []) as ItemMidia[];
  } catch {
    return [];
  }
}

export async function listarPresets(): Promise<Preset[]> {
  try {
    const r = await fetch(`${SERVIDOR}/presets`);
    if (!r.ok) return [];
    return ((await r.json()).presets ?? []) as Preset[];
  } catch {
    return [];
  }
}

export async function salvarPreset(preset: Preset): Promise<Preset> {
  const r = await fetch(`${SERVIDOR}/presets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(preset),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui salvar o estilo.');
  return corpo.preset as Preset;
}

export async function apagarPreset(id: string): Promise<void> {
  await fetch(`${SERVIDOR}/presets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Guarda no disco o vídeo que o usuário arrastou e devolve o caminho.
 * O render precisa de arquivo; o navegador só tem um blob.
 */
export async function enviarVideoFonte(arquivo: File): Promise<string> {
  const r = await fetch(`${SERVIDOR}/video-fonte?nome=${encodeURIComponent(arquivo.name)}`, {
    method: 'POST',
    body: arquivo,
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui guardar o vídeo para o render.');
  return corpo.caminho as string;
}
