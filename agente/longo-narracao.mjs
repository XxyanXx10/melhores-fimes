/**
 * Narração de um vídeo longo, um áudio por segmento (assim dá para refazer só um trecho).
 *
 *   node agente/longo-narracao.mjs ideias/longos/jogo-terror-ia.json
 *
 * Grava em cada segmento "audio" (caminho) e "duracao" (s). Segmento que já tem áudio é pulado;
 * apague o "audio" dele no JSON para gerar de novo.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './banco-cenas.mjs';
import { gerarNarracao } from './voz.mjs';

const cfg = JSON.parse(readFileSync(path.join(RAIZ, 'server', 'config.json'), 'utf8').replace(/^﻿/, ''));
const FFPROBE = (cfg.ffmpeg ?? 'ffmpeg').replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'));

function duracao(arq) {
  return Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).toString().trim());
}

const arquivo = process.argv[2];
const roteiro = JSON.parse(readFileSync(arquivo, 'utf8'));
for (const s of roteiro.segmentos) {
  if (!s.audio || !existsSync(s.audio)) {
    console.log(`  voz: ${s.id}`);
    s.audio = await gerarNarracao(s.texto, `${roteiro.titulo} - ${s.id}`);
  }
  s.duracao = Math.round(duracao(s.audio) * 100) / 100;
  writeFileSync(arquivo, JSON.stringify(roteiro, null, 2));
  console.log(`  ${s.id}: ${s.duracao}s`);
}
const total = roteiro.segmentos.reduce((a, s) => a + s.duracao, 0);
console.log(`total: ${Math.floor(total / 60)}min ${Math.round(total % 60)}s`);
