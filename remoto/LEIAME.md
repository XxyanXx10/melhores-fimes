# Render no PC de casa

Edita no notebook, renderiza no PC de casa (o da RTX 4060), o vídeo volta sozinho
para `render/` do notebook. Enquanto o PC de casa trabalha, o notebook fica livre
para o Premiere, para editar o próximo vídeo, para o que for.

```
 notebook (edita)                       PC de casa (renderiza)
 remoto/enviar.mjs  ── Tailscale ──▶   remoto/estacao.mjs
   manda projeto + arquivos              fila, um render por vez
   ◀── baixa o MP4 pronto ──             mesmo render/render.mjs de sempre
```

- **Só manda o que falta.** Cada arquivo é identificado pelo conteúdo (hash). Vídeo,
  música ou efeito que o PC de casa já recebeu uma vez não viaja de novo — nem se
  outro projeto usar o mesmo arquivo.
- **Aguenta queda de internet.** Upload e download retomam de onde pararam.
- **Fila.** Mande 4 vídeos de uma vez; o PC de casa faz um atrás do outro e o
  notebook baixa cada um assim que fica pronto.
- **Não estraga nada lá.** Se o PC de casa tem um arquivo com o mesmo nome mas
  conteúdo diferente, a versão do notebook vai para `public/midia/_remoto/` e o
  render usa ela; o arquivo de lá não é tocado.
- **Confere o código.** Se o template/composição do notebook está diferente do de
  lá, avisa antes de renderizar (senão o vídeo voltaria diferente da prévia).
- **PC não dorme no meio.** Enquanto renderiza, a estação pede ao Windows para não suspender.
- **Limpa sozinho.** Arquivos recebidos e resultados ficam 15 dias (`diasGuardar` no config).

## Instalar (uma vez)

### 1. Tailscale nos dois computadores (e no celular)

É o que liga o notebook da empresa ao PC de casa sem abrir porta no roteador: uma
rede privada e criptografada só entre os seus aparelhos. Gratuito para uso pessoal.

1. Baixe em <https://tailscale.com/download> e instale no **PC de casa** e no **notebook**.
2. Entre com a **mesma conta** nos dois (Google serve).
3. No PC de casa: ícone do Tailscale na bandeja → anote o nome da máquina
   (ex.: `pc-casa`) ou o IP `100.x.y.z`.
4. (Opcional) Instale o app Tailscale no celular, mesma conta.

> Se a rede da empresa bloquear o Tailscale, ele costuma passar mesmo assim (usa
> HTTPS como reserva). Se não passar, fale com quem cuida da rede.

### 2. PC de casa (a estação)

1. Atualize o projeto: `git pull` no branch `claude/video-caption-platform-nn7yrw`
   (a pasta `remoto/` precisa existir lá) e `npm install`.
2. Confira o `server/config.json` de lá: `"gpu": true` e `concurrency` do tamanho da máquina.
3. Gere a senha da conexão:
   ```bash
   node remoto/configurar.mjs --nome "PC de casa"
   ```
   Ele mostra o comando exato para rodar no notebook — copie.
4. Botão direito em **`remoto/instalar-estacao.bat` → Executar como administrador**. Ele:
   - libera a porta 5180 no Firewall **só para aparelhos do Tailscale**;
   - faz a estação abrir sozinha (minimizada) quando o Windows liga;
   - já abre a estação.
5. Energia: Configurações → Sistema → Energia → **Suspender: Nunca** (na tomada).
   Desligar o monitor pode; suspender não, senão ninguém atende.

### 3. Notebook

```bash
node remoto/configurar.mjs --servidor http://pc-casa:5180 --token <a senha que o PC de casa mostrou>
node remoto/enviar.mjs --ping
```

Se o `--ping` responder com o nome e o processador do PC de casa, está pronto.

## Usar

O normal é **pedir ao Claude**: "renderiza esses 4 no PC de casa", "como está a
fila lá?", "cancela o segundo". Por baixo, ele roda:

```bash
node remoto/enviar.mjs "projeto/Video A.json" "projeto/Video B.json"   # renderiza e baixa em render/
node remoto/enviar.mjs "projeto/Video A.json" --still 90                # um frame, para conferir rápido
node remoto/enviar.mjs "projeto/Video A.json" --segundos 0-10           # só um trecho
node remoto/enviar.mjs "projeto/Video A.json" --sem-esperar             # manda e libera o terminal
node remoto/enviar.mjs --acompanhar <id> [<id> ...]                     # espera e baixa depois
node remoto/enviar.mjs --fila
node remoto/enviar.mjs --cancelar <id>
node remoto/enviar.mjs --ping
```

O resultado chega em `render/<nome>-<data-hora>.mp4`, o mesmo padrão do botão Exportar.
`--pasta` e `--saida` mudam o destino.

### Código diferente entre as máquinas

O render compara `src/`, `render/render.mjs` e o que mais decide o visual. Se
estiver diferente, ele para e oferece:

- **`--levar-codigo`**: copia os arquivos diferentes do notebook para o PC de casa
  (os de lá vão para `remoto/.estacao/backup-codigo/`). Rápido para uma mudança de
  estilo que ainda não foi para o Git.
- **commit + push no notebook, depois `node remoto/enviar.mjs --atualizar-estacao`**:
  o PC de casa faz `git pull` + `npm install` sozinho. O jeito certo de manter os
  dois iguais.
- **`--ignorar-codigo`**: renderiza com o código de lá mesmo.

### Scripts (FFmpeg, Python, Blender…)

Qualquer script do projeto roda lá, com os arquivos levados daqui:

```bash
node remoto/enviar.mjs --script agente/alice-ffmpeg.mjs --arquivo "D:/video/bruto.mp4" -- {arquivo:0} --saida {saida}
```

`{arquivo:N}` vira o caminho, lá, do N-ésimo `--arquivo`; `{saida}` é a pasta cujos
arquivos voltam para o notebook. Arquivos novos gravados ao lado da entrada (ex.:
`bruto-cortado.mp4`) também voltam. Limitação: o script recebe só os arquivos
passados por `--arquivo` — se ele lê um projeto JSON que aponta para outros
arquivos, esses não vão junto (para render, use o modo normal, que vai).

## Pelo celular

O celular não precisa de nada deste sistema: ele conversa com o **Claude**, e o
Claude roda os comandos acima.

1. Deixe o Claude Code aberto no notebook (ou no PC de casa) com o **Remote Control**
   ligado para a sessão.
2. No celular, abra o app do Claude → **Code**: a sessão aparece lá.
3. Mande o áudio como hoje: "o vídeo da Dani tá pronto na pasta X, monta, legenda e
   renderiza no PC de casa".

O computador onde o Claude está precisa estar ligado. Se for o PC de casa, o Claude
pode até renderizar direto lá, sem `enviar.mjs` — o notebook nem precisa estar ligado.

## Problemas

| Sintoma | O que fazer |
|---|---|
| `não consegui falar com a estação` | PC de casa ligado? Tailscale conectado nos dois? Janela "Estação de render" aberta lá? |
| `a senha (token) não bate` | O `token` do `remoto/config.json` tem que ser igual nos dois. Reconfigure o notebook com o comando que o `configurar.mjs` do PC de casa mostra. |
| `o código que desenha o vídeo é diferente` | Veja "Código diferente entre as máquinas". |
| Render falha com `ENOENT ... realpath` | Uma pasta em `public/` lá é atalho para um disco que não está conectado. |
| Disco do PC de casa enchendo | Baixe `diasGuardar` no `remoto/config.json` de lá (padrão 15). |

## Arquivos

| Arquivo | Onde roda | O que é |
|---|---|---|
| `estacao.mjs` | PC de casa | O serviço que recebe, enfileira e renderiza |
| `enviar.mjs` | notebook | Manda, acompanha, baixa |
| `configurar.mjs` | os dois | Grava `remoto/config.json` (fora do Git: tem a senha) |
| `comum.mjs` | os dois | Peças compartilhadas |
| `iniciar-estacao.bat` | PC de casa | Abre a estação e reabre se cair |
| `instalar-estacao.bat` | PC de casa (admin) | Firewall + abrir com o Windows |
| `.estacao/` | PC de casa | Arquivos recebidos, tarefas, backups de código (fora do Git) |
| `.cliente/` | notebook | Memória de hashes e de envios (fora do Git) |
