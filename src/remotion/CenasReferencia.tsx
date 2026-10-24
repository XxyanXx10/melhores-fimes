import { Easing, Img, interpolate, spring, staticFile } from 'remotion';
import type { CenaRemotion } from '../types';

/*
 * Cenas com referência real: a manchete da notícia e o print do produto.
 * O vídeo mostra a coisa de verdade enquanto a narração fala dela, em vez de
 * um banco de imagem genérico. As imagens vêm de agente/referencias.mjs.
 */

type P = { cena: CenaRemotion; frame: number; fps: number; escala: number; progresso: number };

const fonteDe = (src: string) => (/^(blob:|https?:|data:)/.test(src) ? src : staticFile(src));
const normal = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w%]/g, '');

/**
 * Marca a frase inteira de cada destaque onde ela aparece em sequência (não cada
 * palavra solta: "de" ou "artificial" em outro ponto do título não acendem) e
 * junta as vizinhas num pedaço só, para o marca-texto passar contínuo.
 */
function pedacos(texto: string, destaques: string[] = []) {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const chaves = palavras.map(normal);
  const marcada = palavras.map(() => false);
  for (const d of destaques) {
    const alvo = d.split(/\s+/).map(normal).filter(Boolean);
    if (!alvo.length) continue;
    for (let i = 0; i + alvo.length <= chaves.length; i++)
      if (alvo.every((a, k) => chaves[i + k] === a)) for (let k = 0; k < alvo.length; k++) marcada[i + k] = true;
  }
  const saida: { texto: string; quente: boolean }[] = [];
  for (const [i, w] of palavras.entries()) {
    const quente = marcada[i];
    const ult = saida[saida.length - 1];
    if (ult && ult.quente === quente) ult.texto += ` ${w}`;
    else saida.push({ texto: w, quente });
  }
  return saida;
}

/**
 * Manchete da notícia como ela aparece no site: ícone e nome do site, data,
 * imagem de capa e o título — com um marca-texto passando nas palavras-chave.
 */
export function CenaManchete({ cena, frame, fps, escala, progresso }: P) {
  const cor = cena.destaque || '#ffe14d';
  const entrada = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const aproxima = interpolate(progresso, [0, 1], [1, 1.04]);
  const horiz = escala < 0.9;
  let ordem = 0;
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 30 * escala,
        overflow: 'hidden',
        maxWidth: horiz ? 940 * escala : undefined,
        margin: horiz ? '0 auto' : undefined,
        boxShadow: `0 ${40 * escala}px ${110 * escala}px rgba(0,0,0,.7)`,
        transform: `scale(${interpolate(entrada, [0, 1], [0.86, 1]) * aproxima}) rotate(${interpolate(entrada, [0, 1], [-3, 0])}deg)`,
        color: '#111418',
      }}
    >
      {cena.imagem && (
        <div style={{ width: '100%', aspectRatio: horiz ? '21 / 9' : '16 / 9', overflow: 'hidden' }}>
          <Img
            src={fonteDe(cena.imagem)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${interpolate(progresso, [0, 1], [1.02, 1.12])})` }}
          />
        </div>
      )}
      <div style={{ padding: horiz ? `${22 * escala}px ${32 * escala}px ${26 * escala}px` : `${32 * escala}px ${38 * escala}px ${40 * escala}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 * escala, marginBottom: (horiz ? 12 : 20) * escala }}>
          {cena.logo && <Img src={fonteDe(cena.logo)} style={{ width: (horiz ? 44 : 56) * escala, height: (horiz ? 44 : 56) * escala, borderRadius: 12 * escala, objectFit: 'contain' }} />}
          <span style={{ fontSize: (horiz ? 28 : 32) * escala, fontWeight: 800 }}>{cena.fonte}</span>
          {cena.data && <span style={{ fontSize: (horiz ? 24 : 28) * escala, color: '#6b7280', fontWeight: 600 }}>· {cena.data}</span>}
        </div>
        <div style={{ fontSize: (cena.imagem ? (horiz ? 46 : 60) : (horiz ? 56 : 70)) * escala, fontWeight: 800, lineHeight: 1.16, letterSpacing: -0.5 * escala }}>
          {pedacos(cena.titulo, cena.destaques).map((p, i) => {
            if (!p.quente) return <span key={i}>{p.texto} </span>;
            // um pedaço marcado depois do outro, a partir de quando o cartão assentou
            const inicio = 16 + ordem++ * 9;
            const passada = interpolate(frame, [inicio, inicio + 11], [0, 100], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.quad),
            });
            return (
              <span key={i}>
                <span
                  style={{
                    backgroundImage: `linear-gradient(${cor}, ${cor})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: `${passada}% 78%`,
                    backgroundPosition: '0 70%',
                    padding: `0 ${6 * escala}px`,
                    margin: `0 ${-6 * escala}px`,
                    boxDecorationBreak: 'clone',
                    WebkitBoxDecorationBreak: 'clone',
                  }}
                >
                  {p.texto}
                </span>{' '}
              </span>
            );
          })}
        </div>
        {cena.subtitulo && <div style={{ fontSize: (horiz ? 25 : 30) * escala, color: '#4b5563', marginTop: (horiz ? 12 : 18) * escala, lineHeight: 1.3 }}>{cena.subtitulo}</div>}
      </div>
    </div>
  );
}

/**
 * Print real (anúncio, tela do produto, página do site): entra, a câmera
 * aproxima devagar do `foco` e uma caixa se desenha em volta da `marca`,
 * escurecendo o resto para o olho ir direto ao ponto.
 */
export function CenaPrint({ cena, frame, fps, escala, progresso }: P) {
  const cor = cena.destaque || '#ffd60a';
  const [lw, lh] = cena.tamanho ?? [1200, 675];
  const r = cena.recorte ?? { x: 0, y: 0, w: 100, h: 100 };
  const proporcao = (lw * r.w) / (lh * r.h);
  const moldura = cena.moldura ?? 'cartao';
  const barra = moldura === 'janela' ? 58 * escala : 0;
  // até ~1000 px no vertical (9:16) ou ~720 px no horizontal (16:9), para não encostar na legenda
  const horiz = escala < 0.9;
  const alturaMax = (horiz ? (cena.titulo ? 680 : 760) : (cena.titulo ? 900 : 1000)) * escala - barra;
  const largura = Math.min((horiz ? 1240 : 960) * escala, alturaMax * proporcao);
  const altura = largura / proporcao;

  const entrada = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const foco = cena.foco ?? { x: 50, y: 50 };
  const zoom = interpolate(progresso, [0.1, 1], [1, foco.zoom ?? 1.22], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const desenho = interpolate(progresso, [0.28, 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const m = cena.marca;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {cena.titulo && (
        <div
          style={{
            fontSize: 52 * escala,
            fontWeight: 900,
            color: '#fff',
            textAlign: 'center',
            marginBottom: 26 * escala,
            textShadow: '0 6px 24px rgba(0,0,0,.85)',
            opacity: Math.min(1, entrada),
          }}
        >
          {cena.titulo}
        </div>
      )}
      <div
        style={{
          width: largura,
          borderRadius: moldura === 'nenhuma' ? 18 * escala : 26 * escala,
          overflow: 'hidden',
          background: '#0d0f14',
          border: moldura === 'nenhuma' ? 'none' : `${2 * escala}px solid rgba(255,255,255,.16)`,
          boxShadow: moldura === 'nenhuma' ? 'none' : `0 ${36 * escala}px ${100 * escala}px rgba(0,0,0,.75)`,
          transform: `translateY(${interpolate(entrada, [0, 1], [70 * escala, 0])}px) scale(${interpolate(entrada, [0, 1], [0.9, 1])})`,
          opacity: Math.min(1, entrada * 1.4),
        }}
      >
        {moldura === 'janela' && (
          <div style={{ height: barra, background: '#22252c', display: 'flex', alignItems: 'center', gap: 10 * escala, padding: `0 ${20 * escala}px` }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <span key={c} style={{ width: 16 * escala, height: 16 * escala, borderRadius: '50%', background: c }} />
            ))}
            <span
              style={{
                marginLeft: 14 * escala,
                flex: 1,
                background: '#15171c',
                color: '#aab1bd',
                fontSize: 24 * escala,
                borderRadius: 999,
                padding: `${8 * escala}px ${20 * escala}px`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cena.url}
            </span>
          </div>
        )}
        <div style={{ position: 'relative', width: largura, height: altura, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: `${foco.x}% ${foco.y}%` }}>
            <Img
              src={fonteDe(cena.imagem ?? '')}
              style={{
                position: 'absolute',
                width: `${(100 * 100) / r.w}%`,
                height: `${(100 * 100) / r.h}%`,
                left: `${(-r.x / r.w) * 100}%`,
                top: `${(-r.y / r.h) * 100}%`,
                maxWidth: 'none',
              }}
            />
            {m && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                {/* escurece tudo menos a marca */}
                <path
                  fillRule="evenodd"
                  fill={`rgba(0,0,0,${0.5 * desenho})`}
                  d={`M0 0H100V100H0Z M${m.x} ${m.y}V${m.y + m.h}H${m.x + m.w}V${m.y}Z`}
                />
                <rect
                  x={m.x}
                  y={m.y}
                  width={m.w}
                  height={m.h}
                  rx={1.2}
                  fill="none"
                  stroke={cor}
                  strokeWidth={6 * escala}
                  vectorEffect="non-scaling-stroke"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - desenho}
                  style={{ filter: `drop-shadow(0 0 ${10 * escala}px ${cor})` }}
                />
              </svg>
            )}
          </div>
          {cena.subtitulo && (
            <div
              style={{
                position: 'absolute',
                right: 14 * escala,
                bottom: 12 * escala,
                fontSize: 22 * escala,
                color: 'rgba(255,255,255,.85)',
                background: 'rgba(0,0,0,.55)',
                padding: `${4 * escala}px ${12 * escala}px`,
                borderRadius: 8 * escala,
              }}
            >
              {cena.subtitulo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "Real ou IA?": duas fotos lado a lado, contagem 3-2-1 com um anel que
 * esvazia e, no `revelar`, o carimbo em cada foto (IA em vermelho, REAL em verde).
 */
export function CenaQuiz({ cena, frame, fps, escala }: P) {
  const [esq, dir] = cena.imagens ?? [];
  const revelaEm = Math.round((cena.revelar ?? 3) * fps);
  const revelado = frame >= revelaEm;
  // uma foto só: a resposta é 'ia' ou 'real' e a foto ocupa o lugar das duas
  const unica = (cena.imagens ?? []).length === 1;
  const ehIA = (lado: 'esquerda' | 'direita') =>
    unica ? cena.resposta === 'ia' : cena.resposta === 'ambas' || cena.resposta === lado;
  const restante = Math.max(0, revelaEm - frame) / fps;
  // a voz conta "três… dois… um" no último segundo e meio: o número acompanha a fala, não o tempo todo
  const numero = restante > 1.55 ? 3 : restante > 0.75 ? 2 : 1;
  const anel = revelado ? 0 : restante / (cena.revelar ?? 3);
  const pulso = spring({ frame: frame - revelaEm, fps, config: { damping: 9, stiffness: 180 } });
  const largura = (unica ? 680 : 452) * escala;
  const foto = (src: string | undefined, lado: 'esquerda' | 'direita', i: number) => {
    const entra = spring({ frame: frame - i * 5, fps, config: { damping: 13, stiffness: 140 } });
    const ia = ehIA(lado);
    const cor = ia ? '#ff3b4d' : '#22c55e';
    return (
      <div
        key={lado}
        style={{
          position: 'relative',
          width: largura,
          height: largura * (4 / 3),
          borderRadius: 26 * escala,
          overflow: 'hidden',
          border: `${6 * escala}px solid ${revelado ? cor : 'rgba(255,255,255,.9)'}`,
          boxShadow: revelado ? `0 0 ${50 * escala}px ${cor}aa` : `0 ${24 * escala}px ${60 * escala}px rgba(0,0,0,.6)`,
          transform: `translateY(${interpolate(entra, [0, 1], [80 * escala, 0])}px) rotate(${(lado === 'esquerda' ? -2 : 2) * (1 - entra)}deg)`,
          opacity: Math.min(1, entra * 1.3),
        }}
      >
        {src && <Img src={fonteDe(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: revelado && !ia ? 'saturate(1.1)' : undefined }} />}
        <div style={{ position: 'absolute', left: 14 * escala, top: 12 * escala, fontSize: 40 * escala, fontWeight: 900, color: '#fff', textShadow: '0 3px 12px rgba(0,0,0,.9)' }}>
          {unica ? '' : lado === 'esquerda' ? 'A' : 'B'}
        </div>
        {revelado && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%,-50%) rotate(-12deg) scale(${interpolate(pulso, [0, 1], [2.2, 1])})`,
              opacity: Math.min(1, pulso * 2),
              padding: `${8 * escala}px ${26 * escala}px`,
              border: `${7 * escala}px solid ${cor}`,
              borderRadius: 14 * escala,
              color: cor,
              background: 'rgba(0,0,0,.55)',
              fontSize: 76 * escala,
              fontWeight: 900,
              letterSpacing: 2 * escala,
            }}
          >
            {ia ? 'IA' : 'REAL'}
          </div>
        )}
      </div>
    );
  };
  const raio = 70;
  const volta = 2 * Math.PI * raio;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {cena.titulo && (
        <div style={{ fontSize: 64 * escala, fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 30 * escala, textShadow: '0 6px 24px rgba(0,0,0,.85)', textTransform: 'uppercase' }}>
          {cena.titulo}
        </div>
      )}
      <div style={{ display: 'flex', gap: 22 * escala }}>
        {foto(esq, 'esquerda', 0)}
        {!unica && foto(dir, 'direita', 1)}
      </div>
      <div style={{ marginTop: 34 * escala, height: 170 * escala, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!revelado ? (
          <div style={{ position: 'relative', width: 170 * escala, height: 170 * escala }}>
            <svg viewBox="0 0 160 160" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r={raio} fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.18)" strokeWidth="10" />
              <circle cx="80" cy="80" r={raio} fill="none" stroke={cena.destaque || '#ffd60a'} strokeWidth="10" strokeLinecap="round" strokeDasharray={volta} strokeDashoffset={volta * (1 - anel)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 92 * escala, fontWeight: 900, color: '#fff' }}>
              {unica ? '?' : numero}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 54 * escala, fontWeight: 900, color: '#fff', textShadow: '0 4px 18px rgba(0,0,0,.9)', transform: `scale(${interpolate(pulso, [0, 1], [0.6, 1])})` }}>
            {cena.subtitulo ?? 'Acertou?'}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fundo animado nas cores da receita, no lugar do b-roll genérico do Pexels
 * (imagem aleatória atrás de tudo cansa). Manchas de luz grandes que andam devagar,
 * uma grade sutil e vinheta. Só gradiente: leve para o render.
 */
function FundoManchas({ cena, frame, fps }: { cena: CenaRemotion; frame: number; fps: number }) {
  const [a, b] = [cena.destaque || '#7c3aed', cena.subtitulo || '#0ea5e9'];
  const t = frame / fps;
  const mancha = (cor: string, x: number, y: number, tam: number) =>
    `radial-gradient(${tam}% ${tam * 0.75}% at ${x}% ${y}%, ${cor}99 0%, ${cor}38 38%, transparent 72%)`;
  const x1 = 30 + 18 * Math.sin(t * 0.23);
  const y1 = 28 + 12 * Math.cos(t * 0.19);
  const x2 = 70 + 16 * Math.cos(t * 0.17);
  const y2 = 70 + 14 * Math.sin(t * 0.21);
  const x3 = 50 + 30 * Math.sin(t * 0.11 + 1);
  const deslize = (t * 18) % 120;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: [mancha(a, x1, y1, 80), mancha(b, x2, y2, 75), mancha(a, x3, 92, 60), 'linear-gradient(180deg, #06070c 0%, #0b0d16 50%, #05060a 100%)'].join(','),
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.07,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)',
          backgroundSize: '90px 90px',
          backgroundPosition: `0 ${deslize}px`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,.75) 100%)' }} />
    </div>
  );
}

type PF = { cena: CenaRemotion; frame: number; fps: number };
const BASE_ESCURA = 'linear-gradient(180deg, #05060b 0%, #0a0c15 55%, #040509 100%)';
const vinheta = <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,.78) 100%)' }} />;

/** "synthwave": céu roxo, sol listrado no horizonte e grade em perspectiva vindo na direção de quem assiste */
function FundoSynthwave({ cena, frame, fps }: PF) {
  const a = cena.destaque || '#ec4899';
  const b = cena.subtitulo || '#8b5cf6';
  const anda = ((frame / fps) * 60) % 80;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, #07031a 0%, #1a0b3d 40%, ${b}55 56%, #05020f 57%)` }}>
      <div style={{ position: 'absolute', left: '50%', top: '40%', width: 520, height: 520, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `linear-gradient(180deg, #ffd166 0%, ${a} 70%)`, opacity: 0.55,
        maskImage: 'repeating-linear-gradient(180deg, #000 0 26px, transparent 26px 36px)', WebkitMaskImage: 'repeating-linear-gradient(180deg, #000 0 26px, transparent 26px 36px)' }} />
      <div style={{ position: 'absolute', left: '-50%', right: '-50%', top: '57%', height: '60%', transformOrigin: 'top', transform: 'perspective(500px) rotateX(62deg)',
        backgroundImage: `linear-gradient(${a}cc 2px, transparent 2px), linear-gradient(90deg, ${a}cc 2px, transparent 2px)`, backgroundSize: '80px 80px', backgroundPosition: `0 ${anda}px`, opacity: 0.55 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '56.4%', height: 4, background: a, boxShadow: `0 0 30px 8px ${a}` , opacity: 0.8 }} />
      {vinheta}
    </div>
  );
}

/** "listras": faixas diagonais nas cores da receita andando devagar (pop, cômico) */
function FundoListras({ cena, frame, fps }: PF) {
  const a = cena.destaque || '#f5b301';
  const b = cena.subtitulo || '#ec4899';
  const anda = ((frame / fps) * 40) % 226;
  return (
    <div style={{ position: 'absolute', inset: 0, background: BASE_ESCURA }}>
      <div style={{ position: 'absolute', inset: '-20%', opacity: 0.22,
        backgroundImage: `repeating-linear-gradient(45deg, ${a} 0 80px, transparent 80px 160px, ${b} 160px 240px, transparent 240px 320px)`, backgroundPosition: `${anda}px 0`, backgroundSize: '452px 452px' }} />
      {vinheta}
    </div>
  );
}

/** "bokeh": bolhas de luz desfocadas subindo devagar */
function FundoBokeh({ cena, frame, fps }: PF) {
  const a = cena.destaque || '#22c55e';
  const b = cena.subtitulo || '#38bdf8';
  const t = frame / fps;
  const bolhas = Array.from({ length: 16 }, (_, i) => {
    const semente = (i * 9301 + 49297) % 233280 / 233280;
    const x = (i * 37 + 11) % 100;
    const tam = 120 + ((i * 53) % 220);
    const y = 110 - (((t * (6 + (i % 5) * 2) + i * 23) % 140));
    const cor = i % 2 ? a : b;
    return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: tam, height: tam, transform: 'translate(-50%,-50%)', borderRadius: '50%',
      background: `radial-gradient(circle, ${cor}${semente > 0.5 ? '55' : '33'} 0%, ${cor}11 55%, transparent 70%)` }} />;
  });
  return (
    <div style={{ position: 'absolute', inset: 0, background: BASE_ESCURA, overflow: 'hidden' }}>
      {bolhas}
      {vinheta}
    </div>
  );
}

/** "pontos": retícula de meio-tom (cara de jornal/gibi) sobre manchas de luz */
function FundoPontos({ cena, frame, fps }: PF) {
  const a = cena.destaque || '#f5b301';
  const t = frame / fps;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <FundoManchas cena={cena} frame={frame} fps={fps} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.18,
        backgroundImage: `radial-gradient(circle, ${a} 2.5px, transparent 3px)`, backgroundSize: '26px 26px', backgroundPosition: `${(t * 6) % 26}px ${(t * 3) % 26}px` }} />
      {vinheta}
    </div>
  );
}

/** "codigo": colunas de caracteres caindo (o mundo visto de dentro da IA) */
function FundoCodigo({ cena, frame, fps }: PF) {
  const a = cena.destaque || '#22c55e';
  const t = frame / fps;
  const simbolos = '01アイウエオカキクケコ{}<>/=+*#$%&ABCDEF';
  const colunas = Array.from({ length: 22 }, (_, c) => {
    const vel = 60 + ((c * 37) % 90);
    const texto = Array.from({ length: 28 }, (_, k) => simbolos[(c * 7 + k * 13) % simbolos.length]).join('\n');
    const y = ((t * vel + c * 140) % 2600) - 1300;
    return <div key={c} style={{ position: 'absolute', left: `${(c / 22) * 100 + 1}%`, top: y, whiteSpace: 'pre', fontFamily: 'monospace', fontSize: 34, lineHeight: 1.25,
      color: a, opacity: 0.18 + ((c * 17) % 10) / 40, textShadow: `0 0 8px ${a}` }}>{texto}</div>;
  });
  return (
    <div style={{ position: 'absolute', inset: 0, background: BASE_ESCURA, overflow: 'hidden' }}>
      {colunas}
      {vinheta}
    </div>
  );
}

/** Fundo animado do vídeo inteiro; `cena.estilo` escolhe o desenho (padrão: manchas de luz). */
export function FundoAnimado(p: PF) {
  switch (p.cena.estilo) {
    case 'synthwave': return <FundoSynthwave {...p} />;
    case 'listras': return <FundoListras {...p} />;
    case 'bokeh': return <FundoBokeh {...p} />;
    case 'pontos': return <FundoPontos {...p} />;
    case 'codigo': return <FundoCodigo {...p} />;
    default: return <FundoManchas {...p} />;
  }
}
