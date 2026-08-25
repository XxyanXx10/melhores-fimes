import { interpolate } from 'remotion';
import type { CaptionStyle, TipoTransicao } from '../types';

/**
 * Transições nos cortes que o vídeo já tem.
 *
 * A narração nunca é interrompida: o áudio do vídeo principal corre inteiro,
 * do começo ao fim. Por isso a transição não é troca de clipe (nada de
 * TransitionSeries) — é uma animação curta POR CIMA, que cobre a virada
 * visual enquanto a voz segue.
 */

/** 0 no repouso, 1 no auge do corte, 0 de novo — em ~`duracao` segundos */
export function pulso(t: number, corte: number, duracao: number): number {
  const meio = duracao / 2;
  if (t < corte - meio || t > corte + meio) return 0;
  return interpolate(Math.abs(t - corte), [0, meio], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** o corte mais próximo de t que ainda está dentro da janela da transição */
export function corteAtivo(cortes: number[], t: number, duracao: number): number | null {
  const meio = duracao / 2;
  for (const c of cortes) if (t >= c - meio && t <= c + meio) return c;
  return null;
}

/**
 * O que a transição faz com o vídeo principal.
 * Whip e zoom mexem na própria imagem; flash e cortina só põem coisa em cima.
 *
 * Devolve um pedaço de transform para ser **somado** ao do zoom — devolver
 * um `transform` inteiro apagaria o movimento de câmera.
 */
export function efeitoNoVideo(
  tipo: TipoTransicao,
  p: number,
  forca: number,
): { transform: string; filter?: string } {
  if (p <= 0) return { transform: '' };
  switch (tipo) {
    case 'whip':
      return {
        transform: `translateX(${p * 14 * forca}%)`,
        filter: `blur(${p * 10 * forca}px)`,
      };
    case 'zoom':
      return {
        transform: `scale(${1 + p * 0.18 * forca})`,
        filter: `blur(${p * 5 * forca}px)`,
      };
    default:
      return { transform: '' };
  }
}

type Props = {
  tipo: TipoTransicao;
  /** 0..1, o quanto a transição está acontecendo agora */
  p: number;
  forca: number;
  estilo: CaptionStyle;
};

/** A camada desenhada por cima do vídeo durante o corte. */
export function Transicao({ tipo, p, forca, estilo }: Props) {
  if (p <= 0) return null;

  if (tipo === 'flash') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffffff',
          opacity: Math.min(1, p * 0.85 * forca),
          pointerEvents: 'none',
        }}
      />
    );
  }

  if (tipo === 'cortina') {
    // um degradê em movimento cobrindo a virada, na cor do modelo
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: p,
          pointerEvents: 'none',
          backgroundImage: `linear-gradient(${115 + p * 40}deg, ${estilo.highlightColor}, ${
            estilo.highlightColor2
          })`,
          transform: `translateX(${(1 - p) * 100 * (p > 0.5 ? -1 : 1)}%)`,
        }}
      />
    );
  }

  // whip e zoom acontecem no próprio vídeo; aqui só um escurecido curto
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#000',
        opacity: p * 0.25,
        pointerEvents: 'none',
      }}
    />
  );
}
