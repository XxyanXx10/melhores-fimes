import { useEffect, useRef, useState } from 'react';
import type { Preset, Template } from '../types';
import {
  SERVIDOR,
  enderecoDoRender,
  enfileirarRenders,
  enviarMidia,
  enviarNarracaoDark,
  estadoLoteDark,
  iniciarLoteDark,
  listarBibliotecaDark,
  listarNarracoesDaPasta,
  removerDaFilaRender,
  type BibliotecaDark,
  type EstadoLoteDark,
  type ItemFilaRender,
  type NarracaoDark,
  type OpcoesLoteDark,
} from '../transcrever';
import { Ideias } from './Ideias';

type Props = {
  templates: Template[];
  presets: Preset[];
  filaRender: ItemFilaRender[];
  onAtualizarFila: () => void;
  onVoltarProjetos: () => void;
  onAbrirProjeto: (arquivo: string) => void;
  onVoltarEditor: (() => void) | null;
};

const legivel = (b: number) =>
  b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`;

export function CanalDark(p: Props) {
  const [narracoes, setNarracoes] = useState<NarracaoDark[]>([]);
  const [verIdeias, setVerIdeias] = useState(false);
  const [pastaNarracoes, setPastaNarracoes] = useState('');
  const [mostrarInputPasta, setMostrarInputPasta] = useState(false);
  const [enviandoNarracao, setEnviandoNarracao] = useState(false);

  const [bib, setBib] = useState<BibliotecaDark>({
    videosFundo: [],
    musicas: [],
    efeitos: [],
    imagens: [],
  });
  const [pastaFundo, setPastaFundo] = useState('');
  const [fundosSelecionados, setFundosSelecionados] = useState<string[]>([]);
  const [imagensSelecionadas, setImagensSelecionadas] = useState<string[]>([]);
  const [enviandoFundo, setEnviandoFundo] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [enviandoMusica, setEnviandoMusica] = useState(false);

  // Gavetas recolhidas por padrão para não poluir a tela
  const [abrirSeletorFundos, setAbrirSeletorFundos] = useState(false);
  const [abrirSeletorImagens, setAbrirSeletorImagens] = useState(false);
  const [abrirAjustesAvancados, setAbrirAjustesAvancados] = useState(false);

  const [formato, setFormato] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [template, setTemplate] = useState('dark-misterio');
  const [movimento, setMovimento] = useState<'off' | 'natural' | 'suave' | 'ritmo'>('natural');
  const [forcaZoom, setForcaZoom] = useState(1.15);
  const [modoFundo, setModoFundo] = useState<'remotion' | 'contexto' | 'dinamico' | 'loop' | 'escuro' | 'original'>('remotion');
  const [gerarCenasRemotion, setGerarCenasRemotion] = useState(true);
  const [buscarImagensReaisWeb, setBuscarImagensReaisWeb] = useState(true);
  const [pexelsKey, setPexelsKey] = useState('');
  const [intervaloTroca, setIntervaloTroca] = useState(5);
  const [escurecerFundo, setEscurecerFundo] = useState(true);
  const [cortarSilenciosAudio, setCortarSilenciosAudio] = useState(true);
  const [silencioMinimo, setSilencioMinimo] = useState(0.35);
  const [gerarCartoesChave, setGerarCartoesChave] = useState(true);
  const [repetirImagensApoio, setRepetirImagensApoio] = useState(true);
  const [efeitosAutomaticos, setEfeitosAutomaticos] = useState(true);
  const [musicaFundo, setMusicaFundo] = useState<string>('');
  const [volumeMusica, setVolumeMusica] = useState(0.14);
  const [transicao, setTransicao] = useState<'off' | 'variado' | 'flash' | 'escurece' | 'whip' | 'zoom'>('variado');
  const [prefixoNome, setPrefixoNome] = useState('');
  const [exportarDireto, setExportarDireto] = useState(false);

  const [lote, setLote] = useState<EstadoLoteDark>({ etapa: 'parado' });
  const [erro, setErro] = useState<string | null>(null);
  const [ouvindoMusica, setOuvindoMusica] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function recarregarBiblioteca(pasta?: string) {
    const dados = await listarBibliotecaDark(pasta ?? (pastaFundo.trim() || undefined));
    setBib(dados);
    if (dados.videosFundo.length && !fundosSelecionados.length) {
      setFundosSelecionados(dados.videosFundo.map((v) => v.caminho));
    }
    if (dados.musicas.length && !musicaFundo) {
      setMusicaFundo(dados.musicas[0].src);
    }
  }

  useEffect(() => {
    void recarregarBiblioteca();
    return () => {
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vivo = true;
    const checar = () =>
      void estadoLoteDark().then((e) => {
        if (!vivo) return;
        setLote(e);
        if (e.etapa === 'pronto') p.onAtualizarFila();
      });
    checar();
    const id = setInterval(checar, 1200);
    return () => {
      vivo = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aoSubirNarracoes(files: FileList | null) {
    if (!files || !files.length) return;
    setEnviandoNarracao(true);
    setErro(null);
    try {
      const novos: NarracaoDark[] = [];
      for (const f of Array.from(files)) {
        novos.push(await enviarNarracaoDark(f));
      }
      setNarracoes((atuais) => [...atuais, ...novos]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar narrações.');
    } finally {
      setEnviandoNarracao(false);
    }
  }

  async function carregarPastaNarracoes() {
    if (!pastaNarracoes.trim()) return;
    setErro(null);
    try {
      const itens = await listarNarracoesDaPasta(pastaNarracoes.trim());
      if (!itens.length) {
        setErro('Nenhum arquivo de áudio ou vídeo encontrado nessa pasta.');
        return;
      }
      setNarracoes(
        itens.map((x) => ({
          ...x,
          titulo: x.nome.replace(/\.[^.]+$/, ''),
        })),
      );
      setMostrarInputPasta(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler a pasta de narrações.');
    }
  }

  async function subirVideoFundoNovo(files: FileList | null) {
    if (!files || !files.length) return;
    setEnviandoFundo(true);
    setErro(null);
    try {
      for (const f of Array.from(files)) {
        await enviarMidia(f);
      }
      const novosDados = await listarBibliotecaDark(pastaFundo.trim() || undefined);
      setBib(novosDados);
      setFundosSelecionados(novosDados.videosFundo.map((v) => v.caminho));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar vídeo de fundo.');
    } finally {
      setEnviandoFundo(false);
    }
  }

  async function subirImagemApoioNova(files: FileList | null) {
    if (!files || !files.length) return;
    setEnviandoImagem(true);
    setErro(null);
    try {
      const novasSrcs: string[] = [];
      for (const f of Array.from(files)) {
        novasSrcs.push(await enviarMidia(f));
      }
      const novosDados = await listarBibliotecaDark(pastaFundo.trim() || undefined);
      setBib(novosDados);
      setImagensSelecionadas((atuais) => [...new Set([...atuais, ...novasSrcs])]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar imagens de apoio.');
    } finally {
      setEnviandoImagem(false);
    }
  }

  async function subirMusicaNova(f: File | undefined) {
    if (!f) return;
    setEnviandoMusica(true);
    setErro(null);
    try {
      const src = await enviarMidia(f);
      const novosDados = await listarBibliotecaDark(pastaFundo.trim() || undefined);
      setBib(novosDados);
      setMusicaFundo(src);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar música.');
    } finally {
      setEnviandoMusica(false);
    }
  }

  function ouvirPreviaMusica(src: string) {
    audioRef.current?.pause();
    if (ouvindoMusica === src) {
      setOuvindoMusica(null);
      return;
    }
    const a = new Audio(`${SERVIDOR}/${src}`);
    a.volume = Math.min(1, volumeMusica * 2.5);
    a.onended = () => setOuvindoMusica(null);
    void a.play();
    audioRef.current = a;
    setOuvindoMusica(src);
  }

  function aplicarPresetNoDark(preset: Preset) {
    setTemplate(preset.template);
    if (preset.movimento) setMovimento(preset.movimento);
    if (preset.forcaZoom) setForcaZoom(preset.forcaZoom);
    if (
      preset.transicao &&
      preset.transicao !== 'cortina' &&
      preset.transicao !== 'barras' &&
      preset.transicao !== 'giro' &&
      preset.transicao !== 'deslize'
    ) {
      setTransicao(preset.transicao);
    }
  }

  async function dispararGeracao(exportarFila: boolean) {
    if (!narracoes.length) {
      setErro('Adicione ao menos 1 áudio ou vídeo no Passo 1 para começar.');
      return;
    }
    setErro(null);
    const opcoes: OpcoesLoteDark = {
      formato,
      template,
      movimento,
      forcaZoom,
      modoFundo,
      intervaloTrocaFundo: intervaloTroca,
      escurecerFundo,
      gerarCenasRemotion,
      buscarImagensReaisWeb,
      pexelsKey: pexelsKey.trim() || undefined,
      pastaFundoExterna: pastaFundo.trim() || undefined,
      videosFundoEscolhidos: fundosSelecionados,
      cortarSilenciosAudio,
      silencioMinimo,
      gerarCartoesChave,
      imagensApoio: imagensSelecionadas,
      repetirImagensApoio,
      efeitosAutomaticos,
      musicaFundo: musicaFundo || undefined,
      volumeMusica,
      transicao,
      prefixoNome: prefixoNome.trim() || undefined,
      exportarFila,
    };

    try {
      await iniciarLoteDark(
        narracoes.map((n) => ({
          caminho: n.caminho,
          titulo: n.titulo || n.nome.replace(/\.[^.]+$/, ''),
        })),
        opcoes,
      );
      setLote({
        etapa: 'processando',
        atual: 1,
        total: narracoes.length,
        detalhe: 'Iniciando criação em lote…',
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar o lote.');
    }
  }

  const processando = lote.etapa === 'processando';
  const templatesDark = p.templates.filter((t) => t.family === 'Canal Dark');
  const outrosTemplates = p.templates.filter((t) => t.family !== 'Canal Dark');

  if (verIdeias) return <Ideias onFechar={() => setVerIdeias(false)} onAbrirProjeto={p.onAbrirProjeto} />;

  return (
    <div className="tela-projetos tela-dark">
      {/* Cabeçalho limpo */}
      <header className="tp-topo">
        <div className="tp-titulo">
          <h1>
            🔥 Criador de Canal Dark <span>· Produção Rápida</span>
          </h1>
          <p>
            Envie seus áudios narrados, escolha o visual e deixe o sistema montar o vídeo com legenda, cartões e efeitos sozinho.
          </p>
        </div>

        <div className="tp-acoes">
          <button type="button" className="chip chip-topo chip-dark" onClick={() => setVerIdeias(true)}>
            💡 Ideias de conteúdo
          </button>
          <button type="button" className="chip chip-topo" onClick={p.onVoltarProjetos}>
            ← Voltar para Meus Projetos
          </button>
          {p.onVoltarEditor && (
            <button type="button" className="chip chip-topo" onClick={p.onVoltarEditor}>
              Voltar ao Editor
            </button>
          )}
        </div>
      </header>

      {(erro || (lote.etapa === 'erro' && lote.erro)) && (
        <div className="dk-alerta-erro" role="alert">
          <span>⚠️ {erro ?? lote.erro}</span>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setErro(null);
              setLote({ etapa: 'parado' });
            }}
          >
            Entendi
          </button>
        </div>
      )}

      {/* Barra de Progresso quando está gerando */}
      {processando && (
        <div className="dk-banner-progresso">
          <div className="dk-banner-topo">
            <span className="girando" aria-hidden="true" />
            <div>
              <strong>
                Montando vídeo {lote.atual ?? 1} de {lote.total ?? narracoes.length}
                {lote.nome ? ` — “${lote.nome}”` : ''}
              </strong>
              <p>{lote.detalhe}</p>
            </div>
          </div>
          <div className="dk-barra-trilho">
            <div
              className="dk-barra-preenchimento"
              style={{
                width: `${Math.min(100, Math.round(((lote.atual ?? 1) / Math.max(1, lote.total ?? 1)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Resultado quando termina de gerar */}
      {lote.etapa === 'pronto' && lote.criados && lote.criados.length > 0 && (
        <div className="dk-banner-pronto">
          <div className="dk-banner-pronto-cab">
            <div>
              <strong>✅ {lote.criados.length} vídeo(s) prontos e legendados!</strong>
              <p>Clique em "Abrir no Editor" para ver e ajustar, ou exporte direto em MP4.</p>
            </div>
            <div className="chips">
              <button
                type="button"
                className="primario"
                onClick={() => {
                  void enfileirarRenders(lote.criados!.map((c) => c.arquivoProjeto)).then(() => p.onAtualizarFila());
                }}
              >
                🎬 Baixar Todos em MP4 ({lote.criados.length})
              </button>
              <button type="button" className="chip" onClick={p.onVoltarProjetos}>
                Ver em Meus Projetos
              </button>
            </div>
          </div>
          <ul className="dk-lista-criados">
            {lote.criados.map((c) => (
              <li key={c.arquivoProjeto}>
                <div className="dk-criado-info">
                  <strong>{c.nomeProjeto}</strong>
                  <span>
                    {Math.round(c.duracao)}s · {c.palavras} palavras · {c.cartoes} cartões · {c.fotos} imagens
                  </span>
                </div>
                <div className="chips">
                  <button
                    type="button"
                    className="primario"
                    onClick={() => p.onAbrirProjeto(c.arquivoProjeto)}
                  >
                    ✏️ Abrir no Editor
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => void enfileirarRenders([c.arquivoProjeto]).then(() => p.onAtualizarFila())}
                  >
                    + Fila MP4
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fila de Exportação MP4 (só aparece quando tem vídeo exportando) */}
      {p.filaRender.length > 0 && (
        <section className="dk-fila-exportacao">
          <div className="dk-fila-cab">
            <strong>
              🎬 Fila de Exportação MP4 ({p.filaRender.filter((x) => x.status === 'pronto').length}/
              {p.filaRender.length} prontos)
            </strong>
            <div className="chips">
              <button
                type="button"
                className="chip"
                onClick={() => void removerDaFilaRender(undefined, true).then(() => p.onAtualizarFila())}
              >
                Limpar prontos
              </button>
              <button
                type="button"
                className="chip chip-perigo"
                onClick={() => void removerDaFilaRender().then(() => p.onAtualizarFila())}
              >
                Cancelar fila
              </button>
            </div>
          </div>
          <div className="dk-fila-chips">
            {p.filaRender.map((item) => (
              <div key={item.id} className={`dk-fila-pill is-${item.status}`}>
                <span>{item.nome}</span>
                <em>
                  {item.status === 'aguardando' && '⏳ Na fila'}
                  {item.status === 'renderizando' && `⚙️ ${Math.round(item.progresso * 100)}%`}
                  {item.status === 'pronto' && '✅ Pronto'}
                  {item.status === 'erro' && '❌ Erro'}
                </em>
                {item.status === 'pronto' && item.saida && (
                  <a href={enderecoDoRender(item.saida)} download>
                    ⬇ Baixar MP4
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3 PASSOS CLAROS E VISUAIS */}
      <div className="dk-passos-grid">
        {/* ============================================================
            PASSO 1: NARRAÇÕES / ÁUDIOS
            ============================================================ */}
        <section className="dk-card">
          <div className="dk-card-topo">
            <span className="dk-num-passo">1</span>
            <div>
              <h2>Suas Narrações (Áudio ou Vídeo)</h2>
              <p>Suba 1 ou vários áudios gravados. Cada áudio vira um vídeo completo.</p>
            </div>
          </div>

          <label className="dk-dropzone">
            <input
              type="file"
              accept="audio/*,video/*"
              multiple
              disabled={enviandoNarracao || processando}
              onChange={(e) => {
                void aoSubirNarracoes(e.target.files);
                e.target.value = '';
              }}
            />
            <span className="dk-dropzone-icone">🎙️</span>
            <strong>
              {enviandoNarracao ? 'Enviando seus arquivos…' : 'Clique para escolher os áudios ou vídeos'}
            </strong>
            <span>Aceita .mp3, .wav, .m4a (ElevenLabs, CapCut, celular) ou .mp4</span>
          </label>

          {/* Lista de áudios adicionados */}
          <div className="dk-caixa-lista">
            <div className="dk-caixa-lista-cab">
              <strong>
                {narracoes.length === 0
                  ? 'Nenhum áudio na fila ainda'
                  : `${narracoes.length} ${narracoes.length === 1 ? 'vídeo será criado' : 'vídeos serão criados'}`}
              </strong>
              <div className="chips">
                <button
                  type="button"
                  className="chip"
                  onClick={() => setMostrarInputPasta((v) => !v)}
                >
                  📁 {mostrarInputPasta ? 'Fechar pasta' : 'Carregar de pasta'}
                </button>
                {narracoes.length > 0 && (
                  <button type="button" className="chip chip-perigo" onClick={() => setNarracoes([])}>
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {mostrarInputPasta && (
              <div className="dk-linha-pasta">
                <input
                  type="text"
                  value={pastaNarracoes}
                  placeholder="Cole o caminho da pasta (ex.: D:\MeusAudios)"
                  onChange={(e) => setPastaNarracoes(e.target.value)}
                />
                <button type="button" className="primario" onClick={() => void carregarPastaNarracoes()}>
                  Carregar
                </button>
              </div>
            )}

            {narracoes.length === 0 ? (
              <div className="dk-lista-vazia">
                Adicione um ou mais arquivos acima para começar. Você poderá dar nome a cada vídeo aqui.
              </div>
            ) : (
              <ul className="dk-itens-audio">
                {narracoes.map((n, idx) => (
                  <li key={`${n.caminho}-${idx}`}>
                    <span className="dk-item-indice">#{idx + 1}</span>
                    <input
                      type="text"
                      value={n.titulo ?? n.nome.replace(/\.[^.]+$/, '')}
                      placeholder="Título do vídeo"
                      onChange={(e) => {
                        const val = e.target.value;
                        setNarracoes((atuais) =>
                          atuais.map((item, k) => (k === idx ? { ...item, titulo: val } : item)),
                        );
                      }}
                    />
                    <em className="dk-item-tam">{legivel(n.tamanho)}</em>
                    <button
                      type="button"
                      className="dk-item-remover"
                      onClick={() => setNarracoes((atuais) => atuais.filter((_, k) => k !== idx))}
                      title="Remover este áudio"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="dk-opcao-box">
            <input
              type="checkbox"
              checked={cortarSilenciosAudio}
              onChange={(e) => setCortarSilenciosAudio(e.target.checked)}
            />
            <div>
              <strong>✂️ Remover pausas e silêncios automaticamente</strong>
              <span>Deixa a fala rápida e sem respiros longos (recomendado para Shorts/TikTok)</span>
            </div>
          </label>
        </section>

        {/* ============================================================
            PASSO 2: ESTILO VISUAL & FUNDO
            ============================================================ */}
        <section className="dk-card">
          <div className="dk-card-topo">
            <span className="dk-num-passo">2</span>
            <div>
              <h2>Formato e Estilo Visual</h2>
              <p>Escolha o formato da tela, o estilo da legenda e o tipo de vídeo de fundo.</p>
            </div>
          </div>

          {/* Formato da Tela */}
          <div className="dk-bloco">
            <span className="dk-rotulo">Formato do Vídeo</span>
            <div className="dk-grade-3">
              {(
                [
                  ['9:16', '📱 Vertical 9:16', 'Reels, Shorts, TikTok'],
                  ['16:9', '🖥️ Horizontal 16:9', 'YouTube Longo'],
                  ['1:1', '⬛ Quadrado 1:1', 'Feed / Post'],
                ] as const
              ).map(([id, titulo, sub]) => (
                <button
                  key={id}
                  type="button"
                  className={`dk-botao-escolha ${formato === id ? 'is-ativo' : ''}`}
                  onClick={() => setFormato(id)}
                >
                  <strong>{titulo}</strong>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Estilo de Legenda com Prévia Visual */}
          <div className="dk-bloco">
            <span className="dk-rotulo">Estilo da Legenda</span>
            <div className="dk-grade-2">
              {templatesDark.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`dk-card-estilo ${template === t.id ? 'is-ativo' : ''}`}
                  onClick={() => setTemplate(t.id)}
                >
                  <span
                    className="dk-amostra-legenda"
                    style={{
                      background: t.swatch[0],
                      color: t.swatch[1],
                      fontFamily: t.style.fontFamily,
                    }}
                  >
                    ABC
                  </span>
                  <div className="dk-card-estilo-texto">
                    <strong>{t.name.replace(/^Dark — /, '')}</strong>
                    <span>{t.description}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Outros estilos ou presets salvos */}
            <div className="dk-linha-outros-estilos">
              <select
                className="dk-select"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <optgroup label="Estilos Canal Dark">
                  {templatesDark.map((t) => (
                    <option key={t.id} value={t.id}>
                      🔥 {t.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Outros Estilos da Plataforma">
                  {outrosTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.family})
                    </option>
                  ))}
                </optgroup>
              </select>

              {p.presets.length > 0 && (
                <select
                  className="dk-select"
                  defaultValue=""
                  onChange={(e) => {
                    const pr = p.presets.find((x) => x.id === e.target.value);
                    if (pr) aplicarPresetNoDark(pr);
                  }}
                >
                  <option value="" disabled>
                    🎨 Aplicar meu preset…
                  </option>
                  {p.presets.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Tipo de Fundo */}
          <div className="dk-bloco">
            <span className="dk-rotulo">O que vai passar no fundo do vídeo?</span>
            <button
              type="button"
              className={`dk-botao-escolha ${modoFundo === 'remotion' ? 'is-ativo' : ''}`}
              onClick={() => {
                setModoFundo('remotion');
                setGerarCenasRemotion(true);
              }}
              style={{ width: '100%' }}
            >
              <strong>🤖 Cenas Animadas no Remotion (ChatGPT / UI Dinâmica)</strong>
              <span>
                Lê o roteiro e cria direto no Remotion: conversa digitando no ChatGPT, checklist e escudo de privacidade
              </span>
            </button>
            <button
              type="button"
              className={`dk-botao-escolha ${modoFundo === 'contexto' ? 'is-ativo' : ''}`}
              onClick={() => setModoFundo('contexto')}
              style={{ width: '100%' }}
            >
              <strong>🌐 Cenas Reais do que é Falado (Fotos / Vídeos da Web)</strong>
              <span>
                Lê cada frase da narração e busca imagens/vídeos reais do assunto (ex.: Google, código, finanças)
              </span>
            </button>
            <div className="dk-grade-2">
              {(
                [
                  ['dinamico', '🎬 Cenas da Minha Pasta', `Troca vídeos locais a cada ${intervaloTroca}s`],
                  ['loop', '🔁 Vídeo Único em Loop', 'Repete 1 vídeo de fundo'],
                  ['escuro', '🌑 Fundo Preto Dark', 'Só legenda e cartões'],
                  ['original', '📹 Vídeo Original', 'Usa a imagem do próprio arquivo'],
                ] as const
              ).map(([id, titulo, sub]) => (
                <button
                  key={id}
                  type="button"
                  className={`dk-botao-escolha ${modoFundo === id ? 'is-ativo' : ''}`}
                  onClick={() => setModoFundo(id)}
                >
                  <strong>{titulo}</strong>
                  <span>{sub}</span>
                </button>
              ))}
            </div>

            {/* Resumo compacto do banco de vídeos (sem explodir a tela!) */}
            {(modoFundo === 'contexto' || modoFundo === 'dinamico' || modoFundo === 'loop') && (
              <div className="dk-gaveta-container">
                <div className="dk-gaveta-barra">
                  <span>
                    📂 <strong>{fundosSelecionados.length}</strong> de {bib.videosFundo.length} vídeos locais disponíveis
                  </span>
                  <div className="chips">
                    <label className="chip chip-forte" style={{ cursor: 'pointer' }}>
                      {enviandoFundo ? 'Enviando…' : '+ Subir vídeo'}
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        hidden
                        disabled={enviandoFundo}
                        onChange={(e) => {
                          void subirVideoFundoNovo(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setAbrirSeletorFundos((v) => !v)}
                    >
                      {abrirSeletorFundos ? 'Ocultar lista ▲' : 'Escolher vídeos ▼'}
                    </button>
                  </div>
                </div>

                {abrirSeletorFundos && (
                  <div className="dk-gaveta-corpo">
                    <div className="dk-linha-pasta" style={{ marginBottom: 8 }}>
                      <input
                        type="text"
                        value={pastaFundo}
                        placeholder="Ou usar vídeos de outra pasta do PC (ex.: D:\Fundos)"
                        onChange={(e) => setPastaFundo(e.target.value)}
                      />
                      <button
                        type="button"
                        className="chip chip-forte"
                        onClick={() => void recarregarBiblioteca(pastaFundo.trim())}
                      >
                        Ler pasta
                      </button>
                    </div>
                    <div className="dk-gaveta-acoes">
                      <button
                        type="button"
                        className="chip"
                        onClick={() => setFundosSelecionados(bib.videosFundo.map((v) => v.caminho))}
                      >
                        Marcar todos
                      </button>
                      <button type="button" className="chip" onClick={() => setFundosSelecionados([])}>
                        Desmarcar todos
                      </button>
                    </div>
                    <ul className="dk-lista-compacta">
                      {bib.videosFundo.map((v) => {
                        const marcado = fundosSelecionados.includes(v.caminho);
                        return (
                          <li key={v.caminho}>
                            <label>
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFundosSelecionados((atuais) => [...atuais, v.caminho]);
                                  } else {
                                    setFundosSelecionados((atuais) =>
                                      atuais.filter((x) => x !== v.caminho),
                                    );
                                  }
                                }}
                              />
                              <span>{v.nome}</span>
                            </label>
                            <em>{legivel(v.tamanho)}</em>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ============================================================
            PASSO 3: EFEITOS AUTOMÁTICOS, MÚSICA & GERAR
            ============================================================ */}
        <section className="dk-card dk-card-destaque">
          <div className="dk-card-topo">
            <span className="dk-num-passo">3</span>
            <div>
              <h2>Efeitos Automáticos e Criar</h2>
              <p>O sistema analisa o que é dito e adiciona cenas dinâmicas no Remotion, imagens e efeitos sozinho.</p>
            </div>
          </div>

          <div className="dk-opcoes-lista">
            <label className="dk-opcao-box">
              <input
                type="checkbox"
                checked={gerarCenasRemotion}
                onChange={(e) => setGerarCenasRemotion(e.target.checked)}
              />
              <div>
                <strong>🤖 Criar Cenas Animadas no Remotion (ChatGPT / Checklist / Escudo)</strong>
                <span>Lê o roteiro e desenha conversa no ChatGPT digitando ao vivo, cards de contexto e passos</span>
              </div>
            </label>

            <label className="dk-opcao-box">
              <input
                type="checkbox"
                checked={buscarImagensReaisWeb}
                onChange={(e) => setBuscarImagensReaisWeb(e.target.checked)}
              />
              <div>
                <strong>🌐 Buscar Imagens / Prints Reais na Web</strong>
                <span>Mostra fotos e logos reais do que está sendo falado (ex.: Google, Gemini, gráficos)</span>
              </div>
            </label>

            <label className="dk-opcao-box">
              <input
                type="checkbox"
                checked={gerarCartoesChave}
                onChange={(e) => setGerarCartoesChave(e.target.checked)}
              />
              <div>
                <strong>🎴 Criar Cartões de Impacto Automaticamente</strong>
                <span>Destaca o gancho inicial e as frases mais fortes na tela</span>
              </div>
            </label>

            <label className="dk-opcao-box">
              <input
                type="checkbox"
                checked={efeitosAutomaticos}
                onChange={(e) => setEfeitosAutomaticos(e.target.checked)}
              />
              <div>
                <strong>🔊 Colocar Efeitos Sonoros Sozinho (SFX)</strong>
                <span>Adiciona som de impacto (whoosh, sino, pop) quando entram cartões e imagens</span>
              </div>
            </label>

            <label className="dk-opcao-box">
              <input
                type="checkbox"
                checked={escurecerFundo}
                onChange={(e) => setEscurecerFundo(e.target.checked)}
              />
              <div>
                <strong>🌑 Filtro Dark Cinematográfico</strong>
                <span>Escurece levemente o vídeo de fundo para a legenda ficar 100% legível</span>
              </div>
            </label>
          </div>

          {/* Música de Fundo */}
          <div className="dk-bloco">
            <div className="dk-rotulo-linha">
              <span className="dk-rotulo">🎵 Música de Fundo</span>
              <label className="dk-link-upload">
                {enviandoMusica ? 'Enviando…' : '+ Enviar outra música'}
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  disabled={enviandoMusica}
                  onChange={(e) => {
                    void subirMusicaNova(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="dk-musica-row">
              <select
                className="dk-select"
                value={musicaFundo}
                onChange={(e) => setMusicaFundo(e.target.value)}
              >
                <option value="">Sem música de fundo</option>
                {bib.musicas.map((m) => (
                  <option key={m.src} value={m.src}>
                    🎵 {m.nome}
                  </option>
                ))}
              </select>
              {musicaFundo && (
                <button
                  type="button"
                  className="chip chip-forte"
                  onClick={() => ouvirPreviaMusica(musicaFundo)}
                >
                  {ouvindoMusica === musicaFundo ? '■ Parar' : '▶ Ouvir'}
                </button>
              )}
            </div>

            {musicaFundo && (
              <div className="dk-slider-row">
                <span>Volume da música: {Math.round(volumeMusica * 100)}%</span>
                <input
                  type="range"
                  min={0.04}
                  max={0.4}
                  step={0.01}
                  value={volumeMusica}
                  onChange={(e) => setVolumeMusica(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Gaveta opcional: Imagens de apoio & Ajustes finos */}
          <div className="dk-botoes-extras">
            <button
              type="button"
              className="chip"
              onClick={() => setAbrirSeletorImagens((v) => !v)}
            >
              🖼️ Imagens extras ({imagensSelecionadas.length}) {abrirSeletorImagens ? '▲' : '▼'}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => setAbrirAjustesAvancados((v) => !v)}
            >
              ⚙️ Ajustes finos {abrirAjustesAvancados ? '▲' : '▼'}
            </button>
          </div>

          {abrirSeletorImagens && (
            <div className="dk-gaveta-corpo">
              <div className="dk-gaveta-acoes">
                <span>Clique nas imagens que quiser mostrar durante o vídeo:</span>
                <label className="chip chip-forte" style={{ cursor: 'pointer' }}>
                  {enviandoImagem ? 'Enviando…' : '+ Subir imagens'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    disabled={enviandoImagem}
                    onChange={(e) => {
                      void subirImagemApoioNova(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <div className="dk-grade-miniaturas">
                {bib.imagens.map((img) => {
                  const ativa = imagensSelecionadas.includes(img.src);
                  return (
                    <button
                      key={img.src}
                      type="button"
                      className={`dk-miniatura ${ativa ? 'is-ativa' : ''}`}
                      onClick={() =>
                        setImagensSelecionadas((atuais) =>
                          ativa ? atuais.filter((x) => x !== img.src) : [...atuais, img.src],
                        )
                      }
                      title={img.nome}
                    >
                      <img src={`${SERVIDOR}/${img.src}`} alt={img.nome} loading="lazy" />
                      <span>{img.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {abrirAjustesAvancados && (
            <div className="dk-gaveta-corpo">
              <label className="dk-campo-simples">
                <span>Prefixo no nome dos projetos</span>
                <input
                  type="text"
                  className="dk-select"
                  value={prefixoNome}
                  placeholder="Ex.: Canal Mistério"
                  onChange={(e) => setPrefixoNome(e.target.value)}
                />
              </label>
              <label className="dk-campo-simples">
                <span>Movimento de câmera (Zoom)</span>
                <select
                  className="dk-select"
                  value={movimento}
                  onChange={(e) => setMovimento(e.target.value as typeof movimento)}
                >
                  <option value="natural">Natural (acompanha a fala)</option>
                  <option value="ritmo">No ritmo (mais dinâmico)</option>
                  <option value="suave">Suave contínuo</option>
                  <option value="off">Parado (sem zoom)</option>
                </select>
              </label>
              <label className="dk-campo-simples">
                <span>Transição entre cortes</span>
                <select
                  className="dk-select"
                  value={transicao}
                  onChange={(e) => setTransicao(e.target.value as typeof transicao)}
                >
                  <option value="variado">Variado automático</option>
                  <option value="flash">Clarão curto</option>
                  <option value="escurece">Mergulho no preto</option>
                  <option value="whip">Chicote rápido</option>
                  <option value="zoom">Estalo de zoom</option>
                  <option value="off">Corte seco</option>
                </select>
              </label>
              {modoFundo === 'dinamico' && (
                <label className="dk-campo-simples">
                  <span>Trocar cena de fundo a cada: {intervaloTroca}s</span>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    step={0.5}
                    value={intervaloTroca}
                    onChange={(e) => setIntervaloTroca(Number(e.target.value))}
                  />
                </label>
              )}
            </div>
          )}

          {/* Checkbox para já exportar MP4 + Botão Gigante de Disparo */}
          <div className="dk-area-disparo">
            <label className="dk-check-exportar">
              <input
                type="checkbox"
                checked={exportarDireto}
                onChange={(e) => setExportarDireto(e.target.checked)}
              />
              <span>Já renderizar os arquivos MP4 finais automaticamente após criar</span>
            </label>

            <button
              type="button"
              className="dk-botao-gerar"
              disabled={processando || narracoes.length === 0}
              onClick={() => void dispararGeracao(exportarDireto)}
            >
              {processando
                ? '⏳ Produzindo vídeos…'
                : narracoes.length === 0
                  ? 'Adicione um áudio no Passo 1 para começar'
                  : `🚀 Criar ${narracoes.length} ${narracoes.length === 1 ? 'Vídeo Dark Agora' : 'Vídeos Dark Agora'}`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
