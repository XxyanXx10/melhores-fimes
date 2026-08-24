import type { Block, CaptionStyle } from '../types';
import { enfaseAuto } from '../enfase';

type Props = {
  bloco: Block | undefined;
  ativa: number;
  /** última palavra já iniciada, para a entrada palavra a palavra */
  revelada: number;
  style: CaptionStyle;
  /** largura da prévia em px, para converter tamanhos relativos */
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
      };
    case 'underline':
      return {
        color: style.highlightColor,
        boxShadow: `inset 0 -${fontePx * 0.14}px 0 ${style.highlightBg}`,
      };
    case 'gradient':
      // preenche a própria palavra com o gradiente (o "prisma")
      return {
        backgroundImage: `linear-gradient(100deg, ${style.highlightColor}, ${style.highlightColor2})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      };
    case 'scale':
      return { color: style.highlightColor, transform: `scale(1.14)` };
    default:
      return { color: style.highlightColor };
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

export function CaptionOverlay({ bloco, ativa, revelada, style, largura }: Props) {
  if (!bloco || !bloco.words.length) return null;

  const fontePx = (style.fontSize / 100) * largura;
  // manual vence o automático, palavra por palavra
  const slots = bloco.words.map((w, i) => w.emphasis ?? enfaseAuto(bloco, i, style.autoEnfase));
  const base: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: `${fontePx}px`,
    letterSpacing: `${style.letterSpacing}px`,
    color: style.color,
    textTransform: style.uppercase ? 'uppercase' : 'none',
    fontStyle: style.italic ? 'italic' : 'normal',
    lineHeight: 1.1,
    padding: style.backdrop === 'box' ? `${fontePx * 0.28}px ${fontePx * 0.42}px` : undefined,
    background: style.backdrop === 'box' ? style.backdropColor : undefined,
    borderRadius: style.backdrop === 'box' ? `${fontePx * 0.2}px` : undefined,
    textShadow:
      style.backdrop === 'shadow'
        ? `0 ${fontePx * 0.06}px ${fontePx * 0.18}px ${style.backdropColor}`
        : undefined,
    WebkitTextStroke:
      style.backdrop === 'stroke' ? `${Math.max(1, fontePx * 0.045)}px ${style.backdropColor}` : undefined,
    paintOrder: 'stroke fill',
  };

  return (
    <div
      className="caption-layer"
      style={{
        top: `${style.positionY}%`,
        left: `${style.safeMargin}%`,
        right: `${style.safeMargin}%`,
      }}
    >
      <div className={`caption anim-${style.animation}`} key={bloco.id} style={base}>
        {bloco.words.map((w, i) => {
          const destacada = style.highlightWords && i === ativa;
          const oculta = style.animation === 'typewriter' && i > revelada;
          return (
            <span
              key={`${bloco.id}-${i}`}
              className={`word hl-${style.highlightStyle} ${destacada ? 'is-hl' : ''} ${
                oculta ? 'is-hidden' : ''
              }`}
              // a marcação manual manda: uma palavra marcada nunca muda de cor no karaokê
              style={
                slots[i] ? enfase(slots[i], style) : destacada ? destaque(style, fontePx) : undefined
              }
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
