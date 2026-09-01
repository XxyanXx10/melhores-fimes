import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';
import { LeftPanel } from './components/LeftPanel';
import { TelaProjetos } from './components/TelaProjetos';
import { Preview } from './components/Preview';
import { CaptionPanel } from './components/CaptionPanel';
import { FotosPanel } from './components/FotosPanel';
import { CartoesPanel } from './components/CartoesPanel';
import { DivisaoPanel } from './components/DivisaoPanel';
import { Timeline } from './components/Timeline';
import { StepBar } from './components/StepBar';
import { PresetsBarra } from './components/PresetsBarra';
import { templates, defaultTemplateId } from './data/templates';
import { DURACAO_EXEMPLO, mockWords } from './data/mockTranscript';
import { caracteresPorLinha, importar } from './importar';
import {
  abrirDoDisco,
  detectarCortes,
  enderecoDoRender,
  enviarVideoFonte,
  estadoRender,
  apagarPreset,
  listarPresets,
  apagarProjeto,
  duplicarProjeto,
  gravarProjeto,
  listarProjetos,
  salvarPreset,
  pedirRender,
  transcreverArquivo,
  verificarServidor,
  type ProjetoNoDisco,
} from './transcrever';
import { baixar, lerArquivo, validar, type Projeto } from './projeto';
import { agrupar, blocoAtivo, palavraAtiva, reescrever, ultimaIniciada } from './blocks';
import type {
  Block,
  CaptionStyle,
  Cartao,
  CoresTransicao,
  Corte,
  Divisao,
  Foto,
  Movimento,
  Preset,
  Scene,
  TipoTransicao,
  Word,
} from './types';
import { estadoZoom, gerarZooms } from './zoom';

/** Cenas placeholder, proporcionais à duração (a detecção real vem depois). */
function cenasDe(duracao: number): Scene[] {
  const corte = [0, 0.28, 0.61, 1].map((f) => +(f * duracao).toFixed(2));
  return [
    { id: 'c1', label: 'Gancho', start: corte[0], end: corte[1] },
    { id: 'c2', label: 'Problema', start: corte[1], end: corte[2] },
    { id: 'c3', label: 'Solução', start: corte[2], end: corte[3] },
  ];
}

const PASSOS = ['Enviar vídeo', 'Gerar legenda', 'Escolher estilo', 'Ajustar', 'Visualizar', 'Exportar'];

export default function App() {
  const [passo, setPasso] = useState(0);
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const [override, setOverride] = useState<Partial<CaptionStyle>>({});
  const [words, setWords] = useState<Word[]>([]);
  const [transcrito, setTranscrito] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [tempo, setTempo] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(DURACAO_EXEMPLO);
  const [guias, setGuias] = useState(true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [servidorOk, setServidorOk] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [decorrido, setDecorrido] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [autoTranscrever, setAutoTranscrever] = useState(true);
  const [arrastando, setArrastando] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [volume, setVolume] = useState(1);
  const [movimento, setMovimento] = useState<Movimento>('off');
  const [forcaZoom, setForcaZoom] = useState(1);

  const playerRef = useRef<PlayerRef | null>(null);
  const [fps, setFps] = useState(30);
  const [tamanho, setTamanho] = useState({ largura: 1080, altura: 1920 });
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [divisoes, setDivisoes] = useState<Divisao[]>([]);
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [transicao, setTransicao] = useState<TipoTransicao>('off');
  const [forcaTransicao, setForcaTransicao] = useState(1);
  const [duracaoTransicao, setDuracaoTransicao] = useState(0.8);
  const [coresTransicao, setCoresTransicao] = useState<CoresTransicao | undefined>(undefined);
  const [detectando, setDetectando] = useState(false);
  const [noDisco, setNoDisco] = useState<ProjetoNoDisco[]>([]);
  /** nome que o usuário deu ao projeto, e o arquivo onde ele foi gravado */
  const [nomeProjeto, setNomeProjeto] = useState<string | null>(null);
  const [arquivoProjeto, setArquivoProjeto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<number | null>(null);
  /** como o projeto estava na última gravação — serve para saber se há mudança pendente */
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(null);
  /** a lista de projetos ocupa a tela inteira até você escolher um */
  const [naListaDeProjetos, setNaListaDeProjetos] = useState(true);
  const [carregandoLista, setCarregandoLista] = useState(true);
  /** caminho do vídeo no disco — o render precisa dele, o navegador não */
  const [caminhoDoVideo, setCaminhoDoVideo] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetAplicado, setPresetAplicado] = useState<string | null>(null);
  /** cores com que um cartão novo nasce — vêm do estilo de marca */
  const [cartaoPadrao, setCartaoPadrao] = useState({ cor: 'rgba(14,27,46,0.94)', destaque: '#FFD60A' });
  /*
   * O estado do render vive em disco e sobrevive a fechar a aba. Sem isto,
   * ao abrir a plataforma aparecia "MP4 pronto" de um render de horas atrás
   * — e o usuário baixava o arquivo velho achando que era o novo.
   */
  const [pediuRender, setPediuRender] = useState(false);
  const [render, setRender] = useState({ rodando: false, progresso: 0, saida: null as string | null, erro: null as string | null });

  const estimativa = Math.max(20, duracao * 1.6);
  const progresso = Math.min(0.95, decorrido / estimativa);

  /* cronômetro do progresso: o whisper.cpp não reporta andamento, então
     estimamos pelo tempo decorrido e travamos em 95% até chegar a resposta. */
  useEffect(() => {
    if (!transcrevendo) return;
    setDecorrido(0);
    const inicio = Date.now();
    const id = setInterval(() => setDecorrido((Date.now() - inicio) / 1000), 250);
    return () => clearInterval(id);
  }, [transcrevendo]);


  /* o serviço local de transcrição está de pé? */
  useEffect(() => {
    let vivo = true;
    const checar = () => void verificarServidor().then((r) => vivo && setServidorOk(!!r?.ok));
    checar();
    const id = setInterval(checar, 15000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  /* projetos que já existem na pasta do computador */
  useEffect(() => {
    if (!servidorOk) return;
    void listarProjetos().then((l) => {
      setNoDisco(l);
      setCarregandoLista(false);
    });
    void listarPresets().then(setPresets);
  }, [servidorOk]);

  /* volume do vídeo enviado */
  useEffect(() => {
    const pl = playerRef.current;
    if (!pl) return;
    pl.setVolume(volume);
    if (mudo) pl.mute();
    else pl.unmute();
  }, [volume, mudo, src]);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const style: CaptionStyle = useMemo(() => ({ ...template.style, ...override }), [template, override]);

  const blocos = useMemo(() => agrupar(words, style.wordsPerBlock), [words, style.wordsPerBlock]);
  const bloco = blocoAtivo(blocos, tempo);
  const ativa = palavraAtiva(bloco, tempo);
  const revelada = ultimaIniciada(bloco, tempo);
  const cenas = useMemo(() => cenasDe(duracao), [duracao]);
  const cena = cenas.find((c) => tempo >= c.start && tempo < c.end);
  const zooms = useMemo(
    () => gerarZooms(movimento, blocos, cenas, duracao, forcaZoom, style.autoEnfase, words),
    [movimento, blocos, cenas, duracao, forcaZoom, style.autoEnfase, words],
  );
  const camera = estadoZoom(zooms, tempo);
  const maxChars = caracteresPorLinha(style.fontSize, style.safeMargin);

  /* Relógio: quem manda é o Player. Sem vídeo, a prévia usa o próprio
     cronômetro para o fundo de exemplo continuar animando. */
  useEffect(() => {
    const pl = playerRef.current;
    if (!pl || !src) return;
    /*
     * O Player desenha a composição sozinho, no ritmo dele. Este `tempo`
     * serve só para a interface (cursor da linha do tempo, bloco ativo,
     * painéis). Atualizar a cada frame re-renderiza o app inteiro 25x por
     * segundo e derruba a reprodução para metade da velocidade — então
     * só avisamos a interface a cada ~100 ms.
     */
    let ultimo = 0;
    const emFrame = () => {
      const agora = performance.now();
      if (agora - ultimo < 100) return;
      ultimo = agora;
      setTempo(pl.getCurrentFrame() / fps);
    };
    const parou = () => setTocando(false);
    pl.addEventListener('frameupdate', emFrame);
    pl.addEventListener('ended', parou);
    pl.addEventListener('pause', parou);
    return () => {
      pl.removeEventListener('frameupdate', emFrame);
      pl.removeEventListener('ended', parou);
      pl.removeEventListener('pause', parou);
    };
  }, [src, fps]);

  useEffect(() => {
    if (!tocando || src) return;
    let raf = 0;
    let anterior = performance.now();
    const loop = (agora: number) => {
      const dt = (agora - anterior) / 1000;
      setTempo((t) => {
        const prox = t + dt;
        if (prox >= duracao) {
          setTocando(false);
          return 0;
        }
        return prox;
      });
      anterior = agora;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tocando, duracao, src]);

  const irPara = useCallback(
    (t: number) => {
      const alvo = Math.max(0, t);
      setTempo(alvo);
      playerRef.current?.seekTo(Math.round(alvo * fps));
    },
    [fps],
  );

  const alternar = useCallback(() => {
    setTocando((v) => {
      const prox = !v;
      const pl = playerRef.current;
      if (pl) {
        if (prox) pl.play();
        else pl.pause();
      }
      return prox;
    });
  }, []);

  function enviar(f: File) {
    setNaListaDeProjetos(false);
    setArquivoProjeto(null);
    setNomeProjeto(f.name.replace(/\.[^.]+$/, ''));
    const url = URL.createObjectURL(f);
    setArquivo(f);
    setErro(null);
    setSrc(url);
    setNomeArquivo(f.name);
    setTempo(0);
    setTocando(false);
    setPasso(1);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      setDuracao(probe.duration || DURACAO_EXEMPLO);
      // o navegador não expõe o fps; o valor de verdade vem do ffprobe,
      // pelo arquivo de projeto. Aqui só acertamos o tamanho do quadro.
      if (probe.videoWidth && probe.videoHeight) {
        setTamanho({ largura: probe.videoWidth, altura: probe.videoHeight });
      }
    };
    probe.src = url;

    if (autoTranscrever) {
      void verificarServidor().then((r) => {
        setServidorOk(!!r?.ok);
        if (r?.ok) void transcreverAuto(f);
      });
    }
  }

  function importarTexto(texto: string) {
    const novas = importar(texto, duracao);
    if (!novas.length) return;
    // sem vídeo enviado, a duração passa a ser a da própria transcrição
    if (!src) setDuracao(Math.max(1, novas[novas.length - 1].end));
    setWords(novas);
    setTranscrito(true);
    setPasso(2);
    irPara(0);
  }

  async function transcreverAuto(alvo?: File) {
    const f = alvo ?? arquivo;
    if (!f) return;
    setTranscrevendo(true);
    setErro(null);
    try {
      const r = await transcreverArquivo(f);
      setWords(r.words);
      // o fps de verdade vem daqui: o navegador não expõe essa informação,
      // e a composição rodando num fps diferente do arquivo dá trepidação
      setFps(r.fps);
      setTamanho({ largura: r.largura, altura: r.altura });
      setTranscrito(true);
      setPasso(2);
      irPara(0);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao transcrever.');
    } finally {
      setTranscrevendo(false);
    }
  }

  function aplicarProjeto(p: Projeto) {
      setWords(p.palavras);
      setTranscrito(true);
      if (!src) setDuracao(p.duracao);
      setTemplateId(templates.some((t) => t.id === p.template) ? p.template : defaultTemplateId);
      setOverride(p.estilo);
      setMovimento(p.movimento ?? 'off');
      setForcaZoom(p.forcaZoom ?? 1);
      setFotos(p.fotos ?? []);
      setCartoes(p.cartoes ?? []);
      setDivisoes(p.divisoes ?? []);
      setCortes(p.cortes ?? []);
      setTransicao(p.transicao ?? 'off');
      setForcaTransicao(p.forcaTransicao ?? 1);
      setDuracaoTransicao(p.duracaoTransicao ?? 0.8);
      setCoresTransicao(p.coresTransicao);
      if (p.fps) setFps(p.fps);
      if (p.largura && p.altura) setTamanho({ largura: p.largura, altura: p.altura });
      setNomeArquivo((n) => n ?? p.nome ?? null);
      setErro(null);
      setPasso(4);
      irPara(0);
  }

  async function abrirProjeto(f: File) {
    try {
      const p = await lerArquivo(f);
      setNomeProjeto(p.nomeProjeto ?? p.nome ?? f.name.replace(/\.json$/i, ''));
      setArquivoProjeto(p.arquivo ?? null);
      setSalvoEm(null);
      setNaListaDeProjetos(false);
      aplicarProjeto(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler esse arquivo de projeto.');
    }
  }

  /**
   * Abre um projeto da pasta do computador: legenda, ajustes E o vídeo.
   * Sem precisar arrastar nada — o serviço local entrega o vídeo por http.
   */
  async function abrirDaPasta(arquivo: string) {
    try {
      const { projeto, videoUrl } = await abrirDoDisco(arquivo);
      const p = validar(projeto);
      setCaminhoDoVideo((projeto as { video?: string }).video ?? null);
      setSrc(videoUrl);
      setArquivo(null);
      setDuracao(p.duracao);
      setNomeArquivo(p.nome ?? arquivo);
      setNomeProjeto(p.nomeProjeto ?? p.nome ?? arquivo.replace(/\.json$/i, ''));
      setArquivoProjeto(arquivo);
      setSalvoEm(null);
      setTocando(false);
      setNaListaDeProjetos(false);
      aplicarProjeto(p);
      setSalvoEm(Date.now());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir esse projeto.');
    }
  }

  /** o projeto como está agora na tela — o mesmo objeto que o render recebe */
  function projetoAtual(): Projeto & { video?: string } {
    return {
      versao: 1,
      video: caminhoDoVideo ?? undefined,
      nome: nomeArquivo ?? undefined,
      nomeProjeto: nomeProjeto ?? undefined,
      arquivo: arquivoProjeto ?? undefined,
      duracao,
      fps,
      largura: tamanho.largura,
      altura: tamanho.altura,
      template: templateId,
      estilo: override,
      movimento,
      forcaZoom,
      fotos,
      cartoes,
      divisoes,
      cortes,
      transicao,
      forcaTransicao,
      duracaoTransicao,
      coresTransicao,
      palavras: words,
    };
  }

  /*
   * O render é do serviço, não desta aba: pode ter começado antes, em
   * outra janela, ou pelo terminal. Por isso perguntamos sempre — a barra
   * precisa aparecer mesmo para um render que já estava em andamento.
   */
  useEffect(() => {
    if (!servidorOk) return;
    let vivo = true;
    const checar = () =>
      void estadoRender().then((e) => {
        if (!vivo || !e) return;
        if (e.rodando) setPediuRender(true);
        setRender((atual) =>
          atual.rodando === e.rodando &&
          atual.progresso === e.progresso &&
          atual.saida === e.saida &&
          atual.erro === e.erro
            ? atual
            : { rodando: e.rodando, progresso: e.progresso, saida: e.saida, erro: e.erro },
        );
      });
    checar();
    const id = setInterval(checar, 1500);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [servidorOk]);

  /** aplica um estilo de marca: só o que se repete de um vídeo para outro */
  function aplicarPreset(x: Preset) {
    setTemplateId(templates.some((t) => t.id === x.template) ? x.template : defaultTemplateId);
    setOverride(x.estilo ?? {});
    setMovimento(x.movimento ?? 'off');
    setForcaZoom(x.forcaZoom ?? 1);
    setTransicao(x.transicao ?? 'off');
    setForcaTransicao(x.forcaTransicao ?? 1);
    setDuracaoTransicao(x.duracaoTransicao ?? 0.8);
    setCoresTransicao(x.coresTransicao);
    setCartaoPadrao({ cor: x.cartaoCor, destaque: x.cartaoDestaque });
    setPresetAplicado(x.id);
    setErro(null);
  }

  async function guardarPreset(nome: string) {
    try {
      const novo = await salvarPreset({
        id: '',
        nome,
        template: templateId,
        estilo: override,
        movimento,
        forcaZoom,
        transicao,
        forcaTransicao,
        duracaoTransicao,
        coresTransicao,
        cartaoCor: cartaoPadrao.cor,
        cartaoDestaque: cartaoPadrao.destaque,
      });
      setPresets(await listarPresets());
      setPresetAplicado(novo.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar o estilo.');
    }
  }

  async function removerPreset(id: string) {
    await apagarPreset(id);
    setPresets(await listarPresets());
    setPresetAplicado(null);
  }

  async function exportar() {
    if (!caminhoDoVideo && !arquivo) {
      setErro('Abra ou envie um vídeo antes de exportar.');
      return;
    }
    setErro(null);
    // limpa o resultado do render anterior: senão o aviso antigo fica na
    // tela e parece que o clique não fez nada
    setPediuRender(true);
    setRender({ rodando: true, progresso: 0, saida: null, erro: null });
    try {
      /*
       * O render precisa de um arquivo no disco. Se o vídeo veio arrastado,
       * o navegador só tem um blob — então mandamos para o serviço guardar
       * antes. Aberto por "Abrir do computador", o caminho já existe.
       */
      let caminho = caminhoDoVideo;
      if (!caminho && arquivo) {
        caminho = await enviarVideoFonte(arquivo);
        setCaminhoDoVideo(caminho);
      }
      await pedirRender({ ...projetoAtual(), video: caminho ?? undefined });
      setRender({ rodando: true, progresso: 0, saida: null, erro: null });
      setPasso(5);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao começar o render.');
    }
  }

  /**
   * Grava o projeto na pasta da máquina.
   *
   * Antes isto montava um objeto próprio — que esquecia o campo `video` — e
   * baixava o arquivo para a pasta de Downloads. O trabalho saía de onde a
   * plataforma procura, e reabrir dava "vídeo não encontrado".
   */
  async function salvarProjeto(nomeDesejado?: string): Promise<boolean> {
    const nome = (nomeDesejado ?? nomeProjeto ?? nomeArquivo ?? 'projeto').trim();
    if (!servidorOk) {
      baixar(projetoAtual(), `${nome.replace(/\.[^.]+$/, '')}.json`);
      return true;
    }
    setSalvando(true);
    try {
      const projeto = { ...projetoAtual(), nomeProjeto: nome };
      const arquivo = await gravarProjeto(projeto, arquivoProjeto ?? nome);
      setNomeProjeto(nome);
      setArquivoProjeto(arquivo);
      setSalvoEm(Date.now());
      setErro(null);
      void listarProjetos().then(setNoDisco);
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar o projeto.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  /*
   * Desfazer e refazer.
   *
   * Guarda o projeto inteiro a cada mudança que "assenta" (400 ms sem mexer),
   * então uma sequência de cliques no mesmo controle deslizante vira um passo
   * só, não trinta.
   */
  const historico = useRef<string[]>([]);
  const posicao = useRef(-1);
  const restaurando = useRef(false);
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const [podeRefazer, setPodeRefazer] = useState(false);

  /** devolve o projeto à tela sem mexer no passo nem no ponto da reprodução */
  function restaurar(p: Projeto) {
    setWords(p.palavras);
    setTemplateId(templates.some((t) => t.id === p.template) ? p.template : defaultTemplateId);
    setOverride(p.estilo);
    setMovimento(p.movimento ?? 'off');
    setForcaZoom(p.forcaZoom ?? 1);
    setFotos(p.fotos ?? []);
    setCartoes(p.cartoes ?? []);
    setDivisoes(p.divisoes ?? []);
    setCortes(p.cortes ?? []);
    setTransicao(p.transicao ?? 'off');
    setForcaTransicao(p.forcaTransicao ?? 1);
    setDuracaoTransicao(p.duracaoTransicao ?? 0.8);
    setCoresTransicao(p.coresTransicao);
    if (p.nomeProjeto) setNomeProjeto(p.nomeProjeto);
  }

  function andarHistorico(passo: -1 | 1) {
    const alvo = posicao.current + passo;
    if (alvo < 0 || alvo >= historico.current.length) return;
    posicao.current = alvo;
    restaurando.current = true;
    restaurar(JSON.parse(historico.current[alvo]) as Projeto);
    setPodeDesfazer(alvo > 0);
    setPodeRefazer(alvo < historico.current.length - 1);
  }

  /*
   * Salvamento automático.
   *
   * Só age depois que o projeto tem arquivo (ou seja, foi salvo uma vez):
   * assim nunca cria arquivo sem o usuário pedir, mas nunca mais perde o
   * trabalho de quem já começou. Espera parar de mexer para não gravar a
   * cada tecla.
   */
  const projetoSerializado = JSON.stringify(projetoAtual());

  /* logo depois de abrir ou gravar, o que está na tela É o que está no disco */
  useEffect(() => {
    if (salvoEm && !salvando) setUltimoSalvo(projetoSerializado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvoEm, salvando]);

  useEffect(() => {
    if (!transcrito) return;
    if (restaurando.current) {
      restaurando.current = false;
      return;
    }
    const id = setTimeout(() => {
      if (historico.current[posicao.current] === projetoSerializado) return;
      historico.current = historico.current.slice(0, posicao.current + 1);
      historico.current.push(projetoSerializado);
      if (historico.current.length > 80) historico.current.shift();
      posicao.current = historico.current.length - 1;
      setPodeDesfazer(posicao.current > 0);
      setPodeRefazer(false);
    }, 400);
    return () => clearTimeout(id);
  }, [projetoSerializado, transcrito]);

  /* Ctrl+Z e Ctrl+Shift+Z (ou Ctrl+Y), fora dos campos de texto */
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      andarHistorico(k === 'y' || e.shiftKey ? 1 : -1);
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!servidorOk || !arquivoProjeto || !transcrito || salvando) return;
    const id = setTimeout(() => void salvarProjeto(), 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoSerializado, servidorOk, arquivoProjeto, transcrito]);

  /** uma cópia do projeto para guardar onde você quiser */
  function baixarCopia() {
    baixar(projetoAtual(), `${(nomeProjeto ?? nomeArquivo ?? 'projeto').replace(/\.[^.]+$/, '')}.json`);
  }

  function soltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    for (const f of Array.from(e.dataTransfer.files)) {
      if (f.name.toLowerCase().endsWith('.json')) void abrirProjeto(f);
      else if (f.type.startsWith('video/')) enviar(f);
      else if (/\.(srt|vtt|txt)$/i.test(f.name)) void f.text().then(importarTexto);
    }
  }

  function transcrever() {
    setWords(mockWords);
    setTranscrito(true);
    setPasso(2);
  }

  function editar(b: Block, texto: string) {
    const novas = reescrever(b, texto);
    setWords((atuais) => {
      const antes = atuais.filter((w) => w.end < b.start - 0.001);
      const depois = atuais.filter((w) => w.start > b.end + 0.001);
      return [...antes, ...novas, ...depois];
    });
  }

  /** clique numa palavra: nenhuma ênfase -> 1 -> 2 -> nenhuma */
  function marcar(b: Block, indice: number) {
    const alvo = b.words[indice];
    if (!alvo) return;
    const proxima = alvo.emphasis === 1 ? 2 : alvo.emphasis === 2 ? undefined : 1;
    setWords((atuais) =>
      atuais.map((w) =>
        w.start === alvo.start && w.text === alvo.text ? { ...w, emphasis: proxima } : w,
      ),
    );
  }

  /** procura os cortes que o vídeo já tem, pelo serviço local */
  async function procurarCortes() {
    if (!arquivo) return;
    setDetectando(true);
    setErro(null);
    try {
      const achados = await detectarCortes(arquivo);
      setCortes(achados.map((t) => ({ t, ativo: true })));
      if (achados.length && transicao === 'off') setTransicao('flash');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao procurar os cortes.');
    } finally {
      setDetectando(false);
    }
  }

  const concluidos = [
    !!src,
    transcrito,
    transcrito,
    Object.keys(override).length > 0,
    tempo > 0,
    false,
  ];

  if (naListaDeProjetos && servidorOk) {
    return (
      <TelaProjetos
        projetos={noDisco}
        carregando={carregandoLista}
        onAbrir={(a) => void abrirDaPasta(a)}
        onNovo={enviar}
        onDuplicar={(a) =>
          void duplicarProjeto(a)
            .then(() => listarProjetos().then(setNoDisco))
            .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui duplicar.'))
        }
        onApagar={(a) =>
          void apagarProjeto(a)
            .then(() => listarProjetos().then(setNoDisco))
            .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui apagar.'))
        }
        onFechar={transcrito ? () => setNaListaDeProjetos(false) : null}
      />
    );
  }

  return (
    <div
      className={`app ${arrastando ? 'is-arrastando' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setArrastando(false);
      }}
      onDrop={soltar}
    >
      <header className="topo">
        <h1>
          Melhores Fimes <span>· criador de vídeos padronizados</span>
        </h1>
        {transcrito && (
          <label className="nome-projeto" title="Nome do projeto">
            <input
              value={nomeProjeto ?? ''}
              placeholder="Dê um nome a este projeto"
              onChange={(e) => setNomeProjeto(e.target.value)}
              onBlur={() => {
                if (nomeProjeto?.trim() && arquivoProjeto) void salvarProjeto();
              }}
            />
            <em>
              {salvando
                ? 'salvando…'
                : ultimoSalvo === projetoSerializado
                  ? 'salvo'
                  : salvoEm
                    ? 'com mudanças'
                    : 'não salvo'}
            </em>
          </label>
        )}
        <StepBar passos={PASSOS} atual={passo} concluidos={concluidos} onSelect={setPasso} />
        <PresetsBarra
          presets={presets}
          aplicado={presetAplicado}
          ativo={servidorOk}
          onAplicar={aplicarPreset}
          onSalvar={(nome) => void guardarPreset(nome)}
          onApagar={(id) => void removerPreset(id)}
        />
        {servidorOk && (
          <button
            type="button"
            className="chip chip-topo"
            onClick={() => {
              void listarProjetos().then(setNoDisco);
              setNaListaDeProjetos(true);
            }}
            title="Ver todos os projetos"
          >
            Projetos
          </button>
        )}
        <span className="historico">
          <button
            type="button"
            className="chip chip-topo"
            disabled={!podeDesfazer}
            onClick={() => andarHistorico(-1)}
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
          >
            ↶
          </button>
          <button
            type="button"
            className="chip chip-topo"
            disabled={!podeRefazer}
            onClick={() => andarHistorico(1)}
            title="Refazer (Ctrl+Shift+Z)"
            aria-label="Refazer"
          >
            ↷
          </button>
        </span>
        <label className="chip chip-topo">
          Abrir projeto
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void abrirProjeto(f);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="chip chip-topo"
          disabled={!transcrito || salvando}
          onClick={() => void salvarProjeto()}
          title={servidorOk ? 'Grava na pasta de projetos da máquina' : 'Serviço desligado: baixa uma cópia'}
        >
          {salvando ? 'Salvando…' : servidorOk ? 'Salvar' : 'Baixar projeto'}
        </button>
        {servidorOk && (
          <button type="button" className="chip chip-topo" disabled={!transcrito} onClick={baixarCopia}>
            Baixar cópia
          </button>
        )}
        <button
          type="button"
          className="primario"
          disabled={!transcrito || render.rodando}
          onClick={() => void exportar()}
          title={
            !transcrito
              ? 'Gere a legenda primeiro'
              : 'Gerar o MP4 com tudo aplicado'
          }
        >
          {render.rodando ? `Renderizando ${Math.round(render.progresso * 100)}%` : 'Exportar'}
        </button>
      </header>

      {/* nada de resultado de render antigo ao abrir a plataforma:
          o estado vive em disco, mas só interessa a quem pediu */}
      {(render.rodando || ((render.saida || render.erro) && pediuRender)) && (
        <div className={`aviso-render ${render.erro ? 'is-erro' : ''}`} role="status" aria-live="polite">
          {render.rodando && (
            <>
              <span className="girando" aria-hidden="true" />
              <strong>Gerando o MP4… {Math.round(render.progresso * 100)}%</strong>
              <span className="dica">Pode continuar mexendo; o render roda por fora.</span>
            </>
          )}
          {!render.rodando && render.saida && pediuRender && (
            <>
              <strong>MP4 pronto</strong>
              <a className="chip chip-forte" href={enderecoDoRender(render.saida)} download>
                Baixar {render.saida}
              </a>
              <span className="dica">também fica na pasta render/ do projeto</span>
              <button
                type="button"
                className="chip"
                onClick={() => setRender({ rodando: false, progresso: 0, saida: null, erro: null })}
              >
                Fechar
              </button>
            </>
          )}
          {!render.rodando && render.erro && pediuRender && (
            <>
              <strong>O render falhou</strong>
              <span className="dica">{render.erro}</span>
              <button
                type="button"
                className="chip"
                onClick={() => setRender({ rodando: false, progresso: 0, saida: null, erro: null })}
              >
                Fechar
              </button>
            </>
          )}
        </div>
      )}

      <div className="grade">
        <LeftPanel
          templates={templates}
          selecionado={templateId}
          onSelecionar={(id) => {
            setTemplateId(id);
            setOverride({});
            setPasso(2);
          }}
          style={style}
          onStyle={(patch) => {
            setOverride((o) => ({ ...o, ...patch }));
            setPasso(3);
          }}
          modificado={Object.keys(override).length > 0}
          onResetar={() => setOverride({})}
          onUpload={enviar}
          nomeArquivo={nomeArquivo}
          autoTranscrever={autoTranscrever}
          onAutoTranscrever={setAutoTranscrever}
          servidorOk={servidorOk}
          movimento={movimento}
          onMovimento={setMovimento}
          forcaZoom={forcaZoom}
          onForcaZoom={setForcaZoom}
          cortes={cortes}
          transicao={transicao}
          onTransicao={setTransicao}
          forcaTransicao={forcaTransicao}
          onForcaTransicao={setForcaTransicao}
          duracaoTransicao={duracaoTransicao}
          onDuracaoTransicao={setDuracaoTransicao}
          coresTransicao={coresTransicao}
          onCoresTransicao={setCoresTransicao}
          detectando={detectando}
          onCorte={(t, patch) =>
            setCortes((atuais) =>
              atuais.map((c) => {
                if (c.t !== t) return c;
                const novo = { ...c, ...patch };
                // 'undefined' aqui quer dizer "volta ao padrão", não "mantém"
                if ('duracao' in patch && patch.duracao === undefined) delete novo.duracao;
                if ('imagem' in patch && patch.imagem === undefined) delete novo.imagem;
                return novo;
              }),
            )
          }
          onTodosCortes={(ativo) => setCortes((atuais) => atuais.map((c) => ({ ...c, ativo })))}
          onIrPara={irPara}
          onDetectar={() => void procurarCortes()}
        />

        <Preview
          src={src}
          playerRef={playerRef}
          palavras={words}
          movimento={movimento}
          forcaZoom={forcaZoom}
          fotos={fotos}
          cartoes={cartoes}
          divisoes={divisoes}
          cortes={cortes}
          transicao={transicao}
          forcaTransicao={forcaTransicao}
          duracaoTransicao={duracaoTransicao}
          coresTransicao={coresTransicao}
          fps={fps}
          largura={tamanho.largura}
          altura={tamanho.altura}
          duracao={duracao}
          templateId={templateId}
          override={override}
          onMoverCamada={(tipo, id, pos) => {
            if (tipo === 'foto') {
              setFotos((atuais) => atuais.map((f) => (f.id === id ? { ...f, ...pos } : f)));
            } else {
              setCartoes((atuais) => atuais.map((c) => (c.id === id ? { ...c, ...pos } : c)));
            }
          }}
          onLarguraCamada={(tipo, id, largura) => {
            if (tipo === 'foto') {
              setFotos((atuais) => atuais.map((f) => (f.id === id ? { ...f, largura } : f)));
            } else {
              setCartoes((atuais) => atuais.map((c) => (c.id === id ? { ...c, largura } : c)));
            }
          }}
          bloco={bloco}
          ativa={ativa}
          revelada={revelada}
          style={style}
          tempo={tempo}
          cena={cena}
          guias={guias}
          onGuias={setGuias}
          mudo={mudo}
          volume={volume}
          transcrevendo={transcrevendo}
          progresso={progresso}
          camera={camera}
        />

        <CaptionPanel
          blocos={blocos}
          cenas={cenas}
          tempo={tempo}
          onEditar={editar}
          onMarcar={marcar}
          onIr={irPara}
          transcrito={transcrito}
          onTranscrever={transcrever}
          onImportar={importarTexto}
          maxChars={maxChars}
          temVideo={!!src}
          onAuto={() => void transcreverAuto()}
          servidorOk={servidorOk}
          transcrevendo={transcrevendo}
          progresso={progresso}
          decorrido={decorrido}
          estimativa={estimativa}
          erro={erro}
        >
          <FotosPanel
            fotos={fotos}
            tempo={tempo}
            duracao={duracao}
            onAdicionar={(f) => {
              setFotos((atuais) => [...atuais, f].sort((a, b) => a.start - b.start));
              setPasso(3);
            }}
            onMudar={(id, patch) =>
              setFotos((atuais) =>
                atuais
                  .map((f) => (f.id === id ? { ...f, ...patch } : f))
                  .sort((a, b) => a.start - b.start),
              )
            }
            onRemover={(id) => setFotos((atuais) => atuais.filter((f) => f.id !== id))}
            onIr={irPara}
          />
          <CartoesPanel
            padrao={cartaoPadrao}
            cartoes={cartoes}
            tempo={tempo}
            duracao={duracao}
            onAdicionar={(c) => {
              setCartoes((atuais) => [...atuais, c].sort((a, b) => a.start - b.start));
              setPasso(3);
            }}
            onMudar={(id, patch) =>
              setCartoes((atuais) =>
                atuais
                  .map((c) => (c.id === id ? { ...c, ...patch } : c))
                  .sort((a, b) => a.start - b.start),
              )
            }
            onRemover={(id) => setCartoes((atuais) => atuais.filter((c) => c.id !== id))}
            onIr={irPara}
          />
          <DivisaoPanel
            divisoes={divisoes}
            tempo={tempo}
            duracao={duracao}
            onAdicionar={(d) => {
              setDivisoes((atuais) => [...atuais, d].sort((a, b) => a.start - b.start));
              setPasso(3);
            }}
            onMudar={(id, patch) =>
              setDivisoes((atuais) =>
                atuais
                  .map((d) => (d.id === id ? { ...d, ...patch } : d))
                  .sort((a, b) => a.start - b.start),
              )
            }
            onRemover={(id) => setDivisoes((atuais) => atuais.filter((d) => d.id !== id))}
            onIr={irPara}
          />
        </CaptionPanel>
      </div>

      <Timeline
        duracao={duracao}
        tempo={tempo}
        tocando={tocando}
        blocos={blocos}
        cenas={cenas}
        zooms={zooms}
        fotos={fotos}
        divisoes={divisoes}
        cortes={cortes}
        onIr={irPara}
        onTocar={alternar}
        temVideo={!!src}
        mudo={mudo}
        volume={volume}
        onMudo={() => setMudo((v) => !v)}
        onVolume={(v) => {
          setVolume(v);
          setMudo(v === 0);
        }}
      />

      {passo === 5 && (
        <div className="modal" role="dialog" aria-modal>
          <div className="modal-caixa">
            <h3>Exportar</h3>
            <p>
              A renderização real entra na <strong>Etapa 4</strong>, quando as configurações visuais
              forem ligadas ao Remotion. Este protótipo já guarda tudo que o render vai receber:
            </p>
            <pre>{JSON.stringify({ template: template.id, style, blocos: blocos.length }, null, 2)}</pre>
            <button type="button" className="primario" onClick={() => setPasso(4)}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
