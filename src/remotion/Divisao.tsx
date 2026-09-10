import { Img, OffthreadVideo, staticFile, interpolate, useVideoConfig } from 'remotion';
import type { Divisao as DivisaoSpec } from '../types';

/** vídeo ou imagem? decidido pela extensão, que é o que temos */
export function ehVideo(src: string): boolean {
  return /\.(mp4|webm|mov|m4v|mkv)$/i.test(src);
}

/** blob:/http: passam direto; o resto vem de public/ */
export function resolverFonte(src: string): string {
  return /^(blob:|https?:|data:)/.test(src) ? src : staticFile(src);
}

/**
 * Quanto do tamanho final a divisão já tem.
 * No 'fade' ela nasce do tamanho cheio e só aparece; nos outros, ela
 * cresce a partir da borda — que é o que dá a sensação de deslizar.
 */
export function fatorTamanho(d: DivisaoSpec, progresso: number): number {
  return d.entrada === 'fade' ? (progresso > 0 ? 1 : 0) : progresso;
}

/**
 * A região que a mídia extra ocupa, em % do quadro, já considerando
 * o quanto a divisão já entrou (`p`, de 0 a 1).
 */
export function regiaoExtra(d: DivisaoSpec, p: number): React.CSSProperties {
  const tamanho = d.proporcao * p;
  switch (d.lado) {
    case 'cima':
      return { left: 0, right: 0, top: 0, height: `${tamanho}%` };
    case 'baixo':
      return { left: 0, right: 0, top: `${100 - tamanho}%`, height: `${tamanho}%` };
    case 'esquerda':
      return { top: 0, bottom: 0, left: 0, width: `${tamanho}%` };
    default:
      return { top: 0, bottom: 0, left: `${100 - tamanho}%`, width: `${tamanho}%` };
  }
}

/**
 * A região que sobra para o vídeo principal — o complemento exato da
 * de cima. Os dois somam o quadro inteiro, sem faixa preta no meio.
 *
 * Em números (% do quadro), não em CSS pronto: quem precisa só desenhar a
 * caixa usa `regiaoPrincipal`; quem precisa fazer conta em cima dela (a
 * legenda, para não cair em cima da mídia extra) usa esta.
 */
export function regiaoPrincipalCaixa(
  d: DivisaoSpec | undefined,
  p: number,
): { top: number; left: number; width: number; height: number } {
  if (!d) return { top: 0, left: 0, width: 100, height: 100 };
  const tamanho = d.proporcao * p;
  switch (d.lado) {
    case 'cima':
      return { top: tamanho, left: 0, width: 100, height: 100 - tamanho };
    case 'baixo':
      return { top: 0, left: 0, width: 100, height: 100 - tamanho };
    case 'esquerda':
      return { top: 0, left: tamanho, width: 100 - tamanho, height: 100 };
    default:
      return { top: 0, left: 0, width: 100 - tamanho, height: 100 };
  }
}

export function regiaoPrincipal(d: DivisaoSpec | undefined, p: number): React.CSSProperties {
  const { top, left, width, height } = regiaoPrincipalCaixa(d, p);
  return { top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` };
}

/**
 * Quanto a divisão já entrou, de 0 a 1: abre no começo e fecha no fim.
 * No 'corte' não há transição — ela simplesmente está lá.
 */
export function progressoDivisao(d: DivisaoSpec, t: number, fps: number): number {
  if (d.entrada === 'corte') return 1;
  const abre = 0.35;
  const fecha = 0.3;
  const fim = d.start + d.duracao;
  const entrando = interpolate(t, [d.start, d.start + abre], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const saindo = interpolate(t, [fim - fecha, fim], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // fps entra só para manter a assinatura estável se um dia virar spring
  void fps;
  return Math.min(entrando, saindo);
}

export function Divisao({ divisao, progresso }: { divisao: DivisaoSpec; progresso: number }) {
  const fonte = resolverFonte(divisao.src);
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#000',
        opacity: divisao.entrada === 'fade' ? progresso : 1,
        ...regiaoExtra(divisao, fatorTamanho(divisao, progresso)),
      }}
    >
      {ehVideo(divisao.src) ? (
        <OffthreadVideo
          src={fonte}
          muted={divisao.mudo}
          trimBefore={Math.max(0, Math.round(divisao.recorte * fps))}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Img src={fonte} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  );
}
