import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Foto as FotoSpec } from '../types';

/** valor de uma propriedade do trajeto no instante `tt` (segundos desde a entrada) */
function noTrajeto(
  trajeto: NonNullable<FotoSpec['trajeto']>,
  campo: 'x' | 'y' | 'escala' | 'opacidade',
  inicial: number,
  tt: number,
): number {
  const pontos = trajeto.filter((p) => p[campo] !== undefined).sort((a, b) => a.t - b.t);
  if (!pontos.length) return inicial;
  const ts = [0, ...pontos.map((p) => p.t)];
  const vs = [inicial, ...pontos.map((p) => p[campo] as number)];
  // dois pontos no mesmo instante dão degrau; o interpolate exige ordem estrita
  const ts2 = ts.map((t, i) => (i > 0 && t <= ts[i - 1] ? ts[i - 1] + 0.001 : t));
  for (let i = 1; i < ts2.length; i++) if (ts2[i] <= ts2[i - 1]) ts2[i] = ts2[i - 1] + 0.001;
  return interpolate(tt, ts2, vs, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
}

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
  const tt = frame / fps;

  const pop = foto.entrada === 'pop';
  const entrada = spring({
    frame,
    fps,
    config: pop ? { damping: 11, mass: 0.55, stiffness: 160 } : { damping: 200, mass: 0.6 },
  });
  const duracaoSaida = foto.saidaRapida ? 0.12 : 0.4;
  const saida = interpolate(frame, [durationInFrames - fps * duracaoSaida, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const escalaEntrada =
    foto.entrada === 'escala'
      ? interpolate(entrada, [0, 1], [0.82, 1])
      : pop
        ? interpolate(entrada, [0, 1], [0.55, 1])
        : 1;
  const desloca = foto.entrada === 'sobe' ? interpolate(entrada, [0, 1], [8, 0]) : 0;
  const opacidadeEntrada = foto.entrada === 'fade' ? entrada : Math.min(1, entrada * 1.6);

  const tr = foto.trajeto;
  const x = tr ? noTrajeto(tr, 'x', foto.x, tt) : foto.x;
  const y = tr ? noTrajeto(tr, 'y', foto.y, tt) : foto.y;
  const escalaTrajeto = tr ? noTrajeto(tr, 'escala', 1, tt) : 1;
  const opacidadeTrajeto = tr ? noTrajeto(tr, 'opacidade', 1, tt) : 1;
  const opacidade = opacidadeEntrada * saida * opacidadeTrajeto;

  const endereco = /^(blob:|https?:|data:)/.test(foto.src) ? foto.src : staticFile(foto.src);
  // clipe gerado por IA ou b-roll: toca no lugar da foto, sem som (a narração segue)
  const ehVideo = /\.(mp4|mov|webm)$/i.test(foto.src);
  // vídeo/imagem que cobre a tela toda: preenche cortando as sobras, sem faixas pretas
  if (foto.cobrir) {
    const cheio = {
      position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover',
      opacity: opacidade, transform: `scale(${escalaEntrada * escalaTrajeto})`,
    } as const;
    return (
      <AbsoluteFill>
        {ehVideo ? <OffthreadVideo src={endereco} muted style={cheio} /> : <Img src={endereco} style={cheio} />}
      </AbsoluteFill>
    );
  }
  const estilo = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    width: `${foto.largura}%`,
    transform: `translate(-50%, -50%) translateY(${desloca}%) scale(${escalaEntrada * escalaTrajeto})`,
    opacity: opacidade,
    borderRadius: '2%',
    boxShadow: '0 2% 6% rgba(0,0,0,.45)',
    objectFit: 'cover',
    // 'varre': a imagem é revelada da esquerda para a direita (efeito marca-texto)
    clipPath: foto.entrada === 'varre' ? `inset(0 ${(1 - Math.min(1, frame / (fps * 0.7))) * 100}% 0 0)` : undefined,
  } as const;

  return (
    <AbsoluteFill>
      {ehVideo ? (
        <OffthreadVideo src={endereco} muted style={estilo} />
      ) : (
        <Img src={endereco} style={estilo} />
      )}
    </AbsoluteFill>
  );
}
