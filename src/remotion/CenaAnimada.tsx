import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CenaRemotion } from '../types';
import { CenaCelular, CenaFrase, CenaLogos, CenaGrafico, CenaIcones, CenaNumero, CenaRede } from './CenasExtras';

type Props = {
  cena: CenaRemotion;
  largura: number;
};

export function CenaAnimada({ cena, largura }: Props) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height: altura } = useVideoConfig();

  const horizontal = largura > altura;
  const escalaBase = largura / 1080;

  // Entrada e saída suaves da cena inteira
  const entrada = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 130, mass: 0.8 },
  });
  const saida = interpolate(
    frame,
    [Math.max(0, durationInFrames - 8), durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const opacidade = Math.min(1, entrada) * saida;
  const deslizeY = interpolate(entrada, [0, 1], [36 * escalaBase, 0]);

  const corDestaque = cena.destaque || '#10a37f';

  // Progresso normalizado de 0 a 1 durante a cena (para digitação e barras)
  const progressoCena = interpolate(
    frame,
    [6, Math.max(12, durationInFrames - 10)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: opacidade,
        // translúcido: o vídeo de fundo continua passando atrás da cena
        background:
          'radial-gradient(80% 60% at 50% 45%, rgba(8, 10, 18, 0.45), rgba(3, 4, 8, 0.78) 90%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // centralizado (um pouco acima do meio, para não brigar com a legenda)
        justifyContent: 'center',
        paddingBottom: horizontal ? 0 : `${Math.round(560 * escalaBase)}px`,
        paddingLeft: `${Math.round(48 * escalaBase)}px`,
        paddingRight: `${Math.round(48 * escalaBase)}px`,
      }}
    >
      <div
        style={{
          width: horizontal ? '76%' : '94%',
          maxWidth: `${Math.round(980 * escalaBase)}px`,
          transform: `translateY(${deslizeY}px)`,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {cena.tipo === 'chatgpt' && (
          <CenaChatGpt
            cena={cena}
            frame={frame}
            fps={fps}
            escala={escalaBase}
            progresso={progressoCena}
            corDestaque={corDestaque}
          />
        )}

        {cena.tipo === 'contexto-ia' && (
          <CenaListaCards
            cena={cena}
            frame={frame}
            fps={fps}
            escala={escalaBase}
            iconeTopo="🧠"
            corTema="#ef4444"
            modoContexto
          />
        )}

        {cena.tipo === 'checklist' && (
          <CenaListaCards
            cena={cena}
            frame={frame}
            fps={fps}
            escala={escalaBase}
            iconeTopo="💡"
            corTema="#10b981"
            modoContexto={false}
          />
        )}

        {cena.tipo === 'privacidade' && (
          <CenaPrivacidade
            cena={cena}
            frame={frame}
            fps={fps}
            escala={escalaBase}
            progresso={progressoCena}
          />
        )}

        {cena.tipo === 'codigo' && (
          <CenaCodigo
            cena={cena}
            frame={frame}
            fps={fps}
            escala={escalaBase}
            progresso={progressoCena}
          />
        )}

        {cena.tipo === 'logos' && <CenaLogos cena={cena} frame={frame} fps={fps} escala={escalaBase} progresso={progressoCena} />}
        {cena.tipo === 'celular' && <CenaCelular cena={cena} frame={frame} fps={fps} escala={escalaBase} progresso={progressoCena} />}
        {cena.tipo === 'frase' && <CenaFrase cena={cena} frame={frame} fps={fps} escala={escalaBase} progresso={progressoCena} />}
        {cena.tipo === 'numero' && <CenaNumero cena={cena} frame={frame} fps={fps} escala={escalaBase} progresso={progressoCena} />}
        {cena.tipo === 'grafico' && <CenaGrafico cena={cena} frame={frame} fps={fps} escala={escalaBase} progresso={progressoCena} />}
        {cena.tipo === 'icones' && <CenaIcones cena={cena} frame={frame} fps={fps} escala={escalaBase} progresso={progressoCena} />}
        {cena.tipo === 'rede' && <CenaRede cena={cena} frame={frame} fps={fps} escala={escalaBase} progresso={progressoCena} />}
        {cena.tipo === 'versus' && (
          <CenaVersus
            cena={cena}
            frame={frame}
            fps={fps}
            escala={escalaBase}
            progresso={progressoCena}
          />
        )}
      </div>
    </AbsoluteFill>
  );
}

/* ============================================================================
   1. CENA CHATGPT — Conversa animada no estilo ChatGPT 4o
   ============================================================================ */
function CenaChatGpt({
  cena,
  frame,
  fps,
  escala,
  progresso,
  corDestaque,
}: {
  cena: CenaRemotion;
  frame: number;
  fps: number;
  escala: number;
  progresso: number;
  corDestaque: string;
}) {
  const prompt = cena.promptUsuario || 'Você sabe tudo sobre mim e o que aconteceu ontem?';
  const resposta =
    cena.respostaIa ||
    cena.itens.join(' ') ||
    'Não automaticamente. Eu respondo com base na nossa conversa e nas informações que você compartilha.';

  const charsVisiveis = Math.max(1, Math.floor(resposta.length * Math.min(1, progresso * 1.18)));
  const textoDigitado = resposta.slice(0, charsVisiveis);
  const digitandoAinda = charsVisiveis < resposta.length;

  const entradaBalaoUsuario = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: { damping: 14, stiffness: 150 },
  });

  const entradaBalaoIa = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 14, stiffness: 130 },
  });

  return (
    <div
      style={{
        background: '#171717',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: `${Math.round(28 * escala)}px`,
        boxShadow: '0 32px 80px rgba(0, 0, 0, 0.75), 0 0 50px rgba(16, 163, 127, 0.16)',
        overflow: 'hidden',
        color: '#ececec',
      }}
    >
      {/* Topo da janela do ChatGPT */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${Math.round(22 * escala)}px ${Math.round(28 * escala)}px`,
          background: '#212121',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(14 * escala)}px` }}>
          <div
            style={{
              width: `${Math.round(42 * escala)}px`,
              height: `${Math.round(42 * escala)}px`,
              borderRadius: '50%',
              background: '#10a37f',
              display: 'grid',
              placeItems: 'center',
              fontSize: `${Math.round(22 * escala)}px`,
              fontWeight: 900,
              color: '#fff',
              boxShadow: '0 0 18px rgba(16, 163, 127, 0.6)',
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: `${Math.round(25 * escala)}px`, fontWeight: 800, color: '#fff' }}>
              {cena.titulo || 'ChatGPT 4o'}
            </div>
            <div style={{ fontSize: `${Math.round(17 * escala)}px`, color: '#10a37f', fontWeight: 600 }}>
              ● {digitandoAinda ? 'Digitando resposta…' : 'Assistente IA Ativo'}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: `${Math.round(7 * escala)}px ${Math.round(16 * escala)}px`,
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.06)',
            fontSize: `${Math.round(17 * escala)}px`,
            color: '#a1a1aa',
            fontWeight: 600,
          }}
        >
          IA Conversacional
        </div>
      </div>

      {/* Corpo do Chat */}
      <div
        style={{
          padding: `${Math.round(30 * escala)}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${Math.round(24 * escala)}px`,
        }}
      >
        {/* Balão de pergunta do Usuário */}
        <div
          style={{
            alignSelf: 'flex-end',
            maxWidth: '84%',
            background: '#2f2f2f',
            color: '#fff',
            padding: `${Math.round(20 * escala)}px ${Math.round(26 * escala)}px`,
            borderRadius: `${Math.round(24 * escala)}px ${Math.round(24 * escala)}px ${Math.round(6 * escala)}px ${Math.round(24 * escala)}px`,
            fontSize: `${Math.round(26 * escala)}px`,
            lineHeight: 1.38,
            fontWeight: 600,
            transform: `scale(${interpolate(entradaBalaoUsuario, [0, 1], [0.85, 1])})`,
            opacity: entradaBalaoUsuario,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              fontSize: `${Math.round(16 * escala)}px`,
              color: '#9ca3af',
              marginBottom: `${Math.round(6 * escala)}px`,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            👤 Você perguntou:
          </div>
          {prompt}
        </div>

        {/* Resposta da IA com efeito de digitação ao vivo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: `${Math.round(18 * escala)}px`,
            opacity: entradaBalaoIa,
            transform: `translateY(${interpolate(entradaBalaoIa, [0, 1], [18 * escala, 0])}px)`,
          }}
        >
          <div
            style={{
              width: `${Math.round(44 * escala)}px`,
              height: `${Math.round(44 * escala)}px`,
              borderRadius: '50%',
              background: '#10a37f',
              display: 'grid',
              placeItems: 'center',
              fontSize: `${Math.round(22 * escala)}px`,
              color: '#fff',
              flexShrink: 0,
              marginTop: `${Math.round(4 * escala)}px`,
            }}
          >
            🤖
          </div>

          <div
            style={{
              flex: 1,
              background: '#212121',
              border: `1px solid ${corDestaque}55`,
              borderRadius: `${Math.round(8 * escala)}px ${Math.round(24 * escala)}px ${Math.round(24 * escala)}px ${Math.round(24 * escala)}px`,
              padding: `${Math.round(24 * escala)}px`,
              fontSize: `${Math.round(28 * escala)}px`,
              lineHeight: 1.44,
              color: '#f4f4f5',
              fontWeight: 500,
            }}
          >
            <span>{textoDigitado}</span>
            {digitandoAinda && (
              <span
                style={{
                  display: 'inline-block',
                  marginLeft: `${Math.round(6 * escala)}px`,
                  color: '#10a37f',
                  fontWeight: 900,
                }}
              >
                ▋
              </span>
            )}

            {/* Pílulas de resumo abaixo da resposta */}
            {cena.itens.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: `${Math.round(10 * escala)}px`,
                  marginTop: `${Math.round(20 * escala)}px`,
                }}
              >
                {cena.itens.map((item, idx) => {
                  const pItem = spring({
                    frame: Math.max(0, frame - 16 - idx * 7),
                    fps,
                    config: { damping: 13, stiffness: 140 },
                  });
                  return (
                    <span
                      key={idx}
                      style={{
                        opacity: pItem,
                        transform: `scale(${interpolate(pItem, [0, 1], [0.85, 1])})`,
                        background: 'rgba(16, 163, 127, 0.16)',
                        border: '1px solid rgba(16, 163, 127, 0.45)',
                        color: '#6ee7b7',
                        borderRadius: '999px',
                        padding: `${Math.round(8 * escala)}px ${Math.round(18 * escala)}px`,
                        fontSize: `${Math.round(20 * escala)}px`,
                        fontWeight: 700,
                      }}
                    >
                      {item}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Barra simulada de digitação no rodapé do ChatGPT */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#2a2a2a',
            borderRadius: '999px',
            padding: `${Math.round(14 * escala)}px ${Math.round(22 * escala)}px`,
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#9ca3af',
            fontSize: `${Math.round(20 * escala)}px`,
          }}
        >
          <span>Envie uma mensagem com seu contexto…</span>
          <span
            style={{
              width: `${Math.round(36 * escala)}px`,
              height: `${Math.round(36 * escala)}px`,
              borderRadius: '50%',
              background: '#fff',
              color: '#111',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
            }}
          >
            ↑
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   2 & 3. CENA CONTEXTO IA (❌ / ✅) E CHECKLIST PASSO A PASSO
   ============================================================================ */
function CenaListaCards({
  cena,
  frame,
  fps,
  escala,
  iconeTopo,
  corTema,
  modoContexto,
}: {
  cena: CenaRemotion;
  frame: number;
  fps: number;
  escala: number;
  iconeTopo: string;
  corTema: string;
  modoContexto: boolean;
}) {
  return (
    <div
      style={{
        background: 'rgba(17, 21, 30, 0.95)',
        border: `2px solid ${corTema}55`,
        borderRadius: `${Math.round(28 * escala)}px`,
        padding: `${Math.round(32 * escala)}px`,
        boxShadow: '0 30px 70px rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        gap: `${Math.round(20 * escala)}px`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(16 * escala)}px` }}>
        <span style={{ fontSize: `${Math.round(42 * escala)}px` }}>{iconeTopo}</span>
        <div>
          <div
            style={{
              fontSize: `${Math.round(30 * escala)}px`,
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {cena.titulo}
          </div>
          {cena.subtitulo && (
            <div style={{ fontSize: `${Math.round(21 * escala)}px`, color: '#94a3b8', marginTop: 2 }}>
              {cena.subtitulo}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: `${Math.round(14 * escala)}px` }}>
        {cena.itens.map((item, idx) => {
          const pItem = spring({
            frame: Math.max(0, frame - 6 - idx * 8),
            fps,
            config: { damping: 13, stiffness: 140 },
          });
          const ehNegativo = modoContexto && !item.startsWith('✅');
          const corCard = ehNegativo ? '#ef4444' : '#10b981';
          const textoLimpo = item.replace(/^[❌✅]\s*/, '');

          return (
            <div
              key={idx}
              style={{
                opacity: pItem,
                transform: `translateX(${interpolate(pItem, [0, 1], [-32 * escala, 0])}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: `${Math.round(18 * escala)}px`,
                background: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${corCard}55`,
                borderRadius: `${Math.round(18 * escala)}px`,
                padding: `${Math.round(18 * escala)}px ${Math.round(22 * escala)}px`,
              }}
            >
              <div
                style={{
                  width: `${Math.round(44 * escala)}px`,
                  height: `${Math.round(44 * escala)}px`,
                  borderRadius: '50%',
                  background: `${corCard}25`,
                  border: `2px solid ${corCard}`,
                  color: corCard,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: `${Math.round(22 * escala)}px`,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {modoContexto ? (ehNegativo ? '✕' : '✓') : idx + 1}
              </div>
              <div
                style={{
                  fontSize: `${Math.round(26 * escala)}px`,
                  fontWeight: 700,
                  color: '#f8fafc',
                  lineHeight: 1.3,
                  flex: 1,
                }}
              >
                {textoLimpo}
              </div>
              {!modoContexto && (
                <span
                  style={{
                    fontSize: `${Math.round(24 * escala)}px`,
                    color: '#10b981',
                    fontWeight: 900,
                  }}
                >
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   4. CENA PRIVACIDADE & SEGURANÇA DE DADOS
   ============================================================================ */
function CenaPrivacidade({
  cena,
  frame,
  fps,
  escala,
  progresso,
}: {
  cena: CenaRemotion;
  frame: number;
  fps: number;
  escala: number;
  progresso: number;
}) {
  const pulsoEscudo = 1 + Math.sin(frame * 0.18) * 0.05;

  return (
    <div
      style={{
        background: 'linear-gradient(160deg, #131c2e 0%, #0d1320 100%)',
        border: '2px solid rgba(56, 189, 248, 0.45)',
        borderRadius: `${Math.round(28 * escala)}px`,
        padding: `${Math.round(34 * escala)}px`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 40px rgba(56, 189, 248, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: `${Math.round(22 * escala)}px`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: `${Math.round(92 * escala)}px`,
          height: `${Math.round(92 * escala)}px`,
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.15)',
          border: '2px solid #38bdf8',
          display: 'grid',
          placeItems: 'center',
          fontSize: `${Math.round(46 * escala)}px`,
          transform: `scale(${pulsoEscudo})`,
          boxShadow: '0 0 30px rgba(56, 189, 248, 0.4)',
        }}
      >
        🛡️
      </div>

      <div>
        <div
          style={{
            fontSize: `${Math.round(32 * escala)}px`,
            fontWeight: 900,
            color: '#fff',
            textTransform: 'uppercase',
          }}
        >
          {cena.titulo || 'Privacidade & Dados Pessoais'}
        </div>
        {cena.subtitulo && (
          <div style={{ fontSize: `${Math.round(22 * escala)}px`, color: '#7dd3fc', marginTop: 4 }}>
            {cena.subtitulo}
          </div>
        )}
      </div>

      {/* Barra de verificação de segurança */}
      <div
        style={{
          width: '100%',
          height: `${Math.round(10 * escala)}px`,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(progresso * 100)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #f59e0b, #38bdf8, #10b981)',
          }}
        />
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: `${Math.round(12 * escala)}px` }}>
        {cena.itens.map((item, idx) => {
          const pItem = spring({
            frame: Math.max(0, frame - 6 - idx * 7),
            fps,
            config: { damping: 14, stiffness: 140 },
          });
          return (
            <div
              key={idx}
              style={{
                opacity: pItem,
                transform: `translateY(${interpolate(pItem, [0, 1], [16 * escala, 0])}px)`,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: `${Math.round(16 * escala)}px`,
                padding: `${Math.round(16 * escala)}px ${Math.round(20 * escala)}px`,
                fontSize: `${Math.round(25 * escala)}px`,
                fontWeight: 700,
                color: '#f1f5f9',
                textAlign: 'left',
              }}
            >
              🔒 {item.replace(/^[🔒🛡️⚠️]\s*/, '')}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   5. CENA CÓDIGO / TERMINAL IA
   ============================================================================ */
function CenaCodigo({
  cena,
  frame,
  fps,
  escala,
  progresso,
}: {
  cena: CenaRemotion;
  frame: number;
  fps: number;
  escala: number;
  progresso: number;
}) {
  return (
    <div
      style={{
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: `${Math.round(24 * escala)}px`,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${Math.round(16 * escala)}px ${Math.round(24 * escala)}px`,
          background: '#161b22',
          borderBottom: '1px solid #30363d',
        }}
      >
        <div style={{ display: 'flex', gap: `${Math.round(10 * escala)}px` }}>
          <span style={{ width: 14 * escala, height: 14 * escala, borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: 14 * escala, height: 14 * escala, borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: 14 * escala, height: 14 * escala, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        <span style={{ color: '#8b949e', fontSize: `${Math.round(20 * escala)}px`, fontFamily: 'monospace' }}>
          ⚡ {cena.titulo || 'agente_ia.ts'}
        </span>
        <span style={{ color: '#58a6ff', fontSize: `${Math.round(18 * escala)}px`, fontWeight: 700 }}>
          {Math.round(progresso * 100)}%
        </span>
      </div>

      <div
        style={{
          padding: `${Math.round(26 * escala)}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${Math.round(14 * escala)}px`,
          fontFamily: 'Consolas, monospace',
        }}
      >
        {cena.itens.map((linha, idx) => {
          const p = spring({
            frame: Math.max(0, frame - 4 - idx * 7),
            fps,
            config: { damping: 14, stiffness: 140 },
          });
          return (
            <div
              key={idx}
              style={{
                opacity: p,
                transform: `translateX(${interpolate(p, [0, 1], [20 * escala, 0])}px)`,
                display: 'flex',
                gap: `${Math.round(16 * escala)}px`,
                fontSize: `${Math.round(24 * escala)}px`,
                color: idx % 2 === 0 ? '#79c0ff' : '#a5d6ff',
                background: 'rgba(56, 139, 253, 0.08)',
                padding: `${Math.round(12 * escala)}px ${Math.round(16 * escala)}px`,
                borderRadius: `${Math.round(12 * escala)}px`,
                borderLeft: '4px solid #58a6ff',
              }}
            >
              <span style={{ color: '#484f58', userSelect: 'none' }}>0{idx + 1}</span>
              <span style={{ color: '#e6edf3', fontWeight: 600 }}>{linha}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   6. CENA VERSUS / COMPARATIVO DE DESEMPENHO
   ============================================================================ */
function CenaVersus({
  cena,
  frame,
  fps,
  escala,
  progresso,
}: {
  cena: CenaRemotion;
  frame: number;
  fps: number;
  escala: number;
  progresso: number;
}) {
  const metas = [96, 78, 88, 70];
  return (
    <div
      style={{
        background: 'rgba(17, 21, 32, 0.95)',
        border: '2px solid rgba(168, 85, 247, 0.45)',
        borderRadius: `${Math.round(28 * escala)}px`,
        padding: `${Math.round(32 * escala)}px`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: `${Math.round(20 * escala)}px`,
      }}
    >
      <div style={{ fontSize: `${Math.round(30 * escala)}px`, fontWeight: 900, color: '#f3e8ff' }}>
        ⚡ {cena.titulo || 'Comparativo em Tempo Real'}
      </div>

      {cena.itens.map((item, idx) => {
        const p = spring({
          frame: Math.max(0, frame - 4 - idx * 7),
          fps,
          config: { damping: 14, stiffness: 130 },
        });
        const pct = Math.round(metas[idx % metas.length] * Math.min(1, progresso * 1.2));
        return (
          <div key={idx} style={{ opacity: p, display: 'flex', flexDirection: 'column', gap: 8 * escala }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${Math.round(24 * escala)}px`, fontWeight: 700, color: '#fff' }}>
              <span>{item}</span>
              <span style={{ color: '#c084fc' }}>{pct}%</span>
            </div>
            <div style={{ height: 16 * escala, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: idx === 0 ? 'linear-gradient(90deg, #a855f7, #ffd60a)' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
