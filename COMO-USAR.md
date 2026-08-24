# Como usar

Guia de instalação e uso no seu computador. Windows, do zero.

## Uma vez só: instalar

### 1. Node.js

Baixe em <https://nodejs.org> a versão **LTS** e instale (Avançar até o fim).
Para conferir, abra o **Prompt de Comando** e digite:

```
node -v
```

Se aparecer algo como `v22.x.x`, está pronto.

### 2. Baixar o projeto

No Prompt de Comando, na pasta onde você quer guardar:

```
git clone https://github.com/XxyanXx10/melhores-fimes.git
cd melhores-fimes
git checkout claude/video-caption-platform-nn7yrw
npm install
```

Sem Git instalado? No GitHub, no seletor de branch escolha
`claude/video-caption-platform-nn7yrw`, depois **Code → Download ZIP**,
extraia e rode `npm install` dentro da pasta.

### 3. Apontar para o seu whisper.cpp

Na pasta `server`, copie `config.example.json` e chame a cópia de `config.json`.
Abra no Bloco de Notas e ajuste:

```json
{
  "whisperCli": "E:/Video/dia todo gravaçao/Cortes/Corte 15/whisper-setup/whisper-cli.exe",
  "modelo": "E:/Video/dia todo gravaçao/Cortes/Corte 15/whisper-setup/ggml-small.bin",
  "ffmpeg": "ffmpeg",
  "idioma": "pt",
  "threads": 0,
  "porta": 5175
}
```

Três cuidados:

- **Barras normais** (`/`), não `\`, mesmo sendo Windows.
- Se o FFmpeg não estiver no PATH, ponha o caminho completo do `ffmpeg.exe` no lugar de `"ffmpeg"`.
- `config.json` não vai para o GitHub — seus caminhos ficam só na sua máquina.

## No dia a dia: abrir

Você tem duas opções — e na segunda não precisa abrir nada, nunca mais.

### Opção A — dois cliques

Dê dois cliques em **`iniciar.bat`**. Ele abre uma janela preta (é o serviço rodando)
e a plataforma no navegador, em <http://localhost:5175>.
A janela precisa ficar aberta enquanto você trabalha; fechar encerra.

### Opção B — iniciar junto com o Windows (recomendado)

Dê dois cliques em **`instalar-atalho.bat`**, uma única vez.

A partir daí a plataforma sobe sozinha quando você liga o computador, **sem janela
nenhuma**. Para usar, basta abrir <http://localhost:5175> no navegador —
salve nos favoritos e trate como um site normal.

Para desfazer, no Prompt de Comando dentro da pasta:

```
instalar-atalho.bat remover
```

### Para desenvolver

Quem for mexer no código usa duas janelas, com recarga automática:

```
npm run transcricao
npm run dev
```

Aí o endereço é <http://localhost:5173>.

## Usando

1. **Enviar vídeo** — no painel da esquerda. Ele já toca com som na prévia.
2. **Transcrever automaticamente** — no painel da direita. Roda o whisper.cpp na sua
   máquina; em CPU costuma levar perto do tempo do próprio vídeo.
3. **Revisar o texto** — cada bloco é editável. Corrigir uma palavra não desalinha os
   tempos, e o aviso laranja mostra o bloco que passaria de duas linhas na tela.
4. **Escolher o estilo** — os cartões aplicam fonte, cores, animação, palavras por bloco,
   posição e margens de uma vez.
5. **Ajustar** — tamanho, palavras por bloco, posição, cores, fundo e animação.
6. **Visualizar** — ▶ no rodapé; a timeline é clicável.

Sem vídeo em mãos, **Usar exemplo** preenche tudo com um texto de teste. Já tem legenda
pronta de outro programa? **Arquivo .srt / .vtt / .txt**.

## Quando algo não funciona

| Sintoma | O que fazer |
| --- | --- |
| "Transcrever automaticamente" cinza | O serviço não está rodando, ou falta enviar o vídeo. |
| "whisper.cpp: ... ENOENT" | O caminho do `whisper-cli.exe` no `config.json` está errado. |
| "FFmpeg: ... ENOENT" | Ponha o caminho completo do `ffmpeg.exe` no `config.json`. |
| A janela da transcrição diz **NÃO ENCONTRADO** | O caminho do executável ou do modelo está errado — ela mostra qual. |
| `npm` não é reconhecido | O Node.js não foi instalado, ou o Prompt precisa ser reaberto. |
| A porta 5175 já está em uso | A plataforma provavelmente já está rodando — abra <http://localhost:5175>. Se não for isso, troque `"porta"` no `config.json`. |
| O endereço não abre depois de ligar o PC | Espere alguns segundos (ele sobe junto com o Windows) e recarregue. Persistindo, use o `iniciar.bat` para ver a mensagem de erro. |

## O que ainda não existe

**Exportar** mostra o pacote de configuração que a renderização vai receber — o vídeo
com a legenda queimada sai na Etapa 4, com o Remotion. As cenas
(Gancho / Problema / Solução) são um recorte proporcional da duração, não detecção real.
