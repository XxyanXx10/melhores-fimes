/**
 * Configura a conexão entre os computadores (grava remoto/config.json).
 *
 * No PC de casa (a estação), uma vez:
 *   node remoto/configurar.mjs --nome "PC de casa"
 *     → cria a senha e mostra o comando para rodar no notebook.
 *
 * No notebook:
 *   node remoto/configurar.mjs --servidor http://pc-de-casa:5180 --token <senha>
 *
 *   node remoto/configurar.mjs --mostrar     mostra como está (senha escondida)
 *   node remoto/configurar.mjs --nova-senha  troca a senha (aí reconfigure o notebook)
 */
import os from 'node:os';
import { ARQUIVO_CONFIG, PORTA_PADRAO, gravarConfigRemoto, lerConfigRemoto, novoToken } from './comum.mjs';

const args = process.argv.slice(2);
const valor = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const cfg = await lerConfigRemoto();
delete cfg.porta; // lerConfigRemoto preenche o padrão; só grava se alguém pediu
const antes = JSON.stringify(cfg);

if (valor('servidor')) {
  let s = valor('servidor').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(s)) s = `http://${s}`;
  if (!/:\d+$/.test(new URL(s).host)) s = `${s}:${PORTA_PADRAO}`;
  cfg.servidor = s;
}
if (valor('token')) cfg.token = valor('token').trim();
if (valor('nome')) cfg.nome = valor('nome');
if (valor('porta')) cfg.porta = Number(valor('porta'));
if (args.includes('--nova-senha') || !cfg.token) cfg.token = novoToken();
if (!cfg.nome && !cfg.servidor) cfg.nome = os.hostname();

if (JSON.stringify(cfg) !== antes) await gravarConfigRemoto(cfg);

const escondido = cfg.token ? `${cfg.token.slice(0, 4)}…${cfg.token.slice(-4)}` : '(nenhuma)';
console.log(`remoto/config.json (${ARQUIVO_CONFIG})`);
console.log(`  nome:     ${cfg.nome ?? '-'}`);
console.log(`  servidor: ${cfg.servidor ?? '- (este computador é a estação)'}`);
console.log(`  porta:    ${cfg.porta ?? PORTA_PADRAO}`);
console.log(`  senha:    ${args.includes('--mostrar') ? escondido : cfg.token}`);

if (!cfg.servidor && !args.includes('--mostrar')) {
  console.log(`
Este computador vai ser a ESTAÇÃO (quem renderiza).
No notebook, rode (troque o endereço pelo nome deste PC no Tailscale):

  node remoto/configurar.mjs --servidor http://${os.hostname().toLowerCase()}:${cfg.porta ?? PORTA_PADRAO} --token ${cfg.token}

Depois abra a estação aqui: remoto\\iniciar-estacao.bat`);
}
