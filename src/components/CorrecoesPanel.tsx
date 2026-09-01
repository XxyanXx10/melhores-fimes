import { useState } from 'react';
import type { Correcao } from '../transcrever';

type Props = {
  correcoes: Correcao[];
  onSalvar: (lista: Correcao[]) => void;
  onAplicarAgora: () => void;
  temLegenda: boolean;
  aplicando: boolean;
};

/**
 * As correções que se repetem em todo vídeo.
 *
 * O Whisper erra sempre nas mesmas palavras — sigla, nome de cliente, jargão.
 * Aqui elas viram regra: passam sozinhas no fim de cada transcrição.
 */
export function CorrecoesPanel(p: Props) {
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState('');
  const [para, setPara] = useState('');

  function adicionar() {
    const novo = { de: de.trim(), para: para.trim() };
    if (!novo.de || !novo.para) return;
    const semRepetida = p.correcoes.filter((c) => c.de.toLowerCase() !== novo.de.toLowerCase());
    p.onSalvar([...semRepetida, novo]);
    setDe('');
    setPara('');
  }

  return (
    <section className="bloco">
      <h2>
        <button type="button" className="dobra" onClick={() => setAberto((v) => !v)}>
          {aberto ? '▾' : '▸'} Correções que se repetem
          {p.correcoes.length > 0 && <b>{p.correcoes.length}</b>}
        </button>
      </h2>

      {aberto && (
        <>
          <p className="dica">
            O que o Whisper erra em todo vídeo — sigla, nome de cliente, jargão. Vale também para
            expressão de mais de uma palavra: “porto um” vira “Port1”.
          </p>

          {p.correcoes.length > 0 && (
            <ul className="correcoes">
              {p.correcoes.map((c) => (
                <li key={c.de}>
                  <span className="de">{c.de}</span>
                  <span className="seta">→</span>
                  <span className="para">{c.para}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${c.de}`}
                    title="Remover"
                    onClick={() => p.onSalvar(p.correcoes.filter((x) => x.de !== c.de))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="correcao-nova">
            <input
              value={de}
              placeholder="o que ele escreve"
              onChange={(e) => setDe(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            />
            <span className="seta">→</span>
            <input
              value={para}
              placeholder="o certo"
              onChange={(e) => setPara(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            />
            <button type="button" className="chip" disabled={!de.trim() || !para.trim()} onClick={adicionar}>
              Adicionar
            </button>
          </div>

          {p.correcoes.length > 0 && (
            <button
              type="button"
              className="ghost"
              disabled={!p.temLegenda || p.aplicando}
              onClick={p.onAplicarAgora}
            >
              {p.aplicando ? 'Aplicando…' : 'Aplicar nesta legenda agora'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
