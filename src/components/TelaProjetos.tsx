import { useMemo, useState } from 'react';
import type { ProjetoNoDisco } from '../transcrever';
import { SERVIDOR } from '../transcrever';

type Props = {
  projetos: ProjetoNoDisco[];
  onAbrir: (arquivo: string) => void;
  onNovo: (f: File) => void;
  onApagar: (arquivo: string) => void;
  onDuplicar: (arquivo: string) => void;
  onFechar: (() => void) | null;
  carregando: boolean;
};

type Ordem = 'recentes' | 'nome' | 'duracao';

function quando(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 90) return 'agora há pouco';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  return new Date(ms).toLocaleDateString('pt-BR');
}

function duracaoCurta(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

/** duas letras para o cartão que ainda não tem miniatura */
function iniciais(nome: string): string {
  const partes = nome.replace(/\.[^.]+$/, '').split(/[\s—-]+/).filter(Boolean);
  return (partes[0]?.[0] ?? '?').toUpperCase() + (partes[1]?.[0] ?? '').toUpperCase();
}

export function TelaProjetos(p: Props) {
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = termo
      ? p.projetos.filter(
          (x) =>
            x.nome.toLowerCase().includes(termo) ||
            (x.arquivoVideo ?? '').toLowerCase().includes(termo),
        )
      : p.projetos;
    const copia = [...filtrados];
    if (ordem === 'nome') copia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    else if (ordem === 'duracao') copia.sort((a, b) => b.duracao - a.duracao);
    else copia.sort((a, b) => b.atualizado - a.atualizado);
    return copia;
  }, [p.projetos, busca, ordem]);

  return (
    <div className="tela-projetos">
      <header className="tp-topo">
        <div className="tp-titulo">
          <h1>
            Melhores Fimes <span>· seus projetos</span>
          </h1>
          <p>
            {p.projetos.length
              ? `${p.projetos.length} ${p.projetos.length === 1 ? 'projeto' : 'projetos'} nesta máquina`
              : 'Nenhum projeto ainda — comece enviando um vídeo.'}
          </p>
        </div>

        <div className="tp-acoes">
          <label className="primario">
            Novo projeto
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) p.onNovo(f);
                e.target.value = '';
              }}
            />
          </label>
          {p.onFechar && (
            <button type="button" className="chip chip-topo" onClick={p.onFechar}>
              Voltar ao que eu estava editando
            </button>
          )}
        </div>
      </header>

      {p.projetos.length > 0 && (
        <div className="tp-filtros">
          <input
            className="tp-busca"
            value={busca}
            placeholder="Procurar por nome…"
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="chips">
            {(
              [
                ['recentes', 'Mexidos por último'],
                ['nome', 'Nome'],
                ['duracao', 'Duração'],
              ] as Array<[Ordem, string]>
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                className={`chip ${ordem === id ? 'is-active' : ''}`}
                onClick={() => setOrdem(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {p.carregando ? (
        <p className="tp-vazio">Procurando seus projetos…</p>
      ) : !p.projetos.length ? (
        <div className="tp-vazio">
          <p>
            Envie um vídeo vertical: a transcrição começa sozinha e o projeto passa a viver nesta
            lista, com o nome que você quiser.
          </p>
        </div>
      ) : !lista.length ? (
        <p className="tp-vazio">Nenhum projeto com “{busca}”.</p>
      ) : (
        <ul className="tp-grade">
          {lista.map((x) => (
            <li key={x.arquivo} className={`tp-cartao ${x.temVideo ? '' : 'is-orfao'}`}>
              <button className="tp-abrir" type="button" onClick={() => p.onAbrir(x.arquivo)}>
                <span className="tp-imagem">
                  {x.temVideo ? (
                    <img
                      src={`${SERVIDOR}/miniatura/${encodeURIComponent(x.arquivo)}`}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <em>{iniciais(x.nome)}</em>
                </span>
                <span className="tp-nome">{x.nome}</span>
                <span className="tp-meta">
                  {duracaoCurta(x.duracao)} · {x.palavras} {x.palavras === 1 ? 'palavra' : 'palavras'} ·{' '}
                  {quando(x.atualizado)}
                </span>
                <span className="tp-selos">
                  {x.exportado && <b className="ok">MP4 pronto</b>}
                  {!x.temVideo && <b className="alerta">vídeo não encontrado</b>}
                </span>
              </button>

              <div className="tp-menu">
                <button type="button" onClick={() => p.onDuplicar(x.arquivo)} title="Duplicar">
                  Duplicar
                </button>
                <button type="button" onClick={() => setConfirmar(x.arquivo)} title="Apagar">
                  Apagar
                </button>
              </div>

              {confirmar === x.arquivo && (
                <div className="tp-confirma">
                  <p>Apagar “{x.nome}”? Ele vai para a lixeira da pasta de projetos.</p>
                  <div>
                    <button type="button" className="chip" onClick={() => setConfirmar(null)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="chip chip-perigo"
                      onClick={() => {
                        p.onApagar(x.arquivo);
                        setConfirmar(null);
                      }}
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
