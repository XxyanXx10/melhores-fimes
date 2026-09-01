import { useEffect, useState } from 'react';
import { listarVersoes, type VersaoNoDisco } from '../transcrever';

type Props = {
  arquivo: string;
  onVoltarPara: (versao: VersaoNoDisco) => void;
  onFechar: () => void;
};

function quando(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * As versões anteriores do projeto.
 *
 * O salvamento automático é bom até o dia em que você estraga a legenda e ele
 * grava o estrago. Isto é a saída: uma cópia a cada vinte minutos de trabalho.
 */
export function Versoes(p: Props) {
  const [versoes, setVersoes] = useState<VersaoNoDisco[] | null>(null);

  useEffect(() => {
    void listarVersoes(p.arquivo).then(setVersoes);
  }, [p.arquivo]);

  return (
    <div className="modal" role="dialog" aria-modal aria-label="Versões anteriores">
      <div className="modal-caixa">
        <h3>Versões anteriores</h3>
        {versoes === null ? (
          <p>Procurando…</p>
        ) : !versoes.length ? (
          <p>
            Ainda não há versões guardadas deste projeto. Uma cópia é feita a cada vinte minutos de
            trabalho, para você poder voltar de um estrago.
          </p>
        ) : (
          <ul className="versoes">
            {versoes.map((v) => (
              <li key={v.arquivo}>
                <span>
                  <strong>{quando(v.quando)}</strong>
                  <em>
                    {v.palavras} {v.palavras === 1 ? 'palavra' : 'palavras'}
                    {v.template ? ` · ${v.template}` : ''}
                  </em>
                </span>
                <button type="button" className="chip" onClick={() => p.onVoltarPara(v)}>
                  Voltar para esta
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="primario" onClick={p.onFechar}>
          Fechar
        </button>
      </div>
    </div>
  );
}
