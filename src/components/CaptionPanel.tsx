import { useState } from 'react';
import type { Block, Scene } from '../types';
import { formatarTempo, textoDoBloco } from '../blocks';

type Props = {
  blocos: Block[];
  cenas: Scene[];
  tempo: number;
  onEditar: (bloco: Block, texto: string) => void;
  /** troca a ênfase de uma palavra: nenhuma -> 1 -> 2 -> nenhuma */
  onMarcar: (bloco: Block, indice: number) => void;
  onIr: (t: number) => void;
  transcrito: boolean;
  onTranscrever: () => void;
  onImportar: (texto: string) => void;
  /** caracteres que cabem numa linha da prévia, com o estilo atual */
  maxChars: number;
  temVideo: boolean;
  onAuto: () => void;
  servidorOk: boolean;
  transcrevendo: boolean;
  /** 0..1, estimado pelo tempo decorrido */
  progresso: number;
  decorrido: number;
  estimativa: number;
  erro: string | null;
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
      <button
        type="button"
        className="chip chip-forte"
        onClick={p.onAuto}
        disabled={!p.temVideo || !p.servidorOk || p.transcrevendo}
        title={
          !p.temVideo
            ? 'Envie um vídeo primeiro'
            : !p.servidorOk
              ? 'Inicie o serviço local: npm run transcricao'
              : 'Transcrever com o whisper.cpp da sua máquina'
        }
      >
        {p.transcrevendo ? 'Transcrevendo…' : 'Transcrever automaticamente'}
      </button>
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

        {p.transcrevendo && (
          <div className="progresso" role="status" aria-live="polite">
            <div className="progresso-topo">
              <strong>Transcrevendo…</strong>
              <span>{Math.round(p.progresso * 100)}%</span>
            </div>
            <div
              className="progresso-trilho"
              role="progressbar"
              aria-valuenow={Math.round(p.progresso * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progresso-barra" style={{ width: `${p.progresso * 100}%` }} />
            </div>
            <p className="dica">
              {formatarTempo(p.decorrido)} de ~{formatarTempo(p.estimativa)} · whisper.cpp rodando
              na sua máquina, nada sai do computador.
            </p>
          </div>
        )}
        {!p.servidorOk && !p.transcrevendo && (
          <p className="dica">
            Serviço local desligado. Rode <code>npm run transcricao</code> para transcrever
            automaticamente — ou cole o texto abaixo.
          </p>
        )}
        {p.erro && <p className="erro">{p.erro}</p>}

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
          <>
          <p className="dica">
            Clique numa palavra do bloco que está tocando para ela entrar com outra fonte e cor.
            Cada clique passa para a próxima ênfase.
          </p>
          <ol className="blocos">
            {p.blocos.map((b) => {
              const texto = textoDoBloco(b);
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
                  {ativo && (
                    <div className="marcar">
                      {b.words.map((w, i) => (
                        <button
                          key={`${b.id}-m${i}`}
                          type="button"
                          className={`palavra e${w.emphasis ?? 0}`}
                          onClick={() => p.onMarcar(b, i)}
                          title="Clique para trocar a ênfase desta palavra"
                        >
                          {w.text}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          </>
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
