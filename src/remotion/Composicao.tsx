import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { CaptionStyle, Foto as FotoSpec, Movimento, Word } from '../types';
import { agrupar, blocoAtivo, palavraAtiva, ultimaIniciada } from '../blocks';
import { estadoZoom, gerarZooms } from '../zoom';
import { defaultTemplateId, resolverEstilo } from '../data/templates';
import { Foto } from './Foto';
import { Legenda } from './Legenda';
import { carregarFontes } from './fontes';

carregarFontes();

/** dados do vídeo de origem, para a composição nascer do tamanho certo */
export type Meta = {
  duracao: number;
  fps: number;
  largura: number;
  altura: number;
};

export type PropsComposicao = {
  /** blob: no navegador, caminho absoluto no render — a composição não se importa */
  videoSrc: string | null;
  palavras: Word[];
  /** id do cartão em data/templates.ts */
  template: string;
  /** ajustes do usuário por cima do cartão */
  estiloOverride: Partial<CaptionStyle>;
  movimento: Movimento;
  forcaZoom: number;
  fotos: FotoSpec[];
  /** só o render usa: define duração e tamanho da composição */
  meta?: Meta;
};

export const propsPadrao: PropsComposicao = {
  videoSrc: null,
  palavras: [],
  template: defaultTemplateId,
  estiloOverride: {},
  movimento: 'off',
  forcaZoom: 1,
  fotos: [],
};

/**
 * A composição do vídeo. É esta mesma que o Remotion Player desenha na
 * prévia e que o Remotion Renderer usa para gerar o MP4 — não existe
 * segunda implementação em lugar nenhum.
 *
 * Tudo que ela sabe vem das props (o EditSpec). Ela não importa nada de
 * `components/` nem depende do app.css, senão o render sairia diferente
 * da prévia.
 */
export function Composicao(props: PropsComposicao) {
  const { videoSrc, palavras, template, estiloOverride, movimento, forcaZoom, fotos } = props;
  const estilo = resolverEstilo(template, estiloOverride);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: largura } = useVideoConfig();
  const t = frame / fps;

  // o mesmo cálculo de câmera de antes: função pura de tempo, agora alimentada pelo frame
  const blocos = agrupar(palavras, estilo.wordsPerBlock);
  const bloco = blocoAtivo(blocos, t);
  // no navegador o vídeo é um blob:, no render é um arquivo dentro de public/
  const fonteVideo = videoSrc && /^(blob:|https?:|data:)/.test(videoSrc) ? videoSrc : videoSrc ? staticFile(videoSrc) : null;
  const zooms = gerarZooms(
    movimento,
    blocos,
    [],
    durationInFrames / fps,
    forcaZoom,
    estilo.autoEnfase,
    palavras,
  );
  const camera = estadoZoom(zooms, t);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {fonteVideo && (
        <AbsoluteFill
          style={{
            transform: `scale(${camera.escala})`,
            transformOrigin: camera.origem,
          }}
        >
          <OffthreadVideo
            src={fonteVideo}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      )}

      {fotos.map((f) => (
        <Sequence
          key={f.id}
          from={Math.round(f.start * fps)}
          durationInFrames={Math.max(1, Math.round(f.duracao * fps))}
        >
          <Foto foto={f} />
        </Sequence>
      ))}

      <Legenda
        bloco={bloco}
        ativa={palavraAtiva(bloco, t)}
        revelada={ultimaIniciada(bloco, t)}
        style={estilo}
        largura={largura}
      />
    </AbsoluteFill>
  );
}
