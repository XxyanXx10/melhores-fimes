export type Animation = 'none' | 'pop' | 'fade' | 'slide-up' | 'typewriter';
export type Backdrop = 'none' | 'shadow' | 'box' | 'stroke';
/** como a palavra falada é marcada (o Captions usa muito 'caixa') */
/** troca de fonte automática, sem marcar nada à mão */
export type AutoEnfase = 'off' | 'alternada' | 'chave';
export type Highlight = 'color' | 'box' | 'underline' | 'scale' | 'gradient';

/** visual de uma palavra enfatizada à mão — fonte e cor próprias */
export type Emphasis = {
  color: string;
  fontFamily: string;
  italic: boolean;
  /** false deixa a palavra em caixa mista mesmo num modelo caixa alta */
  uppercase: boolean;
};

export type CaptionStyle = {
  fontFamily: string;
  fontWeight: number;
  uppercase: boolean;
  italic: boolean;
  /** tamanho relativo à largura da prévia (%) */
  fontSize: number;
  letterSpacing: number;
  color: string;
  highlightColor: string;
  backdrop: Backdrop;
  backdropColor: string;
  animation: Animation;
  wordsPerBlock: number;
  /** posição vertical da legenda em % da altura */
  positionY: number;
  /** margem de segurança lateral em % da largura */
  safeMargin: number;
  highlightWords: boolean;
  /** forma do destaque da palavra falada */
  highlightStyle: Highlight;
  /** cor da caixa/sublinhado do destaque */
  highlightBg: string;
  /** segunda cor do destaque em gradiente (highlightColor -> highlightColor2) */
  highlightColor2: string;
  /** os dois slots de ênfase (aplicados no clique ou automaticamente) */
  emphases: [Emphasis, Emphasis];
  /** aplica ênfase sozinho quando a palavra não foi marcada à mão */
  autoEnfase: AutoEnfase;
  /**
   * Legenda só nestes trechos ([início, fim] em s). Vazio/ausente = vídeo todo.
   * Para vídeos longos em que a legenda não precisa aparecer o tempo inteiro.
   */
  trechos?: [number, number][];
};

export type Template = {
  id: string;
  name: string;
  family: string;
  description: string;
  swatch: [string, string];
  style: CaptionStyle;
};

/** ênfase manual numa palavra: 1 ou 2, cada uma com seu visual no template */
export type Word = {
  text: string;
  start: number;
  end: number;
  emphasis?: 1 | 2;
  /**
   * Corte manual dos blocos, quando o do modelo não serve para aquela frase.
   * 'aqui'  — começa um bloco novo nesta palavra
   * 'nunca' — esta palavra nunca começa bloco (junta com o de cima)
   */
  quebra?: 'aqui' | 'nunca';
};

export type Block = {
  id: string;
  start: number;
  end: number;
  words: Word[];
  /** índice da palavra destacada dentro do bloco */
  highlight: number;
};

/** um trecho de movimento de câmera aplicado ao vídeo */
export type Zoom = {
  id: string;
  start: number;
  end: number;
  /** escala no início e no fim do trecho (1 = tamanho original) */
  de: number;
  para: number;
  /** ponto para onde a câmera "olha", em % do quadro */
  origemX: number;
  origemY: number;
  /** como a escala caminha do início ao fim do trecho */
  curva: 'linear' | 'saida' | 'entradaSaida';
};

/** como os zooms são gerados a partir da fala */
export type Movimento = 'off' | 'suave' | 'ritmo' | 'natural';

/** uma foto/b-roll entrando por cima do vídeo */
/**
 * Som por cima do vídeo: música de fundo ou efeito sonoro.
 *
 * `src` é um arquivo de áudio dentro de public/ (ex.: "midia/trilha.mp3").
 * Música costuma durar o vídeo inteiro e ficar baixa para não brigar com a
 * fala; efeito é um estalo curto num instante exato (transição, destaque).
 */
export type Som = {
  id: string;
  src: string;
  /** nome do arquivo, para mostrar na lista */
  nome: string;
  tipo: 'musica' | 'efeito';
  /** instante do vídeo em que o som começa, em segundos */
  start: number;
  /** quanto tempo toca; 0 = até o fim do vídeo (ou até o áudio acabar) */
  duracao: number;
  /** 0 a 1 */
  volume: number;
  /** segundos de entrada e saída gradual */
  fadeIn: number;
  fadeOut: number;
  /** repete o áudio enquanto durar (música curta num vídeo longo) */
  repetir: boolean;
  /** momentos em que a música abaixa (instante do vídeo; volume 0 a 1 do que está tocando) */
  quedas?: { start: number; duracao: number; volume: number }[];
};

export type Foto = {
  id: string;
  /** caminho dentro de public/ (ex.: "midia/grafico.png") — vale no Player e no render */
  src: string;
  start: number;
  duracao: number;
  entrada: 'fade' | 'escala' | 'sobe' | 'pop' | 'varre';
  /** caminho opcional: pontos (t em segundos desde a entrada) por onde a imagem passa */
  trajeto?: { t: number; x?: number; y?: number; escala?: number; opacidade?: number }[];
  /** 'fundo': fica embaixo das cenas animadas (b-roll que continua passando atrás delas) */
  camada?: 'fundo';
  /** preenche a tela inteira (corta as sobras) — para b-roll e imagens de fundo */
  cobrir?: boolean;
  /** sem a saída gradual de 0,4 s (para uma imagem trocar por outra no mesmo lugar) */
  saidaRapida?: boolean;
  /** largura ocupada, em % da largura do quadro */
  largura: number;
  /** centro da foto, em % do quadro */
  x: number;
  y: number;
  /** oculta a legenda inferior durante esta imagem/vídeo (variação estilo YouTube) */
  semLegenda?: boolean;
};

/**
 * Cartão de apoio desenhado pela própria composição.
 *
 * Alternativa à foto: em vez de exportar uma imagem pronta de fora, o
 * texto fica aqui e é animado item a item. Continua editável depois.
 */
export type Cartao = {
  id: string;
  start: number;
  duracao: number;
  titulo?: string;
  itens: string[];
  /** cor de fundo do cartão */
  cor: string;
  /** cor do título, da barra lateral e do último item */
  destaque: string;
  /** centro do cartão e largura, em % do quadro */
  x: number;
  y: number;
  largura: number;
};

/**
 * Tela dividida: enquanto ela dura, o vídeo principal encolhe para um lado
 * e a outra mídia (vídeo ou imagem) ocupa o resto. É o layout de reação.
 */
export type Divisao = {
  id: string;
  /** caminho dentro de public/ — pode ser vídeo ou imagem */
  src: string;
  start: number;
  duracao: number;
  /** onde entra a mídia extra; o principal fica no lado oposto */
  lado: 'cima' | 'baixo' | 'esquerda' | 'direita';
  /** quanto da tela a mídia extra ocupa, em % (50 = metade exata) */
  proporcao: number;
  entrada: 'corte' | 'fade' | 'desliza';
  /** o áudio do vídeo extra atrapalha a fala; por padrão fica mudo */
  mudo: boolean;
  /**
   * Segundo do PRÓPRIO arquivo extra onde a reprodução começa — não tem a
   * ver com `start`, que é quando a divisão entra no vídeo principal. Sem
   * isto, a mídia extra toca sempre do 0:00 dela, nunca do trecho que você
   * quer mostrar.
   */
  recorte: number;
};

/** as duas cores do degradê das transições, independentes da legenda */
export type CoresTransicao = [string, string];

/**
 * Um corte encontrado no vídeo.
 *
 * O detector acha todos, mas nem todo corte pede transição — em 25s,
 * sete viradas cansam. Por isso cada um liga e desliga sozinho, e pode
 * ter a própria animação.
 */
export type Corte = {
  t: number;
  ativo: boolean;
  /** ausente = usa a animação escolhida para o vídeo todo */
  tipo?: TipoTransicao;
  /** ausente = usa a duração escolhida para o vídeo todo */
  duracao?: number;
  /** imagem que aparece durante esta transição (caminho dentro de public/) */
  imagem?: string;
};

export type TipoTransicao =
  | 'off'
  | 'flash'
  | 'escurece'
  | 'whip'
  | 'deslize'
  | 'zoom'
  | 'giro'
  | 'cortina'
  | 'barras'
  /** troca de animação a cada corte, para o vídeo não ficar repetitivo */
  | 'variado';

/**
 * Um estilo de marca salvo: tudo que se repete de um vídeo para outro.
 *
 * A transcrição, os cortes e as fotos mudam a cada vídeo; isto aqui não.
 * Guardar separado é o que permite aplicar o mesmo visual em série sem
 * reconfigurar nada.
 */
export type Preset = {
  id: string;
  nome: string;
  template: string;
  estilo: Partial<CaptionStyle>;
  movimento: Movimento;
  forcaZoom: number;
  transicao: TipoTransicao;
  forcaTransicao: number;
  duracaoTransicao: number;
  coresTransicao?: CoresTransicao;
  /** cores com que os cartões novos nascem */
  cartaoCor: string;
  cartaoDestaque: string;
};

export type Scene = {
  id: string;
  label: string;
  start: number;
  end: number;
};

/**
 * Cenas nativas animadas direto no Remotion baseadas no roteiro/fala:
 *   - 'chatgpt': Simula uma conversa real no ChatGPT (pergunta do usuário + resposta digitando)
 *   - 'contexto-ia': Painel visual mostrando o que a IA sabe (✅) vs. não sabe (❌)
 *   - 'checklist': Passo a passo animado com checkmarks entrando no ritmo da fala
 *   - 'privacidade': Escudo de proteção de dados pessoais e alerta de privacidade
 *   - 'codigo': Editor de código / terminal IA analisando e programando ao vivo
 *   - 'versus': Comparativo / barras de desempenho entre modelos ou ideias
 */
export type TipoCenaRemotion =
  | 'chatgpt'
  | 'contexto-ia'
  | 'checklist'
  | 'privacidade'
  | 'codigo'
  | 'versus'
  | 'numero'
  | 'grafico'
  | 'icones'
  | 'rede'
  | 'celular'
  | 'frase'
  | 'logos'
  /** etapas ligadas por setas (ChatGPT → Claude → Gemini), com ponto de luz e seta de volta */
  | 'fluxo'
  /** botão "INSCREVER-SE" com a mão clicando e o sininho */
  | 'inscrever'
  | 'manchete'
  | 'print'
  | 'quiz'
  /** fundo animado nas cores da receita, o vídeo inteiro, atrás das outras cenas */
  | 'fundo';

/** retângulo em % (0–100) de uma imagem ou da área mostrada */
export type Retangulo = { x: number; y: number; w: number; h: number };

export type CenaRemotion = {
  id: string;
  tipo: TipoCenaRemotion;
  start: number;
  duracao: number;
  titulo: string;
  subtitulo?: string;
  /** 'frase': 'edit' escreve letra por letra, soco de zoom e pisca (tela preta de edit) */
  animacao?: 'edit';
  /** Pergunta exibida no balão do usuário (para tipo 'chatgpt') */
  promptUsuario?: string;
  /** Resposta digitada pela IA (para tipo 'chatgpt') */
  respostaIa?: string;
  /** Lista de pontos/passos/linhas animados em sequência */
  itens: string[];
  /** Cor de destaque opcional */
  destaque?: string;
  /** 'numero': valor grande que conta até ele (ex.: "11%") */
  valor?: string;
  /** 'grafico': altura de cada barra (mesma ordem de `itens`) */
  valores?: number[];
  /** 'grafico': texto em cima de cada barra */
  rotulosValor?: string[];
  /** 'icones' e 'rede': um emoji por item */
  icones?: string[];
  /** 'celular': nome do app no topo da tela e quem fala em cada mensagem ('eu' = direita) */
  app?: string;
  autores?: ('eu' | 'app')[];
  /** 'frase': palavras que ganham a cor de destaque */
  destaques?: string[];
  /** tema da cena no banco (ia, plano-saude...) */
  tema?: string;
  /** 'manchete' e 'print': imagem real (dentro de public/) — capa da notícia, print do produto */
  imagem?: string;
  /** 'print': largura e altura da imagem em pixels (o aplicar-plano preenche) */
  tamanho?: [number, number];
  /** 'print': pedaço da imagem que aparece (ex.: só o celular no meio do print) */
  recorte?: Retangulo;
  /** 'print': ponto para onde a câmera aproxima, em % da área mostrada, e quanto aproxima */
  foco?: { x: number; y: number; zoom?: number };
  /** 'print': caixa desenhada em volta do que importa, em % da área mostrada */
  marca?: Retangulo;
  /** 'print': 'janela' põe a barra de navegador com `url`; 'nenhuma' deixa a imagem solta */
  moldura?: 'cartao' | 'janela' | 'nenhuma';
  url?: string;
  /** 'quiz' ("Real ou IA?"): as duas fotos (esquerda, direita), qual é IA e quando revela (s desde o início da cena) */
  imagens?: string[];
  /** 'ia' / 'real': quiz de uma foto só */
  resposta?: 'esquerda' | 'direita' | 'ambas' | 'nenhuma' | 'ia' | 'real';
  revelar?: number;
  /** 'fundo': desenho do fundo animado */
  estilo?: 'manchas' | 'synthwave' | 'listras' | 'bokeh' | 'pontos' | 'codigo';
  /** 'manchete': nome do site, ícone do site (em public/) e data da notícia */
  fonte?: string;
  logo?: string;
  data?: string;
  /** oculta a legenda inferior durante esta cena (variação estilo YouTube) */
  semLegenda?: boolean;
};

