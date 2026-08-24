import type { Word } from './types';

export const SERVIDOR = 'http://localhost:5175';

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

export async function transcreverArquivo(arquivo: File): Promise<Word[]> {
  const r = await fetch(`${SERVIDOR}/transcrever?nome=${encodeURIComponent(arquivo.name)}`, {
    method: 'POST',
    body: arquivo,
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.erro ?? 'Falha ao transcrever.');
  return corpo.words as Word[];
}
