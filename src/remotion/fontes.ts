/**
 * Carrega as fontes dentro da composição.
 *
 * A interface pega as fontes do <link> no index.html, mas o Renderer roda
 * sem index.html nenhum. Sem isto, a legenda sai com fonte de sistema no
 * MP4 e ninguém percebe até o final do render. Carregando aqui, prévia e
 * render usam a mesma fonte pelo mesmo caminho.
 *
 * Pedimos só os pesos que os modelos usam e só o subconjunto latino:
 * sem isso, uma família como a Inter dispara mais de cem requisições e
 * atrasa cada render sem nenhum ganho visível em português.
 */
import { loadFont as anton } from '@remotion/google-fonts/Anton';
import { loadFont as archivoBlack } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as bebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as caveat } from '@remotion/google-fonts/Caveat';
import { loadFont as inter } from '@remotion/google-fonts/Inter';
import { loadFont as montserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as playfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as poppins } from '@remotion/google-fonts/Poppins';
import { loadFont as robotoCondensed } from '@remotion/google-fonts/RobotoCondensed';

let carregadas = false;

/** chamado uma vez pela composição, antes de desenhar qualquer legenda */
export function carregarFontes() {
  if (carregadas) return;
  carregadas = true;
  const s = ['latin', 'latin-ext'] as const;
  const aviso = true;
  anton('normal', { weights: ['400'], subsets: [...s], ignoreTooManyRequestsWarning: aviso });
  archivoBlack('normal', { weights: ['400'], subsets: [...s], ignoreTooManyRequestsWarning: aviso });
  bebasNeue('normal', { weights: ['400'], subsets: [...s], ignoreTooManyRequestsWarning: aviso });
  caveat('normal', { weights: ['700'], subsets: [...s], ignoreTooManyRequestsWarning: aviso });
  inter('normal', {
    weights: ['400', '600', '800', '900'],
    subsets: [...s],
    ignoreTooManyRequestsWarning: aviso,
  });
  montserrat('normal', {
    weights: ['700', '800', '900'],
    subsets: [...s],
    ignoreTooManyRequestsWarning: aviso,
  });
  playfairDisplay('normal', {
    weights: ['700'],
    subsets: [...s],
    ignoreTooManyRequestsWarning: aviso,
  });
  playfairDisplay('italic', {
    weights: ['700'],
    subsets: [...s],
    ignoreTooManyRequestsWarning: aviso,
  });
  poppins('normal', {
    weights: ['600', '800'],
    subsets: [...s],
    ignoreTooManyRequestsWarning: aviso,
  });
  robotoCondensed('normal', {
    weights: ['700'],
    subsets: [...s],
    ignoreTooManyRequestsWarning: aviso,
  });
}
