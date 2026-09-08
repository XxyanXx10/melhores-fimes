import { useMemo, useState } from 'react';
import type { Word } from '../types';
// a mesma conta que o serviço usa para cortar de verdade: a prévia nunca mente
import { resumoDoCorte } from '../../agente/cortes.mjs';

type Props = {
  palavras: Word[];
  duracao: number;
  /** null = dá para cortar; texto = o que falta, dito ao usuário */
  impedimento: string | null;
  cortando: boolean;
  jaCortado: boolean;
  onCortar: (silencioMinimo: number) => void;
  onDesfazer: () => void;
};

function segundos(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}m${String(r).padStart(2, '0')}s` : `${r}s`;
}

/**
 * Corte automático dos silêncios.
 *
 * A transcrição já sabe onde está a fala; o que sobra entre as palavras é
 * respiração e pausa. A conta roda aqui na tela, então você vê quanto sai
 * antes de mandar cortar.
 */
export function CortesPanel(p: Props) {
  const [silencio, setSilencio] = useState(0.35);

  const previa = useMemo(() => {
    if (!p.palavras.length || !p.duracao) return null;
    return resumoDoCorte(p.palavras, p.duracao, { silencioMinimo: silencio });
  }, [p.palavras, p.duracao, silencio]);

  return (
    <section className="bloco">
      <h2>Cortar silêncios</h2>

      {p.jaCortado ? (
        <>
          <p className="dica">
            Este projeto já está usando o vídeo cortado. Para tentar outro limiar, corte de novo — a
            conta sempre parte do vídeo original.
          </p>
          <button type="button" className="ghost" onClick={p.onDesfazer} disabled={p.cortando}>
            Voltar ao vídeo original
          </button>
        </>
      ) : null}

      <label className="campo">
        <span>Silêncio a partir de</span>
        <input
          type="range"
          min={0.15}
          max={1.5}
          step={0.05}
          value={silencio}
          onChange={(e) => setSilencio(+e.target.value)}
        />
        <output>{silencio.toFixed(2)}s</output>
      </label>

      {previa && (
        <div className={`previa-corte ${previa.cortes ? '' : 'is-vazia'}`}>
          {previa.cortes ? (
            <>
              <strong>
                −{segundos(previa.removido)} de {segundos(previa.duracaoOriginal)}
              </strong>
              <em>
                {previa.cortes} {previa.cortes === 1 ? 'corte' : 'cortes'} · fica com{' '}
                {segundos(previa.duracaoNova)}
              </em>
              <div className="barra-corte" aria-hidden>
                <span style={{ width: `${(previa.duracaoNova / previa.duracaoOriginal) * 100}%` }} />
              </div>
            </>
          ) : (
            <em>Nenhum silêncio maior que {silencio.toFixed(2)}s — nada seria cortado.</em>
          )}
        </div>
      )}

      <button
        type="button"
        className="chip chip-forte"
        disabled={!!p.impedimento || p.cortando || !previa?.cortes}
        onClick={() => p.onCortar(silencio)}
        title="Gera um vídeo novo sem as pausas e ajusta a legenda"
      >
        {p.cortando ? 'Cortando…' : 'Cortar silêncios'}
      </button>

      {/* botão cinza sem explicação é o que mais irrita: aqui o motivo aparece */}
      {p.impedimento && <p className="dica is-alerta">{p.impedimento}</p>}

      <p className="dica">
        Gera um arquivo novo ao lado do original, com a legenda já ajustada. O vídeo original não é
        tocado — e, como o corte encurta o vídeo, a exportação também fica mais rápida.
      </p>
    </section>
  );
}
