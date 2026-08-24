# Melhores Fimes — criador visual de vídeos padronizados

Protótipo da **Etapa 1**: a interface navegável, sem backend e sem IA.
O objetivo aqui é olhar, clicar e dizer *"é assim que eu quero trabalhar"*.

## Rodar

```bash
npm install
npm run dev
```

## O que já funciona

- Fluxo em 6 passos no topo (enviar → legenda → estilo → ajustar → visualizar → exportar), com marcação do que já foi feito.
- **Esquerda** — upload do vídeo, cartões de estilo e ajustes simples (tamanho, palavras por bloco, margem segura, posição, cores, fundo, animação, destaque, caixa alta).
- **Centro** — prévia vertical 9:16 com margens de segurança e legenda renderizada palavra a palavra.
- **Direita** — legenda em blocos editáveis (o texto reescrito redistribui os tempos dentro do bloco) e lista de cenas.
- **Rodapé** — timeline simplificada com trilha de cenas, trilha de legenda, cursor clicável e play/pause.
- **Texto real sem backend** — colar a fala ou importar `.srt` / `.vtt` / `.txt`. Com tempos, cada bloco respeita a janela do cue; sem tempos, as palavras são distribuídas pela duração. Blocos que passariam de 2 linhas na prévia ganham um aviso.
- Três templates reais: `Port1 — Autoridade`, `Port1 — Provocativo`, `CPS — Institucional`. Cada cartão aplica de uma vez fonte, cores, animação, palavras por bloco, posição, destaque, fundo e margens.

## O que ainda é simulado

- A transcrição *automática* ainda não existe: ou você cola/importa o texto, ou usa o exemplo de `src/data/mockTranscript.ts`. O WhisperX entra na Etapa 3.
- As cenas são um recorte proporcional da duração (detecção real vem depois).
- Sem vídeo enviado, a prévia usa um fundo animado de exemplo.
- "Exportar" mostra o pacote de configuração que o render vai receber; a renderização real entra na Etapa 4 com o Remotion.

## Próximas etapas

| Etapa | Escopo |
| --- | --- |
| 1 ✅ | Protótipo visual da tela |
| 2 | Refinar/ampliar os templates de legenda |
| 3 | Transcrição automática com WhisperX (upload e import de texto já funcionam) |
| 4 | Ligar as configurações ao Remotion e exportar |
| 5 | Efeitos simples, um de cada vez: zoom, cortes, imagens de apoio, transições, destaques |

## Onde mexer

- Templates: `src/data/templates.ts`
- Modelo de estilo da legenda: `src/types.ts`
- Render da legenda na prévia: `src/components/CaptionOverlay.tsx`
- Agrupamento e edição de blocos: `src/blocks.ts`
- Import de SRT/VTT/texto: `src/importar.ts`
