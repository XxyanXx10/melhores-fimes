import { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type {
  Block,
  CaptionStyle,
  Divisao,
  Foto,
  Movimento,
  Scene,
  TipoTransicao,
  Word,
} from '../types';
import { Composicao } from '../remotion/Composicao';
import { CaptionOverlay } from './CaptionOverlay';

type Props = {
  src: string | null;
  bloco: Block | undefined;
  ativa: number;
  revelada: number;
  style: CaptionStyle;
  tempo: number;
  cena: Scene | undefined;
  playerRef: React.RefObject<PlayerRef | null>;
  mudo: boolean;
  volume: number;
  guias: boolean;
  onGuias: (v: boolean) => void;
  transcrevendo: boolean;
  progresso: number;
  /** escala e ponto de foco da câmera — só o fundo de exemplo usa */
  camera: { escala: number; origem: string };
  /* o que a composição precisa saber */
  palavras: Word[];
  movimento: Movimento;
  forcaZoom: number;
  fotos: Foto[];
  divisoes: Divisao[];
  cortes: number[];
  transicao: TipoTransicao;
  forcaTransicao: number;
  fps: number;
  largura: number;
  altura: number;
  duracao: number;
  templateId: string;
  override: Partial<CaptionStyle>;
};

export function Preview(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [larguraPx, setLarguraPx] = useState(360);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLarguraPx(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frames = Math.max(1, Math.round(p.duracao * p.fps));

  /*
   * Objeto novo a cada render faria o Player refazer a composição toda vez
   * que qualquer coisa da interface mudasse — inclusive o relógio. Só muda
   * quando algo que a composição realmente usa mudar.
   */
  const propsDaComposicao = useMemo(
    () => ({
      videoSrc: p.src,
      palavras: p.palavras,
      template: p.templateId,
      estiloOverride: p.override,
      movimento: p.movimento,
      forcaZoom: p.forcaZoom,
      fotos: p.fotos,
      divisoes: p.divisoes,
      cortes: p.cortes,
      transicao: p.transicao,
      forcaTransicao: p.forcaTransicao,
    }),
    [p.src, p.palavras, p.templateId, p.override, p.movimento, p.forcaZoom, p.fotos, p.divisoes, p.cortes, p.transicao, p.forcaTransicao],
  );
  const estiloDoPlayer = useMemo(() => ({ width: '100%', height: '100%' }), []);

  return (
    <main className="palco">
      <div className="palco-topo">
        <span className="badge">
          {p.largura} × {p.altura} · {p.fps}fps
        </span>
        <label className="toggle">
          <input type="checkbox" checked={p.guias} onChange={(e) => p.onGuias(e.target.checked)} />
          Margens de segurança
        </label>
      </div>

      <div className="quadro" ref={ref}>
        {p.transcrevendo && (
          <div className="quadro-carregando" role="status" aria-live="polite">
            <span className="girando" aria-hidden="true" />
            <strong>Gerando a legenda…</strong>
            <div className="progresso-trilho">
              <div className="progresso-barra" style={{ width: `${p.progresso * 100}%` }} />
            </div>
            <em>{Math.round(p.progresso * 100)}%</em>
          </div>
        )}

        {p.src ? (
          /* A MESMA composição que o Renderer usa para gerar o MP4. */
          <Player
            ref={p.playerRef}
            component={Composicao}
            inputProps={propsDaComposicao}
            durationInFrames={frames}
            fps={p.fps}
            compositionWidth={p.largura}
            compositionHeight={p.altura}
            style={estiloDoPlayer}
            controls={false}
            showVolumeControls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            initiallyMuted={p.mudo}
          />
        ) : (
          <div
            className="fundo fundo-exemplo"
            style={{
              ['--t' as string]: p.tempo,
              transform: `scale(${p.camera.escala})`,
              transformOrigin: p.camera.origem,
            }}
          >
            <div className="orb orb-a" />
            <div className="orb orb-b" />
            <span className="fundo-nome">{p.cena?.label ?? 'Vídeo de exemplo'}</span>
          </div>
        )}

        {p.guias && (
          <div className="guias" style={{ inset: `12% ${p.style.safeMargin}%` }} aria-hidden />
        )}

        {/* Sem vídeo não há Player, então o fundo de exemplo ainda usa o
            overlay antigo. Com vídeo, a legenda vem de dentro da composição. */}
        {!p.src && (
          <CaptionOverlay
            bloco={p.bloco}
            ativa={p.ativa}
            revelada={p.revelada}
            style={p.style}
            largura={larguraPx}
          />
        )}
      </div>
    </main>
  );
}
