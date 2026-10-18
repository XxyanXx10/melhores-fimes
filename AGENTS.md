# Instruções para o assistente (qualquer um: Antigravity, Gemini, Codex, Claude…)

Este projeto é a **tela**; você é o **motor**. O dono não roda comandos: ele pede em
português e você executa tudo pelo terminal e relata o resultado.

Leia, nesta ordem:

1. **`GUIA_CRIACAO_VIDEOS.md`**: como os vídeos do Canal Dark são feitos, do roteiro ao MP4:
   instalação em outro PC, comandos, formato do plano de cenas, gosto do dono, problemas conhecidos.
2. `CANAL_DARK_AGENTE.md`: referência rápida do plano de cenas.
3. `CLAUDE.md`: regras gerais da plataforma (transcrição, cortes, takes, arquivo de projeto).

Regras que nunca mudam:
- Nada de texto em inglês na tela (manchetes e destaques sempre traduzidos).
- Antes de gerar música, imagem ou fundo, procure na biblioteca: `node agente/biblioteca.mjs buscar <termos>`.
- Música baixa (0.07), efeitos de meme nas piadas, sem "respiros", sem imagem aleatória de banco.
- Vídeos prontos vão para `Área de Trabalho/Vídeos Canal Dark`.
- Antes de mudança grande no código: `node agente/backup.mjs`.
