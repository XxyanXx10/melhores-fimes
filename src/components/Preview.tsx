import { useEffect, useRef, useState } from 'react';
import type { Block, CaptionStyle, Scene } from '../types';
import { CaptionOverlay } from './CaptionOverlay';

type Props = {
  src: string | null;
  bloco: Block | undefined;
  ativa: number;
  style: CaptionStyle;
  tempo: number;
  cena: Scene | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  guias: boolean;
  onGuias: (v: boolean) => void;
};

export function Preview(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(360);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <main className="palco">
      <div className="palco-topo">
        <span className="badge">1080 × 1920 · 9:16</span>
        <label className="toggle">
          <input type="checkbox" checked={p.guias} onChange={(e) => p.onGuias(e.target.checked)} />
          Margens de segurança
        </label>
      </div>

      <div className="quadro" ref={ref}>
        {p.src ? (
          <video ref={p.videoRef} className="fundo" src={p.src} muted playsInline />
        ) : (
          <div className="fundo fundo-exemplo" style={{ ['--t' as string]: p.tempo }}>
            <div className="orb orb-a" />
            <div className="orb orb-b" />
            <span className="fundo-nome">{p.cena?.label ?? 'Vídeo de exemplo'}</span>
          </div>
        )}

        {p.guias && (
          <div
            className="guias"
            style={{ inset: `12% ${p.style.safeMargin}%` }}
            aria-hidden
          />
        )}

        <CaptionOverlay bloco={p.bloco} ativa={p.ativa} style={p.style} largura={largura} />
      </div>
    </main>
  );
}
