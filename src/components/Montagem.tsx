import { useEffect, useState } from 'react';
import { andarMontagem, enviarVideoFonte, montarTakes, type AndarMontagem } from '../transcrever';

type Props = {
  onPronto: (arquivoProjeto: string) => void;
  onFechar: () => void;
};

/**
 * Montar um vídeo a partir dos takes.
 *
 * É o jeito como o vídeo é gravado de verdade: uma frase por take, cada um
 * começando com "um, dois, três, gravando". A plataforma joga fora a claquete,
 * tira os silêncios e cola tudo — só depois disso a legenda faz sentido.
 */
export function Montagem(p: Props) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [nome, setNome] = useState('');
  const [silencio, setSilencio] = useState(0.35);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [andar, setAndar] = useState<AndarMontagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const rodando = enviando !== null || (andar && ['começando', 'transcrevendo', 'montando'].includes(andar.etapa));

  /* enquanto monta, o serviço vai contando em que take está */
  useEffect(() => {
    if (!andar || !['começando', 'transcrevendo', 'montando'].includes(andar.etapa)) return;
    const id = setInterval(() => {
      void andarMontagem().then((a) => {
        setAndar(a);
        if (a.etapa === 'pronto' && a.resultado) p.onPronto(a.resultado.arquivoProjeto);
        if (a.etapa === 'erro') setErro(a.erro ?? 'A montagem falhou.');
      });
    }, 1500);
    return () => clearInterval(id);
  }, [andar, p]);

  async function comecar() {
    setErro(null);
    try {
      /* os takes precisam existir no disco: o serviço não alcança o navegador */
      const caminhos: string[] = [];
      for (const [i, f] of arquivos.entries()) {
        setEnviando(i + 1);
        caminhos.push(await enviarVideoFonte(f));
      }
      setEnviando(null);
      await montarTakes(caminhos, nome.trim() || 'Montagem', silencio);
      setAndar({ etapa: 'começando', de: caminhos.length });
    } catch (e) {
      setEnviando(null);
      setErro(e instanceof Error ? e.message : 'Não consegui montar.');
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal aria-label="Montar a partir de takes">
      <div className="modal-caixa modal-largo">
        <h3>Montar a partir dos takes</h3>
        <p className="dica">
          Escolha todos os takes de uma vez. Cada um deve começar com a claquete falada — o
          “gravando” e tudo que vem antes dele é jogado fora, os silêncios saem, e os pedaços são
          colados na ordem dos nomes dos arquivos.
        </p>

        {!rodando && (
          <>
            <label className="upload">
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => {
                  const lista = Array.from(e.target.files ?? []);
                  setArquivos(lista);
                  if (!nome && lista.length) setNome(lista[0].name.replace(/[-_ ]*\d+\.[^.]+$/, ''));
                }}
              />
              <span>
                {arquivos.length
                  ? `${arquivos.length} takes escolhidos`
                  : 'Escolher os takes (pode selecionar todos de uma vez)'}
              </span>
            </label>

            {arquivos.length > 0 && (
              <ol className="takes-lista">
                {[...arquivos]
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
                  .map((f) => (
                    <li key={f.name}>
                      <span>{f.name}</span>
                      <em>{(f.size / 1e6).toFixed(0)} MB</em>
                    </li>
                  ))}
              </ol>
            )}

            <label className="campo campo-linha">
              <span>Nome do vídeo</span>
              <input
                className="tp-busca"
                value={nome}
                placeholder="Reajuste ANS"
                onChange={(e) => setNome(e.target.value)}
              />
            </label>

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
          </>
        )}

        {rodando && (
          <div className="montando">
            <span className="girando" aria-hidden="true" />
            {enviando !== null ? (
              <strong>
                Enviando take {enviando} de {arquivos.length}…
              </strong>
            ) : andar?.etapa === 'transcrevendo' ? (
              <strong>
                Transcrevendo take {andar.take} de {andar.de}…
              </strong>
            ) : (
              <strong>Colando os takes…</strong>
            )}
            <span className="dica">
              Cada take é transcrito na sua máquina; em CPU isso leva perto do tempo de cada vídeo.
            </span>
          </div>
        )}

        {erro && <p className="erro">{erro}</p>}

        <div className="modal-botoes">
          <button type="button" className="chip" onClick={p.onFechar} disabled={!!rodando}>
            {rodando ? 'Aguarde…' : 'Cancelar'}
          </button>
          <button
            type="button"
            className="primario"
            disabled={!arquivos.length || !!rodando}
            onClick={() => void comecar()}
          >
            Montar {arquivos.length ? `${arquivos.length} takes` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
