# Instalar a conexão — instruções para o assistente

> O dono vai dizer algo como **"procura a pasta conexão, entende o que tem que fazer e instala"**.
> Este arquivo é para você, assistente (Claude ou outro com terminal). Leia inteiro antes de
> começar. Rode os comandos você mesmo e conte o resultado em linguagem simples. O dono não
> digita comandos. Quando um passo depender dele (login, clicar em "Sim" no Windows), diga
> exatamente o que ele vai ver e o que deve clicar.

O que a conexão faz está em [LEIAME.md](LEIAME.md). Em uma frase: o notebook edita, o PC de
casa (RTX 4060) renderiza, e o vídeo volta sozinho. Tem também um painel no navegador e a
pasta do Google Drive como caixa de entrada para vídeos que vêm do celular.

## 0. Em qual computador você está?

| Sinal | Computador | Papel |
|---|---|---|
| `nvidia-smi` responde (placa NVIDIA) | **PC de casa** | estação: recebe e renderiza |
| sem NVIDIA; nome `CPS-MKT` | **notebook** | manda e recebe de volta |

Se não der para ter certeza, pergunte ao dono. Use `node conexao/configurar.mjs --json` para
ver o estado atual: papel, se já tem senha, se o Tailscale está instalado e conectado.

## 1. Nos dois computadores

1. **A pasta `conexao/` está na raiz do projeto?** Se o projeto veio pelo Git, rode `git pull`.
   Se a pasta veio por Drive ou pendrive, copie para `<projeto>/conexao/`.
2. **Node 18+**: `node -v`. Se faltar `node_modules`, rode `npm install`.
3. **Tailscale.** Use o campo `tailscale` do `configurar.mjs --json`.
   - Se não estiver instalado, peça OK e rode `winget install --id Tailscale.Tailscale -e`.
     Ou mande o dono baixar em <https://tailscale.com/download>.
   - Depois **o dono** faz login na janela do Tailscale, com **a mesma conta nos dois
     computadores**. O Google serve. Não faça o login por ele.
   - Confira de novo. O certo é `conectado: true`, e o `nome` aparece. Anote o nome do PC
     de casa: o notebook usa esse nome para achar a estação.

## 2. PC de casa (a estação)

1. **Projeto pronto para renderizar.** O `server/config.json` precisa existir; se não existir,
   copie de `server/config.example.json` e ajuste, como manda o `GUIA_CRIACAO_VIDEOS.md`.
   Ponha `"gpu": true`. Teste rápido: `node render/render.mjs projeto/<algum>.json --still 30 --saida render/teste.png`.
2. **Senha e código:**
   ```bash
   node conexao/configurar.mjs --nome "PC de casa"
   ```
   O comando mostra um **código de 6 dígitos** (vale 15 minutos, uma vez só) e o nome do PC
   no Tailscale. Passe os dois ao dono: ele vai dizer isso ao Claude do notebook. Se o código
   vencer: `node conexao/configurar.mjs --parear`.
3. **Firewall + abrir sozinho com o Windows** (precisa de administrador):
   ```bash
   powershell -Command "Start-Process -Verb RunAs -FilePath '<raiz do projeto>\conexao\instalar-estacao.bat'"
   ```
   Avise antes: *"o Windows vai perguntar se permite alterações: clique em Sim"*. O script:
   - libera as portas 5180 e 5181 **só para aparelhos do Tailscale**;
   - cria o atalho de inicialização;
   - já abre a estação e o painel.

   Para desfazer: `instalar-estacao.bat remover`.
4. **Não deixar o PC dormir na tomada.** Isso muda configuração do sistema: **peça OK antes**.
   ```bash
   powercfg /change standby-timeout-ac 0
   powercfg /change hibernate-timeout-ac 0
   ```
   Desligar só o monitor pode. Suspender não, senão ninguém atende.
5. **Conferir:**
   - `curl http://127.0.0.1:5180/` responde "Estação de render…";
   - o painel abre em <http://localhost:5181>.

   A estação roda numa janela minimizada, "Estação de render". Ela tem que ficar aberta.

## 3. Notebook

1. Com o nome e o código que o PC de casa mostrou:
   ```bash
   node conexao/configurar.mjs --servidor <nome-do-pc-de-casa> --codigo <6 dígitos>
   node conexao/enviar.mjs --ping
   ```
   O `--ping` deve responder com o nome e o processador do PC de casa.
   Também dá para parear pelo painel: abra-o e preencha "Conectar".
2. **Painel:** `node conexao/painel.mjs --abrir` (ou dois cliques em `conexao\abrir-painel.bat`).
   Ele fica em <http://localhost:5181>.

## 4. Google Drive (opcional — vídeos que vêm do celular)

Faça no computador onde o dono quer receber os vídeos. O normal é o PC de casa, porque o
vídeo chega e renderiza ali mesmo, sem a viagem pelo Tailscale.

1. Instale o **Google Drive para computador**: peça OK e rode
   `winget install --id Google.GoogleDrive -e`. **O dono** entra na conta, a mesma do celular.
2. `node conexao/drive.mjs --configurar` acha o "Meu Drive" (normalmente `G:`) e cria as
   pastas `Edição de vídeo/Entrada` e `Edição de vídeo/Prontos`.
3. Sugira ao dono: no Google Drive para computador, marque a pasta "Edição de vídeo" como
   **Disponível off-line**. Assim os vídeos já chegam baixados.

## 5. Celular (Remote Control)

O celular conversa com o Claude, e o Claude roda tudo aqui. Deixe uma sessão do Claude Code
aberta no computador que vai trabalhar, com o **Remote Control** ligado. No app do Claude, no
celular, a sessão aparece em **Code**. Com a estação aberta, o painel também abre no celular
(com o Tailscale instalado nele) em `http://<nome-do-pc>:5181`.

## Depois de instalado: o que cada pedido vira

| O dono diz | Você roda |
|---|---|
| "renderiza no PC de casa" | `node conexao/enviar.mjs "projeto/X.json"` (demora: rode em segundo plano e acompanhe) |
| "renderiza esses 4" | `node conexao/enviar.mjs "projeto/A.json" "projeto/B.json" …` |
| "manda o pronto para o Drive" | acrescente `--pasta drive` |
| "só um frame para eu ver" | `--still 90` |
| "como está a fila?" | `node conexao/enviar.mjs --fila` |
| "cancela" | `node conexao/enviar.mjs --cancelar <id>` |
| "abre o painel" | `node conexao/painel.mjs --abrir` |
| "chegou vídeo no Drive?" | `node conexao/drive.mjs --novos` |
| "edita o vídeo que subi" | `node conexao/drive.mjs --trazer tudo` e depois o fluxo normal (`agente/montar.mjs`, `transcrever.mjs`, `cortar.mjs`…) sobre a cópia em `videos/drive/` |
| "me manda" (depois de renderizar) | `node conexao/drive.mjs --entregar render/<arquivo>.mp4` |
| link do Drive | `node conexao/drive.mjs --achar "<link>"`. Se tiver o conector do Google Drive, pegue o nome do arquivo pelo id. O vídeo em si vem pela pasta sincronizada. |

**Se você está no próprio PC de casa**, não precisa do `enviar.mjs`: renderize direto com
`node render/render.mjs projeto/X.json --gpu --saida <destino>`. O `enviar.mjs` é para quando
você está no notebook.

**Código diferente** (o `enviar.mjs` sai com código 2): o template do notebook não é igual ao
do PC de casa. Pergunte ao dono qual vale. Normalmente vale o do notebook, onde ele editou:
`--levar-codigo`. O caminho limpo é commit + push no notebook e depois
`node conexao/enviar.mjs --atualizar-estacao`.

## Regras

- Não cole a senha (`token`) inteira no chat; o código de 6 dígitos pode.
- `conexao/config.json`, `conexao/.estacao/` e `conexao/.cliente/` são locais e ficam fora do
  Git. Não apague à mão; a estação limpa sozinha o que tem mais de 15 dias.
- Se algo falhar, a tabela "Problemas" do [LEIAME.md](LEIAME.md) diz o que olhar primeiro.
