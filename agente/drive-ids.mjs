/**
 * Lê o índice local do Google Drive para desktop e devolve o link de cada vídeo
 * de uma pasta do Drive (só aparece depois que o arquivo termina de subir).
 *
 *   node agente/drive-ids.mjs "Canal Dark - posts"
 *
 * Copia o banco para um temporário antes (o app do Drive deixa o original travado).
 * Saída: { "arquivo.mp4": "https://drive.google.com/file/d/<id>/view", ... }
 */
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function idsDoDrive(pasta) {
  const base = path.join(process.env.LOCALAPPDATA, 'Google', 'DriveFS');
  const conta = readdirSync(base).find((d) => /^\d+$/.test(d) && existsSync(path.join(base, d, 'metadata_sqlite_db')));
  const tmp = mkdtempSync(path.join(tmpdir(), 'drivefs-'));
  for (const suf of ['', '-wal', '-shm']) {
    const f = path.join(base, conta, `metadata_sqlite_db${suf}`);
    if (existsSync(f)) copyFileSync(f, path.join(tmp, `db${suf}`));
  }
  const db = new DatabaseSync(path.join(tmp, 'db'), { readOnly: true });
  const pai = db.prepare('SELECT stable_id FROM items WHERE local_title = ? AND is_folder = 1').get(pasta);
  if (!pai) return {};
  const filhos = db
    .prepare('SELECT i.local_title AS nome, i.id AS id FROM items i JOIN stable_parents p ON p.item_stable_id = i.stable_id WHERE p.parent_stable_id = ? AND i.is_folder = 0')
    .all(pai.stable_id);
  const saida = {};
  for (const f of filhos) if (f.id && !String(f.id).startsWith('local-')) saida[f.nome] = `https://drive.google.com/file/d/${f.id}/view`;
  return saida;
}

if (process.argv[1]?.endsWith('drive-ids.mjs')) {
  console.log(JSON.stringify(idsDoDrive(process.argv[2] ?? 'Canal Dark - posts'), null, 2));
}
