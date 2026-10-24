/**
 * Roteiro livre (fora da aba Ideias) → voz do Yan → vídeo base do Canal Dark.
 *
 *   node agente/roteiro-livre.mjs ideias/roteiros-livres/pov-mae-chatgpt.json [...mais]
 *
 * Para os formatos que não são notícia (Real ou IA?, Pedi pra IA, vexames,
 * listas, POV…). O arquivo tem { "titulo", "formato", "texto" }. A voz só é
 * gerada uma vez: o caminho do áudio fica gravado no próprio arquivo, e rodar de
 * novo reaproveita. Depois disso o projeto aparece em "pendentes" para o agente
 * montar as cenas, igual aos de notícia.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';
import { gerarNarracao } from './voz.mjs';
import { gerarLoteDark } from './dark.mjs';
import { alinharComRoteiro } from './alinhar.mjs';

async function cfg() {
  return JSON.parse((await readFile(path.join(RAIZ, 'server', 'config.json'), 'utf8')).replace(/^﻿/, ''));
}

export async function produzirRoteiroLivre(arquivo) {
  const r = JSON.parse(await readFile(arquivo, 'utf8'));
  if (!r.titulo || !r.texto) throw new Error(`${arquivo}: falta "titulo" ou "texto"`);
  if (!r.audio || !existsSync(r.audio)) {
    console.log(`  voz: ${r.titulo}`);
    r.audio = await gerarNarracao(r.texto, r.titulo);
    await writeFile(arquivo, JSON.stringify(r, null, 2), 'utf8');
  }
  const c = await cfg();
  console.log(`  vídeo base: ${r.titulo}`);
  const [criado] = await gerarLoteDark([{ caminho: r.audio, titulo: r.titulo }], {
    formato: r.formatoTela ?? '9:16',
    template: r.template ?? c.darkTemplate ?? 'dark-misterio',
    modoFundo: 'escuro',
    gerarCenasRemotion: false,
    buscarImagensReaisWeb: false,
    gerarCartoesChave: false,
    efeitosAutomaticos: false,
    escurecerFundo: true,
    cortarSilenciosAudio: true,
    musicaFundo: c.darkMusica ?? 'midia/magnific-cachito.mp3',
    volumeMusica: 0.1,
  });
  const arqP = path.join(RAIZ, 'projeto', criado.arquivoProjeto);
  const proj = JSON.parse(await readFile(arqP, 'utf8'));
  // legenda com a grafia exata do roteiro (o Whisper só dá o tempo)
  proj.palavras = alinharComRoteiro(proj.palavras ?? [], r.texto);
  proj.formato = r.formato;
  await writeFile(arqP, JSON.stringify(proj, null, 2), 'utf8');
  r.projeto = criado.arquivoProjeto;
  await writeFile(arquivo, JSON.stringify(r, null, 2), 'utf8');
  return criado;
}

if (process.argv[1]?.endsWith('roteiro-livre.mjs')) {
  const arquivos = process.argv.slice(2);
  if (!arquivos.length) {
    console.log('uso: node agente/roteiro-livre.mjs <roteiro.json> [...]');
    process.exit(1);
  }
  // um de cada vez: se um falhar, os outros seguem
  for (const a of arquivos) {
    try {
      const c = await produzirRoteiroLivre(a);
      console.log(`✓ ${c.arquivoProjeto} (${c.duracao} s)`);
    } catch (e) {
      console.log(`✗ ${a}: ${e.message}`);
    }
  }
}
