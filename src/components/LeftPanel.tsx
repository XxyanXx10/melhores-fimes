import type {
  CaptionStyle,
  CoresTransicao,
  Corte,
  Emphasis,
  Movimento,
  Template,
  TipoTransicao,
} from '../types';
import { useState } from 'react';
import { formatarTempo } from '../blocks';
import { enviarMidia, SERVIDOR } from '../transcrever';
import { FONTES } from '../data/fontes';

type Props = {
  templates: Template[];
  selecionado: string;
  onSelecionar: (id: string) => void;
  style: CaptionStyle;
  onStyle: (patch: Partial<CaptionStyle>) => void;
  modificado: boolean;
  onResetar: () => void;
  onUpload: (f: File) => void;
  nomeArquivo: string | null;
  autoTranscrever: boolean;
  onAutoTranscrever: (v: boolean) => void;
  servidorOk: boolean;
  movimento: Movimento;
  onMovimento: (m: Movimento) => void;
  forcaZoom: number;
  onForcaZoom: (v: number) => void;
  /** instantes em que o vídeo já foi cortado */
  cortes: Corte[];
  transicao: TipoTransicao;
  onTransicao: (t: TipoTransicao) => void;
  forcaTransicao: number;
  onForcaTransicao: (v: number) => void;
  /** quanto tempo a transição fica na tela, em segundos */
  duracaoTransicao: number;
  onDuracaoTransicao: (v: number) => void;
  /** cores do degradê da transição; ausente = herda o modelo de legenda */
  coresTransicao?: CoresTransicao;
  onCoresTransicao: (c?: CoresTransicao) => void;
  /** liga, desliga ou troca a animação de um corte específico */
  onCorte: (t: number, patch: Partial<Corte>) => void;
  onTodosCortes: (ativo: boolean) => void;
  onIrPara: (t: number) => void;
  detectando: boolean;
  onDetectar: () => void;
};

const TRANSICOES: Array<[TipoTransicao, string]> = [
  ['off', 'Nenhuma'],
  ['variado', 'Variado (troca a cada corte)'],
  ['flash', 'Clarão'],
  ['escurece', 'Escurece'],
  ['whip', 'Chicote'],
  ['deslize', 'Empurra'],
  ['zoom', 'Estalo'],
  ['giro', 'Giro'],
  ['cortina', 'Cortina de cor'],
  ['barras', 'Faixas'],
];

const DESCRICOES: Record<TipoTransicao, string> = {
  off: 'Os cortes aparecem como estão no vídeo.',
  variado: 'Reveza as animações a cada corte — o vídeo não fica repetitivo.',
  flash: 'Estouro branco curto. O mais discreto e o que menos cansa.',
  escurece: 'Mergulha no preto por um instante. Dá peso à virada.',
  whip: 'A imagem varre para o lado com borrão de movimento.',
  deslize: 'Empurrão seco, sem borrão — parece corte de edição.',
  zoom: 'Fecha e desfoca por um instante.',
  giro: 'Inclina e fecha ao mesmo tempo. O mais agressivo.',
  cortina: 'Degradê nas cores do modelo cobrindo, com a legenda por cima.',
  barras: 'Faixas entrando de lados alternados, cara de vinheta.',
};

const posicoes: Array<[string, number]> = [
  ['Alta', 30],
  ['Meio', 50],
  ['Padrão', 72],
  ['Baixa', 84],
];

/** [família, modelos] preservando a ordem em que aparecem na lista */
function familias(lista: Template[]): Array<[string, Template[]]> {
  const mapa = new Map<string, Template[]>();
  for (const t of lista) mapa.set(t.family, [...(mapa.get(t.family) ?? []), t]);
  return [...mapa.entries()];
}

export function LeftPanel(p: Props) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [enviando, setEnviando] = useState<number | null>(null);

  async function imagemDoCorte(t: number, arquivo: File) {
    setEnviando(t);
    try {
      p.onCorte(t, { imagem: await enviarMidia(arquivo) });
    } finally {
      setEnviando(null);
    }
  }

  return (
    <aside className="panel panel-left">
      <section className="bloco">
        <h2>1. Vídeo</h2>
        <label className="upload">
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.onUpload(f);
            }}
          />
          <span>{p.nomeArquivo ?? 'Enviar vídeo (9:16)'}</span>
        </label>
        <label className="campo campo-check">
          <input
            type="checkbox"
            checked={p.autoTranscrever}
            disabled={!p.servidorOk}
            onChange={(e) => p.onAutoTranscrever(e.target.checked)}
          />
          <span>Transcrever assim que o vídeo entrar</span>
        </label>
        <p className="dica">
          {p.servidorOk
            ? 'Vertical (9:16) fica melhor. A legenda aparece sozinha quando a transcrição terminar.'
            : 'Vertical (9:16) fica melhor. Sem vídeo, a prévia usa um fundo de exemplo — sem som.'}
        </p>
      </section>

      <section className="bloco">
        <h2>3. Estilo</h2>
        {familias(p.templates).map(([familia, lista]) => (
        <div className="cards" key={familia}>
          <span className="familia">{familia}</span>
          {lista.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`card ${t.id === p.selecionado ? 'is-active' : ''}`}
              onClick={() => p.onSelecionar(t.id)}
            >
              <span
                className="card-swatch"
                style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
              >
                <span style={{ color: t.swatch[1], fontFamily: t.style.fontFamily }}>Aa</span>
              </span>
              <span className="card-info">
                <strong>{t.name}</strong>
                <em>{t.description}</em>
              </span>
            </button>
          ))}
        </div>
        ))}
        {p.modificado && (
          <button type="button" className="ghost" onClick={p.onResetar}>
            Voltar ao padrão do cartão
          </button>
        )}
      </section>

      <section className="bloco">
        <h2>Movimento</h2>
        <div className="campo campo-linha">
          <span>Zoom</span>
          <div className="chips">
            {(['off', 'natural', 'suave', 'ritmo'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${p.movimento === m ? 'is-active' : ''}`}
                onClick={() => p.onMovimento(m)}
              >
                {{ off: 'Parado', natural: 'Natural', suave: 'Suave', ritmo: 'No ritmo' }[m]}
              </button>
            ))}
          </div>
        </div>
        {p.movimento !== 'off' && (
          <label className="campo">
            <span>Intensidade</span>
            <input
              type="range"
              min={0.4}
              max={2}
              step={0.1}
              value={p.forcaZoom}
              onChange={(e) => p.onForcaZoom(Number(e.target.value))}
            />
            <span>{Math.round(p.forcaZoom * 100)}%</span>
          </label>
        )}
        <p className="dica">
          {{
            off: 'Câmera parada. O vídeo aparece como foi gravado.',
            natural:
              'A câmera reage às pausas, aos números e às viradas da fala — e fica parada entre um ponto e outro.',
            suave: 'Deriva lenta, fechando e abrindo a cada cena. Não cansa em vídeo longo.',
            ritmo: 'Um estalo a cada bloco de legenda. Mecânico de propósito, para conteúdo acelerado.',
          }[p.movimento]}
        </p>
      </section>

      <section className="bloco">
        <h2>Transições nos cortes</h2>
        <p className="dica">
          {p.cortes.length
            ? `${p.cortes.filter((c) => c.ativo).length} de ${p.cortes.length} cortes com transição. A narração não é tocada.`
            : 'Nenhum corte detectado ainda. O FFmpeg acha os pontos em que a imagem vira.'}
        </p>
        <div className="fontes">
          <button
            type="button"
            className="chip chip-forte"
            onClick={p.onDetectar}
            disabled={p.detectando || !p.servidorOk}
          >
            {p.detectando ? 'Procurando…' : 'Procurar cortes'}
          </button>
        </div>
        {p.cortes.length > 0 && (
          <>
            <label className="campo">
              <span>Animação</span>
              <select
                value={p.transicao}
                onChange={(e) => p.onTransicao(e.target.value as TipoTransicao)}
              >
                {TRANSICOES.map(([id, rotulo]) => (
                  <option key={id} value={id}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
            <p className="dica">{DESCRICOES[p.transicao]}</p>
            {p.transicao !== 'off' && (
              <label className="campo">
                <span>Intensidade</span>
                <input
                  type="range"
                  min={0.3}
                  max={2}
                  step={0.1}
                  value={p.forcaTransicao}
                  onChange={(e) => p.onForcaTransicao(Number(e.target.value))}
                />
                <span>{Math.round(p.forcaTransicao * 100)}%</span>
              </label>
            )}
            {p.transicao !== 'off' && (
              <label className="campo">
                <span>Duração</span>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={p.duracaoTransicao}
                  onChange={(e) => p.onDuracaoTransicao(Number(e.target.value))}
                />
                <span>{p.duracaoTransicao.toFixed(1)}s</span>
              </label>
            )}

            <div className="campo campo-linha">
              <span>Cores do degradê</span>
              <div className="cores">
                <input
                  type="color"
                  value={p.coresTransicao?.[0] ?? p.style.highlightColor}
                  onChange={(e) =>
                    p.onCoresTransicao([
                      e.target.value,
                      p.coresTransicao?.[1] ?? p.style.highlightColor2,
                    ])
                  }
                  aria-label="Primeira cor do degradê"
                />
                <input
                  type="color"
                  value={p.coresTransicao?.[1] ?? p.style.highlightColor2}
                  onChange={(e) =>
                    p.onCoresTransicao([
                      p.coresTransicao?.[0] ?? p.style.highlightColor,
                      e.target.value,
                    ])
                  }
                  aria-label="Segunda cor do degradê"
                />
                <span
                  className="amostra-degrade"
                  style={{
                    backgroundImage: `linear-gradient(100deg, ${
                      p.coresTransicao?.[0] ?? p.style.highlightColor
                    }, ${p.coresTransicao?.[1] ?? p.style.highlightColor2})`,
                  }}
                />
                {p.coresTransicao && (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => p.onCoresTransicao(undefined)}
                    title="Voltar a usar as cores do modelo de legenda"
                  >
                    Do modelo
                  </button>
                )}
              </div>
            </div>

            <div className="campo campo-linha">
              <span>Onde entra</span>
              <div className="chips">
                <button type="button" className="chip" onClick={() => p.onTodosCortes(true)}>
                  Todos
                </button>
                <button type="button" className="chip" onClick={() => p.onTodosCortes(false)}>
                  Nenhum
                </button>
              </div>
            </div>

            <ul className="cortes">
              {p.cortes.map((c) => (
                <li key={c.t} className={c.ativo ? 'is-ativo' : ''}>
                  <label className="corte-liga">
                    <input
                      type="checkbox"
                      checked={c.ativo}
                      onChange={(e) => p.onCorte(c.t, { ativo: e.target.checked })}
                    />
                  </label>
                  <button type="button" className="tempo" onClick={() => p.onIrPara(c.t)}>
                    {formatarTempo(c.t)}
                  </button>
                  <select
                    value={c.tipo ?? ''}
                    disabled={!c.ativo}
                    onChange={(e) =>
                      p.onCorte(c.t, {
                        tipo: e.target.value ? (e.target.value as TipoTransicao) : undefined,
                      })
                    }
                    aria-label={`Animação do corte em ${formatarTempo(c.t)}`}
                  >
                    <option value="">Como o vídeo</option>
                    {TRANSICOES.filter(([id]) => id !== 'off' && id !== 'variado').map(
                      ([id, rotulo]) => (
                        <option key={id} value={id}>
                          {rotulo}
                        </option>
                      ),
                    )}
                  </select>
                  <button
                    type="button"
                    className="chip"
                    disabled={!c.ativo}
                    onClick={() => setAberto(aberto === c.t ? null : c.t)}
                    title="Duração e imagem deste corte"
                  >
                    {aberto === c.t ? '−' : '+'}
                  </button>

                  {aberto === c.t && c.ativo && (
                    <div className="corte-extra">
                      <label className="campo">
                        <span>Duração</span>
                        <input
                          type="range"
                          min={0.3}
                          max={3}
                          step={0.1}
                          value={c.duracao ?? p.duracaoTransicao}
                          onChange={(e) => p.onCorte(c.t, { duracao: Number(e.target.value) })}
                        />
                        <span>
                          {(c.duracao ?? p.duracaoTransicao).toFixed(1)}s
                          {c.duracao === undefined ? ' (do vídeo)' : ''}
                        </span>
                      </label>
                      {c.duracao !== undefined && (
                        <button
                          type="button"
                          className="chip"
                          onClick={() => p.onCorte(c.t, { duracao: undefined })}
                        >
                          Usar a duração do vídeo
                        </button>
                      )}

                      <div className="corte-imagem">
                        {c.imagem && <img src={`${SERVIDOR}/${c.imagem}`} alt="" />}
                        <label className="chip">
                          {enviando === c.t
                            ? 'Enviando…'
                            : c.imagem
                              ? 'Trocar imagem'
                              : 'Pôr uma imagem'}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            disabled={enviando === c.t}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void imagemDoCorte(c.t, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        {c.imagem && (
                          <button
                            type="button"
                            className="chip chip-perigo"
                            onClick={() => p.onCorte(c.t, { imagem: undefined })}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="bloco">
        <h2>4. Ajustes</h2>

        <label className="campo">
          <span>Tamanho</span>
          <input
            type="range"
            min={3}
            max={14}
            step={0.5}
            value={p.style.fontSize}
            onChange={(e) => p.onStyle({ fontSize: +e.target.value })}
          />
          <output>{p.style.fontSize.toFixed(1)}</output>
        </label>

        <label className="campo">
          <span>Palavras por bloco</span>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={p.style.wordsPerBlock}
            onChange={(e) => p.onStyle({ wordsPerBlock: +e.target.value })}
          />
          <output>{p.style.wordsPerBlock}</output>
        </label>

        <label className="campo">
          <span>Margem segura</span>
          <input
            type="range"
            min={4}
            max={20}
            step={1}
            value={p.style.safeMargin}
            onChange={(e) => p.onStyle({ safeMargin: +e.target.value })}
          />
          <output>{p.style.safeMargin}%</output>
        </label>

        <div className="campo campo-linha">
          <span>Posição</span>
          <div className="chips">
            {posicoes.map(([nome, v]) => (
              <button
                key={nome}
                type="button"
                className={`chip ${Math.round(p.style.positionY) === v ? 'is-active' : ''}`}
                onClick={() => p.onStyle({ positionY: v })}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>

        <div className="campo campo-linha">
          <span>Cores</span>
          <div className="cores">
            <label>
              <input
                type="color"
                value={p.style.color}
                onChange={(e) => p.onStyle({ color: e.target.value })}
              />
              texto
            </label>
            <label>
              <input
                type="color"
                value={p.style.highlightColor}
                onChange={(e) => p.onStyle({ highlightColor: e.target.value })}
              />
              destaque
            </label>
            {p.style.highlightStyle === 'gradient' && p.style.highlightWords && (
              <label>
                <input
                  type="color"
                  value={p.style.highlightColor2}
                  onChange={(e) => p.onStyle({ highlightColor2: e.target.value })}
                />
                destaque 2
              </label>
            )}
            {(p.style.highlightStyle === 'box' || p.style.highlightStyle === 'underline') &&
              p.style.highlightWords && (
                <label>
                  <input
                    type="color"
                    value={p.style.highlightBg}
                    onChange={(e) => p.onStyle({ highlightBg: e.target.value })}
                  />
                  {p.style.highlightStyle === 'box' ? 'caixa' : 'traço'}
                </label>
              )}
          </div>
        </div>

        <div className="campo campo-linha">
          <span>Fundo</span>
          <div className="chips">
            {(['none', 'shadow', 'box', 'stroke'] as const).map((b) => (
              <button
                key={b}
                type="button"
                className={`chip ${p.style.backdrop === b ? 'is-active' : ''}`}
                onClick={() => p.onStyle({ backdrop: b })}
              >
                {{ none: 'Nenhum', shadow: 'Sombra', box: 'Caixa', stroke: 'Contorno' }[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="campo campo-linha">
          <span>Animação</span>
          <div className="chips">
            {(['none', 'fade', 'pop', 'slide-up', 'typewriter'] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${p.style.animation === a ? 'is-active' : ''}`}
                onClick={() => p.onStyle({ animation: a })}
              >
                {{ none: 'Sem', fade: 'Fade', pop: 'Pop', 'slide-up': 'Subir', typewriter: 'Máquina' }[a]}
              </button>
            ))}
          </div>
        </div>

        {p.style.highlightWords && (
          <div className="campo campo-linha">
            <span>Destaque</span>
            <div className="chips">
              {(['color', 'box', 'underline', 'scale', 'gradient'] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`chip ${p.style.highlightStyle === h ? 'is-active' : ''}`}
                  onClick={() => p.onStyle({ highlightStyle: h })}
                >
                  {
                    {
                      color: 'Cor',
                      box: 'Caixa',
                      underline: 'Sublinhado',
                      scale: 'Maior',
                      gradient: 'Gradiente',
                    }[h]
                  }
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="campo campo-check">
          <input
            type="checkbox"
            checked={p.style.highlightWords}
            onChange={(e) => p.onStyle({ highlightWords: e.target.checked })}
          />
          <span>Destacar palavra falada</span>
        </label>

        <div className="campo campo-linha">
          <span>Trocar fonte sozinho</span>
          <div className="chips">
            {(['off', 'chave', 'alternada'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${p.style.autoEnfase === m ? 'is-active' : ''}`}
                onClick={() => p.onStyle({ autoEnfase: m })}
              >
                {{ off: 'Não', chave: 'Palavra-chave', alternada: 'A cada 3' }[m]}
              </button>
            ))}
          </div>
        </div>

        {[0, 1].map((i) => {
          const e = p.style.emphases[i];
          const trocar = (patch: Partial<Emphasis>) => {
            const par: [Emphasis, Emphasis] = [...p.style.emphases] as [Emphasis, Emphasis];
            par[i] = { ...par[i], ...patch };
            p.onStyle({ emphases: par });
          };
          return (
            <div className="campo enfase" key={i}>
              <span>
                Ênfase {i + 1} <code>{i === 0 ? '*palavra*' : '**palavra**'}</code>
              </span>
              <div className="enfase-linha">
                <select
                  value={e.fontFamily}
                  onChange={(ev) => trocar({ fontFamily: ev.target.value })}
                  aria-label={`Fonte da ênfase ${i + 1}`}
                >
                  {FONTES.map((f) => (
                    <option key={f.id} value={f.css}>
                      {f.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="color"
                  value={e.color}
                  onChange={(ev) => trocar({ color: ev.target.value })}
                  aria-label={`Cor da ênfase ${i + 1}`}
                />
              </div>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${e.italic ? 'is-active' : ''}`}
                  onClick={() => trocar({ italic: !e.italic })}
                >
                  Itálico
                </button>
                <button
                  type="button"
                  className={`chip ${e.uppercase ? 'is-active' : ''}`}
                  onClick={() => trocar({ uppercase: !e.uppercase })}
                >
                  Caixa alta
                </button>
              </div>
              <span className="enfase-amostra" style={{ fontFamily: e.fontFamily, color: e.color,
                fontStyle: e.italic ? 'italic' : 'normal',
                textTransform: e.uppercase ? 'uppercase' : 'none' }}>
                exemplo
              </span>
            </div>
          );
        })}

        <label className="campo campo-check">
          <input
            type="checkbox"
            checked={p.style.uppercase}
            onChange={(e) => p.onStyle({ uppercase: e.target.checked })}
          />
          <span>Caixa alta</span>
        </label>

        <label className="campo campo-check">
          <input
            type="checkbox"
            checked={p.style.italic}
            onChange={(e) => p.onStyle({ italic: e.target.checked })}
          />
          <span>Itálico</span>
        </label>
      </section>
    </aside>
  );
}
