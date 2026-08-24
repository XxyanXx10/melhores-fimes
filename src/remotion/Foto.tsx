import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Foto as FotoSpec } from '../types';

/**
 * Uma foto entrando por cima do vídeo.
 *
 * O frame é relativo à Sequence que envolve este componente, então
 * `useCurrentFrame()` começa em 0 quando a foto entra — é isso que faz
 * a mesma animação valer no Player e no render, sem contas de offset.
 */
export function Foto({ foto }: { foto: FotoSpec }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrada = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const saida = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const escala =
    foto.entrada === 'escala' ? interpolate(entrada, [0, 1], [0.82, 1]) : 1;
  const desloca =
    foto.entrada === 'sobe' ? interpolate(entrada, [0, 1], [8, 0]) : 0;
  const opacidade = (foto.entrada === 'fade' ? entrada : Math.min(1, entrada * 1.6)) * saida;

  return (
    <AbsoluteFill>
      <Img
        src={/^(blob:|https?:|data:)/.test(foto.src) ? foto.src : staticFile(foto.src)}
        style={{
          position: 'absolute',
          left: `${foto.x}%`,
          top: `${foto.y}%`,
          width: `${foto.largura}%`,
          transform: `translate(-50%, -50%) translateY(${desloca}%) scale(${escala})`,
          opacity: opacidade,
          borderRadius: '2%',
          boxShadow: '0 2% 6% rgba(0,0,0,.45)',
          objectFit: 'cover',
        }}
      />
    </AbsoluteFill>
  );
}
