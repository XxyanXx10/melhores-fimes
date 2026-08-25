import { useState } from 'react';
import type { Preset } from '../types';

type Props = {
  presets: Preset[];
  /** já existe um estilo aplicado? qual */
  aplicado: string | null;
  onAplicar: (p: Preset) => void;
  onSalvar: (nome: string) => void;
  onApagar: (id: string) => void;
  /** false enquanto o serviço local não responde */
  ativo: boolean;
};

/**
 * Estilo de marca: o que se repete de um vídeo para outro.
 *
 * Sem isto, cada corte recomeça do zero — escolher modelo, cores, zoom,
 * transição. Com vários vídeos por semana, é aí que o tempo vai embora.
 */
export function PresetsBarra(p: Props) {
  const [nomeando, setNomeando] = useState(false);
  const [nome, setNome] = useState('');

  return (
    <div className="presets">
      <span className="presets-rotulo">Estilo</span>

      <select
        value={p.aplicado ?? ''}
        disabled={!p.ativo || !p.presets.length}
        onChange={(e) => {
          const alvo = p.presets.find((x) => x.id === e.target.value);
          if (alvo) p.onAplicar(alvo);
        }}
      >
        <option value="">{p.presets.length ? 'Escolha um estilo…' : 'Nenhum estilo salvo'}</option>
        {p.presets.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nome}
          </option>
        ))}
      </select>

      {nomeando ? (
        <>
          <input
            type="text"
            value={nome}
            autoFocus
            placeholder="nome do estilo"
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nome.trim()) {
                p.onSalvar(nome.trim());
                setNome('');
                setNomeando(false);
              }
              if (e.key === 'Escape') setNomeando(false);
            }}
          />
          <button
            type="button"
            className="chip chip-forte"
            disabled={!nome.trim()}
            onClick={() => {
              p.onSalvar(nome.trim());
              setNome('');
              setNomeando(false);
            }}
          >
            Salvar
          </button>
          <button type="button" className="chip" onClick={() => setNomeando(false)}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="chip"
            disabled={!p.ativo}
            onClick={() => setNomeando(true)}
            title="Guardar modelo, cores, zoom e transição como um estilo reutilizável"
          >
            Salvar estilo atual
          </button>
          {p.aplicado && (
            <button
              type="button"
              className="chip chip-perigo"
              onClick={() => p.onApagar(p.aplicado as string)}
              title="Apagar este estilo"
            >
              ×
            </button>
          )}
        </>
      )}
    </div>
  );
}
