import type { Block, CaptionStyle } from '../types';

type Props = {
  bloco: Block | undefined;
  ativa: number;
  style: CaptionStyle;
  /** largura da prévia em px, para converter tamanhos relativos */
  largura: number;
};

export function CaptionOverlay({ bloco, ativa, style, largura }: Props) {
  if (!bloco || !bloco.words.length) return null;

  const fontePx = (style.fontSize / 100) * largura;
  const base: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: `${fontePx}px`,
    letterSpacing: `${style.letterSpacing}px`,
    color: style.color,
    textTransform: style.uppercase ? 'uppercase' : 'none',
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
          const oculta = style.animation === 'typewriter' && ativa >= 0 && i > ativa;
          return (
            <span
              key={`${bloco.id}-${i}`}
              className={`word ${destacada ? 'is-hl' : ''} ${oculta ? 'is-hidden' : ''}`}
              style={destacada ? { color: style.highlightColor } : undefined}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
