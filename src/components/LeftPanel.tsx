import type { CaptionStyle, Emphasis, Movimento, Template, TipoTransicao } from '../types';
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
  cortes: number[];
  transicao: TipoTransicao;
  onTransicao: (t: TipoTransicao) => void;
  forcaTransicao: number;
  onForcaTransicao: (v: number) => void;
  detectando: boolean;
  onDetectar: () => void;
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
            ? `${p.cortes.length} cortes encontrados. A narração não é tocada — a animação passa por cima.`
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
            <div className="campo campo-linha">
              <span>Animação</span>
              <div className="chips">
                {(['off', 'flash', 'whip', 'zoom', 'cortina'] as const).map((tt) => (
                  <button
                    key={tt}
                    type="button"
                    className={`chip ${p.transicao === tt ? 'is-active' : ''}`}
                    onClick={() => p.onTransicao(tt)}
                  >
                    {
                      {
                        off: 'Nenhuma',
                        flash: 'Clarão',
                        whip: 'Chicote',
                        zoom: 'Estalo',
                        cortina: 'Cortina',
                      }[tt]
                    }
                  </button>
                ))}
              </div>
            </div>
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
