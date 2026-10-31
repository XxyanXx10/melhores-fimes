import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Word } from '../types';
import { carregarFontes } from './fontes';
import { PALAVRAS_WHISPER_HUB_PORT1 } from './palavrasHubPort1';

carregarFontes();

const COR_PORT1 = '#c81e24';
const COR_TEXTO = '#0f172a';
const COR_SUB = '#64748b';
const COR_BORDA = '#e2e8f0';

export type SecaoHubPort1 = {
  id: string;
  numero: string;
  categoria: string;
  titulo: string;
  subtitulo: string;
  start: number;
  end: number;
  tipoVisual: 'intro-boneco' | 'print-login' | 'print-cursos' | 'video-parte3' | 'encerramento-boneco';
  videoSrc?: string;
  /** tópicos curtos exibidos de forma limpa e discreta */
  topicos: string[];
  focoCaixa?: { x: number; y: number; w: number; h: number; rotulo?: string; dePct?: number; atePct?: number };
};

export type PropsHubPort1 = {
  audioSrc?: string | null;
  musicaSrc?: string | null;
  volumeMusica?: number;
  palavras?: Word[];
  secoes?: SecaoHubPort1[];
  duracaoTotal?: number;
};

/**
 * Seções alinhadas com os tempos acústicos exatos extraídos pelo Whisper.
 */
export const SECOES_PADRAO_HUB_PORT1: SecaoHubPort1[] = [
  {
    id: 'intro-boneco',
    numero: 'APRESENTAÇÃO',
    categoria: 'COMUNICAÇÃO INTERNA',
    titulo: 'Hub Port1',
    subtitulo: 'Informações importantes reunidas em um só lugar para facilitar o seu dia a dia.',
    start: 0,
    end: 43.7,
    tipoVisual: 'intro-boneco',
    topicos: [
      'Regras e procedimentos de cada função',
      'Normas de vestimenta',
      'Abertura de chamados para o Suporte de TI',
      'Benefícios oferecidos pela Port1',
    ],
  },
  {
    id: 'print-login',
    numero: 'PASSO 01',
    categoria: 'ACESSO À PLATAFORMA',
    titulo: 'Portal eHunter',
    subtitulo: 'Acesse ehunter.inf.br e clique em EAD - Treinamentos',
    start: 43.7,
    end: 52.02,
    tipoVisual: 'print-login',
    topicos: ['Acesso pelo portal eHunter', 'Botão EAD - Treinamentos'],
    focoCaixa: { x: 38.8, y: 60.5, w: 13.8, h: 7.8, rotulo: 'EAD - TREINAMENTOS', dePct: 0.14, atePct: 0.92 },
  },
  {
    id: 'print-cursos',
    numero: 'PASSO 02',
    categoria: 'MEUS CURSOS',
    titulo: 'Curso Hub Port1',
    subtitulo: 'Localize o curso Hub Port1 na sua trilha de treinamentos',
    start: 52.02,
    end: 64.42,
    tipoVisual: 'print-cursos',
    videoSrc: 'midia/hub-port1/cap_cursos.mp4',
    topicos: ['Menu Meus Cursos', 'Acesso ao Hub Port1'],
    focoCaixa: { x: 38.6, y: 37.2, w: 19.4, h: 55.5, rotulo: 'Curso Hub Port1', dePct: 0.08, atePct: 0.54 },
  },
  {
    id: 'manual-colaborador',
    numero: '01',
    categoria: 'DIRETRIZES E CULTURA',
    titulo: 'Manual do Colaborador',
    subtitulo: 'História, princípios, políticas, regras, direitos e deveres',
    start: 64.42,
    end: 84.67,
    tipoVisual: 'video-parte3',
    videoSrc: 'midia/hub-port1/cap_manual.mp4',
    topicos: ['História e princípios da empresa', 'Políticas, direitos e deveres'],
  },
  {
    id: 'regras-procedimentos',
    numero: '02',
    categoria: 'PROCESSOS OPERACIONAIS',
    titulo: 'Regras de Procedimentos',
    subtitulo: 'Orientações para Telehunter, Analista Hunter e Consultor Hunter',
    start: 84.67,
    end: 105.74,
    tipoVisual: 'video-parte3',
    videoSrc: 'midia/hub-port1/cap_regras.mp4',
    topicos: ['Telehunter, Analista e Consultor Hunter', 'Status e padronização de atendimentos'],
  },
  {
    id: 'normas-vestimenta',
    numero: '03',
    categoria: 'APRESENTAÇÃO PESSOAL',
    titulo: 'Normas de Vestimenta',
    subtitulo: 'Diretrizes de vestuário e comunicação não verbal',
    start: 105.74,
    end: 123.42,
    tipoVisual: 'video-parte3',
    videoSrc: 'midia/hub-port1/cap_vestimenta.mp4',
    topicos: ['Diretrizes de vestuário da empresa', 'Alinhamento e imagem profissional'],
  },
  {
    id: 'suporte-ti',
    numero: '04',
    categoria: 'SUPORTE INTERNO',
    titulo: 'Abertura de Chamados de TI',
    subtitulo: 'Passo a passo padronizado para registrar solicitações',
    start: 123.42,
    end: 140.19,
    tipoVisual: 'video-parte3',
    videoSrc: 'midia/hub-port1/cap_ti.mp4',
    topicos: ['Passo a passo para solicitações', 'Modelo padronizado de chamado'],
  },
  {
    id: 'beneficios-flash',
    numero: '05',
    categoria: 'BENEFÍCIOS PORT1',
    titulo: 'Flash e Mobilidade',
    subtitulo: 'Orientações sobre alimentação, refeição e deslocamento',
    start: 140.19,
    end: 158.88,
    tipoVisual: 'video-parte3',
    videoSrc: 'midia/hub-port1/cap_flash.mp4',
    topicos: ['Benefício de alimentação e refeição', 'Auxílio de mobilidade'],
  },
  {
    id: 'beneficios-sesc',
    numero: '06',
    categoria: 'BENEFÍCIOS PORT1',
    titulo: 'Credencial Sesc',
    subtitulo: 'Como realizar o cadastro e consultar serviços disponíveis',
    start: 158.88,
    end: 174.28,
    tipoVisual: 'video-parte3',
    videoSrc: 'midia/hub-port1/cap_sesc.mp4',
    topicos: ['Orientações para cadastro', 'Esporte, cultura, lazer e serviços'],
  },
  {
    id: 'beneficios-portomed',
    numero: '07',
    categoria: 'BENEFÍCIOS PORT1',
    titulo: 'Plano de Saúde Portomed',
    subtitulo: 'Valores por faixa etária, reajustes e rede hospitalar',
    start: 174.28,
    end: 192.58,
    tipoVisual: 'video-parte3',
    videoSrc: 'midia/hub-port1/cap_portomed.mp4',
    topicos: ['Valores por faixa etária e reajustes', 'Rede de hospitais disponíveis'],
  },
  {
    id: 'encerramento-boneco',
    numero: 'RESUMO',
    categoria: 'ATUALIZAÇÃO CONTÍNUA',
    titulo: 'Explore o Hub Port1',
    subtitulo: 'Conteúdos sempre atualizados para uma comunicação clara, prática e eficiente.',
    start: 192.58,
    end: 226.5,
    tipoVisual: 'encerramento-boneco',
    topicos: [
      'Manual do Colaborador',
      'Regras de Procedimentos',
      'Normas de Vestimenta',
      'Suporte de TI',
      'Benefícios: Flash, Sesc e Portomed',
    ],
  },
];

const fonteDe = (src: string) => (/^(blob:|https?:|data:)/.test(src) ? src : staticFile(src));

export const propsPadraoHubPort1: PropsHubPort1 = {
  audioSrc: 'midia/hub-port1/narracao.mp3',
  musicaSrc: 'midia/musica_daylight.mp3',
  volumeMusica: 0.07,
  palavras: PALAVRAS_WHISPER_HUB_PORT1,
  secoes: SECOES_PADRAO_HUB_PORT1,
  duracaoTotal: 226.5,
};

export function HubPort1Composicao(props: PropsHubPort1) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const secoes = props.secoes && props.secoes.length > 0 ? props.secoes : SECOES_PADRAO_HUB_PORT1;
  const palavras = props.palavras && props.palavras.length > 0 ? props.palavras : PALAVRAS_WHISPER_HUB_PORT1;
  const musicaSrc = props.musicaSrc ?? 'midia/musica_daylight.mp3';
  const volumeMusica = props.volumeMusica ?? 0.07;

  // Palavra falada exatamente neste instante (sincronizada pelo Whisper)
  const palavraAtual = palavras.find((w) => t >= w.start && t <= w.end + 0.04) ?? null;
  const falandoAgora = palavraAtual !== null && t < 225.3;

  const indiceSecao = Math.max(
    0,
    secoes.findIndex((s, idx) => t >= s.start && (t < s.end || idx === secoes.length - 1)),
  );
  const secaoAtiva = secoes[indiceSecao] ?? secoes[0];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: COR_TEXTO,
        overflow: 'hidden',
      }}
    >
      {/* Fundo Branco Editorial Limpo */}
      <FundoEditorialLimpo />

      {/* Cabeçalho Institucional Minimalista */}
      <CabecalhoLimpo secao={secaoAtiva} indiceAtivo={indiceSecao} total={secoes.length} />

      {/* Sequências de cada seção */}
      {secoes.map((sec) => {
        const fromFrame = Math.max(0, Math.round(sec.start * fps));
        const durFrames = Math.max(1, Math.round((sec.end - sec.start) * fps));
        return (
          <Sequence key={sec.id} from={fromFrame} durationInFrames={durFrames} premountFor={Math.round(fps * 1.0)}>
            <CenaSecaoLimpa
              secao={sec}
              falando={falandoAgora}
              palavraTexto={palavraAtual?.text ?? ''}
            />
          </Sequence>
        );
      })}

      {/* Legenda Sincronizada Palavra por Palavra (Whisper) */}
      <LegendaSincronizadaLimpa palavras={palavras} t={t} />

      {/* Áudio da Narração */}
      {props.audioSrc && <Audio src={fonteDe(props.audioSrc)} volume={1} />}

      {/* Música de Fundo Suave (0.07) */}
      {musicaSrc && (
        <Audio
          src={fonteDe(musicaSrc)}
          loop
          volume={(f) => {
            const fadeIn = interpolate(f, [0, fps * 2], [0, 1], { extrapolateRight: 'clamp' });
            const fadeOut = interpolate(
              f,
              [Math.max(0, durationInFrames - fps * 2.5), durationInFrames],
              [1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            return volumeMusica * fadeIn * fadeOut;
          }}
        />
      )}
    </AbsoluteFill>
  );
}

/* ============================================================================
   FUNDO BRANCO EDITORIAL LIMPO
   ============================================================================ */
function FundoEditorialLimpo() {
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)',
      }}
    >
      {/* Linha superior sutil na cor institucional da Port1 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: COR_PORT1,
        }}
      />
    </AbsoluteFill>
  );
}

/* ============================================================================
   CABEÇALHO INSTITUCIONAL MINIMALISTA (SEM POLUIÇÃO VISUAL)
   ============================================================================ */
function CabecalhoLimpo({
  secao,
  indiceAtivo,
  total,
}: {
  secao: SecaoHubPort1;
  indiceAtivo: number;
  total: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 22,
        left: 64,
        right: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${COR_BORDA}`,
        paddingBottom: 14,
        zIndex: 20,
      }}
    >
      {/* Esquerda: Logo Port1 + divisor limpo + título da seção */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <Img
          src={staticFile('midia/Logo_Port1_-_consultoria_corporatira_fundo_tranparente__1___1_.png')}
          style={{ height: 42, width: 'auto', objectFit: 'contain' }}
        />
        <div style={{ width: 1, height: 30, background: '#cbd5e1' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: COR_PORT1,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {secao.numero}
          </span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: COR_TEXTO,
              letterSpacing: '-0.01em',
            }}
          >
            {secao.titulo}
          </span>
        </div>
      </div>

      {/* Direita: Indicador minimalista de progresso (barra contínua discreta) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COR_SUB,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {secao.categoria}
        </span>
        <div
          style={{
            width: 120,
            height: 4,
            background: '#e2e8f0',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(((indiceAtivo + 1) / total) * 100)}%`,
              height: '100%',
              background: COR_PORT1,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ROTEADOR DE CENA
   ============================================================================ */
function CenaSecaoLimpa({
  secao,
  falando,
  palavraTexto,
}: {
  secao: SecaoHubPort1;
  falando: boolean;
  palavraTexto: string;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrada = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const saida = interpolate(
    frame,
    [Math.max(0, durationInFrames - 8), durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const opacidade = Math.min(1, entrada * 1.3) * saida;

  if (secao.tipoVisual === 'intro-boneco') {
    return (
      <AbsoluteFill style={{ opacity: opacidade }}>
        <CenaIntroLimpa secao={secao} frame={frame} fps={fps} falando={falando} palavraTexto={palavraTexto} />
      </AbsoluteFill>
    );
  }

  if (secao.tipoVisual === 'encerramento-boneco') {
    return (
      <AbsoluteFill style={{ opacity: opacidade }}>
        <CenaEncerramentoLimpa secao={secao} frame={frame} fps={fps} falando={falando} palavraTexto={palavraTexto} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ opacity: opacidade }}>
      <CenaTelaCheiaLimpa secao={secao} frame={frame} fps={fps} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
}

/* ============================================================================
   INTRODUÇÃO LIMPA: BONEQUINHO + TIPOGRAFIA EDITORIAL EM FUNDO BRANCO
   ============================================================================ */
function CenaIntroLimpa({
  secao,
  frame,
  fps,
  falando,
  palavraTexto,
}: {
  secao: SecaoHubPort1;
  frame: number;
  fps: number;
  falando: boolean;
  palavraTexto: string;
}) {
  const t = frame / fps;
  const entrada = spring({ frame, fps, config: { damping: 16, stiffness: 100 } });

  // Tempos exatos em que cada um dos 4 itens é citado na introdução (extraídos pelo Whisper)
  const temposItens = [15.62, 18.86, 20.76, 24.56];
  const gesto: 'aceno' | 'apresenta' | 'convite' =
    t < 4.5 ? 'aceno' : t < 38.5 ? 'apresenta' : 'convite';

  return (
    <AbsoluteFill
      style={{
        paddingTop: 106,
        paddingBottom: 108,
        paddingLeft: 96,
        paddingRight: 96,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 64,
      }}
    >
      {/* Esquerda: Personagem em card editorial limpo */}
      <div
        style={{
          flex: '0 0 460px',
          height: 680,
          background: '#ffffff',
          borderRadius: 28,
          border: `1px solid ${COR_BORDA}`,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          position: 'relative',
          overflow: 'hidden',
          transform: `translateY(${interpolate(entrada, [0, 1], [24, 0])}px)`,
        }}
      >
        {/* Faixa sutil de fundo no topo do card */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 140,
            background: 'linear-gradient(180deg, rgba(200, 30, 36, 0.05) 0%, transparent 100%)',
          }}
        />

        <div style={{ width: 390, height: 470, marginBottom: 36 }}>
          <BonequinhoPort1SVG
            frame={frame}
            fps={fps}
            falando={falando}
            gesto={gesto}
            palavraTexto={palavraTexto}
          />
        </div>

        <div
          style={{
            width: '100%',
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: `1px solid ${COR_BORDA}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: COR_TEXTO }}>
            Treinamento & Integração
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: COR_PORT1,
              letterSpacing: '0.04em',
            }}
          >
            PORT1 CONSULTORIA
          </span>
        </div>
      </div>

      {/* Direita: Tipografia limpa + lista de conteúdos que acendem no tempo da voz */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: COR_PORT1,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            NOVIDADE PARA OS COLABORADORES
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: COR_TEXTO,
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
            }}
          >
            Conheça o <span style={{ color: COR_PORT1 }}>Hub Port1</span>
          </div>
          <div
            style={{
              fontSize: 22,
              color: COR_SUB,
              marginTop: 14,
              lineHeight: 1.45,
              fontWeight: 400,
              maxWidth: 760,
            }}
          >
            {secao.subtitulo}
          </div>
        </div>

        {/* Lista limpa dos 4 pilares citados na fala */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {secao.topicos.map((topico, idx) => {
            const tAtiva = temposItens[idx] ?? 15 + idx * 3;
            const jaFalou = t >= tAtiva;
            const falandoEste = t >= tAtiva && t < (temposItens[idx + 1] ?? 28.0);
            const p = spring({
              frame: Math.max(0, frame - Math.round(tAtiva * fps)),
              fps,
              config: { damping: 16, stiffness: 120 },
            });

            return (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: `1.5px solid ${falandoEste ? COR_PORT1 : jaFalou ? '#cbd5e1' : COR_BORDA}`,
                  borderLeft: `5px solid ${jaFalou ? COR_PORT1 : '#cbd5e1'}`,
                  borderRadius: 14,
                  padding: '18px 24px',
                  boxShadow: falandoEste
                    ? '0 12px 30px rgba(200, 30, 36, 0.08)'
                    : '0 4px 14px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transform: `translateX(${jaFalou ? interpolate(p, [0, 1], [12, 0]) : 0}px)`,
                  opacity: jaFalou ? 1 : 0.55,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: jaFalou ? COR_PORT1 : '#94a3b8',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    0{idx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 21,
                      fontWeight: jaFalou ? 700 : 500,
                      color: jaFalou ? COR_TEXTO : COR_SUB,
                    }}
                  >
                    {topico}
                  </span>
                </div>

                {jaFalou && (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'rgba(200, 30, 36, 0.1)',
                      color: COR_PORT1,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ============================================================================
   NAVEGAÇÃO DE TELA EM TAMANHO GRANDE E LIMPO (PRINTS 1 E 2 + GRAVAÇÃO PARTE 3)
   ============================================================================ */
function CenaTelaCheiaLimpa({
  secao,
  frame,
  fps,
  durationInFrames,
}: {
  secao: SecaoHubPort1;
  frame: number;
  fps: number;
  durationInFrames: number;
}) {
  const progresso = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const entrada = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });

  // No Passo 2 (print-cursos), exibe o Print 2 nos primeiros 55% e depois abre o curso (cap_cursos.mp4)
  const corteVideoPrint2 = Math.round(durationInFrames * 0.55);
  const mostrarVideoNoPrint2 = secao.tipoVisual === 'print-cursos' && frame >= corteVideoPrint2;

  const zoomPrint =
    secao.tipoVisual === 'print-login'
      ? interpolate(progresso, [0.1, 0.78, 1], [1, 1.18, 1.2], { easing: Easing.inOut(Easing.cubic) })
      : secao.tipoVisual === 'print-cursos' && !mostrarVideoNoPrint2
      ? interpolate(progresso, [0.08, 0.50], [1, 1.14], {
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        })
      : 1;

  const origemZoom =
    secao.tipoVisual === 'print-login'
      ? '45% 64%'
      : secao.tipoVisual === 'print-cursos'
      ? '48% 64%'
      : '50% 50%';

  const caixa = secao.focoCaixa;
  const dePct = caixa?.dePct ?? 0.14;
  const atePct = caixa?.atePct ?? 0.72;
  const mostrarCaixa = caixa && progresso >= dePct && progresso <= atePct && !mostrarVideoNoPrint2;
  const forcaCaixa = mostrarCaixa
    ? interpolate(
        progresso,
        [dePct, dePct + 0.06, atePct - 0.06, atePct],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      )
    : 0;

  return (
    <AbsoluteFill
      style={{
        paddingTop: 100,
        paddingBottom: 98,
        paddingLeft: 64,
        paddingRight: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Moldura Limpa da Tela (ocupa quase todo o quadro para leitura nítida) */}
      <div
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 1620,
          background: '#ffffff',
          borderRadius: 18,
          border: `1px solid #cbd5e1`,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.09)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          transform: `scale(${interpolate(entrada, [0, 1], [0.98, 1])})`,
        }}
      >
        {/* Barra de janela clara e discreta */}
        <div
          style={{
            height: 38,
            background: '#f1f5f9',
            borderBottom: `1px solid ${COR_BORDA}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#cbd5e1' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#cbd5e1' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#cbd5e1' }} />
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: COR_SUB }}>
              {secao.subtitulo}
            </span>
          </div>

          {/* Tópicos discretos da seção no canto direito da barra */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {secao.topicos.map((topico, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: COR_TEXTO,
                  background: '#ffffff',
                  border: `1px solid ${COR_BORDA}`,
                  padding: '3px 10px',
                  borderRadius: 6,
                }}
              >
                {topico}
              </span>
            ))}
          </div>
        </div>

        {/* Área da imagem/vídeo da plataforma */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `scale(${zoomPrint})`,
              transformOrigin: origemZoom,
            }}
          >
            {secao.tipoVisual === 'print-login' && (
              <Img
                src={staticFile('midia/hub-port1/parte1-limpa.png')}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                }}
              />
            )}

            {secao.tipoVisual === 'print-cursos' && !mostrarVideoNoPrint2 && (
              <Img
                src={staticFile('midia/hub-port1/parte2-limpa.png')}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                }}
              />
            )}

            {(secao.tipoVisual === 'video-parte3' || mostrarVideoNoPrint2) && secao.videoSrc && (
              <Sequence
                from={mostrarVideoNoPrint2 ? corteVideoPrint2 : 0}
                durationInFrames={
                  mostrarVideoNoPrint2
                    ? Math.max(1, durationInFrames - corteVideoPrint2)
                    : durationInFrames
                }
              >
                <OffthreadVideo
                  src={staticFile(secao.videoSrc)}
                  muted
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '104.5%',
                    objectFit: 'fill',
                  }}
                />
              </Sequence>
            )}

            {/* Destaque Pontual Limpo nos Prints 1 e 2 */}
            {caixa && forcaCaixa > 0.01 && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${caixa.x}%`,
                    top: `${caixa.y}%`,
                    width: `${caixa.w}%`,
                    height: `${caixa.h}%`,
                    border: `2.5px solid ${COR_PORT1}`,
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(200, 30, 36, 0.22)',
                    opacity: forcaCaixa,
                  }}
                >
                  {caixa.rotulo && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -34,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: COR_PORT1,
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {caixa.rotulo}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cursor nos Prints 1 e 2 */}
            {(secao.tipoVisual === 'print-login' || (secao.tipoVisual === 'print-cursos' && !mostrarVideoNoPrint2)) &&
              caixa && (
                <CursorLimpo
                  progresso={secao.tipoVisual === 'print-cursos' ? progresso / 0.55 : progresso}
                  alvoX={caixa.x + caixa.w * 0.52}
                  alvoY={caixa.y + caixa.h * 0.55}
                />
              )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ============================================================================
   ENCERRAMENTO LIMPO EM FUNDO BRANCO
   ============================================================================ */
function CenaEncerramentoLimpa({
  secao,
  frame,
  fps,
  falando,
  palavraTexto,
}: {
  secao: SecaoHubPort1;
  frame: number;
  fps: number;
  falando: boolean;
  palavraTexto: string;
}) {
  const entrada = spring({ frame, fps, config: { damping: 16, stiffness: 100 } });

  return (
    <AbsoluteFill
      style={{
        paddingTop: 106,
        paddingBottom: 108,
        paddingLeft: 96,
        paddingRight: 96,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 64,
      }}
    >
      {/* Esquerda: Resumo Limpo dos Conteúdos */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          transform: `translateY(${interpolate(entrada, [0, 1], [20, 0])}px)`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: COR_PORT1,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            FERRAMENTA DE APOIO AO COLABORADOR
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: COR_TEXTO,
              letterSpacing: '-0.02em',
              lineHeight: 1.12,
            }}
          >
            Acesse e explore o <span style={{ color: COR_PORT1 }}>Hub Port1</span>
          </div>
          <div
            style={{
              fontSize: 20,
              color: COR_SUB,
              marginTop: 10,
              lineHeight: 1.45,
            }}
          >
            {secao.subtitulo}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {secao.topicos.map((topico, idx) => {
            const p = spring({
              frame: Math.max(0, frame - 6 - idx * 8),
              fps,
              config: { damping: 16, stiffness: 120 },
            });
            return (
              <div
                key={idx}
                style={{
                  gridColumn: idx === 4 ? '1 / span 2' : undefined,
                  opacity: p,
                  background: '#ffffff',
                  border: `1px solid ${COR_BORDA}`,
                  borderLeft: `4px solid ${COR_PORT1}`,
                  borderRadius: 12,
                  padding: '16px 20px',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 700, color: COR_TEXTO }}>{topico}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: COR_PORT1 }}>✓</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Direita: Personagem em Card Editorial Limpo */}
      <div
        style={{
          flex: '0 0 440px',
          height: 640,
          background: '#ffffff',
          borderRadius: 28,
          border: `1px solid ${COR_BORDA}`,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: 380, height: 450, marginBottom: 32 }}>
          <BonequinhoPort1SVG
            frame={frame}
            fps={fps}
            falando={falando}
            gesto="aceno"
            palavraTexto={palavraTexto}
          />
        </div>
        <div
          style={{
            width: '100%',
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: `1px solid ${COR_BORDA}`,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: COR_TEXTO,
          }}
        >
          Disponível no portal eHunter
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ============================================================================
   CURSOR LIMPO PARA OS PRINTS 1 E 2
   ============================================================================ */
function CursorLimpo({
  progresso,
  alvoX,
  alvoY,
}: {
  progresso: number;
  alvoX: number;
  alvoY: number;
}) {
  const mov = interpolate(progresso, [0.12, 0.42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const x = interpolate(mov, [0, 1], [75, alvoX]);
  const y = interpolate(mov, [0, 1], [80, alvoY]);
  const clicando = progresso >= 0.44 && progresso <= 0.56;
  const onda = interpolate(progresso, [0.44, 0.62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (progresso < 0.08 || progresso > 0.85) return null;

  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, pointerEvents: 'none', zIndex: 30 }}>
      {onda > 0 && onda < 1 && (
        <div
          style={{
            position: 'absolute',
            left: -22,
            top: -22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: `2.5px solid ${COR_PORT1}`,
            transform: `scale(${interpolate(onda, [0, 1], [0.3, 1.9])})`,
            opacity: 1 - onda,
          }}
        />
      )}
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        style={{
          transform: `scale(${clicando ? 0.86 : 1})`,
          filter: 'drop-shadow(0 4px 8px rgba(15,23,42,0.35))',
        }}
      >
        <path
          d="M4 2L20 11L13 13L16 21L13 22L10 14L4 19V2Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ============================================================================
   PERSONAGEM VETORIAL CORPORATIVO ("BONEQUINHO PORT1")
   ============================================================================ */
function BonequinhoPort1SVG({
  frame,
  fps,
  falando,
  gesto,
  palavraTexto,
}: {
  frame: number;
  fps: number;
  falando: boolean;
  gesto: 'aceno' | 'apresenta' | 'convite';
  palavraTexto: string;
}) {
  const t = frame / fps;

  const respiraY = Math.sin(t * 2.4) * 2.5;
  const cabecaRot = falando ? Math.sin(t * 4.8) * 2.2 : Math.sin(t * 1.6) * 1.0;
  const cabecaY = falando ? Math.abs(Math.sin(t * 6.8)) * 1.8 : 0;

  const cicloPisca = t % 3.4;
  const piscando = cicloPisca > 3.24 && cicloPisca < 3.38;

  const temVogalAberta = /[aáàãâeéêoóõô]/i.test(palavraTexto);
  const aberturaBoca = falando
    ? 0.32 + Math.abs(Math.sin(t * 14.0)) * (temVogalAberta ? 0.58 : 0.38)
    : 0;

  const bracoDirRot =
    gesto === 'aceno'
      ? -34 + Math.sin(t * 7.5) * 14
      : gesto === 'convite'
      ? -20 + Math.sin(t * 4.0) * 8
      : -10 + Math.sin(t * 3.0) * 6;

  return (
    <svg viewBox="0 0 360 400" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id="blazerClean" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="peleClean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffdbb5" />
          <stop offset="100%" stopColor="#f3be8a" />
        </linearGradient>
      </defs>

      <g transform={`translate(0, ${respiraY})`}>
        <ellipse cx="180" cy="378" rx="76" ry="10" fill="rgba(15, 23, 42, 0.08)" />

        {/* Braço Esquerdo */}
        <g transform={`rotate(${Math.sin(t * 2.2) * 3}, 115, 235)`}>
          <path
            d="M115 230 C82 255, 78 295, 95 322"
            fill="none"
            stroke="url(#blazerClean)"
            strokeWidth="34"
            strokeLinecap="round"
          />
          <circle cx="96" cy="326" r="16" fill="url(#peleClean)" />
        </g>

        {/* Tronco Blazer */}
        <path
          d="M110 218 C110 202, 250 202, 250 218 L266 362 C266 372, 94 372, 94 362 Z"
          fill="url(#blazerClean)"
        />

        {/* Camisa e Gravata Institucional */}
        <polygon points="152,212 208,212 180,298" fill="#ffffff" />
        <polygon points="172,222 188,222 191,285 180,302 169,285" fill={COR_PORT1} />

        {/* Lapela */}
        <polygon points="150,210 118,246 164,288 180,298" fill="#0f172a" />
        <polygon points="210,210 242,246 196,288 180,298" fill="#0f172a" />

        {/* Pin discreto */}
        <circle cx="216" cy="262" r="5" fill={COR_PORT1} />

        {/* Braço Direito */}
        <g transform={`rotate(${bracoDirRot}, 244, 232)`}>
          <path
            d="M244 232 C282 215, 304 182, 312 148"
            fill="none"
            stroke="url(#blazerClean)"
            strokeWidth="34"
            strokeLinecap="round"
          />
          <g transform="translate(312, 142)">
            <circle cx="0" cy="0" r="17" fill="url(#peleClean)" />
          </g>
        </g>

        {/* Pescoço */}
        <rect x="163" y="186" width="34" height="34" rx="14" fill="url(#peleClean)" />

        {/* Cabeça */}
        <g transform={`translate(0, ${cabecaY}) rotate(${cabecaRot}, 180, 145)`}>
          <circle cx="104" cy="142" r="15" fill="url(#peleClean)" />
          <circle cx="256" cy="142" r="15" fill="url(#peleClean)" />

          <rect x="108" y="64" width="144" height="138" rx="64" fill="url(#peleClean)" />

          <path
            d="M104 118 C100 66, 138 42, 184 44 C228 44, 260 68, 256 118 C246 92, 224 80, 180 80 C138 80, 116 92, 104 118 Z"
            fill="#1e293b"
          />

          <path
            d={`M134 ${falando ? 107 : 110} Q148 ${falando ? 102 : 106} 162 ${falando ? 108 : 110}`}
            fill="none"
            stroke="#1e293b"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d={`M198 ${falando ? 108 : 110} Q212 ${falando ? 102 : 106} 226 ${falando ? 107 : 110}`}
            fill="none"
            stroke="#1e293b"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {piscando ? (
            <>
              <path d="M136 130 Q148 135 160 130" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M200 130 Q212 135 224 130" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse cx="148" cy="130" rx="10" ry="12" fill="#0f172a" />
              <circle cx="145" cy="126" r="3.5" fill="#ffffff" />
              <ellipse cx="212" cy="130" rx="10" ry="12" fill="#0f172a" />
              <circle cx="209" cy="126" r="3.5" fill="#ffffff" />
            </>
          )}

          {/* Óculos discretos em grafite */}
          <rect x="126" y="114" width="44" height="30" rx="9" fill="none" stroke="#334155" strokeWidth="3" />
          <rect x="190" y="114" width="44" height="30" rx="9" fill="none" stroke="#334155" strokeWidth="3" />
          <line x1="170" y1="128" x2="190" y2="128" stroke="#334155" strokeWidth="3" />

          <path d="M180 133 L177 147 L183 147" fill="none" stroke="#d99b66" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Boca sincronizada */}
          {falando && aberturaBoca > 0.15 ? (
            <g transform="translate(180, 168)">
              <path
                d={`M-19 -2 Q0 ${21 * aberturaBoca} 19 -2 Q0 ${5 * aberturaBoca} -19 -2 Z`}
                fill="#7f1d1d"
                stroke="#0f172a"
                strokeWidth="2"
              />
              <path d="M-14 -1 L14 -1 L12 3.5 L-12 3.5 Z" fill="#ffffff" />
            </g>
          ) : (
            <path
              d="M161 165 Q180 179 199 165"
              fill="none"
              stroke="#0f172a"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
        </g>
      </g>
    </svg>
  );
}

/* ============================================================================
   LEGENDA SINCRONIZADA LIMPA (AGRUPADA POR FRASES E PONTUAÇÃO REAL DO WHISPER)
   ============================================================================ */
function LegendaSincronizadaLimpa({
  palavras,
  t,
}: {
  palavras: Word[];
  t: number;
}) {
  // Agrupa as palavras respeitando pontuação final (. ? ! ,) e limite de 8 palavras por linha
  const blocos = useMemo(() => {
    const lista: { start: number; end: number; words: Word[] }[] = [];
    let atual: Word[] = [];
    for (let i = 0; i < palavras.length; i++) {
      const w = palavras[i];
      atual.push(w);
      const pontuacaoForte = /[.?!]$/.test(w.text);
      const virgulaLonga = /[,;:]$/.test(w.text) && atual.length >= 5;
      if (pontuacaoForte || virgulaLonga || atual.length >= 8) {
        lista.push({
          start: atual[0].start,
          end: atual[atual.length - 1].end,
          words: atual,
        });
        atual = [];
      }
    }
    if (atual.length > 0) {
      lista.push({
        start: atual[0].start,
        end: atual[atual.length - 1].end,
        words: atual,
      });
    }
    return lista;
  }, [palavras]);

  const blocoAtivo = blocos.find((b) => t >= b.start - 0.08 && t <= b.end + 0.22);
  if (!blocoAtivo) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 22,
        left: 120,
        right: 120,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.96)',
          border: `1px solid ${COR_BORDA}`,
          borderRadius: 12,
          padding: '10px 24px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '4px 7px',
        }}
      >
        {blocoAtivo.words.map((w, i) => {
          const ativa = t >= w.start - 0.04 && t <= w.end + 0.06;
          const jaPassou = t > w.end + 0.06;
          return (
            <span
              key={i}
              style={{
                fontSize: 22,
                fontWeight: ativa ? 800 : 600,
                color: ativa ? COR_PORT1 : jaPassou ? COR_TEXTO : '#475569',
                borderBottom: ativa ? `2.5px solid ${COR_PORT1}` : '2.5px solid transparent',
                paddingBottom: 1,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
