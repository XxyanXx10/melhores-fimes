import { useMemo, useState } from 'react';
import {
  SERVIDOR,
  enderecoDoRender,
  enfileirarRenders,
  removerDaFilaRender,
  type ItemFilaRender,
  type ProjetoNoDisco,
} from '../transcrever';

type Props = {
  projetos: ProjetoNoDisco[];
  onAbrir: (arquivo: string) => void;
  onNovo: (f: File) => void;
  onApagar: (arquivo: string) => void;
  onDuplicar: (arquivo: string) => void;
  onFechar: (() => void) | null;
  onMontar: () => void;
  onAbrirDark: () => void;
  filaRender: ItemFilaRender[];
  onAtualizarFila: () => void;
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
  const [selecionados, setSelecionados] = useState<string[]>([]);

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

  function alternarSelecao(arquivo: string) {
    setSelecionados((atuais) =>
      atuais.includes(arquivo) ? atuais.filter((x) => x !== arquivo) : [...atuais, arquivo],
    );
  }

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
              : 'Nenhum projeto ainda — comece enviando um vídeo ou abrindo a Fábrica de Canal Dark.'}
          </p>
        </div>

        <div className="tp-acoes">
          <button type="button" className="chip chip-topo chip-dark" onClick={p.onAbrirDark}>
            🔥 Canal Dark (Criador em Lote)
          </button>
          <button type="button" className="chip chip-topo" onClick={p.onMontar}>
            Montar a partir de takes
          </button>
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

      {/* Fila de Exportação em Lote */}
      {p.filaRender.length > 0 && (
        <section className="dark-fila-box">
          <div className="dark-fila-topo">
            <strong>
              🎞️ Fila de Exportação em Lote ({p.filaRender.filter((x) => x.status === 'pronto').length}/
              {p.filaRender.length} concluídos)
            </strong>
            <div className="chips">
              <button
                type="button"
                className="chip"
                onClick={() => void removerDaFilaRender(undefined, true).then(() => p.onAtualizarFila())}
              >
                Limpar concluídos
              </button>
              <button
                type="button"
                className="chip chip-perigo"
                onClick={() => void removerDaFilaRender().then(() => p.onAtualizarFila())}
              >
                Cancelar pendentes
              </button>
            </div>
          </div>
          <ul className="dark-fila-lista">
            {p.filaRender.map((item) => (
              <li key={item.id} className={`is-${item.status}`}>
                <span className="dark-fila-nome">{item.nome}</span>
                <span className="dark-fila-status">
                  {item.status === 'aguardando' && '⏳ Na fila'}
                  {item.status === 'renderizando' && `⚙️ Renderizando ${Math.round(item.progresso * 100)}%`}
                  {item.status === 'pronto' && '✅ MP4 Pronto'}
                  {item.status === 'erro' && `❌ ${item.erro ?? 'Erro'}`}
                  {item.status === 'cancelado' && 'Cancelado'}
                </span>
                {item.status === 'pronto' && item.saida && (
                  <a className="chip chip-forte" href={enderecoDoRender(item.saida)} download>
                    Baixar MP4
                  </a>
                )}
                {item.status === 'aguardando' && (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => void removerDaFilaRender(item.id).then(() => p.onAtualizarFila())}
                  >
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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

          <div className="tp-lote-acoes">
            {selecionados.length > 0 ? (
              <>
                <button
                  type="button"
                  className="primario"
                  onClick={() => {
                    void enfileirarRenders(selecionados).then(() => {
                      setSelecionados([]);
                      p.onAtualizarFila();
                    });
                  }}
                >
                  🎞️ Exportar selecionados na Fila ({selecionados.length})
                </button>
                <button type="button" className="chip" onClick={() => setSelecionados([])}>
                  Desmarcar ({selecionados.length})
                </button>
              </>
            ) : (
              <button
                type="button"
                className="chip"
                onClick={() =>
                  setSelecionados(lista.filter((x) => x.temVideo && !x.exportado).map((x) => x.arquivo))
                }
                title="Seleciona todos os projetos com vídeo que ainda não têm MP4 exportado"
              >
                ☑️ Selecionar não exportados
              </button>
            )}
          </div>
        </div>
      )}

      {p.carregando ? (
        <p className="tp-vazio">Procurando seus projetos…</p>
      ) : !p.projetos.length ? (
        <div className="tp-vazio">
          <p>
            Envie um vídeo vertical: a transcrição começa sozinha e o projeto passa a viver nesta
            lista, com o nome que você quiser. Gravou por takes? Use <strong>Montar a partir de
            takes</strong>. Quer criar vários vídeos sem aparecer? Abra a aba{' '}
            <strong>🔥 Canal Dark (Criador em Lote)</strong>.
          </p>
        </div>
      ) : !lista.length ? (
        <p className="tp-vazio">Nenhum projeto com “{busca}”.</p>
      ) : (
        <ul className="tp-grade">
          {lista.map((x) => {
            const marcado = selecionados.includes(x.arquivo);
            return (
              <li
                key={x.arquivo}
                className={`tp-cartao ${x.temVideo ? '' : 'is-orfao'} ${marcado ? 'is-selecionado' : ''}`}
              >
                <label className="tp-selecionar" title="Marcar para exportar em lote">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternarSelecao(x.arquivo)}
                  />
                </label>

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
                  {x.temVideo && (
                    <button
                      type="button"
                      onClick={() => void enfileirarRenders([x.arquivo]).then(() => p.onAtualizarFila())}
                      title="Adicionar à fila de exportação MP4"
                    >
                      + Fila MP4
                    </button>
                  )}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
