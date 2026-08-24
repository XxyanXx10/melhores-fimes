import type { Block, Scene } from '../types';
import { formatarTempo } from '../blocks';

type Props = {
  blocos: Block[];
  cenas: Scene[];
  tempo: number;
  onEditar: (bloco: Block, texto: string) => void;
  onIr: (t: number) => void;
  transcrito: boolean;
  onTranscrever: () => void;
};

export function CaptionPanel(p: Props) {
  return (
    <aside className="panel panel-right">
      <section className="bloco">
        <h2>2. Legenda</h2>
        {!p.transcrito ? (
          <div className="vazio">
            <p>Nenhuma legenda ainda.</p>
            <button type="button" className="primario" onClick={p.onTranscrever}>
              Gerar legenda automática
            </button>
            <p className="dica">Etapa 1: usa a transcrição de exemplo. O WhisperX entra na Etapa 3.</p>
          </div>
        ) : (
          <ol className="blocos">
            {p.blocos.map((b) => {
              const ativo = p.tempo >= b.start && p.tempo <= b.end;
              return (
                <li key={b.id} className={ativo ? 'is-active' : ''}>
                  <button type="button" className="tempo" onClick={() => p.onIr(b.start)}>
                    {formatarTempo(b.start)}
                  </button>
                  <input
                    value={b.words.map((w) => w.text).join(' ')}
                    onChange={(e) => p.onEditar(b, e.target.value)}
                    onFocus={() => p.onIr(b.start)}
                    aria-label={`Bloco em ${formatarTempo(b.start)}`}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="bloco">
        <h2>Cenas</h2>
        <div className="cenas">
          {p.cenas.map((c) => {
            const ativo = p.tempo >= c.start && p.tempo < c.end;
            return (
              <button
                key={c.id}
                type="button"
                className={`cena ${ativo ? 'is-active' : ''}`}
                onClick={() => p.onIr(c.start)}
              >
                <strong>{c.label}</strong>
                <em>
                  {formatarTempo(c.start)} → {formatarTempo(c.end)}
                </em>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
