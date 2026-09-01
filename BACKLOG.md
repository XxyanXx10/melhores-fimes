# Lista de demandas

Levantada em 01/09/2026, rodando a plataforma e lendo o código. Cada item diz
**o que acontece hoje**, **o que deveria acontecer** e o tamanho do serviço
(P = até meio dia, M = um dia, G = vários dias).

Os itens P0 são perda de trabalho: enquanto existirem, todo o resto rende menos.

---

## P0 — Você está perdendo trabalho

### 1. Salvar o projeto apaga o caminho do vídeo
**Hoje:** `salvarProjeto` monta o arquivo sem o campo `video`. O JSON baixado sai
sem saber de que vídeo veio. Ao reabrir, a plataforma diz "vídeo não encontrado" e
**não dá para exportar**. (Confirmado em `src/App.tsx:483` — o campo simplesmente
não está na lista.)
**Deveria:** guardar o caminho do vídeo, e mais: se o arquivo tiver sido movido,
oferecer "procurar esse vídeo" em vez de desistir.
**Tamanho:** P — é uma linha, mas é a mais cara da lista.

### 2. "Salvar projeto" joga na pasta de Downloads
**Hoje:** salvar dispara um download do navegador. O arquivo cai em Downloads,
solto entre instaladores e PDFs, e a pasta `projeto/` — que é onde a plataforma
procura — continua vazia. O serviço nem tem rota para gravar (`/projetos` só lê).
**Deveria:** salvar grava direto na pasta de projetos da máquina, e a lista de
projetos passa a mostrar o que você salvou.
**Tamanho:** P.

### 3. Fechar a aba perde tudo
**Hoje:** não existe salvamento automático nem rascunho. Uma hora de correção de
legenda e ajuste de estilo evapora se o navegador fechar, o serviço reiniciar ou
a máquina travar.
**Deveria:** gravar sozinho a cada mudança (com atraso de alguns segundos), e ao
abrir avisar "você tem trabalho não salvo em X, quer voltar?".
**Tamanho:** M.

### 4. Não dá para desfazer
**Hoje:** nenhum Ctrl+Z. Apagou o texto de um bloco, mexeu no zoom, trocou de
modelo sem querer: não tem volta, refaz na mão.
**Deveria:** desfazer e refazer para tudo que muda o projeto, com atalho de teclado.
**Tamanho:** M.

---

## P1 — Projetos de verdade (a aba que você pediu)

### 5. Criar projeto com nome próprio
**Hoje:** o projeto se chama como o arquivo de vídeo. `corte15.mp4` vira
`corte15.json`. Dois cortes do mesmo dia viram dois nomes iguais e ilegíveis.
**Deveria:** ao adicionar o vídeo, perguntar o nome ("Reajuste ANS — gancho novo").
O nome é seu, o arquivo se vira sozinho.
**Tamanho:** P.

### 6. Uma tela de projetos, não um menuzinho
**Hoje:** a lista de projetos é um `<select>` escondido no topo, que só aparece
se já houver projetos, e mostra `nome · 18s · 96 palavras`.
**Deveria:** uma tela inicial com cartões: miniatura do primeiro quadro, nome,
duração, quando foi mexido pela última vez, e o estado (transcrito? exportado?).
Clicou, abriu de onde parou.
**Tamanho:** G — é a demanda principal, e vale ser a próxima coisa a fazer.

### 7. Renomear, duplicar e apagar
**Hoje:** nada disso existe. Para variar um vídeo você refaz tudo.
**Deveria:** renomear no cartão; duplicar para testar outra versão sem perder a
primeira; apagar com confirmação (e uma lixeira, porque apagar sem querer acontece).
**Tamanho:** M.

### 8. Data e histórico
**Hoje:** a listagem não sabe quando o projeto foi alterado — o servidor devolve
só nome, duração e contagem de palavras.
**Deveria:** ordenar por "mexido por último", que é como se procura de verdade.
Guardar as últimas versões do projeto, para voltar a uma anterior.
**Tamanho:** M.

### 9. Organizar por pasta ou marcador
**Hoje:** todos os projetos numa pasta plana. Com 200 cortes vira um monte.
**Deveria:** agrupar por cliente/campanha (Port1, CPS…) ou por marcador, e ter
busca por nome e por texto falado — achar "aquele vídeo onde eu falo de reajuste".
**Tamanho:** M.

---

## P2 — A interface não cabe mais na tela

### 10. Em notebook, a página rola para o lado
**Hoje:** medido em 1366 × 768 (notebook comum): a página pede 1876 px de largura.
O painel da direita fica cortado e o topo perde botões.
**Deveria:** as três áreas se ajustarem, com os painéis recolhíveis. Em tela
pequena, um painel de cada vez.
**Tamanho:** M.

### 11. O topo virou uma prateleira
**Hoje:** seis passos + estilo salvo + salvar estilo + abrir do computador +
abrir projeto + salvar projeto + exportar, tudo na mesma faixa.
**Deveria:** separar o que é navegação (os passos) do que é arquivo (projeto) e do
que é ação (exportar). O menu de projeto sai do topo e vai para a tela de projetos.
**Tamanho:** P.

### 12. Painéis sem hierarquia
**Hoje:** Vídeo, Estilo, Movimento, Transições, Ajustes, Legenda, Cenas, Fotos,
Cartões, Tela dividida — dez seções abertas ao mesmo tempo, todas do mesmo tamanho.
**Deveria:** o que você usa em todo vídeo fica à mão; o resto recolhido, abrindo
quando precisa.
**Tamanho:** M.

---

## P3 — A promessa de funcionar offline

### 13. A tela depende do Google Fonts
**Hoje:** com as fontes bloqueadas (que é o mesmo que estar sem internet), a
página dispara 32 erros de rede e as letras caem para a fonte padrão do sistema —
ou seja, **a legenda que você vê não é a que vai ser renderizada**.
**Deveria:** as fontes virem junto com o programa, dentro da pasta. Nenhuma
chamada para fora.
**Tamanho:** P.

### 14. O primeiro render baixa 150 MB
**Hoje:** a primeira exportação baixa o Chrome do Remotion. Sem internet, o render
falha — o erro é registrado (isso funciona bem), mas só depois de você esperar.
**Deveria:** baixar isso na instalação, não no primeiro uso com pressa, e avisar
antes: "faltam 150 MB para a primeira exportação".
**Tamanho:** P.

---

## P4 — O trabalho de todo dia

### 15. Corrigir palavra que o Whisper sempre erra
**Hoje:** `ANS` vira `INS` em todo vídeo, e você corrige em todo vídeo.
**Deveria:** uma lista de correções suas ("INS → ANS", "Port1", nomes de clientes),
aplicada sozinha no fim da transcrição.
**Tamanho:** P — e é a que mais economiza tempo por semana.

### 16. Ver a legenda inteira como texto
**Hoje:** só bloco a bloco, num campo por vez.
**Deveria:** poder ler e editar tudo de uma vez, como um texto corrido, sem perder
os tempos.
**Tamanho:** M.

### 17. Ajustar o tempo de um bloco
**Hoje:** editar o texto redistribui os tempos dentro do bloco, mas não dá para
arrastar o começo ou o fim quando o Whisper entra atrasado.
**Deveria:** pegar a borda do bloco na linha do tempo e arrastar.
**Tamanho:** M.

### 18. Juntar e separar blocos
**Hoje:** o corte dos blocos vem do número de palavras do modelo, e pronto.
**Deveria:** juntar dois blocos ou quebrar um, na mão, onde a frase pede.
**Tamanho:** P.

---

## P5 — Entregar o vídeo

### 19. Saber quanto falta
**Hoje:** o andamento existe (e sobrevive a reinício, o que é ótimo), mas não diz
tempo restante nem deixa cancelar.
**Deveria:** porcentagem, estimativa e um botão de cancelar.
**Tamanho:** P.

### 20. Exportar mais de um por vez
**Hoje:** um render por vez, e você espera olhando.
**Deveria:** uma fila — marca cinco cortes, sai para almoçar, volta com os cinco.
**Tamanho:** M.

### 21. Legenda separada (.srt)
**Hoje:** a legenda só sai queimada no vídeo.
**Deveria:** exportar `.srt` também, para subir no YouTube ou reaproveitar.
**Tamanho:** P.

---

## O que já está bom (não mexer sem motivo)

- A prévia e o MP4 saem da **mesma** composição do Remotion: o que você vê é o que sai.
- O reagrupamento das palavras quebradas pelo `-ml 1` está correto e testado.
- O andamento do render sobrevive a reiniciar o serviço.
- O vigia de pasta não transcreve o mesmo arquivo duas vezes e espera a cópia terminar.
- Editar o texto de um bloco não desalinha o resto da legenda.

---

## Ordem sugerida

1. **P0 inteiro** (itens 1–4). São dois dias e param a sangria.
2. **Item 6**, a tela de projetos, puxando junto os itens 5, 7 e 8.
3. **Itens 10 e 11**, para a tela caber no notebook.
4. **Itens 13 e 15**, baratos e de retorno diário.
5. O resto conforme incomodar.
