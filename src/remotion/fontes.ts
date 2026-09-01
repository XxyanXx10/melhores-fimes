/**
 * Carrega as fontes dentro da composição.
 *
 * As fontes moram em public/fontes (baixadas uma vez por agente/fontes.mjs).
 * Antes vinham do Google a cada render: sem internet, o MP4 saía com fonte
 * de sistema e ninguém percebia até o final — a prévia mentia sobre o
 * resultado. Agora prévia e render leem o mesmo arquivo do disco.
 */
import { continueRender, delayRender, staticFile } from 'remotion';

/** o que a composição precisa ter pronto antes de desenhar a primeira legenda */
const NECESSARIAS = [
  '400 16px "Anton"',
  '400 16px "Archivo Black"',
  '400 16px "Bebas Neue"',
  '700 16px "Caveat"',
  '900 16px "Inter"',
  '900 16px "Montserrat"',
  '700 16px "Playfair Display"',
  'italic 700 16px "Playfair Display"',
  '800 16px "Poppins"',
  '700 16px "Roboto Condensed"',
];

const CSS_LOCAL = 'fontes/fontes.css';
let carregadas = false;

/** chamado uma vez pela composição, antes de desenhar qualquer legenda */
export function carregarFontes() {
  if (carregadas || typeof document === 'undefined') return;
  carregadas = true;

  const espera = delayRender('Carregando as fontes locais');
  const pronto = () =>
    Promise.all(NECESSARIAS.map((f) => document.fonts.load(f).catch(() => undefined)))
      .then(() => continueRender(espera))
      .catch(() => continueRender(espera));

  const href = staticFile(CSS_LOCAL);
  const jaTem = [...document.styleSheets].some((s) => s.href?.includes(CSS_LOCAL));

  if (jaTem) {
    void pronto();
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.onload = () => void pronto();
  /* sem as fontes o vídeo ainda sai, com a fonte do sistema — não travamos o render */
  link.onerror = () => continueRender(espera);
  document.head.appendChild(link);
}
