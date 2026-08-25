import type { Block, Divisao, Foto, Scene, Zoom } from '../types';
import { formatarTempo } from '../blocks';

type Props = {
  duracao: number;
  tempo: number;
  tocando: boolean;
  blocos: Block[];
  cenas: Scene[];
  zooms: Zoom[];
  fotos: Foto[];
  divisoes: Divisao[];
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
        {p.zooms.length > 0 && (
          <div className="trilha trilha-zoom">
            {p.zooms.map((z) => (
              <span
                key={z.id}
                className={p.tempo >= z.start && p.tempo <= z.end ? 'is-active' : ''}
                style={{ left: pct(z.start), width: pct(Math.max(0.15, z.end - z.start)) }}
                title={`Zoom ${z.de.toFixed(2)}x → ${z.para.toFixed(2)}x`}
              />
            ))}
          </div>
        )}
        {p.fotos.length > 0 && (
          <div className="trilha trilha-fotos">
            {p.fotos.map((f) => (
              <span
                key={f.id}
                className={p.tempo >= f.start && p.tempo <= f.start + f.duracao ? 'is-active' : ''}
                style={{ left: pct(f.start), width: pct(Math.max(0.15, f.duracao)) }}
                title="Foto"
              />
            ))}
          </div>
        )}
        {p.divisoes.length > 0 && (
          <div className="trilha trilha-divisoes">
            {p.divisoes.map((d) => (
              <span
                key={d.id}
                className={p.tempo >= d.start && p.tempo <= d.start + d.duracao ? 'is-active' : ''}
                style={{ left: pct(d.start), width: pct(Math.max(0.15, d.duracao)) }}
                title="Tela dividida"
              />
            ))}
          </div>
        )}
        <div className="cursor" style={{ left: pct(p.tempo) }} />
      </div>
    </footer>
  );
}
