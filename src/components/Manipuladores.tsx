import { useEffect, useRef, useState } from 'react';
import type { Cartao, Foto } from '../types';

type Alvo = { id: string; tipo: 'foto' | 'cartao'; x: number; y: number; largura: number; rotulo: string };

type Props = {
  fotos: Foto[];
  cartoes: Cartao[];
  /** instante da prévia: só mexemos no que está na tela agora */
  tempo: number;
  onMover: (tipo: 'foto' | 'cartao', id: string, pos: { x: number; y: number }) => void;
  onLargura: (tipo: 'foto' | 'cartao', id: string, largura: number) => void;
};

/**
 * Alças para arrastar foto e cartão direto na prévia.
 *
 * Antes a posição era só um número num slider, e dava para cobrir o rosto
 * de quem fala sem perceber. Aqui você vê onde está e arrasta.
 *
 * As coordenadas são em % do quadro, então a alça funciona igual em
 * qualquer tamanho de prévia — o que se arrasta é a mesma coisa que o
 * render vai usar.
 */
export function Manipuladores(p: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState<{ alvo: Alvo; modo: 'mover' | 'largura' } | null>(null);

  const alvos: Alvo[] = [
    ...p.fotos
      .filter((f) => p.tempo >= f.start && p.tempo <= f.start + f.duracao)
      .map((f) => ({ id: f.id, tipo: 'foto' as const, x: f.x, y: f.y, largura: f.largura, rotulo: 'foto' })),
    ...p.cartoes
      .filter((c) => p.tempo >= c.start && p.tempo <= c.start + c.duracao)
      .map((c) => ({
        id: c.id,
        tipo: 'cartao' as const,
        x: c.x,
        y: c.y,
        largura: c.largura,
        rotulo: c.titulo || 'cartão',
      })),
  ];

  useEffect(() => {
    if (!arrastando) return;

    const mover = (e: PointerEvent) => {
      const caixa = area.current?.getBoundingClientRect();
      if (!caixa) return;
      const px = ((e.clientX - caixa.left) / caixa.width) * 100;
      const py = ((e.clientY - caixa.top) / caixa.height) * 100;
      const { alvo, modo } = arrastando;
      if (modo === 'mover') {
        p.onMover(alvo.tipo, alvo.id, {
          x: Math.round(Math.min(95, Math.max(5, px))),
          y: Math.round(Math.min(95, Math.max(5, py))),
        });
      } else {
        // a largura cresce para os dois lados a partir do centro
        const nova = Math.abs(px - alvo.x) * 2;
        p.onLargura(alvo.tipo, alvo.id, Math.round(Math.min(98, Math.max(20, nova))));
      }
    };
    const soltar = () => setArrastando(null);

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [arrastando, p]);

  if (!alvos.length) return null;

  return (
    <div className="manipuladores" ref={area}>
      {alvos.map((a) => (
        <div key={`${a.tipo}-${a.id}`} className="alca-grupo" style={{ left: `${a.x}%`, top: `${a.y}%` }}>
          <div className="alca-largura" style={{ width: `${a.largura}%` }} aria-hidden />
          <button
            type="button"
            className={`alca alca-${a.tipo}`}
            onPointerDown={(e) => {
              e.preventDefault();
              setArrastando({ alvo: a, modo: 'mover' });
            }}
            title={`Arraste para mover ${a.rotulo}`}
          >
            {a.rotulo}
          </button>
          <button
            type="button"
            className="alca-canto"
            style={{ left: `${a.largura / 2}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              setArrastando({ alvo: a, modo: 'largura' });
            }}
            title="Arraste para mudar a largura"
            aria-label={`Largura de ${a.rotulo}`}
          />
        </div>
      ))}
    </div>
  );
}
