import { useRef, useState } from 'react';
import type { Foto } from '../types';
import { enviarMidia, SERVIDOR } from '../transcrever';
import { formatarTempo } from '../blocks';

type Props = {
  fotos: Foto[];
  /** instante atual da prévia — é onde a foto nova entra */
  tempo: number;
  duracao: number;
  onAdicionar: (f: Foto) => void;
  onMudar: (id: string, patch: Partial<Foto>) => void;
  onRemover: (id: string) => void;
  onIr: (t: number) => void;
};

const ENTRADAS: Array<[Foto['entrada'], string]> = [
  ['escala', 'Cresce'],
  ['fade', 'Fade'],
  ['sobe', 'Sobe'],
];

export function FotosPanel(p: Props) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function adicionar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    try {
      const src = await enviarMidia(arquivo);
      p.onAdicionar({
        id: `f${Date.now()}`,
        src,
        start: +p.tempo.toFixed(2),
        duracao: 2.5,
        entrada: 'escala',
        largura: 62,
        x: 50,
        y: 38,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="bloco">
      <h2>Fotos e b-roll</h2>

      <div className="fontes">
        <label className="chip chip-forte">
          {enviando ? 'Enviando…' : 'Adicionar foto'}
          <input
            ref={entrada}
            type="file"
            accept="image/*"
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

      {!p.fotos.length ? (
        <p className="dica">
          A foto entra no instante em que a prévia estiver parada. Posicione o cursor e adicione.
        </p>
      ) : (
        <ul className="fotos">
          {p.fotos.map((f) => {
            const abertaAgora = aberta === f.id;
            return (
              <li key={f.id} className={abertaAgora ? 'is-aberta' : ''}>
                <div className="foto-topo">
                  <img src={`${SERVIDOR}/${f.src}`} alt="" />
                  <button type="button" className="tempo" onClick={() => p.onIr(f.start)}>
                    {formatarTempo(f.start)}
                  </button>
                  <span className="dica">{f.duracao.toFixed(1)}s</span>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setAberta(abertaAgora ? null : f.id)}
                  >
                    {abertaAgora ? 'Fechar' : 'Ajustar'}
                  </button>
                  <button
                    type="button"
                    className="chip chip-perigo"
                    onClick={() => p.onRemover(f.id)}
                    title="Remover esta foto"
                  >
                    ×
                  </button>
                </div>

                {abertaAgora && (
                  <div className="foto-ajustes">
                    <label className="campo">
                      <span>Entra em</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.1, p.duracao)}
                        step={0.1}
                        value={f.start}
                        onChange={(e) => p.onMudar(f.id, { start: Number(e.target.value) })}
                      />
                      <span>{formatarTempo(f.start)}</span>
                    </label>
                    <label className="campo">
                      <span>Dura</span>
                      <input
                        type="range"
                        min={0.4}
                        max={8}
                        step={0.1}
                        value={f.duracao}
                        onChange={(e) => p.onMudar(f.id, { duracao: Number(e.target.value) })}
                      />
                      <span>{f.duracao.toFixed(1)}s</span>
                    </label>
                    <label className="campo">
                      <span>Tamanho</span>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        step={1}
                        value={f.largura}
                        onChange={(e) => p.onMudar(f.id, { largura: Number(e.target.value) })}
                      />
                      <span>{f.largura}%</span>
                    </label>
                    <label className="campo">
                      <span>Altura na tela</span>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={1}
                        value={f.y}
                        onChange={(e) => p.onMudar(f.id, { y: Number(e.target.value) })}
                      />
                      <span>{f.y}%</span>
                    </label>
                    <label className="campo">
                      <span>Lado</span>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={1}
                        value={f.x}
                        onChange={(e) => p.onMudar(f.id, { x: Number(e.target.value) })}
                      />
                      <span>{f.x}%</span>
                    </label>
                    <div className="campo campo-linha">
                      <span>Entrada</span>
                      <div className="chips">
                        {ENTRADAS.map(([id, rotulo]) => (
                          <button
                            key={id}
                            type="button"
                            className={`chip ${f.entrada === id ? 'is-active' : ''}`}
                            onClick={() => p.onMudar(f.id, { entrada: id })}
                          >
                            {rotulo}
                          </button>
                        ))}
                      </div>
                    </div>
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
