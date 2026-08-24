import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Block, CaptionStyle } from '../types';
import { enfaseAuto } from '../enfase';

/**
 * A legenda, desenhada dentro da composição.
 *
 * Porte do antigo CaptionOverlay: a lógica de destaque e de ênfase é a
 * mesma, mas as animações de entrada — que eram @keyframes no app.css —
 * agora saem do frame. O Renderer não carrega o app.css, então qualquer
 * coisa que dependesse de classe CSS sairia diferente no MP4.
 *
 * Nada aqui usa className: só estilo inline.
 */
type Props = {
  bloco: Block | undefined;
  ativa: number;
  revelada: number;
  style: CaptionStyle;
  /** largura do quadro em px, para converter os tamanhos relativos */
  largura: number;
};

/** o visual da palavra falada — cor, caixa atrás, sublinhado ou só escala */
function destaque(style: CaptionStyle, fontePx: number): React.CSSProperties {
  switch (style.highlightStyle) {
    case 'box':
      return {
        color: style.highlightColor,
        background: style.highlightBg,
        padding: `${fontePx * 0.06}px ${fontePx * 0.16}px`,
        margin: `0 ${fontePx * 0.02}px`,
        borderRadius: `${fontePx * 0.14}px`,
        WebkitTextStroke: 'none',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
      };
    case 'underline':
      return {
        color: style.highlightColor,
        boxShadow: `inset 0 -${fontePx * 0.14}px 0 ${style.highlightBg}`,
      };
    case 'gradient':
      return {
        backgroundImage: `linear-gradient(100deg, ${style.highlightColor}, ${style.highlightColor2})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      };
    case 'scale':
      return { color: style.highlightColor, transform: 'scale(1.14)' };
    default:
      return { color: style.highlightColor, transform: 'scale(1.06)' };
  }
}

/** palavra enfatizada: fonte e cor próprias */
function enfase(slot: 1 | 2 | undefined, style: CaptionStyle): React.CSSProperties | undefined {
  if (!slot) return undefined;
  const e = style.emphases[slot - 1];
  return {
    color: e.color,
    fontFamily: e.fontFamily,
    fontStyle: e.italic ? 'italic' : 'normal',
    textTransform: e.uppercase ? 'uppercase' : 'none',
  };
}

export function Legenda({ bloco, ativa, revelada, style, largura }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!bloco || !bloco.words.length) return null;

  // quanto tempo faz que este bloco entrou — é daqui que sai a animação
  const framesNoBloco = Math.max(0, frame - Math.round(bloco.start * fps));
  const entrada =
    style.animation === 'none'
      ? 1
      : spring({ frame: framesNoBloco, fps, config: { damping: 200, mass: 0.5 } });

  const opacidade = style.animation === 'fade' || style.animation === 'pop' || style.animation === 'slide-up' ? entrada : 1;
  const escala = style.animation === 'pop' ? interpolate(entrada, [0, 1], [0.82, 1]) : 1;
  const sobe = style.animation === 'slide-up' ? interpolate(entrada, [0, 1], [28, 0]) : 0;

  const fontePx = (style.fontSize / 100) * largura;
  // manual vence o automático, palavra por palavra
  const slots = bloco.words.map((w, i) => w.emphasis ?? enfaseAuto(bloco, i, style.autoEnfase));

  const base: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: `${fontePx}px`,
    letterSpacing: `${style.letterSpacing}px`,
    color: style.color,
    textTransform: style.uppercase ? 'uppercase' : 'none',
    fontStyle: style.italic ? 'italic' : 'normal',
    lineHeight: 1.1,
    opacity: opacidade,
    transform: `translateY(${sobe}%) scale(${escala})`,
    padding: style.backdrop === 'box' ? `${fontePx * 0.28}px ${fontePx * 0.42}px` : undefined,
    background: style.backdrop === 'box' ? style.backdropColor : undefined,
    borderRadius: style.backdrop === 'box' ? `${fontePx * 0.2}px` : undefined,
    textShadow:
      style.backdrop === 'shadow'
        ? `0 ${fontePx * 0.06}px ${fontePx * 0.18}px ${style.backdropColor}`
        : undefined,
    WebkitTextStroke:
      style.backdrop === 'stroke'
        ? `${Math.max(1, fontePx * 0.045)}px ${style.backdropColor}`
        : undefined,
    paintOrder: 'stroke fill',
  };

  return (
    <AbsoluteFill
      style={{
        top: `${style.positionY}%`,
        left: `${style.safeMargin}%`,
        right: `${style.safeMargin}%`,
        bottom: 'auto',
        width: 'auto',
        height: 'auto',
        transform: 'translateY(-50%)',
        display: 'flex',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div style={base}>
        {bloco.words.map((w, i) => {
          const destacada = style.highlightWords && i === ativa;
          const oculta = style.animation === 'typewriter' && i > revelada;
          return (
            <span
              key={`${bloco.id}-${i}`}
              style={{
                display: 'inline-block',
                margin: '0 0.18em',
                opacity: oculta ? 0 : 1,
                ...(slots[i]
                  ? enfase(slots[i], style)
                  : destacada
                    ? destaque(style, fontePx)
                    : undefined),
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
