/**
 * Montagem a partir de takes.
 *
 * O vídeo não nasce inteiro: nasce em pedaços, um por frase, e cada pedaço
 * começa com a claquete falada — "um, dois, três, gravando". O que serve
 * começa depois dessa palavra.
 *
 * Aqui ficam as contas: onde termina a claquete de cada take, quais trechos
 * ficam, e como as legendas de todos eles viram uma legenda só, com os tempos
 * corridos do vídeo final.
 */
import { trechosDeFala, duracaoDosTrechos, remapear } from './cortes.mjs';

/** o que costuma sair da boca antes da fala que vale */
export const CLAQUETE_PADRAO = ['gravando', 'gravação', 'gravacao', 'ação', 'acao', 'valendo'];

const semAcento = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\wà-ú]/g, '');

/**
 * Onde termina a claquete de um take.
 *
 * Procuramos só no começo (a janela), porque "gravando" pode voltar no meio da
 * fala — "estamos gravando um material novo" não é claquete. Se a palavra
 * aparecer mais de uma vez na janela, vale a última: é comum repetir.
 */
export function fimDaClaquete(palavras, opcoes = {}) {
  const marcadores = (opcoes.marcadores ?? CLAQUETE_PADRAO).map(semAcento);
  const janela = opcoes.janela ?? 12;

  let fim = null;
  for (const w of palavras) {
    if (w.start > janela) break;
    if (marcadores.includes(semAcento(w.text))) fim = w.end;
  }
  return fim;
}

/**
 * Um take pronto para entrar na montagem.
 *
 * `trechos` são os pedaços do arquivo que ficam — depois da claquete e sem os
 * silêncios. `palavras` já vêm sem as da claquete.
 */
export function prepararTake(take, opcoes = {}) {
  const claquete = opcoes.semClaquete ? null : fimDaClaquete(take.palavras, opcoes);
  const depoisDaClaquete = claquete === null ? take.palavras : take.palavras.filter((w) => w.start >= claquete);

  /* nada sobrou: o take é só claquete, ou a transcrição não pegou fala */
  if (!depoisDaClaquete.length) {
    return { ...take, claquete, trechos: [], palavras: [], duracaoUtil: 0, vazio: true };
  }

  const trechos = trechosDeFala(depoisDaClaquete, {
    ...opcoes,
    duracao: take.duracao,
  });

  return {
    ...take,
    claquete,
    trechos,
    palavras: remapear(depoisDaClaquete, trechos),
    duracaoUtil: duracaoDosTrechos(trechos),
    vazio: false,
  };
}

/**
 * Junta os takes num vídeo só.
 *
 * Cada take entra depois do anterior, então as palavras do segundo em diante
 * andam para a frente pelo tanto que já foi tocado. É isso que faz a legenda
 * do vídeo montado bater com a fala.
 */
export function montar(takes, opcoes = {}) {
  const preparados = takes.map((t) => prepararTake(t, opcoes)).filter((t) => !t.vazio);

  let acumulado = 0;
  const palavras = [];
  for (const take of preparados) {
    for (const w of take.palavras) {
      palavras.push({
        ...w,
        start: +(w.start + acumulado).toFixed(3),
        end: +(w.end + acumulado).toFixed(3),
        /* a primeira palavra de cada take abre bloco: a frase começa ali */
        quebra: w === take.palavras[0] && palavras.length ? 'aqui' : w.quebra,
      });
    }
    acumulado += take.duracaoUtil;
  }

  return {
    takes: preparados,
    palavras,
    duracao: +acumulado.toFixed(3),
    descartados: takes.length - preparados.length,
    duracaoBruta: +takes.reduce((s, t) => s + (t.duracao ?? 0), 0).toFixed(3),
  };
}

/** ordena pelo nome do arquivo do jeito que uma pessoa ordenaria: take2 antes de take10 */
export function ordemNatural(a, b) {
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}
