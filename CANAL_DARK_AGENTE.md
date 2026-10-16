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

## Ordem de preferência para cada trecho
1. Cena do **banco** (`"de": "banco", "id": "..."`) — grátis, padrão visual.
2. Vídeo do **Pexels** (`"de": "pexels", "busca": "termos em inglês"`) — grátis, vai pro banco sozinho.
3. Cena **Remotion** (`"de": "remotion"`) — para lista, número, dado, conversa.
4. **Imagem IA** (Magnific, ~75 créditos) com zoom lento (`"de": "imagem"`) — só se nada acima servir.
5. Vídeo IA (Magnific, ~140 créditos / 5 s) — último caso.

Regras: alternar vídeo real e cena animada; trechos de 3–8 s; nunca inventar números
(nada de porcentagem que a narração não disse); textos de cena com 2–5 palavras.

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
Tipos Remotion: `chatgpt` (promptUsuario, respostaIa), `checklist`, `icones` (icones[]), `rede` (icones[]),
`numero` (valor: "11%"), `grafico` (valores[], rotulosValor[]), `contexto-ia`, `privacidade`, `codigo`.
Evitar `versus` (mostra porcentagens fictícias).

Imagens geradas: salvar em `public/midia/banco/` e marcar `"banco"` para reaproveitar.
