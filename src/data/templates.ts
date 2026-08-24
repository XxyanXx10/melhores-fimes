import type { CaptionStyle, Template } from '../types';

/** valores comuns a todo modelo — cada um sobrescreve só o que muda */
const base: CaptionStyle = {
  fontFamily: 'Inter, sans-serif',
  fontWeight: 800,
  uppercase: true,
  italic: false,
  fontSize: 7,
  letterSpacing: 0,
  color: '#ffffff',
  highlightColor: '#ffd60a',
  backdrop: 'shadow',
  backdropColor: '#000000',
  animation: 'pop',
  wordsPerBlock: 3,
  positionY: 72,
  safeMargin: 10,
  highlightWords: true,
  highlightStyle: 'color',
  highlightBg: '#ffd60a',
  highlightColor2: '#ff5ea8',
  autoEnfase: 'off',
  emphases: [
    { color: '#ffd60a', fontFamily: "'Caveat', cursive", italic: false, uppercase: false },
    // slot 2 é serifada de propósito: precisa destoar da base, não só mudar de cor
    { color: '#3aa0ff', fontFamily: "'Playfair Display', Georgia, serif", italic: true, uppercase: false },
  ],
};

function modelo(
  id: string,
  name: string,
  family: string,
  description: string,
  swatch: [string, string],
  style: Partial<CaptionStyle>,
): Template {
  return { id, name, family, description, swatch, style: { ...base, ...style } };
}

export const templates: Template[] = [
  /* ---------- Port1 / CPS: os que já existiam ---------- */
  modelo(
    'port1-autoridade',
    'Port1 — Autoridade',
    'Port1',
    'Bloco sólido, poucas palavras, leitura firme. Para abertura e afirmações.',
    ['#0b1220', '#ffd60a'],
    {
      fontFamily: "'Archivo Black', Inter, sans-serif",
      fontWeight: 900,
      fontSize: 7.5,
      letterSpacing: -0.5,
      highlightColor: '#ffd60a',
    },
  ),
  modelo(
    'port1-provocativo',
    'Port1 — Provocativo',
    'Port1',
    'Palavra a palavra, alto contraste e caixa colorida no destaque.',
    ['#111111', '#ff3b30'],
    {
      fontFamily: "'Anton', Inter, sans-serif",
      fontWeight: 400,
      fontSize: 9,
      letterSpacing: 0.5,
      highlightColor: '#ffffff',
      highlightStyle: 'box',
      highlightBg: '#ff3b30',
      backdrop: 'stroke',
      animation: 'slide-up',
      wordsPerBlock: 2,
      positionY: 60,
      safeMargin: 12,
    },
  ),
  modelo(
    'cps-institucional',
    'CPS — Institucional',
    'CPS',
    'Sóbrio, caixa escura, ritmo calmo. Para conteúdo explicativo.',
    ['#0f2b46', '#7fd1ff'],
    {
      fontFamily: 'Inter, sans-serif',
      fontWeight: 600,
      uppercase: false,
      fontSize: 5,
      backdrop: 'box',
      backdropColor: 'rgba(10,24,40,0.78)',
      animation: 'fade',
      wordsPerBlock: 6,
      positionY: 80,
      safeMargin: 8,
      highlightWords: false,
      highlightColor: '#7fd1ff',
    },
  ),

  /* ---------- Dinâmica: acumula palavra por palavra na tela ---------- */
  modelo(
    'dinamica-palavra',
    'Dinâmica — Palavra a palavra',
    'Dinâmica',
    'As palavras vão entrando uma a uma e ficam na tela. Marque *palavra* ou **palavra** para trocar a fonte e a cor.',
    ['#101010', '#ffd60a'],
    {
      fontFamily: "'Anton', Inter, sans-serif",
      fontWeight: 400,
      uppercase: true,
      fontSize: 9,
      letterSpacing: 0,
      color: '#ffffff',
      highlightWords: false,
      backdrop: 'stroke',
      backdropColor: '#000000',
      animation: 'typewriter',
      wordsPerBlock: 6,
      positionY: 30,
      safeMargin: 8,
      // já vem trocando a fonte sozinho: a palavra mais forte de cada bloco
      autoEnfase: 'chave',
      // as ênfases vêm do base: manuscrita amarela e serifada azul
    },
  ),
  modelo(
    'dinamica-karaoke',
    'Dinâmica — Com karaokê',
    'Dinâmica',
    'Mesma entrada palavra a palavra, mas a que está sendo falada acende. Marcações continuam valendo.',
    ['#0d0d0d', '#22ff88'],
    {
      fontFamily: "'Montserrat', Inter, sans-serif",
      fontWeight: 900,
      uppercase: true,
      fontSize: 8,
      letterSpacing: -0.5,
      color: '#ffffff',
      highlightColor: '#22ff88',
      highlightStyle: 'scale',
      backdrop: 'stroke',
      backdropColor: '#000000',
      animation: 'typewriter',
      wordsPerBlock: 5,
      positionY: 34,
      safeMargin: 8,
    },
  ),

  /* ---------- Prisma: serifada itálica, destaque em gradiente ---------- */
  modelo(
    'prisma-pro',
    'Prisma — Pro',
    'Prisma',
    'Serifada itálica, caixa mista, discreta. A palavra falada acende em gradiente.',
    ['#0d0b14', '#c8a2ff'],
    {
      fontFamily: "'Playfair Display', Georgia, serif",
      fontWeight: 700,
      uppercase: false,
      italic: true,
      fontSize: 6.5,
      letterSpacing: 0,
      color: '#ffffff',
      highlightColor: '#c8a2ff',
      highlightColor2: '#7fd1ff',
      highlightStyle: 'gradient',
      backdrop: 'shadow',
      backdropColor: 'rgba(0,0,0,0.55)',
      animation: 'fade',
      wordsPerBlock: 4,
      positionY: 70,
      safeMargin: 12,
    },
  ),
  modelo(
    'prisma-forte',
    'Prisma — Forte',
    'Prisma',
    'Mesma ideia em sans pesada e caixa alta: o gradiente corre na palavra falada.',
    ['#150a1e', '#ff5ea8'],
    {
      fontFamily: "'Poppins', Inter, sans-serif",
      fontWeight: 800,
      uppercase: true,
      fontSize: 7.5,
      letterSpacing: -0.5,
      color: '#ffffff',
      highlightColor: '#ff5ea8',
      highlightColor2: '#ffd60a',
      highlightStyle: 'gradient',
      backdrop: 'shadow',
      animation: 'pop',
      wordsPerBlock: 3,
      positionY: 70,
    },
  ),

  /* ---------- Dinâmicos: karaokê palavra a palavra ---------- */
  modelo(
    'karaoke-neon',
    'Karaokê — Neon',
    'Karaokê',
    'Uma palavra por vez, caixa verde acesa no que está sendo falado. Muito ritmo.',
    ['#04150f', '#22ff88'],
    {
      fontFamily: "'Montserrat', Inter, sans-serif",
      fontWeight: 900,
      fontSize: 8.5,
      letterSpacing: -0.5,
      color: '#ffffff',
      highlightColor: '#04150f',
      highlightStyle: 'box',
      highlightBg: '#22ff88',
      backdrop: 'shadow',
      animation: 'pop',
      wordsPerBlock: 1,
      positionY: 66,
    },
  ),
  modelo(
    'karaoke-ciano',
    'Karaokê — Ciano',
    'Karaokê',
    'Três palavras, a falada acende em ciano. O mais versátil para cortes de fala.',
    ['#001b24', '#00e5ff'],
    {
      fontFamily: "'Bebas Neue', Inter, sans-serif",
      fontWeight: 400,
      fontSize: 9.5,
      letterSpacing: 1,
      highlightColor: '#00e5ff',
      highlightStyle: 'scale',
      backdrop: 'stroke',
      backdropColor: '#000000',
      animation: 'pop',
      wordsPerBlock: 3,
      positionY: 68,
    },
  ),

  /* ---------- Impacto: título grande, poucas palavras ---------- */
  modelo(
    'impacto-grito',
    'Impacto — Grito',
    'Impacto',
    'Letra gigante, duas palavras, contorno grosso. Para gancho e virada.',
    ['#140000', '#ff2d55'],
    {
      fontFamily: "'Anton', Inter, sans-serif",
      fontWeight: 400,
      fontSize: 12,
      letterSpacing: -1,
      highlightColor: '#ff2d55',
      highlightStyle: 'scale',
      backdrop: 'stroke',
      backdropColor: '#000000',
      animation: 'pop',
      wordsPerBlock: 2,
      positionY: 45,
      safeMargin: 12,
    },
  ),
  modelo(
    'impacto-sublinhado',
    'Impacto — Sublinhado',
    'Impacto',
    'Traço amarelo correndo por baixo da palavra falada. Firme sem gritar.',
    ['#1a1400', '#ffd60a'],
    {
      fontFamily: "'Montserrat', Inter, sans-serif",
      fontWeight: 800,
      fontSize: 7,
      highlightColor: '#ffffff',
      highlightStyle: 'underline',
      highlightBg: '#ffd60a',
      backdrop: 'shadow',
      animation: 'slide-up',
      wordsPerBlock: 4,
      positionY: 74,
    },
  ),

  /* ---------- Claro: caixa branca, texto escuro ---------- */
  modelo(
    'papel-claro',
    'Papel — Claro',
    'Papel',
    'Caixa branca com texto escuro. Legível em cima de qualquer imagem.',
    ['#f2f2f2', '#111111'],
    {
      fontFamily: "'Poppins', Inter, sans-serif",
      fontWeight: 800,
      uppercase: false,
      fontSize: 5.5,
      color: '#101318',
      highlightColor: '#ffffff',
      highlightStyle: 'box',
      highlightBg: '#ff3b30',
      backdrop: 'box',
      backdropColor: 'rgba(255,255,255,0.94)',
      animation: 'fade',
      wordsPerBlock: 5,
      positionY: 76,
    },
  ),

  /* ---------- Editorial: elegante, minúsculas ---------- */
  modelo(
    'editorial-serifa',
    'Editorial — Serifa',
    'Editorial',
    'Serifada em minúsculas, sem gritaria. Para depoimento e reflexão.',
    ['#12100c', '#e8d5a8'],
    {
      fontFamily: "'Playfair Display', Georgia, serif",
      fontWeight: 700,
      uppercase: false,
      fontSize: 6,
      letterSpacing: 0,
      color: '#fdf8ee',
      highlightColor: '#e8d5a8',
      highlightStyle: 'color',
      backdrop: 'shadow',
      animation: 'fade',
      wordsPerBlock: 5,
      positionY: 78,
    },
  ),

  /* ---------- Limpo e discreto ---------- */
  modelo(
    'minimal-legenda',
    'Minimal — Legenda',
    'Minimal',
    'Discreto, embaixo, sem destaque. Quando a imagem é a estrela.',
    ['#0a0a0a', '#dddddd'],
    {
      fontFamily: "'Roboto Condensed', Inter, sans-serif",
      fontWeight: 700,
      uppercase: false,
      fontSize: 4.2,
      color: '#f2f2f2',
      backdrop: 'shadow',
      animation: 'fade',
      wordsPerBlock: 7,
      positionY: 84,
      safeMargin: 8,
      highlightWords: false,
    },
  ),
  modelo(
    'maquina-datilografo',
    'Máquina — Datilógrafo',
    'Minimal',
    'As palavras aparecem uma a uma, como digitadas. Bom para listas e regras.',
    ['#00140a', '#9dff6a'],
    {
      fontFamily: "'Roboto Condensed', Inter, sans-serif",
      fontWeight: 700,
      fontSize: 6,
      letterSpacing: 1,
      color: '#9dff6a',
      highlightColor: '#ffffff',
      highlightStyle: 'color',
      backdrop: 'shadow',
      animation: 'typewriter',
      wordsPerBlock: 4,
      positionY: 70,
    },
  ),
];

export const defaultTemplateId = templates[0].id;

/** modelos agrupados por família, para a lista da barra lateral */
export const familias = [...new Set(templates.map((t) => t.family))];

/**
 * O estilo final: o cartão escolhido mais os ajustes do usuário por cima.
 * Uma implementação só, usada pela interface e pela composição do Remotion —
 * se cada lado mesclasse do seu jeito, prévia e MP4 divergiriam.
 */
export function resolverEstilo(
  templateId: string,
  override: Partial<CaptionStyle> = {},
): CaptionStyle {
  const t = templates.find((x) => x.id === templateId) ?? templates[0];
  return { ...t.style, ...override };
}
