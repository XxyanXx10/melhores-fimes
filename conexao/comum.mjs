/**
 * Peças usadas pelos dois lados da conexão remota:
 * a estação (PC de casa, que renderiza) e o envio (notebook, que edita).
 */
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const aqui = path.dirname(fileURLToPath(import.meta.url));

/* A raiz do projeto. CONEXAO_RAIZ só existe para testar com outra pasta. */
export const raiz = process.env.CONEXAO_RAIZ ? path.resolve(process.env.CONEXAO_RAIZ) : path.join(aqui, '..');

/* CONEXAO_CONFIG só existe para testar duas máquinas num computador só. */
export const ARQUIVO_CONFIG = process.env.CONEXAO_CONFIG ? path.resolve(process.env.CONEXAO_CONFIG) : path.join(aqui, 'config.json');
export const PORTA_PADRAO = 5180;

/**
 * conexao/config.json (fora do Git: tem a senha). O MESMO arquivo serve nas
 * duas máquinas: a estação usa `porta` e `token`; o notebook usa `servidor` e `token`.
 */
export async function lerConfigRemoto() {
  const cfg = await lerArquivoConfig();
  if (process.env.CONEXAO_TOKEN) cfg.token = process.env.CONEXAO_TOKEN;
  if (process.env.CONEXAO_SERVIDOR) cfg.servidor = process.env.CONEXAO_SERVIDOR;
  if (process.env.CONEXAO_PORTA) cfg.porta = Number(process.env.CONEXAO_PORTA);
  cfg.porta ||= PORTA_PADRAO;
  return cfg;
}

/** O arquivo como está no disco, sem padrões nem variáveis de ambiente (para regravar). */
export async function lerArquivoConfig() {
  try {
    return JSON.parse((await readFile(ARQUIVO_CONFIG, 'utf8')).replace(/^﻿/, ''));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw new Error(`conexao/config.json está com defeito: ${e.message}`);
  }
}

export async function gravarConfigRemoto(cfg) {
  await writeFile(ARQUIVO_CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

export const novoToken = () => randomBytes(24).toString('hex');

/* ---------- pareamento: o notebook pega a senha com um código de 6 dígitos ---------- */

export const novoCodigoDePareamento = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const codigoLegivel = (c) => `${c.slice(0, 3)} ${c.slice(3)}`;

/** Normaliza "pc-casa", "pc-casa:5180" ou "http://100.1.2.3" para http://host:porta. */
export function normalizarServidor(s) {
  let u = String(s).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(u)) u = `http://${u}`;
  if (!/:\d+$/.test(new URL(u).host)) u = `${u}:${PORTA_PADRAO}`;
  return u;
}

/** Troca o código de pareamento pela senha da estação. */
export async function parear(servidor, codigo) {
  const r = await fetch(new URL('/parear', servidor), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ codigo: String(codigo).replace(/\D/g, '') }),
    signal: AbortSignal.timeout(10000),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(dados.erro ?? `erro ${r.status}`), { status: r.status });
  return dados;
}

/* ---------- Tailscale ---------- */

const TAILSCALE_EXE = ['tailscale', 'C:\\Program Files\\Tailscale\\tailscale.exe', 'C:\\Program Files (x86)\\Tailscale\\tailscale.exe'];

/**
 * Como este computador aparece no Tailscale: { instalado, conectado, nome, ip, outros: [...] }.
 * Nunca falha: sem Tailscale, devolve { instalado: false }.
 */
export async function estadoDoTailscale() {
  for (const exe of TAILSCALE_EXE) {
    if (exe.includes('\\') && !existsSync(exe)) continue;
    const r = await new Promise((resolve) =>
      execFile(exe, ['status', '--json'], { timeout: 8000, windowsHide: true }, (erro, saida) => resolve({ erro, saida })),
    );
    if (r.erro?.code === 'ENOENT') continue;
    try {
      const s = JSON.parse(r.saida);
      const eu = s.Self ?? {};
      const nome = (eu.DNSName ?? '').split('.')[0] || eu.HostName;
      return {
        instalado: true,
        conectado: s.BackendState === 'Running',
        estado: s.BackendState,
        nome,
        ip: (eu.TailscaleIPs ?? []).find((i) => i.includes('.')),
        outros: Object.values(s.Peer ?? {}).map((p) => ({
          nome: (p.DNSName ?? '').split('.')[0] || p.HostName,
          ip: (p.TailscaleIPs ?? []).find((i) => i.includes('.')),
          online: !!p.Online,
          sistema: p.OS,
        })),
      };
    } catch {
      return { instalado: true, conectado: false, estado: 'sem resposta' };
    }
  }
  return { instalado: false, conectado: false };
}

export function tokenConfere(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- impressão digital dos arquivos ---------- */

export function hashDeArquivo(caminho) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(caminho)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

/**
 * Calcular o hash de um vídeo de 2 GB leva tempo. Guardamos o resultado
 * por caminho + tamanho + data de modificação: se nada mudou, não recalcula.
 */
export class MemoriaDeHashes {
  constructor(arquivo) {
    this.arquivo = arquivo;
    this.dados = {};
    this.mudou = false;
  }
  async carregar() {
    try {
      this.dados = JSON.parse(await readFile(this.arquivo, 'utf8'));
    } catch {
      this.dados = {};
    }
    return this;
  }
  async hash(caminho) {
    const info = await stat(caminho);
    const chave = path.resolve(caminho).toLowerCase();
    const marca = `${info.size}|${Math.round(info.mtimeMs)}`;
    const guardado = this.dados[chave];
    if (guardado && guardado.marca === marca) return { hash: guardado.hash, tamanho: info.size };
    const hash = await hashDeArquivo(caminho);
    this.dados[chave] = { marca, hash };
    this.mudou = true;
    return { hash, tamanho: info.size };
  }
  async salvar() {
    if (!this.mudou) return;
    await mkdir(path.dirname(this.arquivo), { recursive: true });
    await writeFile(this.arquivo, JSON.stringify(this.dados), 'utf8');
    this.mudou = false;
  }
}

/** Id de um arquivo na estação: hash + extensão (o FFmpeg gosta de extensão). */
export function idDoArquivo(hash, nomeOriginal) {
  const ext = path.extname(nomeOriginal).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 9);
  return hash + (ext.length > 1 ? ext : '');
}
export const ID_VALIDO = /^[a-f0-9]{64}(\.[a-z0-9]{1,8})?$/;

/* ---------- o código que decide como o vídeo sai ---------- */

/**
 * Se o notebook tem uma mudança no template que o PC de casa não tem,
 * o vídeo volta diferente da prévia. Estes são os arquivos que mudam o
 * resultado do render; os dois lados comparam antes de começar.
 */
const CODIGO_FIXO = [
  'render/render.mjs',
  'agente/nucleo.mjs',
  'agente/masterizar.mjs',
  'package.json',
  'remotion.config.ts',
];
const PASTAS_DE_CODIGO = ['src'];
const EXT_CODIGO = /\.(tsx?|jsx?|mjs|cjs|json|css)$/i;

export function caminhoDeCodigoPermitido(rel) {
  const r = rel.replace(/\\/g, '/');
  if (r.includes('..') || path.isAbsolute(r)) return false;
  if (CODIGO_FIXO.includes(r)) return true;
  return PASTAS_DE_CODIGO.some((p) => r.startsWith(p + '/')) && EXT_CODIGO.test(r);
}

async function listarRecursivo(pasta, base = pasta) {
  let saida = [];
  let itens;
  try {
    itens = await readdir(pasta, { withFileTypes: true });
  } catch {
    return saida;
  }
  for (const it of itens) {
    const cheio = path.join(pasta, it.name);
    if (it.isDirectory()) saida = saida.concat(await listarRecursivo(cheio, base));
    else if (it.isFile()) saida.push(path.relative(base, cheio).replace(/\\/g, '/'));
  }
  return saida;
}

/* fim de linha diferente (CRLF/LF) entre as máquinas não é diferença de verdade */
async function hashDeTexto(caminho) {
  const texto = (await readFile(caminho, 'utf8')).replace(/\r\n/g, '\n');
  return createHash('sha256').update(texto).digest('hex');
}

export async function manifestoDoCodigo(pastaRaiz = raiz) {
  const rels = [...CODIGO_FIXO];
  for (const p of PASTAS_DE_CODIGO) {
    for (const r of await listarRecursivo(path.join(pastaRaiz, p))) {
      const rel = `${p}/${r}`;
      if (EXT_CODIGO.test(rel)) rels.push(rel);
    }
  }
  const manifesto = {};
  for (const rel of rels) {
    const cheio = path.join(pastaRaiz, rel);
    if (existsSync(cheio)) manifesto[rel] = await hashDeTexto(cheio);
  }
  return manifesto;
}

/* ---------- miudezas ---------- */

export function carimbo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function nomeSeguro(s) {
  return String(s ?? 'video')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 80) || 'video';
}

export function bytesLegiveis(n) {
  if (!Number.isFinite(n)) return '?';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i >= 2 ? 1 : 0)} ${u[i]}`;
}

export function duracaoLegivel(seg) {
  if (!Number.isFinite(seg) || seg < 0) return '?';
  seg = Math.round(seg);
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  if (m < 60) return `${m}min ${String(seg % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
}

/**
 * Percorre um projeto e devolve uma cópia trocando strings.
 * `trocar(texto)` devolve o texto novo, ou undefined para manter.
 */
export function trocarStrings(valor, trocar) {
  if (typeof valor === 'string') return trocar(valor) ?? valor;
  if (Array.isArray(valor)) return valor.map((v) => trocarStrings(v, trocar));
  if (valor && typeof valor === 'object') {
    const novo = {};
    for (const [k, v] of Object.entries(valor)) novo[k] = trocarStrings(v, trocar);
    return novo;
  }
  return valor;
}

export function cadaString(valor, fazer) {
  trocarStrings(valor, (s) => {
    fazer(s);
    return undefined;
  });
}

/* ---------- uso da máquina (para o painel mostrar quem está trabalhando) ---------- */

let cpuAntes = null;
function amostraCpu() {
  let ocioso = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const [k, v] of Object.entries(c.times)) {
      total += v;
      if (k === 'idle') ocioso += v;
    }
  }
  return { ocioso, total };
}

let gpuCache = { quando: 0, valor: undefined };
function lerGpu() {
  if (Date.now() - gpuCache.quando < 2000 && gpuCache.valor !== undefined) return Promise.resolve(gpuCache.valor);
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 4000, windowsHide: true },
      (erro, saida) => {
        let valor = null;
        if (!erro) {
          const [nome, uso, usada, total] = String(saida).split('\n')[0].split(',').map((x) => x.trim());
          if (nome) valor = { nome, uso: Number(uso), memoria: Number(usada) / Number(total) };
        }
        gpuCache = { quando: Date.now(), valor };
        resolve(valor);
      },
    );
  });
}

/** { cpu: 0..1, memoria: 0..1, gpu: {nome, uso 0..100, memoria 0..1} | null } */
export async function usoDaMaquina() {
  const agora = amostraCpu();
  const antes = cpuAntes;
  cpuAntes = agora;
  const cpu = antes && agora.total > antes.total ? 1 - (agora.ocioso - antes.ocioso) / (agora.total - antes.total) : null;
  return {
    cpu,
    memoria: 1 - os.freemem() / os.totalmem(),
    gpu: await lerGpu(),
  };
}
