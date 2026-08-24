import { Composition, registerRoot } from 'remotion';
import { Composicao, propsPadrao, type PropsComposicao } from './Composicao';

/**
 * Ponto de entrada do Remotion CLI e do Renderer.
 * A interface (Vite) não passa por aqui — ela monta o <Player> direto
 * com o mesmo componente `Composicao`.
 *
 * As dimensões e o fps reais vêm do EditSpec em tempo de render, via
 * `calculateMetadata`, para acompanharem o vídeo de origem.
 */
registerRoot(() => (
  <Composition
    id="video"
    component={Composicao}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={propsPadrao}
    calculateMetadata={({ props }: { props: PropsComposicao }) => {
      const meta = props.meta;
      if (!meta) return {};
      return {
        durationInFrames: Math.max(1, Math.round(meta.duracao * meta.fps)),
        fps: meta.fps,
        width: meta.largura,
        height: meta.altura,
      };
    }}
  />
));
