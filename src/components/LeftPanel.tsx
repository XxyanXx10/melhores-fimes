import type { CaptionStyle, Template } from '../types';

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
};

const posicoes: Array<[string, number]> = [
  ['Alta', 30],
  ['Meio', 50],
  ['Padrão', 72],
  ['Baixa', 84],
];

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
        <p className="dica">
          Vertical (9:16) fica melhor. Sem vídeo, a prévia usa um fundo de exemplo — sem som.
        </p>
      </section>

      <section className="bloco">
        <h2>3. Estilo</h2>
        <div className="cards">
          {p.templates.map((t) => (
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
        {p.modificado && (
          <button type="button" className="ghost" onClick={p.onResetar}>
            Voltar ao padrão do cartão
          </button>
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

        <label className="campo campo-check">
          <input
            type="checkbox"
            checked={p.style.highlightWords}
            onChange={(e) => p.onStyle({ highlightWords: e.target.checked })}
          />
          <span>Destacar palavra falada</span>
        </label>

        <label className="campo campo-check">
          <input
            type="checkbox"
            checked={p.style.uppercase}
            onChange={(e) => p.onStyle({ uppercase: e.target.checked })}
          />
          <span>Caixa alta</span>
        </label>
      </section>
    </aside>
  );
}
