export type Animation = 'none' | 'pop' | 'fade' | 'slide-up' | 'typewriter';
export type Backdrop = 'none' | 'shadow' | 'box' | 'stroke';

export type CaptionStyle = {
  fontFamily: string;
  fontWeight: number;
  uppercase: boolean;
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
};

export type Template = {
  id: string;
  name: string;
  family: string;
  description: string;
  swatch: [string, string];
  style: CaptionStyle;
};

export type Word = { text: string; start: number; end: number };

export type Block = {
  id: string;
  start: number;
  end: number;
  words: Word[];
  /** índice da palavra destacada dentro do bloco */
  highlight: number;
};

export type Scene = {
  id: string;
  label: string;
  start: number;
  end: number;
};
