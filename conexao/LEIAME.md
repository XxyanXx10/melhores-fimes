# Conexão: render no PC de casa

Você edita no notebook e o PC de casa (o da RTX 4060) renderiza. O vídeo volta sozinho para
`render/` do notebook. Enquanto o PC de casa trabalha, o notebook fica livre para o Premiere,
para o próximo vídeo, para o que for.

> **Assistente:** para instalar, siga [INSTALAR.md](INSTALAR.md).

```
 notebook (edita)                         PC de casa (renderiza)
 conexao/enviar.mjs  ── Tailscale ──▶    conexao/estacao.mjs
   IDA: projeto + só o que falta           fila, um render por vez
   ◀── VOLTA: só o MP4 pronto ──           mesmo render/render.mjs de sempre

 celular ── Drive (Entrada) ──▶ PC ──▶ Claude edita ──▶ Drive (Prontos) ──▶ celular
```

## Uma ida e uma volta

- **A edição acontece toda no notebook.** Legenda, cortes, zoom e efeitos ficam num projeto
  `.json` de poucos KB.
- **Ida:** o notebook pergunta ao PC de casa quais arquivos ele já tem e manda só os que
  faltam. Cada arquivo é reconhecido pelo conteúdo (hash), não pelo nome. O vídeo bruto vai
  uma vez e fica guardado lá por 15 dias.
- **Volta:** só o MP4 pronto desce.
- **Ajustou e mandou de novo?** A ida leva só o projeto, alguns KB. Não existe "sobe, desce,
  sobe, desce".
- **Por onde passa:** direto entre as suas máquinas, pelo Tailscale (túnel criptografado),
  sem passar por nuvem nem pelo Drive. Se a rede da empresa não deixar conexão direta, o
  Tailscale passa por um retransmissor: funciona, só fica mais lento.
- **Aguenta queda de internet:** o upload e o download continuam de onde pararam.
- **Fila:** mande 4 vídeos de uma vez. O PC de casa faz um atrás do outro, e cada um desce
  assim que fica pronto.
- **Confere o código:** se o template do notebook está diferente do de lá, ele avisa antes.
  Assim o vídeo não volta diferente da prévia.
- **Não estraga nada lá:** se o PC de casa tem um arquivo com o mesmo nome e conteúdo
  diferente, a versão do notebook vai para `public/midia/_remoto/`, e o arquivo de lá fica
  como está.

## O painel

Uma página no navegador que mostra tudo ao vivo:

- as duas máquinas, com o uso de CPU, RAM e GPU de cada uma;
- o que está subindo e descendo, com a velocidade;
- cada trabalho em 5 etapas: **Ida → Fila → Render → Volta → Pronto**;
- a lista de projetos, para mandar renderizar com um clique;
- a pasta do Drive;
- a aba **Como funciona**, com uma conta de quanto tempo leva a ida.

```bash
node conexao/painel.mjs --abrir      # ou dois cliques em conexao\abrir-painel.bat
```

Ele abre em <http://localhost:5181>. No PC de casa, o painel abre junto com a estação, em modo
`--rede`. Assim, do celular (com o Tailscale instalado nele), dá para ver a fila em
`http://<nome-do-pc-de-casa>:5181`.

## Instalar (uma vez)

1. **Tailscale nos dois** (e no celular, se quiser ver o painel por ele): <https://tailscale.com/download>.
   Entre na **mesma conta** em todos.
2. **No PC de casa:** `git pull` (ou copie esta pasta para a raiz do projeto) e depois peça
   ao Claude de lá: *"procura a pasta conexão e instala"*. Ele segue o [INSTALAR.md](INSTALAR.md).
   No fim, ele mostra um **código de 6 dígitos** e o nome do PC.
3. **No notebook:** diga ao Claude *"conecta no PC de casa: <nome>, código <123 456>"*, ou
   digite os dois no painel, em "Conectar". O código vale 15 minutos, uma vez só. Com ele, o
   notebook busca a senha da conexão sozinho.

## Usar

O normal é **pedir ao Claude**: "renderiza esses 4 no PC de casa", "como está a fila lá?",
"cancela o segundo". Ou clicar no painel. Por baixo, ele roda:

```bash
node conexao/enviar.mjs "projeto/Video A.json" "projeto/Video B.json"   # renderiza e baixa em render/
node conexao/enviar.mjs "projeto/Video A.json" --still 90                # um frame, para conferir rápido
node conexao/enviar.mjs "projeto/Video A.json" --segundos 0-10           # só um trecho
node conexao/enviar.mjs "projeto/Video A.json" --pasta drive             # entrega na pasta Prontos do Drive
node conexao/enviar.mjs "projeto/Video A.json" --sem-esperar             # manda e libera o terminal
node conexao/enviar.mjs --acompanhar <id> [<id> ...]                     # espera e baixa depois
node conexao/enviar.mjs --fila
node conexao/enviar.mjs --cancelar <id>
node conexao/enviar.mjs --ping
```

O resultado chega em `render/<nome>-<data-hora>.mp4`, o mesmo padrão do botão Exportar.

### Código diferente entre as máquinas

O render compara `src/`, `render/render.mjs` e o que mais decide o visual. Se estiver
diferente, ele para e oferece três saídas. O painel mostra as duas primeiras como botões.

- **Levar o código daqui** (`--levar-codigo`): copia os arquivos diferentes do notebook para
  o PC de casa. Os de lá vão para um backup em `conexao/.estacao/backup-codigo/`.
- **Usar o de lá** (`--ignorar-codigo`): renderiza com o código do PC de casa mesmo.
- **Commit + push no notebook, depois `node conexao/enviar.mjs --atualizar-estacao`**: o PC
  de casa faz `git pull` e `npm install` sozinho. É o jeito certo de manter os dois iguais.

## Pacotes: renders que não são da plataforma

Use pacote quando o vídeo não sai do render da plataforma. É o caso dos vídeos da CPS, feitos
com `vfx/cps/compor.py`. O pacote leva **pastas inteiras** do notebook (os scripts e a pasta de
edição do vídeo) e roda um comando lá. Não precisa de git, e o PC de casa não precisa ter nada
disso antes.

Uma receita em JSON descreve o pacote. Caminhos relativos são relativos à pasta da receita:

```json
{
  "nome": "CPS Vídeo 03 4K",
  "pastas":   { "cps": "D:/…/vfx/cps", "edicao": "." },
  "arquivos": { "corte": "../Corte 03.mp4" },
  "ignorar":  ["previa_*", "quadros", "CPS_*_FINAL_*.mp4", "plate1080.mp4"],
  "pasta":    "{edicao}",
  "comando":  ["python", "-I", "{cps}/compor.py", ".", "{cps}/video03.py", "{corte}", "{saida}/CPS_Video03_FINAL_4K.mp4", "--escala", "2", "--luts", "--audio", "audio_mix.wav"],
  "progresso": { "regex": "quadro ([0-9]+)", "total": 1710 },
  "entregar": "."
}
```

```bash
node conexao/enviar.mjs --pacote "E:/Video/Videos Dani/video 03/edicao/pacote-casa.json"
```

- `{nome}` vira o caminho, lá, da pasta ou do arquivo com esse nome. `{saida}` é a pasta do
  que volta.
- `ignorar`: um nome sem barra vale em qualquer nível. Com barra, vale só aquele caminho.
  `__pycache__` e `.git` já ficam de fora.
- `pasta` é onde o comando roda. `trazer` (opcional) lista mais pastas ou arquivos para voltar,
  por exemplo `["{edicao}/quadros"]`.
- `entregar` é onde o resultado cai no notebook. O padrão é `render/`.
- Só roda `python` ou `node`. O Python de lá é o do PATH, ou o `"python"` do
  `conexao/config.json` de lá. O ffmpeg do `server/config.json` de lá entra no PATH.
- Cada tarefa trabalha numa cópia. No fim, a cópia é apagada e só o resultado fica guardado.
- Na segunda vez, só sobe o que mudou: arquivos iguais já estão lá.

**A estação se atualiza sozinha:** `node conexao/enviar.mjs --atualizar-estacao` faz `git pull`
lá. Se vier código novo da própria conexão, a estação reinicia sozinha. Se o
`iniciar-estacao.bat` não a reabrir, o `reiniciar-estacao.mjs` abre outra, escondida, com o log
em `conexao/.estacao/estacao.log`.

## Vídeos do celular, pelo Google Drive

1. No computador que vai editar (o normal é o PC de casa), instale o **Google Drive para
   computador** e entre na mesma conta do celular.
2. `node conexao/drive.mjs --configurar` cria as pastas `Edição de vídeo/Entrada` e
   `Edição de vídeo/Prontos` no seu Drive.
3. **No celular:** suba o vídeo, ou uma pasta com os takes, em **Entrada**. Depois mande
   para o Claude, por áudio ou texto: *"subi o vídeo no Drive, corta os silêncios, legenda
   no estilo de sempre e me manda"*.
4. O Claude roda:
   - `drive.mjs --novos`, para ver o que chegou;
   - `drive.mjs --trazer tudo`, que copia para `videos/drive/`;
   - o fluxo normal (montar, transcrever, cortar, legendar);
   - o render;
   - `drive.mjs --entregar`, que põe o vídeo em **Prontos**.

   O vídeo aparece no celular, em Prontos.

Por que trazer a cópia antes de editar: os scripts gravam arquivos ao lado do vídeo, como o
`-cortado.mp4`. Dentro da pasta do Drive, cada um desses arquivos subiria de novo para a nuvem.

Mandar só o **link** do Drive também serve: `drive.mjs --achar "<link>"` tira o id. Com o
conector do Google Drive, o Claude descobre o nome do arquivo e o acha na pasta sincronizada.

## Pelo celular

O celular não roda nada deste sistema: ele conversa com o **Claude**, e o Claude roda os
comandos acima.

1. Deixe o Claude Code aberto no computador que vai trabalhar, com o **Remote Control** ligado.
2. No celular, abra o app do Claude, vá em **Code**, e a sessão aparece lá.
3. Mande o áudio como hoje.

Se a sessão estiver no PC de casa, o Claude renderiza direto lá, e o notebook nem precisa
estar ligado.

## Problemas

| Sintoma | O que fazer |
|---|---|
| `não consegui falar com a estação` | O PC de casa está ligado e acordado? O Tailscale está conectado nos dois? A janela "Estação de render" está aberta lá? |
| `a senha (token) não bate` | No PC de casa, gere outro código com `node conexao/configurar.mjs --parear` e pareie de novo. |
| `código errado` / `não há código ativo` | O código vale 15 min e uma vez só. Gere outro no PC de casa com `--parear`. |
| `o código que desenha o vídeo é diferente` | Veja "Código diferente entre as máquinas". |
| O render falha com `ENOENT ... realpath` | Uma pasta em `public/` é atalho para um disco que não está conectado. Na hora da instalação, a `public/midia/dani` do notebook apontava para o disco E:. |
| Disco do PC de casa enchendo | Diminua `diasGuardar` no `conexao/config.json` de lá. O padrão é 15. |
| O painel não abre do celular | O PC precisa estar com o painel em `--rede` (a estação já abre assim) e o celular com o Tailscale ligado. |

## Arquivos

| Arquivo | Onde roda | O que é |
|---|---|---|
| `INSTALAR.md` | — | Passo a passo para o assistente instalar |
| `estacao.mjs` | PC de casa | O serviço que recebe, enfileira e renderiza |
| `enviar.mjs` | notebook | Manda, acompanha, baixa |
| `painel.mjs` + `painel/` | os dois | O painel no navegador (porta 5181) |
| `drive.mjs` | quem recebe do celular | Pasta do Google Drive: Entrada e Prontos |
| `configurar.mjs` | os dois | Senha, código de pareamento, estado do Tailscale |
| `reiniciar-estacao.mjs` | PC de casa | Reinicia a estação depois de código novo, sem ninguém lá |
| `comum.mjs` | os dois | Peças compartilhadas |
| `iniciar-estacao.bat` | PC de casa | Abre a estação e o painel, e reabre a estação se ela cair |
| `instalar-estacao.bat` | PC de casa (admin) | Firewall (portas 5180 e 5181, só Tailscale) e abrir com o Windows |
| `abrir-painel.bat` | notebook | Abre o painel no navegador |
| `config.json` | os dois | Senha e endereços. Fica fora do Git |
| `.estacao/` | PC de casa | Arquivos recebidos, tarefas, backups de código. Fica fora do Git |
| `.cliente/` | notebook | Memória de hashes, de envios e de velocidades. Fica fora do Git |
