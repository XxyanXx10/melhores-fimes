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
  /** nome do arquivo de vídeo, quando o projeto tem um */
  arquivoVideo: string | null;
  duracao: number;
  palavras: number;
  temVideo: boolean;
  /** quando o arquivo foi gravado pela última vez (ms) */
  atualizado: number;
  /** já existe MP4 exportado com esse nome */
  exportado: boolean;
  template: string | null;
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

/** grava o projeto na pasta da máquina e devolve o nome do arquivo gravado */
export async function gravarProjeto(
  projeto: unknown,
  arquivo: string,
  /** guarda uma versão do estado atual mesmo que a última seja recente */
  versionar = false,
): Promise<string> {
  const r = await fetch(`${SERVIDOR}/projetos${versionar ? '?versionar=1' : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ arquivo, projeto }),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui salvar o projeto.');
  return corpo.arquivo as string;
}

export type Correcao = { de: string; para: string };

/** a lista de correções que se repetem em todo vídeo */
export async function listarCorrecoes(): Promise<Correcao[]> {
  try {
    const r = await fetch(`${SERVIDOR}/correcoes`);
    if (!r.ok) return [];
    return ((await r.json()).correcoes ?? []) as Correcao[];
  } catch {
    return [];
  }
}

export async function guardarCorrecoes(lista: Correcao[]): Promise<Correcao[]> {
  const r = await fetch(`${SERVIDOR}/correcoes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(lista),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui salvar as correções.');
  return corpo.correcoes as Correcao[];
}

/** passa as correções na legenda que já está na tela */
export async function corrigirAgora(palavras: Word[]): Promise<Word[]> {
  const r = await fetch(`${SERVIDOR}/corrigir`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ palavras }),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Não consegui aplicar as correções.');
  return corpo.palavras as Word[];
}

export type VersaoNoDisco = {
  arquivo: string;
  quando: number;
  palavras: number;
  template: string | null;
  nome: string | null;
};

/** as versões guardadas de um projeto, da mais nova para a mais velha */
export async function listarVersoes(arquivo: string): Promise<VersaoNoDisco[]> {
  try {
    const r = await fetch(`${SERVIDOR}/versoes/${encodeURIComponent(arquivo)}`);
    if (!r.ok) return [];
    return ((await r.json()).versoes ?? []) as VersaoNoDisco[];
  } catch {
    return [];
  }
}

/** o conteúdo de uma versão, para voltar a ela */
export async function abrirVersao(arquivo: string, versao: string): Promise<unknown> {
  const r = await fetch(
    `${SERVIDOR}/versao/${encodeURIComponent(arquivo)}/${encodeURIComponent(versao)}`,
  );
  if (!r.ok) throw new Error('Não consegui abrir essa versão.');
  return r.json();
}

/** copia um projeto com outro nome, para testar uma variação sem perder a primeira */
export async function duplicarProjeto(arquivo: string): Promise<string> {
  const r = await fetch(`${SERVIDOR}/projetos/${encodeURIComponent(arquivo)}`);
  if (!r.ok) throw new Error('Não consegui ler esse projeto.');
  const projeto = (await r.json()) as Record<string, unknown>;
  const nome = `${(projeto.nomeProjeto ?? projeto.nome ?? arquivo) as string} (cópia)`;
  return gravarProjeto({ ...projeto, nomeProjeto: nome, arquivo: undefined }, nome);
}

/** manda o projeto para a lixeira (projeto/.lixeira), não apaga de vez */
export async function apagarProjeto(arquivo: string): Promise<void> {
  const r = await fetch(`${SERVIDOR}/projetos/${encodeURIComponent(arquivo)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Não consegui apagar esse projeto.');
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
  /** quando o render começou (ms) — serve para estimar o que falta */
  inicio?: number;
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

/** interrompe o render em andamento e derruba o Chrome junto */
export async function cancelarRender(): Promise<void> {
  const r = await fetch(`${SERVIDOR}/renderizar`, { method: 'DELETE' });
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}));
    throw new Error(corpo?.erro ?? 'Não consegui cancelar.');
  }
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
