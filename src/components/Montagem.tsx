import { useEffect, useState } from 'react';
import {
  andarMontagem,
  enviarVideoFonte,
  listarTakesDaPasta,
  montarTakes,
  type AndarMontagem,
  type TakeDaPasta,
} from '../transcrever';

type Props = {
  onPronto: (arquivoProjeto: string) => void;
  onFechar: () => void;
};

/** nome do vídeo a partir do último pedaço do caminho da pasta */
function nomeDaPasta(pasta: string): string {
  return pasta.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
}

function dataCurta(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Montar um vídeo a partir dos takes.
 *
 * É o jeito como o vídeo é gravado de verdade: uma frase por take, cada um
 * começando com "um, dois, três, gravando". A plataforma joga fora a claquete,
 * tira os silêncios e cola tudo — só depois disso a legenda faz sentido.
 *
 * Dois jeitos de escolher os takes: apontar para a pasta onde eles estão (o
 * serviço lê direto do disco e ordena pela data de criação — a ordem em que
 * foram gravados de verdade) ou escolher os arquivos pelo seletor do
 * navegador, para quando eles não estão todos numa pasta só nesta máquina.
 */
export function Montagem(p: Props) {
  const [modo, setModo] = useState<'pasta' | 'arquivos'>('pasta');

  /* modo pasta: o serviço lê os arquivos direto do disco, sem reenviar nada */
  const [pasta, setPasta] = useState('');
  const [ordemPasta, setOrdemPasta] = useState<'data' | 'nome'>('data');
  const [buscando, setBuscando] = useState(false);
  const [takesPasta, setTakesPasta] = useState<TakeDaPasta[]>([]);
  const [erroPasta, setErroPasta] = useState<string | null>(null);

  /* modo arquivos: o navegador não dá o caminho do disco, então cada um sobe */
  const [arquivos, setArquivos] = useState<File[]>([]);

  const [nome, setNome] = useState('');
  const [silencio, setSilencio] = useState(0.35);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [andar, setAndar] = useState<AndarMontagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const totalTakes = modo === 'pasta' ? takesPasta.length : arquivos.length;
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

  async function buscarPasta(ordem: 'data' | 'nome' = ordemPasta) {
    if (!pasta.trim()) return;
    setBuscando(true);
    setErroPasta(null);
    try {
      const lista = await listarTakesDaPasta(pasta.trim(), ordem);
      if (!lista.length) {
        setTakesPasta([]);
        setErroPasta('Não achei vídeo nenhum nessa pasta.');
        return;
      }
      setTakesPasta(lista);
      if (!nome) setNome(nomeDaPasta(pasta.trim()));
    } catch (e) {
      setTakesPasta([]);
      setErroPasta(e instanceof Error ? e.message : 'Não consegui ler essa pasta.');
    } finally {
      setBuscando(false);
    }
  }

  function moverTake(i: number, delta: number) {
    setTakesPasta((lista) => {
      const alvo = i + delta;
      if (alvo < 0 || alvo >= lista.length) return lista;
      const copia = [...lista];
      [copia[i], copia[alvo]] = [copia[alvo], copia[i]];
      return copia;
    });
  }

  function removerTake(i: number) {
    setTakesPasta((lista) => lista.filter((_, k) => k !== i));
  }

  async function comecar() {
    setErro(null);
    try {
      if (modo === 'pasta') {
        const caminhos = takesPasta.map((t) => t.caminho);
        await montarTakes(caminhos, nome.trim() || 'Montagem', silencio);
        setAndar({ etapa: 'começando', de: caminhos.length });
        return;
      }

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
          Cada take deve começar com a claquete falada — o "gravando" e tudo que vem antes dele é
          jogado fora, os silêncios saem, e os pedaços são colados na ordem certa.
        </p>

        {!rodando && (
          <>
            <div className="chips" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`chip${modo === 'pasta' ? ' is-active' : ''}`}
                onClick={() => setModo('pasta')}
              >
                Pasta no disco
              </button>
              <button
                type="button"
                className={`chip${modo === 'arquivos' ? ' is-active' : ''}`}
                onClick={() => setModo('arquivos')}
              >
                Escolher arquivos
              </button>
            </div>

            {modo === 'pasta' && (
              <>
                <label className="campo campo-linha">
                  <span>Pasta dos takes</span>
                  <input
                    className="tp-busca"
                    value={pasta}
                    placeholder="E:\Video\Cortes\Reajuste"
                    onChange={(e) => setPasta(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void buscarPasta()}
                  />
                </label>

                <div className="modal-botoes" style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
                  <button
                    type="button"
                    className="chip"
                    disabled={!pasta.trim() || buscando}
                    onClick={() => void buscarPasta()}
                  >
                    {buscando ? 'Procurando…' : 'Buscar takes'}
                  </button>
                  <label className="campo-check" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={ordemPasta === 'nome'}
                      onChange={(e) => {
                        const nova = e.target.checked ? 'nome' : 'data';
                        setOrdemPasta(nova);
                        if (takesPasta.length) void buscarPasta(nova);
                      }}
                    />
                    <span>Ordenar pelo nome do arquivo (em vez da data de criação)</span>
                  </label>
                </div>

                {erroPasta && <p className="erro">{erroPasta}</p>}

                {takesPasta.length > 0 && (
                  <ol className="takes-lista">
                    {takesPasta.map((t, i) => (
                      <li key={t.caminho}>
                        <span>
                          {t.nome} <em>— {dataCurta(t.criadoEm)}</em>
                        </span>
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <em>{(t.tamanho / 1e6).toFixed(0)} MB</em>
                          <button type="button" className="chip-topo" disabled={i === 0} onClick={() => moverTake(i, -1)}>
                            ↑
                          </button>
                          <button
                            type="button"
                            className="chip-topo"
                            disabled={i === takesPasta.length - 1}
                            onClick={() => moverTake(i, 1)}
                          >
                            ↓
                          </button>
                          <button type="button" className="chip-topo" onClick={() => removerTake(i)}>
                            ✕
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}

            {modo === 'arquivos' && (
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
                <p className="dica">
                  Aqui a ordem é pelo nome do arquivo — o navegador não entrega a data de criação.
                  Se os nomes não seguem a ordem da gravação, use "Pasta no disco" em vez disso.
                </p>
              </>
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
                Enviando take {enviando} de {totalTakes}…
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
            disabled={!totalTakes || !!rodando}
            onClick={() => void comecar()}
          >
            Montar {totalTakes ? `${totalTakes} takes` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
