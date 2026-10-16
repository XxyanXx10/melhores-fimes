import { useEffect, useRef, useState } from 'react';
import type { Som } from '../types';
import {
  enviarMidia,
  listarBibliotecaDark,
  SERVIDOR,
  type ItemAudioBib,
} from '../transcrever';
import { formatarTempo } from '../blocks';

type Props = {
  sons: Som[];
  /** instante atual da prévia — é onde o efeito novo entra */
  tempo: number;
  duracao: number;
  onAdicionar: (s: Som) => void;
  onMudar: (id: string, patch: Partial<Som>) => void;
  onRemover: (id: string) => void;
  onIr: (t: number) => void;
  onSonorizarAutomatico?: () => void;
};

/**
 * Música de fundo e efeitos sonoros.
 *
 * A música entra no começo, baixinha (a fala é o que importa) e com saída
 * gradual no fim. O efeito entra no instante em que a prévia está parada —
 * um estalo na transição, um destaque, uma batida no corte.
 */
export function SonsPanel(p: Props) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [ouvindo, setOuvindo] = useState<string | null>(null);
  const [mostrarBib, setMostrarBib] = useState(false);
  const [musicasBib, setMusicasBib] = useState<ItemAudioBib[]>([]);
  const [efeitosBib, setEfeitosBib] = useState<ItemAudioBib[]>([]);
  const tocador = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void listarBibliotecaDark().then((b) => {
      setMusicasBib(b.musicas);
      setEfeitosBib(b.efeitos);
    });
  }, []);

  async function adicionarDaBiblioteca(item: ItemAudioBib) {
    const musica = item.tipo === 'musica';
    const duracaoReal = musica
      ? 0
      : await new Promise<number>((ok) => {
          const a = new Audio(`${SERVIDOR}/${item.src}`);
          a.onloadedmetadata = () => ok(Number.isFinite(a.duration) ? +(a.duration + 0.1).toFixed(2) : 2);
          a.onerror = () => ok(2);
        });
    const novo: Som = {
      id: `s${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      src: item.src,
      nome: item.nome,
      tipo: item.tipo,
      start: musica ? 0 : +p.tempo.toFixed(2),
      duracao: duracaoReal,
      volume: musica ? 0.15 : 0.65,
      fadeIn: musica ? 1.5 : 0,
      fadeOut: musica ? 2.5 : 0,
      repetir: musica,
    };
    p.onAdicionar(novo);
    setAberto(novo.id);
  }

  async function adicionar(arquivo: File, tipo: Som['tipo']) {
    setEnviando(true);
    setErro(null);
    try {
      const src = await enviarMidia(arquivo);
      const musica = tipo === 'musica';
      /* efeito dura o que o áudio dura: sem isso ele ficava "tocando" até o fim do vídeo */
      const duracaoReal = musica
        ? 0
        : await new Promise<number>((ok) => {
            const a = new Audio(`${SERVIDOR}/${src}`);
            a.onloadedmetadata = () => ok(Number.isFinite(a.duration) ? +(a.duration + 0.1).toFixed(2) : 3);
            a.onerror = () => ok(3);
          });
      const novo: Som = {
        id: `s${Date.now()}`,
        src,
        nome: arquivo.name,
        tipo,
        start: musica ? 0 : +p.tempo.toFixed(2),
        duracao: duracaoReal,
        volume: musica ? 0.15 : 0.8,
        fadeIn: musica ? 1.5 : 0,
        fadeOut: musica ? 2.5 : 0,
        repetir: musica,
      };
      p.onAdicionar(novo);
      setAberto(novo.id);
      const b = await listarBibliotecaDark();
      setMusicasBib(b.musicas);
      setEfeitosBib(b.efeitos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o áudio.');
    } finally {
      setEnviando(false);
    }
  }

  function ouvir(s: Som) {
    tocador.current?.pause();
    if (ouvindo === s.id) {
      setOuvindo(null);
      return;
    }
    const a = new Audio(`${SERVIDOR}/${s.src}`);
    a.volume = Math.min(1, s.volume);
    a.onended = () => setOuvindo(null);
    void a.play();
    tocador.current = a;
    setOuvindo(s.id);
  }

  const campo = (rotulo: string, s: Som, chave: keyof Som, min: number, max: number, passo: number, sufixo = 's') => (
    <label className="campo">
      <span>{rotulo}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={passo}
        value={Number(s[chave])}
        onChange={(e) => p.onMudar(s.id, { [chave]: Number(e.target.value) } as Partial<Som>)}
      />
      <span>
        {sufixo === '%' ? `${Math.round(Number(s[chave]) * 100)}%` : `${Number(s[chave]).toFixed(1)}${sufixo}`}
      </span>
    </label>
  );

  return (
    <section className="bloco">
      <h2>Som: música e efeitos</h2>

      <div className="fontes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <label className="chip chip-forte">
          {enviando ? 'Enviando…' : '+ Música do PC'}
          <input
            type="file"
            accept="audio/*"
            hidden
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void adicionar(f, 'musica');
              e.target.value = '';
            }}
          />
        </label>
        <label className="chip chip-forte">
          + Efeito do PC
          <input
            type="file"
            accept="audio/*"
            hidden
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void adicionar(f, 'efeito');
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className={`chip ${mostrarBib ? 'is-active' : ''}`}
          onClick={() => setMostrarBib((v) => !v)}
        >
          📚 Biblioteca ({musicasBib.length + efeitosBib.length})
        </button>
        {p.onSonorizarAutomatico && (
          <button
            type="button"
            className="chip chip-forte"
            onClick={p.onSonorizarAutomatico}
            title="Adiciona efeitos sonoros (pop, sino, whoosh) automaticamente nos cartões, fotos e cortes"
          >
            ⚡ Sonorizar Auto
          </button>
        )}
      </div>

      {mostrarBib && (
        <div className="bib-som-caixa">
          {efeitosBib.length > 0 && (
            <div>
              <span className="dica">🔊 Efeitos (entram em {formatarTempo(p.tempo)}):</span>
              <div className="chips" style={{ marginTop: 4 }}>
                {efeitosBib.map((ef) => (
                  <button
                    key={ef.src}
                    type="button"
                    className="chip"
                    onClick={() => void adicionarDaBiblioteca(ef)}
                  >
                    + {ef.nome.replace(/\.[^.]+$/, '')}
                  </button>
                ))}
              </div>
            </div>
          )}
          {musicasBib.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span className="dica">🎵 Músicas de fundo:</span>
              <div className="chips" style={{ marginTop: 4 }}>
                {musicasBib.map((m) => (
                  <button
                    key={m.src}
                    type="button"
                    className="chip"
                    onClick={() => void adicionarDaBiblioteca(m)}
                  >
                    + {m.nome.replace(/\.[^.]+$/, '').slice(0, 26)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}

      {!p.sons.length ? (
        <p className="dica">
          A música começa no início e fica baixa para não cobrir a fala. O efeito entra no instante
          em que a prévia estiver parada: posicione o cursor e adicione, ou use <strong>⚡ Sonorizar Auto</strong>.
        </p>
      ) : (
        <ul className="fotos">
          {p.sons.map((s) => {
            const aberta = aberto === s.id;
            return (
              <li key={s.id} className={aberta ? 'is-aberta' : ''}>
                <div className="foto-topo">
                  <span className="dica" title={s.nome}>
                    {s.tipo === 'musica' ? '🎵' : '🔊'} {s.nome.length > 22 ? `${s.nome.slice(0, 20)}…` : s.nome}
                  </span>
                  <button type="button" className="tempo" onClick={() => p.onIr(s.start)}>
                    {formatarTempo(s.start)}
                  </button>
                  <button type="button" className="chip" onClick={() => ouvir(s)}>
                    {ouvindo === s.id ? '■' : '▶'}
                  </button>
                  <button type="button" className="chip" onClick={() => setAberto(aberta ? null : s.id)}>
                    {aberta ? 'Fechar' : 'Ajustar'}
                  </button>
                  <button
                    type="button"
                    className="chip chip-perigo"
                    onClick={() => p.onRemover(s.id)}
                    title="Remover este som"
                  >
                    ×
                  </button>
                </div>

                {aberta && (
                  <div className="foto-ajustes">
                    {campo('Volume', s, 'volume', 0, 1, 0.01, '%')}
                    {campo('Começa em', s, 'start', 0, Math.max(0.1, p.duracao), 0.1)}
                    {campo('Dura (0 = até o fim)', s, 'duracao', 0, Math.max(1, p.duracao), 0.1)}
                    {campo('Entrada gradual', s, 'fadeIn', 0, 5, 0.1)}
                    {campo('Saída gradual', s, 'fadeOut', 0, 6, 0.1)}
                    <label className="campo-check">
                      <input
                        type="checkbox"
                        checked={s.repetir}
                        onChange={(e) => p.onMudar(s.id, { repetir: e.target.checked })}
                      />
                      <span>Repetir enquanto durar</span>
                    </label>
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
