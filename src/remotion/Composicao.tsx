import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  CaptionStyle,
  Corte,
  Divisao as DivisaoSpec,
  Foto as FotoSpec,
  Movimento,
  TipoTransicao,
  Word,
} from '../types';
import { agrupar, blocoAtivo, palavraAtiva, ultimaIniciada } from '../blocks';
import { estadoZoom, gerarZooms } from '../zoom';
import { defaultTemplateId, resolverEstilo } from '../data/templates';
import { Foto } from './Foto';
import {
  Divisao,
  fatorTamanho,
  progressoDivisao,
  regiaoPrincipal,
} from './Divisao';
import { Legenda } from './Legenda';
import {
  andamento,
  efeitoNoVideo,
  corteAgora,
  pulso,
  tipoDoCorte,
  Transicao,
} from './Transicao';
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
  divisoes: DivisaoSpec[];
  /** cortes já existentes no vídeo, e como cobri-los */
  cortes: Corte[];
  transicao: TipoTransicao;
  forcaTransicao: number;
  /** quanto tempo a transição fica na tela, em segundos */
  duracaoTransicao: number;
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
  divisoes: [],
  cortes: [],
  transicao: 'off',
  forcaTransicao: 1,
  duracaoTransicao: 0.5,
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
  const {
    videoSrc,
    palavras,
    template,
    estiloOverride,
    movimento,
    forcaZoom,
    fotos,
    divisoes,
    cortes,
    transicao,
    forcaTransicao,
    duracaoTransicao,
  } = props;
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
  const divisao = divisoes.find((d) => t >= d.start && t <= d.start + d.duracao);
  const progresso = divisao ? progressoDivisao(divisao, t, fps) : 0;

  // a transição cobre a virada por meio segundo; o áudio segue intacto
  const agora = transicao === 'off' ? null : corteAgora(cortes, t, duracaoTransicao);
  // a janela é a do corte, que pode ter duração própria
  const JANELA = agora?.duracao ?? duracaoTransicao;
  const pTransicao = agora ? pulso(t, agora.corte.t, JANELA) : 0;
  // o corte pode ter animação própria; senão herda a do vídeo todo
  const tipoCorte = agora ? agora.corte.tipo ?? tipoDoCorte(transicao, agora.posicao) : 'off';
  const direcaoCorte = agora ? (t < agora.corte.t ? 1 : -1) : 1;
  const andamentoCorte = agora ? andamento(t, agora.corte.t, JANELA) : 0;
  const efeitoCorte = efeitoNoVideo(tipoCorte, pTransicao, forcaTransicao, direcaoCorte);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* O principal ocupa o quadro inteiro, ou só a parte que a divisão
          deixa livre. As duas regiões são complementares: nunca sobra faixa. */}
      {fonteVideo && (
        <div
          style={{
            position: 'absolute',
            overflow: 'hidden',
            ...regiaoPrincipal(divisao, divisao ? fatorTamanho(divisao, progresso) : 0),
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              // o movimento do corte soma ao do zoom, não substitui
              transform: `scale(${camera.escala}) ${efeitoCorte.transform}`,
              transformOrigin: camera.origem,
              filter: efeitoCorte.filter,
            }}
          >
            <OffthreadVideo
              src={fonteVideo}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      )}

      {divisao && <Divisao divisao={divisao} progresso={progresso} />}

      <Transicao
        tipo={tipoCorte}
        p={pTransicao}
        forca={forcaTransicao}
        estilo={estilo}
        direcao={direcaoCorte}
        andamento={andamentoCorte}
        imagem={agora?.corte.imagem}
      />

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
