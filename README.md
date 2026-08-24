# Melhores Fimes — criador visual de vídeos padronizados

Protótipo da **Etapa 1**: a interface navegável, sem backend e sem IA.
O objetivo aqui é olhar, clicar e dizer *"é assim que eu quero trabalhar"*.

**Instalar e usar no Windows, passo a passo: [COMO-USAR.md](COMO-USAR.md).**

## Rodar

```bash
npm install
npm start   # constrói e serve tudo num processo só: http://localhost:5175
```

Para desenvolver, com recarga automática e dois processos:

```bash
npm run dev          # a plataforma em http://localhost:5173
npm run transcricao  # o serviço local de transcrição
```

No Windows, `iniciar.bat` faz o `npm start` em dois cliques e `instalar-atalho.bat`
deixa a plataforma subindo junto com o sistema, sem janela.

## Quem é o motor

A plataforma é a tela. Quem transcreve e renderiza é um assistente com acesso ao
terminal da sua máquina (Claude Code, ChatGPT, Antigravity…), seguindo
[CLAUDE.md](CLAUDE.md). Você pede em português; ele roda:

```bash
node agente/transcrever.mjs "C:/videos/corte15.mp4"
```

Ou deixa uma pasta vigiada, e aí basta soltar o vídeo nela:

```bash
npm run vigiar   # vigia ./videos e transcreve o que cair lá
```

Qualquer um dos dois grava `projeto/corte15.json`, que você abre na plataforma pelo botão
**Abrir projeto** ou arrastando para a janela. **Salvar projeto** devolve o mesmo
arquivo com o estilo e as correções que você fez.

## Transcrição automática (local)

O whisper.cpp roda **na sua máquina**. O áudio não é enviado para lugar nenhum,
e não é preciso internet para transcrever.

1. Copie `server/config.example.json` para `server/config.json` e ajuste os caminhos:

   ```json
   {
     "whisperCli": "E:/.../whisper-setup/whisper-cli.exe",
     "modelo": "E:/.../whisper-setup/ggml-small.bin",
     "ffmpeg": "ffmpeg",
     "idioma": "pt",
     "threads": 0,
     "porta": 5175
   }
   ```

   Use barras normais (`/`) mesmo no Windows. `threads: 0` deixa o whisper.cpp decidir.
   `server/config.json` fica fora do Git, então seus caminhos não vão para o repositório.

2. `npm start` — o terminal diz se achou o executável e o modelo.
3. Na plataforma: envie o vídeo e clique em **Transcrever automaticamente**.

O serviço repete exatamente o seu processo atual: extrai o áudio com FFmpeg em
16 kHz mono, chama o whisper.cpp com `-ml 1` (timestamp por palavra) e reagrupa
os pedaços em palavras inteiras — `re` + `aj` + `uste` volta a ser `reajuste`,
com o início do primeiro pedaço e o fim do último. A revisão dos erros de
reconhecimento (`ANS` virando `INS`) continua sendo sua, direto nos blocos
editáveis, e ajustar o texto não desalinha os tempos do bloco.

## O que já funciona

- Fluxo em 6 passos no topo (enviar → legenda → estilo → ajustar → visualizar → exportar), com marcação do que já foi feito.
- **Esquerda** — upload do vídeo, cartões de estilo e ajustes simples (tamanho, palavras por bloco, margem segura, posição, cores, fundo, animação, destaque, caixa alta).
- **Centro** — prévia vertical 9:16 com margens de segurança e legenda renderizada palavra a palavra.
- **Direita** — legenda em blocos editáveis (o texto reescrito redistribui os tempos dentro do bloco) e lista de cenas.
- **Rodapé** — timeline simplificada com trilha de cenas, trilha de legenda, cursor clicável e play/pause.
- **Texto real sem backend** — colar a fala ou importar `.srt` / `.vtt` / `.txt`. Com tempos, cada bloco respeita a janela do cue; sem tempos, as palavras são distribuídas pela duração. Blocos que passariam de 2 linhas na prévia ganham um aviso.
- Três templates reais: `Port1 — Autoridade`, `Port1 — Provocativo`, `CPS — Institucional`. Cada cartão aplica de uma vez fonte, cores, animação, palavras por bloco, posição, destaque, fundo e margens.

## O que ainda é simulado

- Sem o serviço local ligado, a transcrição automática fica desabilitada — aí resta colar/importar o texto ou usar o exemplo de `src/data/mockTranscript.ts`.
- As cenas são um recorte proporcional da duração (detecção real vem depois).
- Sem vídeo enviado, a prévia usa um fundo animado de exemplo.
- "Exportar" mostra o pacote de configuração que o render vai receber; a renderização real entra na Etapa 4 com o Remotion.

## Próximas etapas

| Etapa | Escopo |
| --- | --- |
| 1 ✅ | Protótipo visual da tela |
| 2 | Refinar/ampliar os templates de legenda |
| 3 ✅ | Transcrição automática local com whisper.cpp |
| 4 | Ligar as configurações ao Remotion e exportar |
| 5 | Efeitos simples, um de cada vez: zoom, cortes, imagens de apoio, transições, destaques |

## Onde mexer

- Templates: `src/data/templates.ts`
- Modelo de estilo da legenda: `src/types.ts`
- Render da legenda na prévia: `src/components/CaptionOverlay.tsx`
- Agrupamento e edição de blocos: `src/blocks.ts`
- Import de SRT/VTT/texto: `src/importar.ts`
- Serviço de transcrição: `server/index.mjs`
- Reagrupamento das palavras quebradas: `server/merge.mjs`
