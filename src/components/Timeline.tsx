import type { Block, Scene } from '../types';
import { formatarTempo } from '../blocks';

type Props = {
  duracao: number;
  tempo: number;
  tocando: boolean;
  blocos: Block[];
  cenas: Scene[];
  onIr: (t: number) => void;
  onTocar: () => void;
  temVideo: boolean;
  mudo: boolean;
  volume: number;
  onMudo: () => void;
  onVolume: (v: number) => void;
};

export function Timeline(p: Props) {
  const pct = (t: number) => `${(t / p.duracao) * 100}%`;

  function clicar(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    p.onIr(((e.clientX - r.left) / r.width) * p.duracao);
  }

  return (
    <footer className="timeline">
      <button type="button" className="play" onClick={p.onTocar} aria-label={p.tocando ? 'Pausar' : 'Tocar'}>
        {p.tocando ? '❚❚' : '▶'}
      </button>
      <span className="relogio">
        {formatarTempo(p.tempo)} / {formatarTempo(p.duracao)}
      </span>
      <div className="som">
        <button
          type="button"
          className="play play-som"
          onClick={p.onMudo}
          disabled={!p.temVideo}
          title={p.temVideo ? (p.mudo ? 'Ativar som' : 'Silenciar') : 'Envie um vídeo para ouvir o áudio'}
          aria-label={p.mudo ? 'Ativar som' : 'Silenciar'}
        >
          {p.mudo || !p.temVideo ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={p.mudo ? 0 : p.volume}
          disabled={!p.temVideo}
          onChange={(e) => p.onVolume(+e.target.value)}
          aria-label="Volume"
        />
      </div>

      <div className="trilhas" onClick={clicar}>
        <div className="trilha trilha-cenas">
          {p.cenas.map((c) => (
            <span key={c.id} style={{ left: pct(c.start), width: pct(c.end - c.start) }}>
              {c.label}
            </span>
          ))}
        </div>
        <div className="trilha trilha-legenda">
          {p.blocos.map((b) => (
            <span
              key={b.id}
              className={p.tempo >= b.start && p.tempo <= b.end ? 'is-active' : ''}
              style={{ left: pct(b.start), width: pct(Math.max(0.15, b.end - b.start)) }}
            />
          ))}
        </div>
        <div className="cursor" style={{ left: pct(p.tempo) }} />
      </div>
    </footer>
  );
}
