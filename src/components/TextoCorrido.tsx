import { useState } from 'react';
import type { Block } from '../types';
import { textoCorrido } from '../blocks';

type Props = {
  blocos: Block[];
  onAplicar: (texto: string) => void;
  onFechar: () => void;
};

/**
 * A legenda inteira num campo só.
 *
 * Revisar bloco a bloco funciona para acertar uma palavra; para ler o texto
 * e perceber que a frase ficou torta, é preciso ver tudo junto.
 */
export function TextoCorrido(p: Props) {
  const original = textoCorrido(p.blocos);
  const [texto, setTexto] = useState(original);

  const linhas = texto.split('\n').filter((l) => l.trim()).length;
  const mudouEstrutura = linhas !== p.blocos.length;
  const palavras = texto.split(/\s+/).filter(Boolean).length;

  return (
    <div className="modal" role="dialog" aria-modal aria-label="Legenda inteira">
      <div className="modal-caixa modal-largo">
        <h3>Legenda inteira</h3>
        <p className="dica">
          Uma linha por bloco. Corrigir palavras dentro das linhas mantém os tempos exatos.
        </p>

        <textarea
          className="texto-corrido"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          spellCheck
          autoFocus
        />

        <p className={`dica ${mudouEstrutura ? 'is-alerta' : ''}`}>
          {palavras} {palavras === 1 ? 'palavra' : 'palavras'} em {linhas}{' '}
          {linhas === 1 ? 'linha' : 'linhas'}
          {mudouEstrutura
            ? ` — eram ${p.blocos.length}. As linhas viram os blocos, e os tempos são redistribuídos pelo mesmo intervalo: a sincronia fica aproximada.`
            : ' — os tempos não vão se mexer.'}
        </p>

        <div className="modal-botoes">
          <button type="button" className="chip" onClick={p.onFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="primario"
            disabled={texto.trim() === original.trim() || !palavras}
            onClick={() => p.onAplicar(texto)}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
