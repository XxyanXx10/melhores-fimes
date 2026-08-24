type Props = {
  passos: string[];
  atual: number;
  concluidos: boolean[];
  onSelect: (i: number) => void;
};

export function StepBar({ passos, atual, concluidos, onSelect }: Props) {
  return (
    <nav className="steps" aria-label="Fluxo">
      {passos.map((p, i) => (
        <button
          key={p}
          className={`step ${i === atual ? 'is-active' : ''} ${concluidos[i] ? 'is-done' : ''}`}
          onClick={() => onSelect(i)}
          type="button"
        >
          <span className="step-num">{concluidos[i] && i !== atual ? '✓' : i + 1}</span>
          <span className="step-label">{p}</span>
        </button>
      ))}
    </nav>
  );
}
