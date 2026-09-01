/**
 * Serviço local de transcrição.
 * Roda na sua máquina, chama o FFmpeg e o whisper.cpp que você já usa,
 * e devolve as palavras com tempo — o mesmo formato que a plataforma consome.
 *
 *   node server/index.mjs
 *
 * Nada sai do computador: o áudio nunca é enviado para lugar nenhum.
 */
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aplicarCorrecoes,
  conferirFerramentas,
  detectarCortes,
  lerConfig,
  lerCorrecoes,
  sondarVideo,
  transcreverVideo,
} from '../agente/nucleo.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serve a própria plataforma (pasta dist), para bastar um processo só. */
async function servirEstatico(res, caminho) {
  const dist = path.join(aqui, '..', 'dist');
  let alvo = path.join(dist, caminho === '/' ? 'index.html' : decodeURIComponent(caminho));
  if (!alvo.startsWith(dist)) return json(res, 403, { erro: 'caminho inválido' });
  try {
    if (!(await stat(alvo)).isFile()) alvo = path.join(dist, 'index.html');
  } catch {
    alvo = path.join(dist, 'index.html');
  }
  try {
    const corpo = await readFile(alvo);
    res.writeHead(200, { 'content-type': TIPOS[path.extname(alvo)] ?? 'application/octet-stream' });
    res.end(corpo);
  } catch {
    json(res, 404, { erro: 'a plataforma ainda não foi construída — rode: npm run build' });
  }
}

function json(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(texto);
}

const cfg = await lerConfig();

/*
 * O render roda solto e anota o andamento em render/.estado.json.
 *
 * Guardar isso na memória do serviço foi erro: qualquer reinício (o
 * --watch reinicia a cada edição) matava o render e perdia o progresso.
 * Agora o filho é destacado e o estado vive em disco.
 */
const ARQUIVO_ESTADO = path.join(aqui, '..', 'render', '.estado.json');

async function lerEstadoRender() {
  try {
    return JSON.parse(await readFile(ARQUIVO_ESTADO, 'utf8'));
  } catch {
    return { rodando: false, progresso: 0, saida: null, erro: null };
  }
}

async function escreverEstadoRender(estado) {
  await mkdir(path.dirname(ARQUIVO_ESTADO), { recursive: true });
  await writeFile(ARQUIVO_ESTADO, JSON.stringify(estado), 'utf8');
}

async function iniciarRender(arquivoProjeto, nomeSaida) {
  const filho = spawn(
    process.execPath,
    [path.join(aqui, '..', 'render', 'render.mjs'), arquivoProjeto, '--saida', nomeSaida],
    { cwd: path.join(aqui, '..'), windowsHide: true, detached: true, stdio: 'ignore' },
  );
  /* o pid vai para o estado: é por ele que o cancelar encontra o processo */
  await escreverEstadoRender({
    rodando: true,
    progresso: 0,
    saida: null,
    erro: null,
    pid: filho.pid,
    inicio: Date.now(),
  });
  filho.unref();
}

/*
 * Histórico de versões.
 *
 * O salvamento automático grava a cada poucos segundos; versionar tudo encheria
 * o disco de cópias iguais. Guardamos uma a cada VINTE minutos de trabalho, e
 * ficamos com as vinte últimas — o suficiente para voltar de um estrago sem
 * virar um museu.
 */
const ESPACO_ENTRE_VERSOES = 20 * 60 * 1000;
const VERSOES_GUARDADAS = 20;

function pastaDeVersoes(arquivo) {
  return path.join(aqui, '..', 'projeto', '.versoes', path.basename(arquivo, '.json'));
}

async function guardarVersao(arquivo, caminhoAtual, forcar = false) {
  if (!existsSync(caminhoAtual)) return; // primeiro salvamento: não há o que guardar
  try {
    const pasta = pastaDeVersoes(arquivo);
    await mkdir(pasta, { recursive: true });
    const existentes = (await readdir(pasta)).filter((n) => n.endsWith('.json')).sort();

    const ultima = existentes[existentes.length - 1];
    if (ultima && !forcar) {
      const quando = Number(path.basename(ultima, '.json'));
      if (Number.isFinite(quando) && Date.now() - quando < ESPACO_ENTRE_VERSOES) return;
    }

    await copyFile(caminhoAtual, path.join(pasta, `${Date.now()}.json`));

    const sobrando = [...existentes, 'novo'].length - VERSOES_GUARDADAS;
    for (let i = 0; i < sobrando; i++) {
      await rm(path.join(pasta, existentes[i]), { force: true });
    }
  } catch {
    /* não conseguir versionar nunca pode impedir o usuário de salvar */
  }
}

/** vira nome de arquivo seguro: "Reajuste ANS — gancho" -> "Reajuste ANS - gancho.json" */
function nomeDeArquivo(bruto) {
  const limpo = String(bruto)
    .replace(/\.json$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${limpo || 'projeto'}.json`;
}

/*
 * Alguns componentes codificam o endereço mais de uma vez, e "Corte 15.json"
 * chega como "Corte%2520 15.json". Decodificamos até parar de mudar, senão
 * projeto com espaço ou acento no nome simplesmente não abre o vídeo.
 */
function nomePedido(caminho) {
  let atual = caminho;
  for (let i = 0; i < 3; i++) {
    let proximo;
    try {
      proximo = decodeURIComponent(atual);
    } catch {
      break;
    }
    if (proximo === atual) break;
    atual = proximo;
  }
  return path.basename(atual);
}

const servidor = createServer((req, res) => {
  /*
   * Qualquer erro solto aqui dentro derrubava o processo: o usuário perdia o
   * serviço no meio do trabalho, com a plataforma aberta na tela. Agora a
   * requisição falha sozinha e o resto continua de pé.
   */
  atender(req, res).catch((e) => {
    console.error('Erro ao atender', req.method, req.url, '→', e?.message ?? e);
    if (!res.headersSent) json(res, 500, { erro: e?.message ?? 'erro inesperado' });
    else res.end();
  });
});

async function atender(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') return json(res, 204, {});

  /*
   * Abrir um projeto inteiro pela plataforma.
   *
   * O navegador não abre arquivo do disco por caminho, mas o serviço local
   * abre. Assim o usuário escolhe o projeto numa lista e recebe legenda,
   * ajustes E o vídeo — sem precisar arrastar nada.
   */
  /* Correções que se repetem em todo vídeo: "INS" -> "ANS", nomes de clientes. */
  if (url.pathname === '/correcoes' && req.method === 'GET') {
    return json(res, 200, { correcoes: await lerCorrecoes() });
  }

  if (url.pathname === '/correcoes' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const lista = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!Array.isArray(lista)) return json(res, 400, { erro: 'esperava uma lista' });
      const limpa = lista
        .filter((c) => c && typeof c.de === 'string' && typeof c.para === 'string')
        .map((c) => ({ de: c.de.trim(), para: c.para.trim() }))
        .filter((c) => c.de && c.para);
      await writeFile(path.join(aqui, '..', 'correcoes.json'), JSON.stringify(limpa, null, 2), 'utf8');
      return json(res, 200, { ok: true, correcoes: limpa });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Aplicar as correções numa legenda que já existe. */
  if (url.pathname === '/corrigir' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const { palavras } = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!Array.isArray(palavras)) return json(res, 400, { erro: 'esperava palavras' });
      return json(res, 200, { palavras: aplicarCorrecoes(palavras, await lerCorrecoes()) });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Estilos de marca salvos, para aplicar em série. */
  if (url.pathname === '/presets' && req.method === 'GET') {
    try {
      const pasta = path.join(aqui, '..', 'presets');
      const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.json'));
      const lista = [];
      for (const nome of nomes) {
        try {
          lista.push(JSON.parse(await readFile(path.join(pasta, nome), 'utf8')));
        } catch {
          /* preset ilegível fica de fora */
        }
      }
      return json(res, 200, { presets: lista });
    } catch {
      return json(res, 200, { presets: [] });
    }
  }

  if (url.pathname === '/presets' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const preset = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!preset?.nome) return json(res, 400, { erro: 'o preset precisa de um nome' });
      preset.id = preset.id || `p${Date.now()}`;
      const pasta = path.join(aqui, '..', 'presets');
      await mkdir(pasta, { recursive: true });
      await writeFile(path.join(pasta, `${preset.id}.json`), JSON.stringify(preset, null, 2), 'utf8');
      return json(res, 200, { ok: true, preset });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname.startsWith('/presets/') && req.method === 'DELETE') {
    const id = path.basename(decodeURIComponent(url.pathname)).replace(/[^\w.-]/g, '');
    try {
      await rm(path.join(aqui, '..', 'presets', `${id}.json`), { force: true });
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname === '/projetos' && req.method === 'GET') {
    try {
      const pasta = path.join(aqui, '..', 'projeto');
      const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.json'));
      const lista = [];
      for (const nome of nomes) {
        try {
          const caminho = path.join(pasta, nome);
          const j = JSON.parse(await readFile(caminho, 'utf8'));
          const info = await stat(caminho);
          const mp4 = path.join(aqui, '..', 'render', `${path.basename(nome, '.json')}.mp4`);
          lista.push({
            arquivo: nome,
            /* o nome que o usuário deu; o do vídeo é só o segundo melhor */
            nome: j.nomeProjeto ?? j.nome ?? nome,
            arquivoVideo: j.nome ?? null,
            duracao: j.duracao ?? 0,
            palavras: (j.palavras ?? []).length,
            temVideo: !!j.video && existsSync(j.video),
            atualizado: info.mtimeMs,
            exportado: existsSync(mp4),
            template: j.template ?? null,
          });
        } catch {
          /* projeto ilegível: fica de fora da lista */
        }
      }
      return json(res, 200, { projetos: lista });
    } catch {
      return json(res, 200, { projetos: [] });
    }
  }

  /*
   * Gravar o projeto na pasta da máquina.
   *
   * Antes, "Salvar projeto" só baixava um arquivo para a pasta de Downloads:
   * o trabalho saía de onde a plataforma procura e se perdia.
   */
  if (url.pathname === '/projetos' && req.method === 'POST') {
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const corpo = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      const projeto = corpo.projeto ?? corpo;
      if (!Array.isArray(projeto.palavras)) {
        return json(res, 400, { erro: 'projeto sem palavras' });
      }
      const pasta = path.join(aqui, '..', 'projeto');
      await mkdir(pasta, { recursive: true });
      const arquivo = nomeDeArquivo(corpo.arquivo ?? projeto.nomeProjeto ?? projeto.nome ?? 'projeto');
      const caminho = path.join(pasta, arquivo);
      /* voltar para uma versão antiga guarda o estado atual antes, sempre */
      await guardarVersao(arquivo, caminho, url.searchParams.get('versionar') === '1');
      await writeFile(caminho, JSON.stringify(projeto, null, 2), 'utf8');
      return json(res, 200, { ok: true, arquivo });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Apagar um projeto: vai para projeto/.lixeira, não some de vez. */
  if (url.pathname.startsWith('/projetos/') && req.method === 'DELETE') {
    const nome = nomePedido(url.pathname);
    try {
      const pasta = path.join(aqui, '..', 'projeto');
      const lixeira = path.join(pasta, '.lixeira');
      await mkdir(lixeira, { recursive: true });
      await rename(path.join(pasta, nome), path.join(lixeira, `${Date.now()}-${nome}`));
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 404, { erro: e.message });
    }
  }

  /*
   * Miniatura do projeto: um quadro do vídeo, tirado com o FFmpeg.
   *
   * Não usa o render do Remotion de propósito — abrir a lista de projetos
   * não pode depender de subir um Chrome para cada cartão.
   */
  /* As versões guardadas de um projeto, da mais nova para a mais velha. */
  if (url.pathname.startsWith('/versoes/') && req.method === 'GET') {
    const arquivo = nomePedido(url.pathname);
    try {
      const pasta = pastaDeVersoes(arquivo);
      const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.json'));
      const versoes = [];
      for (const nome of nomes) {
        const quando = Number(path.basename(nome, '.json'));
        if (!Number.isFinite(quando)) continue;
        try {
          const j = JSON.parse(await readFile(path.join(pasta, nome), 'utf8'));
          versoes.push({
            arquivo: nome,
            quando,
            palavras: (j.palavras ?? []).length,
            template: j.template ?? null,
            nome: j.nomeProjeto ?? j.nome ?? null,
          });
        } catch {
          /* versão ilegível fica de fora */
        }
      }
      versoes.sort((a, b) => b.quando - a.quando);
      return json(res, 200, { versoes });
    } catch {
      return json(res, 200, { versoes: [] });
    }
  }

  /* O conteúdo de uma versão, para voltar a ela. */
  if (url.pathname.startsWith('/versao/') && req.method === 'GET') {
    const partes = url.pathname.split('/').filter(Boolean); // versao / <projeto> / <versao>
    const projeto = path.basename(decodeURIComponent(partes[1] ?? ''));
    const versao = path.basename(decodeURIComponent(partes[2] ?? ''));
    try {
      const caminho = path.join(pastaDeVersoes(projeto), versao);
      return json(res, 200, JSON.parse(await readFile(caminho, 'utf8')));
    } catch {
      return json(res, 404, { erro: 'versão não encontrada' });
    }
  }

  if (url.pathname.startsWith('/miniatura/') && req.method === 'GET') {
    const nome = nomePedido(url.pathname);
    try {
      const cache = path.join(aqui, '..', 'projeto', '.miniaturas');
      await mkdir(cache, { recursive: true });
      const jpg = path.join(cache, `${path.basename(nome, '.json')}.jpg`);

      if (!existsSync(jpg)) {
        const j = JSON.parse(await readFile(path.join(aqui, '..', 'projeto', nome), 'utf8'));
        if (!j.video || !existsSync(j.video)) return json(res, 404, { erro: 'sem vídeo' });
        const em = Math.min(1, (j.duracao ?? 2) / 3).toFixed(2);
        await new Promise((resolve, reject) => {
          const f = spawn(
            cfg.ffmpeg,
            ['-y', '-ss', em, '-i', j.video, '-frames:v', '1', '-vf', 'scale=-2:320', jpg],
            { windowsHide: true },
          );
          f.on('error', reject);
          f.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg'))));
        });
      }
      const info = await stat(jpg);
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': info.size });
      return createReadStream(jpg).pipe(res);
    } catch (e) {
      return json(res, 404, { erro: e.message });
    }
  }

  if (url.pathname.startsWith('/projetos/') && req.method === 'GET') {
    const nome = nomePedido(url.pathname);
    try {
      return json(res, 200, JSON.parse(await readFile(path.join(aqui, '..', 'projeto', nome), 'utf8')));
    } catch {
      return json(res, 404, { erro: 'projeto não encontrado' });
    }
  }

  /* O vídeo de um projeto, direto de onde ele está no disco. */
  if (url.pathname.startsWith('/video-do-projeto/') && req.method === 'GET') {
    const nome = nomePedido(url.pathname);
    try {
      const j = JSON.parse(await readFile(path.join(aqui, '..', 'projeto', nome), 'utf8'));
      if (!j.video || !existsSync(j.video)) return json(res, 404, { erro: 'vídeo não encontrado' });
      const info = await stat(j.video);
      const faixa = req.headers.range;
      if (faixa) {
        const [de, ate] = faixa.replace(/bytes=/, '').split('-');
        const inicio = Number(de);
        const fim = ate ? Number(ate) : info.size - 1;
        res.writeHead(206, {
          'content-range': `bytes ${inicio}-${fim}/${info.size}`,
          'accept-ranges': 'bytes',
          'content-length': fim - inicio + 1,
          'content-type': 'video/mp4',
        });
        return createReadStream(j.video, { start: inicio, end: fim }).pipe(res);
      }
      res.writeHead(200, {
        'content-length': info.size,
        'accept-ranges': 'bytes',
        'content-type': 'video/mp4',
      });
      return createReadStream(j.video).pipe(res);
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /*
   * Recebe o vídeo que o usuário arrastou e guarda no disco.
   *
   * O render precisa de um arquivo; o navegador só tem um blob. Sem isto,
   * exportar só funcionava para projeto aberto por "Abrir do computador".
   */
  if (url.pathname === '/video-fonte' && req.method === 'POST') {
    const bruto = url.searchParams.get('nome') ?? 'video.mp4';
    const nome = path.basename(bruto).replace(/[^\w.-]/g, '_');
    try {
      const pasta = path.join(aqui, '..', 'render', '.fontes');
      await mkdir(pasta, { recursive: true });
      const alvo = path.join(pasta, nome);
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(alvo, Buffer.concat(pedacos));
      return json(res, 200, { caminho: alvo });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /* Dispara o render do projeto que está aberto na plataforma. */
  if (url.pathname === '/renderizar' && req.method === 'POST') {
    if ((await lerEstadoRender()).rodando) {
      return json(res, 409, { erro: 'já tem um render em andamento' });
    }
    try {
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      const projeto = JSON.parse(Buffer.concat(pedacos).toString('utf8'));
      if (!projeto.video || !existsSync(projeto.video)) {
        return json(res, 400, { erro: 'o projeto não aponta para um vídeo que exista no disco' });
      }
      const base = (projeto.nome ?? 'video').replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '_');
      const pastaProjeto = path.join(aqui, '..', 'projeto');
      await mkdir(pastaProjeto, { recursive: true });
      const arquivoProjeto = path.join(pastaProjeto, `${base}.render.json`);
      await writeFile(arquivoProjeto, JSON.stringify(projeto, null, 2), 'utf8');
      // carimbo de data/hora: sem isto todo export vira o mesmo 01.mp4
      // e não dá para saber se o arquivo é o novo ou o de antes
      const agora = new Date();
      const carimbo = [
        agora.getFullYear(),
        String(agora.getMonth() + 1).padStart(2, '0'),
        String(agora.getDate()).padStart(2, '0'),
        '-',
        String(agora.getHours()).padStart(2, '0'),
        String(agora.getMinutes()).padStart(2, '0'),
      ].join('');
      const saida = path.join(aqui, '..', 'render', `${base}-${carimbo}.mp4`);
      await iniciarRender(arquivoProjeto, saida);
      return json(res, 200, { ok: true, nome: `${base}.mp4` });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  /*
   * Cancelar o render.
   *
   * O processo roda solto (detached), então o serviço guarda o pid no arquivo
   * de estado e mata o processo inteiro — o Chrome do Remotion é filho dele e
   * cai junto, senão ficaria consumindo memória e disco à toa.
   */
  if (url.pathname === '/renderizar' && req.method === 'DELETE') {
    const estado = await lerEstadoRender();
    if (!estado.rodando || !estado.pid) {
      return json(res, 409, { erro: 'não há render em andamento' });
    }
    if (process.platform === 'win32') {
      /* no Windows, matar o pai deixa o Chrome do Remotion vivo comendo memória */
      spawn('taskkill', ['/PID', String(estado.pid), '/T', '/F'], { windowsHide: true });
    } else {
      try {
        process.kill(-estado.pid, 'SIGTERM'); // o grupo inteiro, com os filhos
      } catch {
        try {
          process.kill(estado.pid, 'SIGTERM');
        } catch {
          /* já tinha morrido */
        }
      }
    }
    await escreverEstadoRender({
      rodando: false,
      progresso: estado.progresso ?? 0,
      saida: null,
      erro: 'Cancelado por você.',
    });
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/renderizar' && req.method === 'GET') {
    return json(res, 200, await lerEstadoRender());
  }

  /* Baixar o MP4 pronto. */
  if (url.pathname.startsWith('/render/') && req.method === 'GET') {
    const nome = path.basename(decodeURIComponent(url.pathname));
    const alvo = path.join(aqui, '..', 'render', nome);
    try {
      const info = await stat(alvo);
      res.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': info.size,
        'content-disposition': `attachment; filename="${nome}"`,
      });
      return createReadStream(alvo).pipe(res);
    } catch {
      return json(res, 404, { erro: 'arquivo não encontrado' });
    }
  }

  if (url.pathname === '/status') {
    return json(res, 200, {
      ok: true,
      config: path.basename(cfg.arquivo),
      modelo: path.basename(cfg.modelo),
      modeloEncontrado: existsSync(cfg.modelo),
      whisperEncontrado: existsSync(cfg.whisperCli),
      idioma: cfg.idioma,
    });
  }

  /*
   * Fotos e b-roll ficam em public/midia/ — a mesma pasta que o Remotion
   * empacota no render. Servimos daqui (e não do dist) para uma foto
   * recém-enviada aparecer na prévia sem precisar reconstruir a interface.
   */
  /* Tudo que já foi enviado, inclusive em subpastas. */
  if (url.pathname === '/midia' && req.method === 'GET') {
    const raiz = path.join(aqui, '..', 'public', 'midia');
    const achados = [];
    async function varrer(pasta, prefixo) {
      let itens = [];
      try {
        itens = await readdir(pasta, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of itens) {
        const rel = prefixo ? `${prefixo}/${item.name}` : item.name;
        if (item.isDirectory()) {
          await varrer(path.join(pasta, item.name), rel);
        } else if (/.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v)$/i.test(item.name)) {
          const info = await stat(path.join(pasta, item.name));
          achados.push({
            src: `midia/${rel}`,
            nome: item.name,
            tamanho: info.size,
            video: /.(mp4|webm|mov|m4v)$/i.test(item.name),
          });
        }
      }
    }
    await varrer(raiz, '');
    achados.sort((a, b) => a.src.localeCompare(b.src));
    return json(res, 200, { midia: achados });
  }

  if (url.pathname === '/midia' && req.method === 'POST') {
    const bruto = url.searchParams.get('nome') ?? 'foto.png';
    const nome = path.basename(bruto).replace(/[^\w.-]/g, '_');
    if (!/\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v)$/i.test(nome)) {
      return json(res, 400, { erro: 'formato não suportado' });
    }
    try {
      const pasta = path.join(aqui, '..', 'public', 'midia');
      await mkdir(pasta, { recursive: true });
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(path.join(pasta, nome), Buffer.concat(pedacos));
      console.log(`✓ mídia: ${nome}`);
      return json(res, 200, { src: `midia/${nome}` });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    }
  }

  if (url.pathname.startsWith('/midia/') && req.method === 'GET') {
    // subpastas valem (midia/campanha/x.png); sair da pasta, não
    const raiz = path.join(aqui, '..', 'public', 'midia');
    const relativo = decodeURIComponent(url.pathname).slice('/midia/'.length);
    const alvo = path.join(raiz, relativo);
    if (!alvo.startsWith(raiz)) return json(res, 403, { erro: 'caminho inválido' });
    try {
      const corpo = await readFile(alvo);
      res.writeHead(200, {
        'content-type': TIPOS[path.extname(alvo)] ?? 'application/octet-stream',
        'access-control-allow-origin': '*',
      });
      return res.end(corpo);
    } catch {
      return json(res, 404, { erro: 'mídia não encontrada' });
    }
  }

  /* Onde o vídeo já foi cortado — o FFmpeg mede a virada da imagem. */
  if (url.pathname === '/cortes' && req.method === 'POST') {
    const nome = url.searchParams.get('nome') ?? 'video.mp4';
    const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
    try {
      const entrada = path.join(pasta, path.basename(nome).replace(/[^\w.-]/g, '_'));
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(entrada, Buffer.concat(pedacos));
      const cortes = await detectarCortes(cfg, entrada);
      console.log(`✓ ${nome}: ${cortes.length} cortes`);
      return json(res, 200, { cortes });
    } catch (e) {
      return json(res, 500, { erro: e.message });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  if (url.pathname === '/transcrever' && req.method === 'POST') {
    const nome = url.searchParams.get('nome') ?? 'video.mp4';
    const pasta = await mkdtemp(path.join(tmpdir(), 'mf-'));
    try {
      const entrada = path.join(pasta, path.basename(nome).replace(/[^\w.-]/g, '_'));
      const pedacos = [];
      for await (const c of req) pedacos.push(c);
      await writeFile(entrada, Buffer.concat(pedacos));

      const words = await transcreverVideo(cfg, entrada);
      // o navegador não sabe o fps do arquivo; o ffprobe sabe
      const meta = await sondarVideo(cfg, entrada);
      console.log(`✓ ${nome}: ${words.length} palavras, ${meta.fps}fps`);
      return json(res, 200, { words, ...meta });
    } catch (e) {
      console.error('✗', e.message);
      return json(res, 500, { erro: e.message });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  if (req.method === 'GET') return servirEstatico(res, url.pathname);

  json(res, 404, { erro: 'rota desconhecida' });
}

/*
 * Ao reiniciar (o --watch reinicia a cada edição), o processo novo às vezes
 * tenta subir antes de o antigo soltar a porta. Sem repetir a tentativa, ele
 * morre e o antigo segue servindo código velho — o serviço parece no ar mas
 * responde "rota desconhecida" para tudo que foi criado depois.
 */
function subir() {
  servidor.listen(cfg.porta, () => {
    console.log(`
  Melhores Fimes: http://localhost:${cfg.porta}
`);
    console.log(`  config : ${cfg.arquivo}`);
    console.log(`  whisper: ${existsSync(cfg.whisperCli) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.whisperCli}`);
    console.log(`  modelo : ${existsSync(cfg.modelo) ? 'ok' : 'NÃO ENCONTRADO'} — ${cfg.modelo}`);
  });
}

servidor.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log('  porta ocupada, tentando de novo…');
  setTimeout(() => servidor.listen(cfg.porta), 400);
});

subir();
