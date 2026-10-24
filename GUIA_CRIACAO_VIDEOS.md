# Guia completo: como os vídeos do Canal Dark são feitos

Este arquivo é para **qualquer assistente com terminal** (Claude Code, Antigravity,
Gemini CLI, Codex…) conseguir fazer os vídeos sozinho, em qualquer PC.
Leia também `CLAUDE.md` (regras gerais da plataforma) e `CANAL_DARK_AGENTE.md`
(referência rápida do plano de cenas).

> **Regra número um:** o dono do canal **não roda comandos**. Ele pede em português
> ("faz mais 5 vídeos", "deixa a música mais baixa") e o assistente executa tudo e
> relata o resultado. Nunca peça para ele digitar nada.

---

## 1. O fluxo, do começo ao fim

```
ideia / notícia ──► roteiro ──► voz clonada (Gemini) ──► vídeo base + legenda
                                                              │
   biblioteca de mídia ◄── referências reais (matéria, fotos) │
            │                                                 ▼
            └──────────────► plano de cenas (JSON) ──► aplicar ──► conferir frames
                                                                        │
                       Área de Trabalho/Vídeos Canal Dark ◄── render (MP4)
```

Um vídeo de 45–60 s leva **uns 6 minutos** de ponta a ponta quando a mídia já existe
na biblioteca (o render sozinho leva 3–4 min numa RTX 4060). Um lote de 5 fica
pronto em ~30 min.

---

## 2. Instalar em outro PC (Windows)

### 2.1 Programas
1. **Node.js LTS**: <https://nodejs.org>
2. **Git**: <https://git-scm.com>
3. **FFmpeg**: `winget install Gyan.FFmpeg`. Anote o caminho do `ffmpeg.exe`
   (fica em `C:/Users/<você>/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg…/bin/`).
4. **whisper.cpp**: baixe o `whisper-cli.exe` (release do GitHub do whisper.cpp) e um
   modelo (`ggml-base.bin` ou `ggml-small.bin`). No PC atual eles ficam em `E:/whisper-setup/`.

### 2.2 Projeto
```bash
git clone https://github.com/XxyanXx10/melhores-fimes.git
cd melhores-fimes
git checkout claude/video-caption-platform-nn7yrw
npm install
```
No primeiro render, o Remotion baixa sozinho o Chrome que ele usa: é normal demorar.

### 2.3 `server/config.json` (fora do Git: tem chaves)
Copie `server/config.example.json` para `server/config.json` e preencha:

```json
{
  "whisperCli": "E:/whisper-setup/whisper-bin/Release/whisper-cli.exe",
  "modelo": "E:/whisper-setup/models/ggml-base.bin",
  "ffmpeg": "C:/.../ffmpeg.exe",
  "idioma": "pt",
  "threads": 0,
  "porta": 5175,
  "concurrency": 10,
  "gpu": true,
  "pastaTemporaria": "C:/Users/<você>/AppData/Local/Temp/melhores-fimes-render",
  "geminiKey": "<chave do AI Studio>",
  "geminiVoz": "voice_nc5nkbi7c4x9",
  "geminiModeloVoz": "gemini-3.8-flash-tts",
  "pexelsKey": "<chave do Pexels>"
}
```

| Campo | Para que serve |
|---|---|
| `ffmpeg` | Caminho completo, **com barras `/`**. |
| `concurrency` | Quadros desenhados em paralelo. 10 num Ryzen de 12 threads; se travar por memória, baixe para 4–6. |
| `gpu` | `true` usa a placa de vídeo (funcionou na RTX 4060; no notebook, não). |
| `pastaTemporaria` | O render gasta centenas de MB de temporário. Aponte para o disco com espaço (o D: vive cheio). |
| `geminiKey` | Escreve roteiros, dá nota às notícias, traduz manchetes e **narra com a voz clonada**. |
| `geminiVoz` | Id da voz clonada do dono no AI Studio. Sem ela a narração sai com outra voz. |
| `pexelsKey` | Vídeos de banco (Pexels). Use pouco: imagem aleatória cansa o público. |

> **Limite de gasto do Gemini:** se aparecer *"exceeded its monthly spending cap"*, a voz
> e os roteiros param. Só o dono pode aumentar, em <https://ai.studio/spend>. Avise-o e espere.

### 2.4 O que NÃO está no Git e precisa ser copiado à mão
Esses itens são trabalho e mídia do canal. Copie do PC antigo (pendrive, nuvem):

| Pasta | O que é | Tamanho aprox. |
|---|---|---|
| `public/midia/musicas/` | trilhas geradas (sem direito autoral) | 8 MB |
| `public/midia/sfx-meme/` | 90 efeitos de meme + `catalogo.json` | 11 MB |
| `public/midia/formatos/` | imagens geradas (2100, caramelo, comidas, quiz…) | 18 MB |
| `public/midia/referencias/` | matérias baixadas (capa, fotos, logos, título) | 80 MB |
| `public/midia/banco/` | logos, prints e o banco de cenas | 7 MB + vídeos |
| `banco-cenas/` | planos de cena, receitas, banco | <1 MB |
| `ideias/ideias.json` | ideias e roteiros aprovados | <1 MB |
| `projeto/*.json` | projetos (narração, legenda, cenas) | pequeno |
| `render/.fontes/narracoes/` | as narrações e vídeos base | ~centenas de MB |

`biblioteca/` (catálogo e descrições) **está** no Git.

**Vídeos baixados (Pexels, Genie…)**: ficam em
`C:\Users\<você>\Videos\Melhores Fimes\videos-baixados`, e `public/midia/banco/videos`
é uma **junção** para lá (o D: não tem espaço). Para recriar no PC novo:
```bat
mklink /J "public\midia\banco\videos" "C:\Users\<você>\Videos\Melhores Fimes\videos-baixados"
```

### 2.5 Testar se está tudo certo
```bash
node render/render.mjs "projeto/<algum projeto> (cenas).json" --still 90 --saida teste.png
```
Se gerar o PNG, a instalação está pronta.

---

## 3. Ferramentas externas

| Ferramenta | Uso | Custo |
|---|---|---|
| Gemini (`gemini-2.5-flash`) | roteiro, nota das notícias, tradução | conta do dono |
| Gemini TTS (`gemini-3.8-flash-tts` + voz clonada) | narração | conta do dono |
| Pexels API | vídeos de banco | grátis |
| Magnific (MCP) | gerar imagens (Seedream 5 Pro, ~100 créditos) e músicas (Lyria, ~80 créditos/30 s) | créditos |
| Wikimedia Commons | fotos reais com licença livre (CC BY-SA exige crédito) | grátis |

**Sem o Magnific** (em outro assistente, por exemplo), use o que já está na biblioteca
ou outro gerador de imagem. Salve sempre em `public/midia/formatos/` e registre na biblioteca.

---

## 4. Passo a passo de um vídeo

### 4.1 Roteiro
Há dois caminhos:

**a) Notícia do dia (aba Ideias da plataforma)**
`node agente/ideias.mjs buscar`: o Gemini lê os RSS e dá nota. O dono aprova na aba
Ideias, e o `produzir` escreve o roteiro, narra e baixa as referências sozinho.
Guia de estilo: `ideias/estilo-roteiro.md`.

**b) Roteiro livre (formatos virais)**: é o mais usado. Crie `ideias/roteiros-livres/<nome>.json`:
```json
{ "titulo": "Pedi pra IA - capitais em 2100 parte 3", "formato": "pedi-pra-ia", "texto": "…" }
```
Regras do texto:
- **Gancho na primeira frase.** Nada de "Olá, pessoal".
- **Tamanho:** a voz fala ~2,9 palavras/s. Para 45–60 s, escreva **130–170 palavras**.
  Vídeo longo: ~280 palavras ≈ 110 s.
- **Emoção pela pontuação:** reticências para suspense, exclamação, perguntas retóricas.
  É assim que a voz do Gemini ganha entonação.
- **Piada** em frase curta logo depois da informação ("Prioridades.", "Cola. Na pizza.").
- **Fatos conferidos.** Leia a matéria inteira e **nunca invente número**. Se só um site
  disse, use "segundo sites especializados". "Sob multa" não é "multou".
- **Termina com pergunta** ("Comenta aí!") ou "salva esse vídeo".
- Notícia em inglês vira texto em português. Nomes de produto ficam como são.

### 4.2 Voz + vídeo base + legenda
```bash
node agente/roteiro-livre.mjs ideias/roteiros-livres/a.json ideias/roteiros-livres/b.json
```
Para cada roteiro, o script narra com a voz clonada, monta o vídeo base e transcreve.
Depois grava `projeto/<titulo>.json`. O áudio fica em cache (rodar de novo não gasta).
Rode em segundo plano quando forem vários.

### 4.3 Biblioteca: antes de gerar qualquer coisa
```bash
node agente/biblioteca.mjs buscar caramelo --tipo imagem
node agente/biblioteca.mjs buscar suspense --tipo musica
```
Tipos: `musica`, `efeito`, `imagem`, `video`, `logo`, `print`, `referencia`, `cena`, `fundo`.
Se já existe, **reutilize**. Se gerar algo novo, descreva em `biblioteca/descricoes.json`
(descrição, tags, prompt, origem) e rode `node agente/biblioteca.mjs atualizar`.
O dono vê tudo em **`Biblioteca de mídia.html`** (abre no navegador, tem busca).

### 4.4 Referências reais (prioridade máxima)
```bash
node agente/referencias.mjs "<link da matéria>" <pasta-curta> "palavras pra achar logos"
```
O script baixa para `public/midia/referencias/<pasta>/`: título, site, data, capa,
fotos da matéria e logos citados.
- **Título em inglês é traduzido sozinho** (o original fica em `tituloOriginal`). Se o Gemini
  não responder, o script avisa: traduza à mão o `titulo` no `referencias.json`.
- **Olhe as imagens** (monte uma folha de contato com o FFmpeg). Apague as que não têm a ver
  com o assunto, e tire da lista `imagens` do `referencias.json`.
- Título "Just a moment..." quer dizer que o site bloqueou (Cloudflare). Apague a pasta e use outra fonte.
- Vídeos oficiais de demonstração (ex.: Genie 3 do Google) podem ser baixados e convertidos
  para MP4 em `public/midia/banco/videos/`. Registre-os na biblioteca.

### 4.5 Ler a narração com os tempos
```bash
node agente/aplicar-plano.mjs transcricao "projeto/<titulo>.json"
```
Mostra cada frase com início e fim em segundos. É com esses tempos que se corta o plano.

### 4.6 Escrever o plano de cenas
Arquivo `banco-cenas/planos/<nome>.json`:

```json
{
  "tema": "ia",
  "fundoAnimado": "synthwave",
  "referencias": "gpt4-captcha",
  "musica": { "src": "midia/musicas/quiz-suspense.mp3", "volume": 0.07 },
  "cenas": [
    { "start": 0, "fim": 4.5, "de": "remotion", "tipo": "frase",
      "titulo": "A IA mentiu pra um humano", "destaques": ["mentiu"], "sfx": "whoosh-sound-effect" },
    { "start": 4.5, "fim": 10.3, "de": "remotion", "tipo": "manchete",
      "destaques": ["fingiu ser cego"], "subtitulo": "Num teste de segurança" },
    { "start": 10.3, "fim": 16, "de": "imagem", "midia": "midia/formatos/belem-2100.jpg", "zoom": "entra",
      "sfx": { "nome": "faahhhhh", "em": 5.6, "max": 1.4, "volume": 0.7, "pausa": 0.7 } },
    { "start": 16, "fim": 23, "de": "video", "midia": "midia/banco/videos/pexels_8087011.mp4" }
  ]
}
```

**De onde vem cada cena (`de`)**

| `de` | O que é |
|---|---|
| `remotion` | cena desenhada (tipos abaixo) |
| `imagem` | imagem em tela cheia com zoom lento (`"zoom": "entra"` ou `"sai"`) |
| `video` | vídeo da pasta `public/` |
| `pexels` | busca no Pexels (`"busca": "termos em inglês"`, ou `"pexelsId"`) |
| `banco` | cena já pronta do banco (`"id"`) |

**Tipos de cena Remotion**

| `tipo` | Campos | Quando usar |
|---|---|---|
| `frase` | `titulo`, `subtitulo`, `destaques[]` | abertura, item de lista, frase de efeito, fechamento |
| `manchete` | `destaques[]`, `subtitulo` (o resto vem das referências) | a notícia de verdade |
| `print` | `imagem`, `recorte`, `foco{x,y,zoom}`, `marca{x,y,w,h}`, `titulo` | foto ou print da matéria com zoom/caixa |
| `celular` | `titulo`, `app`, `itens[]` (mensagens), `autores[]` (`eu`/`app`) | conversas, chat com IA, mensagens |
| `logos` | `titulo`, `icones[]` (arquivos de `banco/logos` sem extensão), `itens[]` | empresas citadas |
| `numero` | `valor` ("11%"), `titulo` | um dado forte |
| `quiz` | `imagens[esq,dir]` ou uma só, `resposta` (esquerda/direita/ambas/nenhuma/ia/real), `revelar` | Real ou IA |
| `codigo` | `titulo` (nome do arquivo), `itens[]` (linhas) | "o pensamento da IA", código |
| `chatgpt` | `promptUsuario`, `respostaIa` | tela de chat |

Evite `checklist` (fica pequeno), `icones` e `versus` (fracos ou com números falsos).

**Som**
- `musica`: arquivo de `public/midia/musicas/`, **volume 0.07**, que combine com o formato.
  `"musica": false` tira a música.
- `sfx` numa cena: `"pop"`, ou `{ "nome", "em" (segundos após o início da cena), "max" (corta),
  "volume", "pausa" (a música cala) }`, ou uma lista. Os nomes vêm de `public/midia/sfx-meme/catalogo.json`.
- O efeito vai **depois** da frase da piada, nunca em cima da fala importante.

| Efeito | Quando |
|---|---|
| `whoosh-sound-effect` | abertura, troca de assunto |
| `faahhhhh`, `bruh-sound-effect`, `metal-pipe-falling-sound-effect` | vexame, bobagem |
| `awww` | coisa fofa |
| `illuminati-confirmed`, `lie-detector-meme-template` | revelação, mentira |
| `nope-sound-effect`, `999-credit-score-siren` | "nunca", alerta |
| `iphone-send` / `iphone-receive` | mensagens no `celular` |
| `cash-register-sound-effect` | dinheiro |
| `pop` | fechamento |

**Fundo**: `"fundoAnimado"` aceita `manchas`, `synthwave` (futuro, games), `listras` (pop,
comida), `bokeh` (fofo, natureza), `pontos` (história, jornal) e `codigo` (hacker, IA por dentro).
Varie entre vídeos seguidos.

**Regras do plano**
- Cenas de 3–8 s, coladas umas nas outras, cobrindo do 0 ao fim da narração.
- Textos de cena com 2–5 palavras.
- **Nada em inglês na tela**: título, destaque, mensagem, manchete. O `aplicar` avisa
  "TEXTO EM INGLÊS" quando acha. Os `destaques` têm que ser trechos do título **traduzido**.
- Não use imagem com muito texto em inglês (print de LinkedIn, gráfico gringo).
- Prefira referência real, depois imagem gerada do assunto, depois cena desenhada.
  Imagem aleatória de banco é o último recurso.

### 4.7 Aplicar
```bash
node agente/aplicar-plano.mjs aplicar "projeto/<titulo>.json" banco-cenas/planos/<nome>.json "projeto/<titulo> (cenas).json"
```
O comando sorteia a **receita** do vídeo (estilo de legenda, posição, paleta, zoom e entrada),
sem repetir os dois vídeos anteriores. Leia os avisos que ele mostra no fim.

### 4.8 Conferir antes do render
```bash
node render/render.mjs "projeto/<titulo> (cenas).json" --still 300 --saida frame.png
```
O número é o quadro, e o vídeo tem 30 quadros por segundo: o segundo 10 é o quadro 300.
Confira as cenas mais arriscadas: manchete, celular, código e prints.

### 4.9 Render
Um vídeo só:
```bash
node render/render.mjs "projeto/<titulo> (cenas).json" --saida "C:/Users/<você>/Desktop/Vídeos Canal Dark/<titulo>.mp4"
```
Para vários, use uma **fila solta**: um script bash que roda um por um, tenta de novo uma vez
se falhar e escreve num log. Inicie com
`Start-Process bash.exe -ArgumentList '"<script>.sh"' -WindowStyle Hidden`, assim a fila
continua mesmo se o assistente fechar. Modelo:
```bash
#!/usr/bin/env bash
cd "/d/Edição de video simplificado" || exit 1
LOG="render/.tmp/fila.log"; D="C:/Users/yaned/Desktop/Vídeos Canal Dark"
echo "início $(date +%H:%M:%S)" > "$LOG"
for n in "Video 1" "Video 2"; do
  t0=$(date +%s)
  node render/render.mjs "projeto/$n (cenas).json" --saida "$D/$n.mp4" > "render/.tmp/log-$n.txt" 2>&1 \
    || node render/render.mjs "projeto/$n (cenas).json" --saida "$D/$n.mp4" > "render/.tmp/log-$n.txt" 2>&1
  echo "$n: saiu $? em $(( $(date +%s) - t0 ))s" >> "$LOG"
done
echo "fim $(date +%H:%M:%S)" >> "$LOG"
```

### 4.10 Conferir o MP4 e entregar
Tire 4–5 quadros do MP4 com o FFmpeg (`-ss <segundo> -frames:v 1`) e olhe. Os vídeos prontos
vão para **`Área de Trabalho/Vídeos Canal Dark`**. Depois, relate ao dono: o que foi feito,
quanto tempo levou e o que foi reaproveitado da biblioteca.

---

## 5. Formatos que funcionam

| Formato | Como é | Cenas típicas |
|---|---|---|
| **Pedi pra IA** (transformação) | "capitais em 2100", "caramelo em profissões", "comida virando prédio". Vira **série com parte 2, 3…** (o público pede nos comentários) | imagens geradas em tela cheia, uma por item, efeito de meme no fim de cada piada |
| **Real ou IA** | 3 rodadas com contagem 3‑2‑1 e revelação, com pegadinha no fim | `quiz` |
| **Pedi pra IA (conversa)** | perguntas que só brasileiro faz, com **respostas reais** do Gemini | `celular` |
| **Lista útil** | "3 coisas que você nunca deve contar pro ChatGPT", "5 usos…" | `frase` numerada, `manchete` para provar |
| **História real** | "A IA que tentou ter uma lojinha", "fingiu ser cega no captcha" | `manchete`, imagem gerada, `celular`, `codigo` |
| **Vexames da IA** | top 3 de mancadas reais | imagem gerada de cada mancada |
| **POV** | "POV: seu chefe descobriu o ChatGPT" | `celular`, imagem gerada |
| **Notícia longa** (~110 s) | assunto quente explicado (IA copiando jogos, PS5 desbloqueado) | manchetes, vídeos oficiais, fotos da matéria |

---

## 5.1 O que os números mostraram (YouTube, 26/09 a 23/10/2026)

2.299 visualizações em 28 dias. Quase tudo veio de 4 vídeos:

| Vídeo | Views | Por que funcionou |
|---|---|---|
| IA e a Imparcialidade nas Eleições | 1.108 | **polêmica brasileira e atual** (eleição, Lula/Meta/TSE) |
| Real ou IA, você acerta? | 349 | **interativo**: a pessoa joga junto |
| Amor de IA, um alerta real | 267 | **história real de brasileiro**, com emoção |
| 3 vexames da IA | 237 | lista curta de mancadas, humor |

Notícia de tecnologia "genérica" (Google, empresas, consciência, ferramentas) ficou entre 4 e 35 views.
Mesmo o melhor vídeo foi assistido em média até 0:14 de 0:34 (43%): **a abertura decide tudo**.

Prioridade de tema: 1) Brasil e polêmica do momento ligada a IA; 2) interativo (quiz); 3) história real
com emoção; 4) humor e vexame. Evite notícia de produto gringo sem ligação com a vida do brasileiro.

## 5.2 Abertura forte (os 2 primeiros segundos)

O público decide em 1–2 s se para no vídeo. Regras:
- **A primeira frase é um alerta, uma pergunta direta ou uma revelação**, com no máximo 10 palavras e
  ponto de exclamação: "Cuidado com o vídeo que vai chegar no seu WhatsApp hoje!".
  Nunca comece com contexto ("Uma empresa anunciou…").
- **A primeira cena (0 a ~1,7 s) é uma palavra ou frase gigante** (`frase` com 1–2 palavras), na cor
  certa para a emoção (`"destaque": "#ef4444"` para alerta), **com um efeito sonoro já no segundo 0**
  (sirene, boom, whoosh). Depois vem a prova (celular, manchete, imagem).
- Nada de tela vazia ou título pequeno no começo. Confira o quadro 30 (1 s) antes do render.
- Voz: o texto da abertura curto e com exclamação faz a voz começar mais forte. A voz é a
  **"Signature Voice"** (`voice_nc5nkbi7c4x9`); a antiga "Yan" fica em `geminiVozAnterior`.
- **Áudio masterizado:** o `render.mjs` normaliza o MP4 final para **-14 LUFS** e realça a fala.
  Antes os vídeos saíam em -22 LUFS (metade do volume dos outros Shorts, som "abafado").
  Não instrua estilo no texto da voz: o modelo lê a instrução em voz alta.

## 6. O gosto do dono (aprovado e rejeitado)

- ✅ Efeitos de meme nas piadas. Ele quer mais disso.
- ✅ Formatos virais, humor leve, conteúdo que "sai da bolha".
- ✅ Música **baixa (0.07)**, diferente a cada vídeo e combinando com o assunto.
- ✅ Fundo animado bonito, variando o estilo.
- ✅ Vídeos de 45–60 s, alguns mais longos.
- ✅ Referência real do que está sendo falado: manchete, foto, logo, cena do jogo.
- ❌ **Respiros** (silêncio inserido depois da piada): "um respiro pra nada". Não use.
- ❌ Imagem aleatória de banco: "dá agonia".
- ❌ **Texto em inglês na tela.** Tudo é traduzido.
- ❌ Vídeos parecidos entre si (a receita e o aviso de "mesma sequência" existem para isso).

---

## 7. Onde fica cada coisa

| Caminho | Conteúdo |
|---|---|
| `agente/` | scripts: `roteiro-livre`, `aplicar-plano`, `referencias`, `biblioteca`, `receita`, `ideias`, `voz`, `idioma`… |
| `render/render.mjs` | render com Remotion (MP4 ou quadro único) |
| `src/remotion/` | as cenas desenhadas (React) |
| `ideias/roteiros-livres/` | roteiros livres |
| `banco-cenas/planos/` | planos de cena |
| `banco-cenas/receitas.json` | histórico de receitas (o que cada vídeo usou) |
| `projeto/` | projetos (`<titulo>.json` é a base, `(cenas).json` é o final) |
| `public/midia/` | músicas, efeitos, imagens, referências, banco |
| `biblioteca/` + `Biblioteca de mídia.html` | catálogo de toda a mídia |
| `render/.tmp/` | logs das filas de render |

---

## 8. Problemas conhecidos

| Sintoma | Causa e solução |
|---|---|
| Render morre logo após "Empacotando…" | Veja `render/.estado.json`. `EPERM symlink`/`EEXIST`: a junção dos vídeos; o `render.mjs` já trata isso. Se voltar, confira se `banco/videos` é junção (`mklink /J`). |
| Quadro (`--still`) sai faltando ou o render falha do nada | Dois renders ao mesmo tempo usam o mesmo pacote em `pastaTemporaria/bundle` e se atropelam. Um de cada vez: a fila nova espera a anterior (`until grep -q "^fim" <log anterior>; do sleep 5; done`). |
| "Page crashed" ou disco cheio | `pastaTemporaria` apontando para um disco com espaço. |
| Render trava em 2% com GPU | `"gpu": false` (no notebook a NVENC não funciona). |
| Caminho vira `/c/...` e o arquivo vai parar em `D:\c\` | No Git Bash, passe sempre caminhos `C:/...` para o node, principalmente com apóstrofo no nome. |
| "exceeded its monthly spending cap" | Limite do Gemini. Só o dono aumenta, em ai.studio/spend. |
| Referência com título "Just a moment..." | Site bloqueado. Use outra fonte. |
| Imagem errada na matéria (pessoa aleatória) | Apague o arquivo e tire do `referencias.json`. |
| Legenda com erro de reconhecimento | Correção humana nos blocos da plataforma, ou `"corrigir": {"errado":"certo"}` no plano. |
| Projeto perdeu campos ao salvar na plataforma | O servidor preserva `receita`/`referencias`/`planoAplicado`; reaplique o plano se faltar. |
| Git reclama de "dubious ownership" | `git -c safe.directory=* <comando>`. |
| Antes de commitar | Confira se nenhuma chave (`AIza…`, Pexels) foi parar no diff. O `config.json` fica fora do Git. |

---

## 9. Checklist antes de entregar

- [ ] Fatos conferidos na matéria (nada inventado, números certos).
- [ ] Nenhum texto em inglês na tela.
- [ ] Música combinando, volume 0.07, diferente do vídeo anterior.
- [ ] Efeitos nas piadas, depois da frase.
- [ ] Quadros conferidos (manchete, celular, imagens).
- [ ] MP4 na pasta `Vídeos Canal Dark` da Área de Trabalho.
- [ ] Mídia nova registrada na biblioteca (`biblioteca.mjs atualizar`).
- [ ] Trabalho salvo no Git (sem chaves).
