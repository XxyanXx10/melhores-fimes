import { useState } from 'react';
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
  onImportar: (texto: string) => void;
  /** caracteres que cabem numa linha da prévia, com o estilo atual */
  maxChars: number;
  temVideo: boolean;
};

function linhas(texto: string, maxChars: number): number {
  return Math.max(1, Math.ceil(texto.length / maxChars));
}

export function CaptionPanel(p: Props) {
  const [colando, setColando] = useState(false);
  const [rascunho, setRascunho] = useState('');

  function arquivo(f: File) {
    const r = new FileReader();
    r.onload = () => p.onImportar(String(r.result ?? ''));
    r.readAsText(f);
  }

  const fontes = (
    <div className="fontes">
      <button type="button" className="chip" onClick={() => setColando((v) => !v)}>
        Colar transcrição
      </button>
      <label className="chip">
        Arquivo .srt / .vtt / .txt
        <input
          type="file"
          accept=".srt,.vtt,.txt,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) arquivo(f);
            e.target.value = '';
          }}
        />
      </label>
      <button type="button" className="chip" onClick={p.onTranscrever}>
        Usar exemplo
      </button>
    </div>
  );

  return (
    <aside className="panel panel-right">
      <section className="bloco">
        <h2>2. Legenda</h2>

        {fontes}

        {colando && (
          <div className="colar">
            <textarea
              value={rascunho}
              placeholder={
                'Cole o texto da fala (ou um SRT/VTT com tempos).\n' +
                'Sem tempos, as palavras são distribuídas pela duração do vídeo.'
              }
              onChange={(e) => setRascunho(e.target.value)}
              rows={6}
            />
            <button
              type="button"
              className="primario"
              disabled={!rascunho.trim()}
              onClick={() => {
                p.onImportar(rascunho);
                setColando(false);
              }}
            >
              Usar este texto
            </button>
          </div>
        )}

        {!p.transcrito ? (
          <div className="vazio">
            <p>Nenhuma legenda ainda.</p>
            <p className="dica">
              {p.temVideo
                ? 'Cole a fala do seu vídeo para julgar os templates com texto real.'
                : 'Envie um vídeo e cole a fala — ou comece pelo exemplo.'}{' '}
              A transcrição automática (WhisperX) entra na Etapa 3.
            </p>
          </div>
        ) : (
          <ol className="blocos">
            {p.blocos.map((b) => {
              const texto = b.words.map((w) => w.text).join(' ');
              const n = linhas(texto, p.maxChars);
              const ativo = p.tempo >= b.start && p.tempo <= b.end;
              return (
                <li key={b.id} className={`${ativo ? 'is-active' : ''} ${n > 2 ? 'is-longo' : ''}`}>
                  <button type="button" className="tempo" onClick={() => p.onIr(b.start)}>
                    {formatarTempo(b.start)}
                  </button>
                  <input
                    value={texto}
                    onChange={(e) => p.onEditar(b, e.target.value)}
                    onFocus={() => p.onIr(b.start)}
                    aria-label={`Bloco em ${formatarTempo(b.start)}`}
                  />
                  {n > 2 && (
                    <span className="aviso" title="Passa de 2 linhas na prévia">
                      {n} linhas
                    </span>
                  )}
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
