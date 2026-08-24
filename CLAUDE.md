# Instruções para o assistente

Este projeto é a **tela**; o assistente é o **motor**. O usuário não roda comandos —
ele pede em linguagem natural ("transcreve esse vídeo", "deixa a legenda maior"),
e o assistente executa. Vale para qualquer assistente com acesso ao terminal da
máquina dele (Claude Code, ChatGPT com execução, Antigravity…).

## Transcrever um vídeo

```bash
node agente/transcrever.mjs "CAMINHO/DO/VIDEO.mp4" --template port1-autoridade
```

O script extrai o áudio com FFmpeg (16 kHz mono), roda o whisper.cpp local com
`-ml 1` (timestamp por palavra), reagrupa os pedaços em palavras inteiras e grava
`projeto/<nome>.json`. Depois disso, diga ao usuário para arrastar esse arquivo
para dentro da plataforma — ou abra a plataforma para ele.

Caminhos do `whisper-cli.exe`, do modelo e do FFmpeg ficam em `server/config.json`
(cópia de `server/config.example.json`, fora do Git). Se algum não existir, o
script diz qual antes de tentar rodar.

## Transcrever sozinho, ao soltar o vídeo numa pasta

```bash
node agente/vigiar.mjs                  # vigia ./videos
node agente/vigiar.mjs "E:/Video/Cortes" # ou a pasta que o usuário usa
```

Fica vigiando; quando um vídeo novo aparece, espera a cópia terminar, transcreve e
grava `projeto/<nome>.json`. Um de cada vez, em fila, e nunca duas vezes o mesmo
arquivo. É o modo preferido quando o usuário disser "quando eu adicionar o vídeo,
transcreve" — deixe rodando em segundo plano.

## Abrir a plataforma

```bash
npm start   # http://localhost:5175
```

Um processo só: serve a interface e o endpoint de transcrição. Para desenvolver,
`npm run dev` (porta 5173) junto com `npm run transcricao`.

## O arquivo de projeto

É o contrato entre motor e tela. Qualquer assistente pode escrever um:

```json
{
  "versao": 1,
  "video": "C:/videos/corte15.mp4",
  "nome": "corte15.mp4",
  "duracao": 62.4,
  "template": "port1-autoridade",
  "estilo": { "fontSize": 8, "positionY": 60 },
  "movimento": "ritmo",
  "forcaZoom": 1,
  "palavras": [{ "text": "ninguém", "start": 0, "end": 0.42, "emphasis": 1 }]
}
```

- `palavras` é obrigatório; cada item precisa de `text`, `start` e `end` em segundos.
- `template` é o id de um cartão em `src/data/templates.ts`.
- `estilo` sobrescreve campos do template (ver `CaptionStyle` em `src/types.ts`).
- `emphasis` numa palavra (1 ou 2) troca a fonte e a cor dela; é opcional e vence
  a ênfase automática do estilo (`autoEnfase`).
- `movimento` é o zoom: `off`, `suave`, `ritmo` ou `chave`; `forcaZoom` multiplica
  a intensidade (1 = padrão). Os trechos são gerados da fala, não ficam no arquivo.
- A plataforma abre pelo botão **Abrir projeto** ou arrastando o arquivo para a janela,
  e devolve o mesmo formato em **Salvar projeto**.

O vídeo em si o usuário arrasta separado: o navegador não abre arquivo do disco por
caminho, por segurança. O `video` no JSON serve para o assistente saber de qual
arquivo aquele projeto veio.

## Regras de convivência

- Nunca peça ao usuário para digitar comandos: rode você mesmo e relate o resultado.
- Erros de reconhecimento (`ANS` virando `INS`) são correção humana, nos blocos
  editáveis — não tente adivinhar.
- Editar o texto de um bloco redistribui os tempos **dentro daquele bloco**; o resto
  da legenda não se mexe.
- Ao mudar estilo a pedido do usuário, prefira ajustar o template em
  `src/data/templates.ts` quando for para valer sempre, e o `estilo` do projeto
  quando for só para aquele vídeo.
