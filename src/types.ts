export type Animation = 'none' | 'pop' | 'fade' | 'slide-up' | 'typewriter';
export type Backdrop = 'none' | 'shadow' | 'box' | 'stroke';
/** como a palavra falada é marcada (o Captions usa muito 'caixa') */
/** troca de fonte automática, sem marcar nada à mão */
export type AutoEnfase = 'off' | 'alternada' | 'chave';
export type Highlight = 'color' | 'box' | 'underline' | 'scale' | 'gradient';

/** visual de uma palavra enfatizada à mão — fonte e cor próprias */
export type Emphasis = {
  color: string;
  fontFamily: string;
  italic: boolean;
  /** false deixa a palavra em caixa mista mesmo num modelo caixa alta */
  uppercase: boolean;
};

export type CaptionStyle = {
  fontFamily: string;
  fontWeight: number;
  uppercase: boolean;
  italic: boolean;
  /** tamanho relativo à largura da prévia (%) */
  fontSize: number;
  letterSpacing: number;
  color: string;
  highlightColor: string;
  backdrop: Backdrop;
  backdropColor: string;
  animation: Animation;
  wordsPerBlock: number;
  /** posição vertical da legenda em % da altura */
  positionY: number;
  /** margem de segurança lateral em % da largura */
  safeMargin: number;
  highlightWords: boolean;
  /** forma do destaque da palavra falada */
  highlightStyle: Highlight;
  /** cor da caixa/sublinhado do destaque */
  highlightBg: string;
  /** segunda cor do destaque em gradiente (highlightColor -> highlightColor2) */
  highlightColor2: string;
  /** os dois slots de ênfase (aplicados no clique ou automaticamente) */
  emphases: [Emphasis, Emphasis];
  /** aplica ênfase sozinho quando a palavra não foi marcada à mão */
  autoEnfase: AutoEnfase;
};

export type Template = {
  id: string;
  name: string;
  family: string;
  description: string;
  swatch: [string, string];
  style: CaptionStyle;
};

/** ênfase manual numa palavra: 1 ou 2, cada uma com seu visual no template */
export type Word = { text: string; start: number; end: number; emphasis?: 1 | 2 };

export type Block = {
  id: string;
  start: number;
  end: number;
  words: Word[];
  /** índice da palavra destacada dentro do bloco */
  highlight: number;
};

/** um trecho de movimento de câmera aplicado ao vídeo */
export type Zoom = {
  id: string;
  start: number;
  end: number;
  /** escala no início e no fim do trecho (1 = tamanho original) */
  de: number;
  para: number;
  /** ponto para onde a câmera "olha", em % do quadro */
  origemX: number;
  origemY: number;
  /** como a escala caminha do início ao fim do trecho */
  curva: 'linear' | 'saida' | 'entradaSaida';
};

/** como os zooms são gerados a partir da fala */
export type Movimento = 'off' | 'suave' | 'ritmo' | 'natural';

/** uma foto/b-roll entrando por cima do vídeo */
export type Foto = {
  id: string;
  /** caminho dentro de public/ (ex.: "midia/grafico.png") — vale no Player e no render */
  src: string;
  start: number;
  duracao: number;
  entrada: 'fade' | 'escala' | 'sobe';
  /** largura ocupada, em % da largura do quadro */
  largura: number;
  /** centro da foto, em % do quadro */
  x: number;
  y: number;
};

/**
 * Cartão de apoio desenhado pela própria composição.
 *
 * Alternativa à foto: em vez de exportar uma imagem pronta de fora, o
 * texto fica aqui e é animado item a item. Continua editável depois.
 */
export type Cartao = {
  id: string;
  start: number;
  duracao: number;
  titulo?: string;
  itens: string[];
  /** cor de fundo do cartão */
  cor: string;
  /** cor do título, da barra lateral e do último item */
  destaque: string;
  /** centro do cartão e largura, em % do quadro */
  x: number;
  y: number;
  largura: number;
};

/**
 * Tela dividida: enquanto ela dura, o vídeo principal encolhe para um lado
 * e a outra mídia (vídeo ou imagem) ocupa o resto. É o layout de reação.
 */
export type Divisao = {
  id: string;
  /** caminho dentro de public/ — pode ser vídeo ou imagem */
  src: string;
  start: number;
  duracao: number;
  /** onde entra a mídia extra; o principal fica no lado oposto */
  lado: 'cima' | 'baixo' | 'esquerda' | 'direita';
  /** quanto da tela a mídia extra ocupa, em % (50 = metade exata) */
  proporcao: number;
  entrada: 'corte' | 'fade' | 'desliza';
  /** o áudio do vídeo extra atrapalha a fala; por padrão fica mudo */
  mudo: boolean;
};

/** as duas cores do degradê das transições, independentes da legenda */
export type CoresTransicao = [string, string];

/**
 * Um corte encontrado no vídeo.
 *
 * O detector acha todos, mas nem todo corte pede transição — em 25s,
 * sete viradas cansam. Por isso cada um liga e desliga sozinho, e pode
 * ter a própria animação.
 */
export type Corte = {
  t: number;
  ativo: boolean;
  /** ausente = usa a animação escolhida para o vídeo todo */
  tipo?: TipoTransicao;
  /** ausente = usa a duração escolhida para o vídeo todo */
  duracao?: number;
  /** imagem que aparece durante esta transição (caminho dentro de public/) */
  imagem?: string;
};

export type TipoTransicao =
  | 'off'
  | 'flash'
  | 'escurece'
  | 'whip'
  | 'deslize'
  | 'zoom'
  | 'giro'
  | 'cortina'
  | 'barras'
  /** troca de animação a cada corte, para o vídeo não ficar repetitivo */
  | 'variado';

export type Scene = {
  id: string;
  label: string;
  start: number;
  end: number;
};
