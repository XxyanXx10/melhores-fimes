import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';
import { LeftPanel } from './components/LeftPanel';
import { Preview } from './components/Preview';
import { CaptionPanel } from './components/CaptionPanel';
import { FotosPanel } from './components/FotosPanel';
import { DivisaoPanel } from './components/DivisaoPanel';
import { Timeline } from './components/Timeline';
import { StepBar } from './components/StepBar';
import { templates, defaultTemplateId } from './data/templates';
import { DURACAO_EXEMPLO, mockWords } from './data/mockTranscript';
import { caracteresPorLinha, importar } from './importar';
import { detectarCortes, transcreverArquivo, verificarServidor } from './transcrever';
import { baixar, lerArquivo, type Projeto } from './projeto';
import { agrupar, blocoAtivo, palavraAtiva, reescrever, ultimaIniciada } from './blocks';
import type {
  Block,
  CaptionStyle,
  Corte,
  Divisao,
  Foto,
  Movimento,
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
  const [divisoes, setDivisoes] = useState<Divisao[]>([]);
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [transicao, setTransicao] = useState<TipoTransicao>('off');
  const [forcaTransicao, setForcaTransicao] = useState(1);
  const [duracaoTransicao, setDuracaoTransicao] = useState(0.8);
  const [detectando, setDetectando] = useState(false);

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

  async function abrirProjeto(f: File) {
    try {
      const p = await lerArquivo(f);
      setWords(p.palavras);
      setTranscrito(true);
      if (!src) setDuracao(p.duracao);
      setTemplateId(templates.some((t) => t.id === p.template) ? p.template : defaultTemplateId);
      setOverride(p.estilo);
      setMovimento(p.movimento ?? 'off');
      setForcaZoom(p.forcaZoom ?? 1);
      setFotos(p.fotos ?? []);
      setDivisoes(p.divisoes ?? []);
      setCortes(p.cortes ?? []);
      setTransicao(p.transicao ?? 'off');
      setForcaTransicao(p.forcaTransicao ?? 1);
      setDuracaoTransicao(p.duracaoTransicao ?? 0.8);
      if (p.fps) setFps(p.fps);
      if (p.largura && p.altura) setTamanho({ largura: p.largura, altura: p.altura });
      setNomeArquivo((n) => n ?? p.nome ?? null);
      setErro(null);
      setPasso(4);
      irPara(0);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler esse arquivo de projeto.');
    }
  }

  function salvarProjeto() {
    const p: Projeto = {
      versao: 1,
      nome: nomeArquivo ?? undefined,
      duracao,
      template: templateId,
      estilo: override,
      fps,
      largura: tamanho.largura,
      altura: tamanho.altura,
      movimento,
      forcaZoom,
      fotos,
      divisoes,
      cortes,
      transicao,
      forcaTransicao,
      duracaoTransicao,
      palavras: words,
    };
    baixar(p, `${(nomeArquivo ?? 'projeto').replace(/\.[^.]+$/, '')}.json`);
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
        <StepBar passos={PASSOS} atual={passo} concluidos={concluidos} onSelect={setPasso} />
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
        <button type="button" className="chip chip-topo" disabled={!transcrito} onClick={salvarProjeto}>
          Salvar projeto
        </button>
        <button
          type="button"
          className="primario"
          disabled={!transcrito}
          onClick={() => setPasso(5)}
          title={transcrito ? 'Exportação entra na Etapa 4' : 'Gere a legenda primeiro'}
        >
          Exportar
        </button>
      </header>

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
          detectando={detectando}
          onCorte={(t, patch) =>
            setCortes((atuais) => atuais.map((c) => (c.t === t ? { ...c, ...patch } : c)))
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
          divisoes={divisoes}
          cortes={cortes}
          transicao={transicao}
          forcaTransicao={forcaTransicao}
          duracaoTransicao={duracaoTransicao}
          fps={fps}
          largura={tamanho.largura}
          altura={tamanho.altura}
          duracao={duracao}
          templateId={templateId}
          override={override}
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
