/**
 * Configura a conexão entre os computadores (grava conexao/config.json).
 *
 * No PC de casa (a estação), uma vez:
 *   node conexao/configurar.mjs --nome "PC de casa"
 *     → cria a senha e mostra um CÓDIGO DE 6 DÍGITOS (vale 15 min).
 *
 * No notebook, com esse código:
 *   node conexao/configurar.mjs --servidor pc-casa --codigo 123456
 *     → busca a senha no PC de casa pelo Tailscale e grava aqui.
 *   (ou, sem código: --servidor pc-casa --token <senha inteira>)
 *
 *   node conexao/configurar.mjs --parear      (PC de casa) gera outro código
 *   node conexao/configurar.mjs --mostrar     mostra como está (senha escondida)
 *   node conexao/configurar.mjs --nova-senha  troca a senha (aí pareie o notebook de novo)
 *   node conexao/configurar.mjs --json        estado em JSON (para o painel e assistentes)
 */
import os from 'node:os';
import {
  ARQUIVO_CONFIG,
  PORTA_PADRAO,
  codigoLegivel,
  estadoDoTailscale,
  gravarConfigRemoto,
  lerArquivoConfig,
  normalizarServidor,
  novoCodigoDePareamento,
  novoToken,
  parear,
} from './comum.mjs';

const args = process.argv.slice(2);
const valor = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const tem = (n) => args.includes(`--${n}`);

const cfg = await lerArquivoConfig();
const antes = JSON.stringify(cfg);

if (valor('servidor')) cfg.servidor = normalizarServidor(valor('servidor'));
if (valor('token')) cfg.token = valor('token').trim();
if (valor('nome')) cfg.nome = valor('nome');
if (valor('porta')) cfg.porta = Number(valor('porta'));

if (valor('codigo')) {
  if (!cfg.servidor) {
    console.error('✗ junto com --codigo, diga o endereço do PC de casa: --servidor pc-casa');
    process.exit(1);
  }
  try {
    const r = await parear(cfg.servidor, valor('codigo'));
    cfg.token = r.token;
    console.log(`✓ Pareado com "${r.nome}".`);
  } catch (e) {
    console.error(
      e.status
        ? `✗ ${e.message}`
        : `✗ não consegui falar com ${cfg.servidor} (${e.cause?.code ?? e.message}). O PC de casa está ligado, com o Tailscale e a estação abertos?`,
    );
    process.exit(1);
  }
}

const ehEstacao = !cfg.servidor;
if (tem('nova-senha') || (!cfg.token && ehEstacao)) cfg.token = novoToken();
if (!cfg.nome && ehEstacao) cfg.nome = os.hostname();

/* código novo: pedido explícito, ou primeira configuração da estação */
const primeiraVez = ehEstacao && !JSON.parse(antes || '{}').token;
if (ehEstacao && (tem('parear') || primeiraVez || tem('nova-senha'))) {
  cfg.pareamento = { codigo: novoCodigoDePareamento(), ate: Date.now() + 15 * 60 * 1000 };
}

if (JSON.stringify(cfg) !== antes) await gravarConfigRemoto(cfg);

const ts = await estadoDoTailscale();

if (tem('json')) {
  console.log(
    JSON.stringify(
      {
        arquivo: ARQUIVO_CONFIG,
        papel: ehEstacao ? 'estacao' : 'notebook',
        nome: cfg.nome ?? null,
        servidor: cfg.servidor ?? null,
        porta: cfg.porta ?? PORTA_PADRAO,
        temSenha: !!cfg.token,
        pareamento: cfg.pareamento && cfg.pareamento.ate > Date.now() ? cfg.pareamento : null,
        tailscale: ts,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const escondido = cfg.token ? `${cfg.token.slice(0, 4)}…${cfg.token.slice(-4)}` : '(nenhuma)';
console.log(`conexao/config.json (${ARQUIVO_CONFIG})`);
console.log(`  papel:     ${ehEstacao ? 'ESTAÇÃO (este computador renderiza)' : 'notebook (manda para a estação)'}`);
console.log(`  nome:      ${cfg.nome ?? '-'}`);
console.log(`  servidor:  ${cfg.servidor ?? '-'}`);
console.log(`  porta:     ${cfg.porta ?? PORTA_PADRAO}`);
console.log(`  senha:     ${escondido}`);
console.log(
  `  Tailscale: ${!ts.instalado ? 'NÃO INSTALADO (https://tailscale.com/download)' : ts.conectado ? `conectado como "${ts.nome}" (${ts.ip})` : `instalado, mas ${ts.estado ?? 'desconectado'} — abra e entre na conta`}`,
);

if (ehEstacao && cfg.pareamento && cfg.pareamento.ate > Date.now() && !tem('mostrar')) {
  const nome = ts.nome || os.hostname().toLowerCase();
  const min = Math.round((cfg.pareamento.ate - Date.now()) / 60000);
  const caixa = [`CÓDIGO PARA O NOTEBOOK:   ${codigoLegivel(cfg.pareamento.codigo)}`, `vale por ${min} minutos, uma vez só`];
  const largura = Math.max(...caixa.map((l) => l.length)) + 4;
  console.log(`
  ┌${'─'.repeat(largura)}┐
${caixa.map((l) => `  │  ${l.padEnd(largura - 2)}│`).join('\n')}
  └${'─'.repeat(largura)}┘

No notebook, peça ao Claude:  "conecta no PC de casa: ${nome}, código ${codigoLegivel(cfg.pareamento.codigo)}"
(por baixo ele roda: node conexao/configurar.mjs --servidor ${nome} --codigo ${cfg.pareamento.codigo})

A estação precisa estar aberta para o notebook buscar a senha: conexao\\iniciar-estacao.bat
Código venceu? node conexao/configurar.mjs --parear`);
}
