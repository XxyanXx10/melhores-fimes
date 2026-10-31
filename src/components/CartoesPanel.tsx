import { useState } from 'react';
import type { Cartao, CenaRemotion, TipoCenaRemotion } from '../types';
import { formatarTempo } from '../blocks';

type Props = {
  cartoes: Cartao[];
  cenasRemotion?: CenaRemotion[];
  /** instante atual da prévia — é onde o cartão novo entra */
  tempo: number;
  duracao: number;
  onAdicionar: (c: Cartao) => void;
  onMudar: (id: string, patch: Partial<Cartao>) => void;
  onRemover: (id: string) => void;
  onIr: (t: number) => void;
  /** cores com que o cartão novo nasce, vindas do estilo de marca */
  padrao: { cor: string; destaque: string };
  onGerarAutomatico?: () => void;
  onGerarCenasRemotion?: (modo?: 'misto' | 'tudo-chatgpt') => void;
  onMudarCenaRemotion?: (id: string, patch: Partial<CenaRemotion>) => void;
  onRemoverCenaRemotion?: (id: string) => void;
  onLimparCenasRemotion?: () => void;
};

/** um ponto de partida decente, para o cartão já nascer legível */
function novoCartao(tempo: number, cor: string, destaque: string): Cartao {
  return {
    id: `k${Date.now()}`,
    start: +tempo.toFixed(2),
    duracao: 3.5,
    titulo: 'TÍTULO',
    itens: ['Primeiro item', 'Segundo item', 'Terceiro item'],
    cor,
    destaque,
    x: 50,
    y: 72,
    largura: 76,
  };
}

/** o cartão guarda uma lista; na tela é mais fácil editar como texto */
function paraTexto(itens: string[]): string {
  return itens.join('\n');
}
function deTexto(texto: string): string[] {
  return texto.split('\n').map((l) => l.trim()).filter(Boolean);
}

const ROTULOS_CENA: Record<TipoCenaRemotion, string> = {
  chatgpt: '💬 ChatGPT',
  'contexto-ia': '🧠 Contexto IA',
  checklist: '✅ Checklist',
  fluxo: '🔁 Fluxo entre IAs',
  inscrever: '🔔 Se inscreve',
  privacidade: '🛡️ Privacidade',
  codigo: '💻 Código / Terminal',
  versus: '⚡ Comparativo',
  numero: '🔢 Número em destaque',
  grafico: '📊 Gráfico',
  icones: '🧩 Ícones',
  rede: '📍 Rede / nomes',
  celular: '📱 Celular',
  frase: '💥 Frase de impacto',
  logos: '🏷️ Logos das empresas',
  manchete: '📰 Manchete da notícia',
  print: '🖼️ Print real com destaque',
  quiz: '🤔 Real ou IA? (quiz)',
  fundo: '🌌 Fundo animado',
};

export function CartoesPanel(p: Props) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [cenaAberta, setCenaAberta] = useState<string | null>(null);
  const cenasRemotion = p.cenasRemotion ?? [];

  return (
    <section className="bloco">
      <h2>Cenas Remotion & Cartões</h2>

      {/* Bloco especial para Cenas Dinâmicas Nativas do Remotion (ChatGPT, Contexto IA, etc.) */}
      {p.onGerarCenasRemotion && (
        <div
          style={{
            background: 'rgba(16, 163, 127, 0.1)',
            border: '1px solid rgba(16, 163, 127, 0.35)',
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>
            🤖 Cenas Dinâmicas no Remotion (Baseadas no Roteiro)
          </div>
          <p className="dica" style={{ margin: '0 0 8px 0' }}>
            Lê a fala e cria cenas animadas nativas no Remotion: conversa digitando ao vivo no ChatGPT,
            painel de contexto, checklist passo a passo e escudo de privacidade.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className="chip chip-forte"
              style={{ background: '#10a37f', color: '#fff', borderColor: '#10a37f' }}
              onClick={() => p.onGerarCenasRemotion?.('misto')}
              title="Analisa o roteiro e cria ChatGPT + Checklist + Escudo de Privacidade sincronizados"
            >
              🤖 Gerar Cenas Dinâmicas do Roteiro
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => p.onGerarCenasRemotion?.('tudo-chatgpt')}
              title="Cria uma conversa contínua no ChatGPT ao longo de todo o vídeo"
            >
              💬 Tudo no Chat do GPT
            </button>
            {cenasRemotion.length > 0 && p.onLimparCenasRemotion && (
              <button
                type="button"
                className="chip chip-perigo"
                onClick={p.onLimparCenasRemotion}
              >
                Limpar ({cenasRemotion.length})
              </button>
            )}
          </div>

          {cenasRemotion.length > 0 && (
            <ul className="fotos" style={{ marginTop: 10 }}>
              {cenasRemotion.map((cr) => {
                const aberta = cenaAberta === cr.id;
                return (
                  <li key={cr.id} className={aberta ? 'is-aberta' : ''}>
                    <div className="foto-topo">
                      <span
                        className="selo-cartao"
                        style={{ borderLeftColor: cr.destaque ?? '#10a37f' }}
                        aria-hidden
                      >
                        🤖
                      </span>
                      <button type="button" className="tempo" onClick={() => p.onIr(cr.start)}>
                        {formatarTempo(cr.start)}
                      </button>
                      <span className="dica" style={{ flex: 1 }}>
                        {ROTULOS_CENA[cr.tipo]} · {cr.duracao.toFixed(1)}s
                      </span>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => setCenaAberta(aberta ? null : cr.id)}
                      >
                        {aberta ? 'Fechar' : 'Editar'}
                      </button>
                      {p.onRemoverCenaRemotion && (
                        <button
                          type="button"
                          className="chip chip-perigo"
                          onClick={() => p.onRemoverCenaRemotion?.(cr.id)}
                          title="Remover esta cena"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {aberta && p.onMudarCenaRemotion && (
                      <div className="foto-ajustes">
                        <label className="campo">
                          <span>Estilo da Cena Remotion</span>
                          <select
                            value={cr.tipo}
                            onChange={(e) =>
                              p.onMudarCenaRemotion?.(cr.id, {
                                tipo: e.target.value as TipoCenaRemotion,
                              })
                            }
                          >
                            {Object.entries(ROTULOS_CENA).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="campo">
                          <span>Título</span>
                          <input
                            type="text"
                            value={cr.titulo}
                            onChange={(e) =>
                              p.onMudarCenaRemotion?.(cr.id, { titulo: e.target.value })
                            }
                          />
                        </label>

                        {cr.tipo === 'chatgpt' && (
                          <>
                            <label className="campo">
                              <span>Pergunta do Usuário (balão superior)</span>
                              <input
                                type="text"
                                value={cr.promptUsuario ?? ''}
                                onChange={(e) =>
                                  p.onMudarCenaRemotion?.(cr.id, { promptUsuario: e.target.value })
                                }
                              />
                            </label>
                            <label className="campo">
                              <span>Resposta da IA (digitada ao vivo)</span>
                              <textarea
                                rows={3}
                                value={cr.respostaIa ?? ''}
                                onChange={(e) =>
                                  p.onMudarCenaRemotion?.(cr.id, { respostaIa: e.target.value })
                                }
                              />
                            </label>
                          </>
                        )}

                        <label className="campo">
                          <span>Itens / Pílulas (um por linha)</span>
                          <textarea
                            rows={3}
                            value={paraTexto(cr.itens ?? [])}
                            onChange={(e) =>
                              p.onMudarCenaRemotion?.(cr.id, { itens: deTexto(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="fontes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          className="chip chip-forte"
          onClick={() => {
            const c = novoCartao(p.tempo, p.padrao.cor, p.padrao.destaque);
            p.onAdicionar(c);
            setAberto(c.id);
          }}
        >
          + Adicionar cartão
        </button>
        {p.onGerarAutomatico && (
          <button
            type="button"
            className="chip chip-forte"
            onClick={p.onGerarAutomatico}
            title="Analisa a fala e cria cartões nos momentos de maior impacto"
          >
            ⚡ Cartões nos momentos-chave
          </button>
        )}
      </div>

      {!p.cartoes.length ? (
        <p className="dica">
          Lista de tópicos desenhada pela própria composição: os itens entram um a um. Não é imagem —
          o texto continua editável e não precisa exportar nada de fora.
        </p>
      ) : (
        <ul className="fotos">
          {p.cartoes.map((c) => {
            const abertoAgora = aberto === c.id;
            return (
              <li key={c.id} className={abertoAgora ? 'is-aberta' : ''}>
                <div className="foto-topo">
                  <span className="selo-cartao" style={{ borderLeftColor: c.destaque }} aria-hidden>
                    ≡
                  </span>
                  <button type="button" className="tempo" onClick={() => p.onIr(c.start)}>
                    {formatarTempo(c.start)}
                  </button>
                  <span className="dica">
                    {c.itens.length} itens · {c.duracao.toFixed(1)}s
                  </span>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setAberto(abertoAgora ? null : c.id)}
                  >
                    {abertoAgora ? 'Fechar' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    className="chip chip-perigo"
                    onClick={() => p.onRemover(c.id)}
                    title="Remover este cartão"
                  >
                    ×
                  </button>
                </div>

                {abertoAgora && (
                  <div className="foto-ajustes">
                    <label className="campo">
                      <span>Título</span>
                      <input
                        type="text"
                        value={c.titulo ?? ''}
                        placeholder="sem título"
                        onChange={(e) => p.onMudar(c.id, { titulo: e.target.value })}
                      />
                    </label>

                    <label className="campo">
                      <span>Itens (um por linha)</span>
                      <textarea
                        rows={4}
                        value={paraTexto(c.itens)}
                        onChange={(e) => p.onMudar(c.id, { itens: deTexto(e.target.value) })}
                      />
                    </label>

                    <label className="campo">
                      <span>Entra em</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.1, p.duracao)}
                        step={0.1}
                        value={c.start}
                        onChange={(e) => p.onMudar(c.id, { start: Number(e.target.value) })}
                      />
                      <span>{formatarTempo(c.start)}</span>
                    </label>

                    <label className="campo">
                      <span>Dura</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.1}
                        value={c.duracao}
                        onChange={(e) => p.onMudar(c.id, { duracao: Number(e.target.value) })}
                      />
                      <span>{c.duracao.toFixed(1)}s</span>
                    </label>

                    <label className="campo">
                      <span>Largura</span>
                      <input
                        type="range"
                        min={40}
                        max={92}
                        step={1}
                        value={c.largura}
                        onChange={(e) => p.onMudar(c.id, { largura: Number(e.target.value) })}
                      />
                      <span>{c.largura}%</span>
                    </label>

                    <label className="campo">
                      <span>Altura na tela</span>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={1}
                        value={c.y}
                        onChange={(e) => p.onMudar(c.id, { y: Number(e.target.value) })}
                      />
                      <span>{c.y}%</span>
                    </label>

                    <div className="campo campo-linha">
                      <span>Cores</span>
                      <div className="cores">
                        <input
                          type="color"
                          value={c.destaque}
                          onChange={(e) => p.onMudar(c.id, { destaque: e.target.value })}
                          aria-label="Cor do título e do destaque"
                        />
                        <span className="dica">título, barra e último item</span>
                      </div>
                    </div>

                    <div className="campo campo-linha">
                      <span>Fundo</span>
                      <div className="chips">
                        {[
                          ['rgba(14,27,46,0.94)', 'Marinho'],
                          ['rgba(42,14,14,0.94)', 'Vinho'],
                          ['rgba(10,10,10,0.92)', 'Preto'],
                          ['rgba(250,250,250,0.95)', 'Claro'],
                        ].map(([valor, rotulo]) => (
                          <button
                            key={valor}
                            type="button"
                            className={`chip ${c.cor === valor ? 'is-active' : ''}`}
                            onClick={() => p.onMudar(c.id, { cor: valor })}
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
