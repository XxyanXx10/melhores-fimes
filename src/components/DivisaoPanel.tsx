import { useState } from 'react';
import type { Divisao } from '../types';
import { enviarMidia, SERVIDOR } from '../transcrever';
import { formatarTempo } from '../blocks';

type Props = {
  divisoes: Divisao[];
  /** instante atual da prévia — é onde a divisão começa */
  tempo: number;
  duracao: number;
  onAdicionar: (d: Divisao) => void;
  onMudar: (id: string, patch: Partial<Divisao>) => void;
  onRemover: (id: string) => void;
  onIr: (t: number) => void;
};

const LADOS: Array<[Divisao['lado'], string]> = [
  ['baixo', 'Embaixo'],
  ['cima', 'Em cima'],
  ['esquerda', 'À esquerda'],
  ['direita', 'À direita'],
];

const ENTRADAS: Array<[Divisao['entrada'], string]> = [
  ['desliza', 'Abre'],
  ['fade', 'Fade'],
  ['corte', 'Corte seco'],
];

export function DivisaoPanel(p: Props) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  async function adicionar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    try {
      const src = await enviarMidia(arquivo);
      p.onAdicionar({
        id: `d${Date.now()}`,
        src,
        start: +p.tempo.toFixed(2),
        duracao: 4,
        lado: 'baixo',
        proporcao: 50,
        entrada: 'desliza',
        mudo: true,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o arquivo.');
    } finally {
      setEnviando(false);
    }
  }

  const ehVideo = (src: string) => /\.(mp4|webm|mov|m4v)$/i.test(src);

  return (
    <section className="bloco">
      <h2>Tela dividida</h2>

      <div className="fontes">
        <label className="chip chip-forte">
          {enviando ? 'Enviando…' : 'Adicionar vídeo ou imagem'}
          <input
            type="file"
            accept="video/*,image/*"
            hidden
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void adicionar(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {!p.divisoes.length ? (
        <p className="dica">
          Metade da tela o seu vídeo, metade o outro. O seu encolhe sozinho para abrir espaço.
        </p>
      ) : (
        <ul className="fotos">
          {p.divisoes.map((d) => {
            const abertaAgora = aberta === d.id;
            return (
              <li key={d.id} className={abertaAgora ? 'is-aberta' : ''}>
                <div className="foto-topo">
                  {ehVideo(d.src) ? (
                    <span className="selo-video" aria-hidden>
                      ▶
                    </span>
                  ) : (
                    <img src={`${SERVIDOR}/${d.src}`} alt="" />
                  )}
                  <button type="button" className="tempo" onClick={() => p.onIr(d.start)}>
                    {formatarTempo(d.start)}
                  </button>
                  <span className="dica">
                    {d.duracao.toFixed(1)}s · {LADOS.find(([id]) => id === d.lado)?.[1]}
                  </span>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setAberta(abertaAgora ? null : d.id)}
                  >
                    {abertaAgora ? 'Fechar' : 'Ajustar'}
                  </button>
                  <button
                    type="button"
                    className="chip chip-perigo"
                    onClick={() => p.onRemover(d.id)}
                    title="Remover esta divisão"
                  >
                    ×
                  </button>
                </div>

                {abertaAgora && (
                  <div className="foto-ajustes">
                    <label className="campo">
                      <span>Começa em</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.1, p.duracao)}
                        step={0.1}
                        value={d.start}
                        onChange={(e) => p.onMudar(d.id, { start: Number(e.target.value) })}
                      />
                      <span>{formatarTempo(d.start)}</span>
                    </label>
                    <label className="campo">
                      <span>Dura</span>
                      <input
                        type="range"
                        min={0.5}
                        max={20}
                        step={0.5}
                        value={d.duracao}
                        onChange={(e) => p.onMudar(d.id, { duracao: Number(e.target.value) })}
                      />
                      <span>{d.duracao.toFixed(1)}s</span>
                    </label>
                    <label className="campo">
                      <span>Ocupa</span>
                      <input
                        type="range"
                        min={20}
                        max={80}
                        step={1}
                        value={d.proporcao}
                        onChange={(e) => p.onMudar(d.id, { proporcao: Number(e.target.value) })}
                      />
                      <span>{d.proporcao}%</span>
                    </label>
                    <div className="campo campo-linha">
                      <span>Fica</span>
                      <div className="chips">
                        {LADOS.map(([id, rotulo]) => (
                          <button
                            key={id}
                            type="button"
                            className={`chip ${d.lado === id ? 'is-active' : ''}`}
                            onClick={() => p.onMudar(d.id, { lado: id })}
                          >
                            {rotulo}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="campo campo-linha">
                      <span>Entrada</span>
                      <div className="chips">
                        {ENTRADAS.map(([id, rotulo]) => (
                          <button
                            key={id}
                            type="button"
                            className={`chip ${d.entrada === id ? 'is-active' : ''}`}
                            onClick={() => p.onMudar(d.id, { entrada: id })}
                          >
                            {rotulo}
                          </button>
                        ))}
                      </div>
                    </div>
                    {ehVideo(d.src) && (
                      <label className="campo campo-check">
                        <input
                          type="checkbox"
                          checked={d.mudo}
                          onChange={(e) => p.onMudar(d.id, { mudo: e.target.checked })}
                        />
                        <span>Sem áudio (recomendado: a fala é a do seu vídeo)</span>
                      </label>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
