import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Cartao as CartaoSpec } from '../types';

/**
 * Cartão de apoio: título e uma lista de itens que entram um a um.
 *
 * Existe para não precisar exportar imagem de fora. Como é componente,
 * o texto continua editável na plataforma e a entrada é animada de
 * verdade — cada item chega no seu tempo, não tudo de uma vez.
 */
export function Cartao({ cartao, largura }: { cartao: CartaoSpec; largura: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrada = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  const saida = interpolate(frame, [durationInFrames - fps * 0.35, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // o tamanho da fonte acompanha o quadro, para o cartão valer em qualquer resolução
  const px = (v: number) => (v / 100) * largura;
  const fonteItem = px(cartao.largura * 0.088);
  const fonteTitulo = px(cartao.largura * 0.042);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${cartao.x}%`,
        top: `${cartao.y}%`,
        width: `${cartao.largura}%`,
        transform: `translate(-50%, -50%) scale(${interpolate(entrada, [0, 1], [0.9, 1])})`,
        opacity: saida,
        background: cartao.cor,
        borderRadius: px(1.6),
        padding: `${px(2.2)}px ${px(2.6)}px`,
        borderLeft: `${px(0.55)}px solid ${cartao.destaque}`,
        boxShadow: '0 1.5% 5% rgba(0,0,0,.5)',
      }}
    >
      {cartao.titulo && (
        <div
          style={{
            fontFamily: "'Poppins', Inter, sans-serif",
            fontWeight: 600,
            fontSize: fonteTitulo,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: cartao.destaque,
            marginBottom: px(1.4),
            opacity: entrada,
          }}
        >
          {cartao.titulo}
        </div>
      )}

      {cartao.itens.map((item, i) => {
        // cada item espera a sua vez: 5 quadros de diferença entre eles
        const meu = spring({
          frame: frame - i * 5,
          fps,
          config: { damping: 200, mass: 0.6 },
        });
        const ultimo = i === cartao.itens.length - 1;
        return (
          <div
            key={`${cartao.id}-${i}`}
            style={{
              fontFamily: "'Anton', Inter, sans-serif",
              fontSize: fonteItem,
              lineHeight: 1.25,
              color: ultimo ? cartao.destaque : '#ffffff',
              opacity: meu,
              transform: `translateX(${interpolate(meu, [0, 1], [-8, 0])}%)`,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
}
