import { Img, interpolate, staticFile } from 'remotion';
import type { CaptionStyle, Corte, TipoTransicao } from '../types';

/**
 * Transições nos cortes que o vídeo já tem.
 *
 * A narração nunca é interrompida: o áudio do vídeo principal corre inteiro,
 * do começo ao fim. Por isso a transição não é troca de clipe (nada de
 * TransitionSeries) — é uma animação curta POR CIMA, que cobre a virada
 * visual enquanto a voz segue.
 */

/** as animações que o modo "variado" reveza, na ordem em que aparecem */
const RODIZIO: TipoTransicao[] = ['flash', 'whip', 'cortina', 'zoom', 'deslize', 'barras', 'giro'];

/**
 * A animação de um corte específico.
 * No modo variado, cada corte pega a próxima da lista — dois cortes
 * seguidos nunca repetem, que é o que tira a cara de repetitivo.
 */
export function tipoDoCorte(tipo: TipoTransicao, indice: number): TipoTransicao {
  if (tipo !== 'variado') return tipo;
  return RODIZIO[indice % RODIZIO.length];
}

/** o tempo de entrada e de saída; o que sobra da duração é a pausa */
const RAMPA = 0.22;

/**
 * Quanto a transição está cobrindo a tela, de 0 a 1.
 *
 * Não é um pico e pronto: ela sobe, **fica parada no auge** e depois desce.
 * Essa pausa é o que dá tempo de a pessoa ver o fundo e ler a legenda —
 * sem ela, a transição é um piscar e não uma virada.
 */
export function pulso(t: number, corte: number, duracao: number): number {
  const meio = duracao / 2;
  const d = Math.abs(t - corte);
  if (d > meio) return 0;
  const platô = Math.max(0, meio - RAMPA);
  if (d <= platô) return 1;
  return interpolate(d, [platô, meio], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** 0 no começo da transição, 1 no fim — para animar durante a pausa */
export function andamento(t: number, corte: number, duracao: number): number {
  const meio = duracao / 2;
  return interpolate(t, [corte - meio, corte + meio], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/**
 * O corte acontecendo agora, se houver — só entre os ligados.
 * A posição devolvida conta apenas os ligados, para o modo variado
 * revezar entre as transições que o usuário realmente vai ver.
 */
export function corteAgora(
  cortes: Corte[],
  t: number,
  duracaoPadrao: number,
): { corte: Corte; posicao: number; duracao: number } | null {
  let posicao = 0;
  for (const c of cortes) {
    if (!c.ativo) continue;
    // cada corte pode ter a própria duração; senão usa a do vídeo todo
    const duracao = c.duracao ?? duracaoPadrao;
    const meio = duracao / 2;
    if (t >= c.t - meio && t <= c.t + meio) return { corte: c, posicao, duracao };
    posicao++;
  }
  return null;
}

/**
 * O que a transição faz com o vídeo principal.
 *
 * Devolve um pedaço de transform para ser **somado** ao do zoom — devolver
 * um `transform` inteiro apagaria o movimento de câmera.
 */
export function efeitoNoVideo(
  tipo: TipoTransicao,
  p: number,
  forca: number,
  direcao = 1,
): { transform: string; filter?: string } {
  if (p <= 0) return { transform: '' };
  switch (tipo) {
    case 'whip':
      return {
        transform: `translateX(${p * 14 * forca * direcao}%)`,
        filter: `blur(${p * 10 * forca}px)`,
      };
    case 'deslize':
      // empurrão seco, sem borrão: parece corte de edição
      return { transform: `translateX(${p * 100 * direcao}%)` };
    case 'zoom':
      return {
        transform: `scale(${1 + p * 0.18 * forca})`,
        filter: `blur(${p * 5 * forca}px)`,
      };
    case 'giro':
      return {
        transform: `rotate(${p * 8 * forca * direcao}deg) scale(${1 + p * 0.22 * forca})`,
        filter: `blur(${p * 4 * forca}px)`,
      };
    default:
      return { transform: '' };
  }
}

type Props = {
  tipo: TipoTransicao;
  /** 0..1, o quanto a transição está acontecendo agora */
  p: number;
  forca: number;
  estilo: CaptionStyle;
  direcao: number;
  /** 0..1 ao longo de toda a transição, para o fundo andar durante a pausa */
  andamento: number;
  /** imagem opcional exibida por cima do fundo, durante a transição */
  imagem?: string;
};

/** A camada desenhada por cima do vídeo durante o corte. */
export function Transicao({ tipo, p, forca, estilo, direcao, andamento: a, imagem }: Props) {
  if (p <= 0) return null;
  const base: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

  /*
   * A imagem vai por cima do fundo, crescendo devagar durante a pausa.
   * Ela não substitui a animação escolhida: a cortina continua sendo o
   * fundo, e a foto é o que a pessoa olha.
   */
  const foto = imagem ? (
    <Img
      src={/^(blob:|https?:|data:)/.test(imagem) ? imagem : staticFile(imagem)}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '78%',
        transform: `translate(-50%, -50%) scale(${0.92 + a * 0.12})`,
        borderRadius: '3%',
        boxShadow: '0 2% 8% rgba(0,0,0,.45)',
        opacity: Math.min(1, p * 1.4),
      }}
    />
  ) : null;

  const fundo = (() => {
    if (tipo === 'flash') {
      return <div style={{ ...base, backgroundColor: '#ffffff', opacity: Math.min(1, p * 0.85 * forca) }} />;
    }
    if (tipo === 'escurece') {
      return <div style={{ ...base, backgroundColor: '#000000', opacity: Math.min(1, p * 0.95 * forca) }} />;
    }
    if (tipo === 'cortina') {
      /*
       * Fundo de cor cobrindo a virada. Durante a pausa ele continua andando —
       * o ângulo gira e o degradê desliza devagar. Parado, um fundo chapado
       * dá sensação de vídeo travado; andando, dá sensação de animação.
       */
      return (
        <div
          style={{
            ...base,
            opacity: p,
            backgroundImage: `linear-gradient(${100 + a * 70}deg, ${estilo.highlightColor}, ${
              estilo.highlightColor2
            }, ${estilo.highlightColor})`,
            backgroundSize: '260% 260%',
            backgroundPosition: `${a * 100}% ${50 + a * 20}%`,
            transform: `translateX(${(1 - p) * 100 * direcao}%) scale(${1 + a * 0.06})`,
          }}
        />
      );
    }
    if (tipo === 'barras') {
      // faixas entrando de lados alternados: virada com cara de vinheta
      const faixas = 6;
      return (
        <div style={base}>
          {Array.from({ length: faixas }, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(i * 100) / faixas}%`,
                height: `${100 / faixas + 0.5}%`,
                backgroundColor: i % 2 === 0 ? estilo.highlightColor : estilo.highlightColor2,
                transform: `translateX(${(1 - p) * 105 * (i % 2 === 0 ? 1 : -1)}%)`,
              }}
            />
          ))}
        </div>
      );
    }
    if (tipo === 'deslize') {
      // o painel que entra atrás enquanto a imagem sai
      return <div style={{ ...base, backgroundColor: '#000', zIndex: -1 }} />;
    }
    // whip, zoom e giro acontecem no próprio vídeo; aqui só um escurecido curto
    return <div style={{ ...base, backgroundColor: '#000', opacity: p * 0.25 }} />;
  })();

  // a foto, quando existe, sempre vai por cima do fundo que a animação desenhou
  return (
    <div style={base}>
      {fundo}
      {foto}
    </div>
  );
}
