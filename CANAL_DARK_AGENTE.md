# Canal Dark — guia para o agente (Claude, Gemini…)

A plataforma executa; o agente decide. Para cada narração:

1. **Criar o projeto** — aba Canal Dark (sobe o áudio, corta silêncio, transcreve, legenda Dark, música).
2. **Ler a transcrição com tempos**
   `node agente/aplicar-plano.mjs transcricao "projeto/<nome>.json"`
3. **Consultar o banco antes de criar algo novo**
   `node agente/banco-cenas.mjs buscar "<frase>" <tema>` · `node agente/banco-cenas.mjs listar <tema>`
4. **Escrever o plano** em `banco-cenas/planos/<nome>.json` (formato abaixo).
5. **Aplicar** — gera um projeto novo `<nome> (plano).json` (ou o nome de saída informado)
   `node agente/aplicar-plano.mjs aplicar "projeto/<nome>.json" banco-cenas/planos/<nome>.json "projeto/<saida>.json"`
6. Conferir na plataforma (Projetos → abrir) e exportar.

> Guia completo, com instalação em outro PC e o gosto do dono: `GUIA_CRIACAO_VIDEOS.md`.

## Nada em inglês na tela
O público não lê inglês. Manchete de site gringo é traduzida sozinha pelo `referencias.mjs`
(o original fica em `tituloOriginal`). Se o Gemini não responder, traduza à mão o `titulo`
do `referencias.json`. `destaques` têm que ser trechos do título **traduzido**. O `aplicar`
avisa "TEXTO EM INGLÊS" em qualquer título, destaque ou mensagem de cena. Evite também
imagens cheias de texto em inglês.

## Biblioteca de mídia (antes de gerar qualquer coisa)
Música, imagem gerada, fundo, efeito, vídeo baixado, logo e print ficam catalogados em
`biblioteca/catalogo.json` — e numa página para o usuário bater o olho:
**`Biblioteca de mídia.html`** (raiz do projeto, abre no navegador, tem busca).
- **Antes** de gerar música, imagem ou baixar vídeo: `node agente/biblioteca.mjs buscar <termos> [--tipo musica|imagem|video|efeito|fundo|logo|print]`.
  Se já existe algo que serve, **reutilize** — gerar custa crédito e tempo.
- **Depois** de criar algo novo: descreva em `biblioteca/descricoes.json` (descrição, tags,
  prompt, origem) ou chame `registrarMidia(src, {...})`, e rode `node agente/biblioteca.mjs atualizar`.
- Vídeos baixados moram em `C:\Users\yaned\Videos\Melhores Fimes\videos-baixados`
  (`public/midia/banco/videos` é uma junção para lá).

## Referências reais e receita (antes de escrever o plano)
- O `produzir` já baixa as **referências da notícia** para `public/midia/referencias/<pasta>/`
  (manchete, site, data, capa, imagens da matéria, logos citados). Para um projeto antigo:
  `node agente/referencias.mjs --ideia <id>` e `"referencias": "<pasta>"` no plano.
- **Receita**: `node agente/receita.mjs sortear "projeto/<nome>.json"` sorteia legenda,
  posição, música, zoom, paleta, entrada do b-roll e a cena de **abertura**, sem repetir
  os dois últimos vídeos. O `aplicar` usa a receita e grava em `banco-cenas/receitas.json`
  (`node agente/receita.mjs historico` mostra o que cada vídeo usou — é isso que se cruza
  com visualizações e retenção). Siga a `abertura` e deixe as cores para a receita.
- `transcricao` já mostra as referências e a receita junto das frases.

## Ordem de preferência para cada trecho
1. **Referência real** — a coisa de verdade de que a narração fala:
   - `"tipo": "manchete"` — card da notícia (site, ícone, data e título vêm sozinhos das
     referências; `destaques` passa o marca-texto; `"imagem": false` tira a capa).
   - `"tipo": "print"` — imagem da matéria/produto com `recorte` (só o celular do print),
     `foco` (para onde a câmera aproxima — use x baixo para não cortar o começo das linhas)
     e `marca` (caixa em volta do que importa, em % da área mostrada). Confira com
     `node render/render.mjs <projeto> --still <frame>` antes do render.
   - `"tipo": "logos"` com os logos citados.
2. Cena do **banco** (`"de": "banco", "id": "..."`) — grátis, padrão visual.
3. Vídeo do **Pexels** (`"de": "pexels", "busca": "termos em inglês"`) — de preferência
   como `fundo` das cenas, não como cena principal.
4. Cena **Remotion** de texto (`frase`, `numero`, `celular`) — para dado, frase de efeito.
5. **Imagem IA** (Magnific, ~75 créditos) com zoom lento (`"de": "imagem"`) — só se nada acima servir.
6. Vídeo IA (Magnific, ~140 créditos / 5 s) — último caso.

Regras: pelo menos metade das cenas com referência real quando a notícia tiver imagens;
não repetir a sequência de cenas do vídeo anterior (o `aplicar` avisa); evitar `icones`
(fraco) e `versus`; trechos de 3–8 s; nunca inventar números; textos de cena com 2–5 palavras.

## Formatos além de notícia (roteiro livre)
`node agente/roteiro-livre.mjs ideias/roteiros-livres/<x>.json` — `{ "titulo", "formato", "texto" }`
→ voz, vídeo base e legenda com o texto exato; depois aparece em `pendentes`.
Formatos testados: `real-ou-ia` (cena `quiz`), `pedi-pra-ia` (imagens geradas em tela cheia),
`vexame`, `lista-util`, `noticia-opiniao`, `pov`. Roteiro engraçado, falado, 60–90 palavras,
pergunta no fim. Imagens geradas ficam em `public/midia/formatos/`.

## Som: trilha, efeitos de meme e pausas
- Trilhas em `public/midia/musicas/` (geradas, sem direito autoral). No plano:
  `"musica": { "src": "midia/musicas/comedia-travessa.mp3", "volume": 0.14 }` ou `"musica": false`.
- Efeitos em `public/midia/sfx-meme/` (catálogo em `catalogo.json`: faahhhhh, bruh-sound-effect,
  awww, illuminati-confirmed, cash-register-3, lie-detector-meme-template…). Na cena:
  `"sfx": "pop"` ou `{ "nome": "faahhhhh", "em": 2.6, "max": 1.6, "volume": 0.8, "pausa": 1.2 }`
  (`em` = segundos depois do início da cena, `pausa` = a música cala durante a piada). Lista = vários.
- `"pausas": [{ "em": 6.4, "duracao": 0.8 }]` cala a música num ponto sem efeito.
- Efeito vai DEPOIS da frase da piada (no respiro), nunca por cima da fala importante.

## Respiros (desligado por padrão)
O dono do canal testou e achou o vão "um respiro pra nada": o padrão é SEM respiros — a fala
segue contínua, o efeito toca na piada e a música só dá uma pausinha (`"pausa"` do `sfx`).
O recurso continua existindo, mas só use se ele pedir.
`"respiros": [{ "depoisDe": "pizza.", "duracao": 1.7, "sfx": "faahhhhh" }]` — silêncio de verdade
inserido na narração (sem voz e sem música) logo depois da palavra; o efeito toca sozinho no vão.
Os tempos do plano continuam os da transcrição original: cenas, efeitos e legenda depois do
respiro andam juntos, a cena da piada fica na tela durante o vão e a frase seguinte começa
bloco novo na legenda. Use depois de cada piada e entre os itens de uma lista (0,7–1,7 s).

## Fundo
`"fundoAnimado": true` — fundo animado nas cores da receita atrás das cenas, no lugar do b-roll
genérico (imagem aleatória atrás de tudo cansa). Com ele, o `fundo` de uma cena só entra se tiver
`"manter": true` (quando o vídeo de fundo é do assunto mesmo). Música padrão: volume 0,07.

## Formato do plano
```json
{
  "tema": "ia | plano-saude | ...",
  "corrigir": { "palavraErrada": "palavraCerta" },
  "cenas": [
    { "start": 0, "fim": 3.7, "de": "pexels", "busca": "doctor hospital tablet",
      "banco": { "tags": ["hospital"], "descricao": "Médico com tablet" } },
    { "start": 3.7, "fim": 8.6, "de": "remotion", "tipo": "icones", "titulo": "Título curto",
      "itens": ["Item 1", "Item 2"], "icones": ["🏥", "💳"], "destaque": "#22c55e",
      "banco": { "tags": ["..."], "descricao": "...", "padrao": false } },
    { "start": 8.6, "fim": 12, "de": "banco", "id": "bxxxx", "sobrescrever": { "titulo": "Outro título" } },
    { "start": 12, "fim": 16, "de": "imagem", "midia": "midia/banco/arquivo.png", "zoom": "entra" }
  ]
}
```
Tipos Remotion: `quiz` (imagens [esq, dir], resposta esquerda|direita|ambas, revelar em s),
`chatgpt` (promptUsuario, respostaIa), `checklist`, `icones` (icones[]), `rede` (icones[]),
`numero` (valor: "11%"), `grafico` (valores[], rotulosValor[]), `contexto-ia`, `privacidade`, `codigo`.
Evitar `versus` (mostra porcentagens fictícias).

Imagens geradas: salvar em `public/midia/banco/` e marcar `"banco"` para reaproveitar.
