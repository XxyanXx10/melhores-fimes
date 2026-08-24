import type { Scene, Word } from '../types';

/**
 * Transcrição de exemplo (Etapa 1: sem WhisperX ainda).
 * Os tempos são gerados a partir da duração média de cada palavra,
 * para que a prévia já tenha sincronia palavra a palavra.
 */
const frases = [
  'A maioria das pessoas erra no começo do vídeo',
  'os três primeiros segundos decidem tudo',
  'se você não prender agora ninguém fica',
  'então comece pelo problema não pela apresentação',
  'e deixe a promessa clara na primeira frase',
];

export const DURACAO_EXEMPLO = 18;

function gerar(): Word[] {
  const palavras = frases.flatMap((f, i) =>
    f.split(' ').map((text) => ({ text, frase: i })),
  );
  const total = palavras.length;
  const passo = DURACAO_EXEMPLO / total;
  return palavras.map((p, i) => ({
    text: p.text,
    start: +(i * passo).toFixed(2),
    end: +((i + 1) * passo - 0.02).toFixed(2),
  }));
}

export const mockWords: Word[] = gerar();

export const mockScenes: Scene[] = [
  { id: 'c1', label: 'Gancho', start: 0, end: 5 },
  { id: 'c2', label: 'Problema', start: 5, end: 11 },
  { id: 'c3', label: 'Solução', start: 11, end: 18 },
];
