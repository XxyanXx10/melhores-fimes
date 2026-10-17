import { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  CaptionStyle,
  Cartao as CartaoSpec,
  CenaRemotion,
  CoresTransicao,
  Corte,
  Divisao as DivisaoSpec,
  Foto as FotoSpec,
  Som as SomSpec,
  Movimento,
  TipoTransicao,
  Word,
  Zoom,
} from '../types';
import { agrupar, blocoAtivo, palavraAtiva, ultimaIniciada } from '../blocks';
import { estadoZoom, gerarZooms } from '../zoom';
import { defaultTemplateId, resolverEstilo } from '../data/templates';
import { Foto } from './Foto';
import { Cartao } from './Cartao';
import { CenaAnimada } from './CenaAnimada';
import {
  Divisao,
  fatorTamanho,
  progressoDivisao,
  regiaoPrincipal,
  regiaoPrincipalCaixa,
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
  /** zooms marcados à mão: valem antes dos automáticos */
  zoomsManuais?: Zoom[];
  fotos: FotoSpec[];
  /** música de fundo e efeitos sonoros */
  sons: SomSpec[];
  cartoes: CartaoSpec[];
  /** cenas dinâmicas nativas do Remotion (ChatGPT, Contexto IA, Checklist, etc.) */
  cenasRemotion?: CenaRemotion[];
  divisoes: DivisaoSpec[];
  /** cortes já existentes no vídeo, e como cobri-los */
  cortes: Corte[];
  transicao: TipoTransicao;
  forcaTransicao: number;
  /** quanto tempo a transição fica na tela, em segundos */
  duracaoTransicao: number;
  /** ausente = herda as cores de destaque do modelo de legenda */
  coresTransicao?: CoresTransicao;
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
  sons: [],
  cartoes: [],
  cenasRemotion: [],
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
    zoomsManuais,
    fotos,
    sons,
    cartoes,
    cenasRemotion,
    divisoes,
    cortes,
    transicao,
    forcaTransicao,
    duracaoTransicao,
    coresTransicao,
  } = props;
  const estilo = resolverEstilo(template, estiloOverride);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: largura } = useVideoConfig();
  const t = frame / fps;

  /*
   * Agrupar as palavras em blocos e gerar os trechos de zoom envolve
   * varrer a transcrição inteira (pontuar, afinar momentos...). Isso é
   * caro, e antes rodava de novo a CADA frame — 30x por segundo durante
   * a prévia — porque a função é chamada direto no corpo do componente,
   * que o Player re-executa a cada frame. Numa máquina sem sobra de CPU
   * isso é o que faz o zoom "tremer" e a prévia engasgar bem na hora dos
   * cortes/transições. Nada disso depende do frame atual — só de
   * memoizar, calculado de novo apenas quando o projeto muda de verdade.
   */
  const blocos = useMemo(
    () => agrupar(palavras, estilo.wordsPerBlock),
    [palavras, estilo.wordsPerBlock],
  );
  const duracaoTotal = durationInFrames / fps;
  const zooms = useMemo(
    () => [
      ...(zoomsManuais ?? []),
      ...gerarZooms(movimento, blocos, [], duracaoTotal, forcaZoom, estilo.autoEnfase, palavras),
    ],
    [zoomsManuais, movimento, blocos, duracaoTotal, forcaZoom, estilo.autoEnfase, palavras],
  );
  const bloco = blocoAtivo(blocos, t);
  // no navegador o vídeo é um blob:, no render é um arquivo dentro de public/
  const fonteVideo = videoSrc && /^(blob:|https?:|data:)/.test(videoSrc) ? videoSrc : videoSrc ? staticFile(videoSrc) : null;
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
  // sem cor escolhida, a transição herda o destaque do modelo de legenda
  const coresDoCorte: CoresTransicao = coresTransicao ?? [estilo.highlightColor, estilo.highlightColor2];

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
              // camada própria na GPU: sem isto o navegador arredonda a
              // escala para pixel inteiro a cada quadro e a imagem treme
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            <OffthreadVideo
              src={fonteVideo}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      )}

      {/*
       * O <Sequence> não é enfeite: sem ele, o OffthreadVideo lá dentro usa o
       * frame ABSOLUTO da composição para escolher o quadro do clipe. Uma
       * divisão que começa aos 34s pedia o segundo 34 de um clipe de 12s — o
       * arquivo já tinha acabado, e o que aparecia era o último quadro dele,
       * parado, pelo resto da divisão. Com a Sequence, o clipe começa do
       * princípio quando a divisão entra, que é o que se espera.
       */}
      {divisao && (
        <Sequence
          key={divisao.id}
          from={Math.round(divisao.start * fps)}
          durationInFrames={Math.max(1, Math.round(divisao.duracao * fps))}
        >
          <Divisao divisao={divisao} progresso={progresso} />
        </Sequence>
      )}

      <Transicao
        tipo={tipoCorte}
        p={pTransicao}
        forca={forcaTransicao}
        cores={coresDoCorte}
        direcao={direcaoCorte}
        andamento={andamentoCorte}
        imagem={agora?.corte.imagem}
      />

      {/* b-roll marcado como fundo fica embaixo das cenas animadas */}
      {fotos
        .filter((f) => f.camada === 'fundo')
        .map((f) => (
          <Sequence
            key={f.id}
            from={Math.round(f.start * fps)}
            durationInFrames={Math.max(1, Math.round(f.duracao * fps))}
            premountFor={Math.round(fps * 1.5)}
          >
            <Foto foto={f} />
          </Sequence>
        ))}

      {(cenasRemotion ?? []).map((cr) => (
        <Sequence
          key={cr.id}
          from={Math.round(cr.start * fps)}
          durationInFrames={Math.max(1, Math.round(cr.duracao * fps))}
        >
          <CenaAnimada cena={cr} largura={largura} />
        </Sequence>
      ))}

      {cartoes.map((c) => (
        <Sequence
          key={c.id}
          from={Math.round(c.start * fps)}
          durationInFrames={Math.max(1, Math.round(c.duracao * fps))}
        >
          <Cartao cartao={c} largura={largura} />
        </Sequence>
      ))}

      {/*
       * Sons: cada um numa Sequence própria, então o frame de dentro começa em
       * 0 quando o som entra — é isso que faz o fade valer igual no Player e
       * no render. `duracao` 0 = até o fim do vídeo.
       */}
      {(sons ?? []).map((s) => {
        /* duracao 0 só vale para a música (até o fim). Um efeito sem duração ficava
           montado até o fim do vídeo e, somando vários, estourava o limite de
           áudios do Player (5) — a prévia quebrava no 6º. Efeito dura o que o
           áudio dura; se não souber, 6 s (sobra, o arquivo acaba antes). */
        const resto = Math.max(0.1, durationInFrames / fps - s.start);
        const dur = s.duracao > 0 ? s.duracao : s.tipo === 'efeito' ? Math.min(6, resto) : resto;
        const quadros = Math.max(1, Math.round(dur * fps));
        return (
          <Sequence key={s.id} from={Math.round(s.start * fps)} durationInFrames={quadros}>
            <Audio
              src={/^(blob:|https?:|data:)/.test(s.src) ? s.src : staticFile(s.src)}
              loop={s.repetir}
              volume={(f) => {
                const entra = s.fadeIn > 0 ? interpolate(f, [0, s.fadeIn * fps], [0, 1], { extrapolateRight: 'clamp' }) : 1;
                const sai = s.fadeOut > 0 ? interpolate(f, [quadros - s.fadeOut * fps, quadros], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
                // a música abaixa em momentos marcados (rampa curta para não estalar)
                const agora = s.start + f / fps;
                let queda = 1;
                for (const q of s.quedas ?? []) {
                  const rampa = 0.12;
                  const dentro = Math.min(
                    1,
                    Math.max(0, Math.min((agora - q.start) / rampa, (q.start + q.duracao - agora) / rampa)),
                  );
                  queda *= 1 - (1 - q.volume) * dentro;
                }
                return Math.max(0, Math.min(1, s.volume * entra * sai * queda));
              }}
            />
          </Sequence>
        );
      })}

      {fotos.filter((f) => f.camada !== 'fundo').map((f) => (
        <Sequence
          key={f.id}
          from={Math.round(f.start * fps)}
          durationInFrames={Math.max(1, Math.round(f.duracao * fps))}
          // b-roll em vídeo começa a carregar 1,5 s antes: sem isto a prévia engasga em cada corte
          premountFor={/\.(mp4|mov|webm)$/i.test(f.src) ? Math.round(fps * 1.5) : 0}
        >
          <Foto foto={f} />
          {/* imagem em tela cheia: sombra embaixo para a legenda não sumir em cima de foto clara */}
          {f.cobrir && (
            <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,.62) 64%, rgba(0,0,0,.78) 100%)', pointerEvents: 'none' }} />
          )}
        </Sequence>
      ))}

      {/*
       * `regiao` é o pedaço de tela que o vídeo principal de fato ocupa —
       * o quadro inteiro, ou só o que sobra quando uma tela dividida
       * encolhe ele pra um lado. Sem passar isto, "Posição" (Alta/Meio/
       * Padrão/Baixa) era sempre relativa ao quadro inteiro: a legenda
       * tanto podia cair em cima da mídia extra quanto ficar espremida
       * no rosto da pessoa, porque a % não acompanhava o encolhimento.
       * A legenda continua por cima de tudo (cartões, fotos, transição),
       * só a posição dela é que passa a levar a divisão em conta.
       */}
      <Legenda
        bloco={bloco}
        ativa={palavraAtiva(bloco, t)}
        revelada={ultimaIniciada(bloco, t)}
        style={estilo}
        largura={largura}
        regiao={regiaoPrincipalCaixa(divisao, divisao ? fatorTamanho(divisao, progresso) : 0)}
      />
    </AbsoluteFill>
  );
}
