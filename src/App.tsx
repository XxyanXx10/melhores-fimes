import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LeftPanel } from './components/LeftPanel';
import { Preview } from './components/Preview';
import { CaptionPanel } from './components/CaptionPanel';
import { Timeline } from './components/Timeline';
import { StepBar } from './components/StepBar';
import { templates, defaultTemplateId } from './data/templates';
import { DURACAO_EXEMPLO, mockScenes, mockWords } from './data/mockTranscript';
import { agrupar, blocoAtivo, palavraAtiva, reescrever } from './blocks';
import type { Block, CaptionStyle, Word } from './types';

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

  const videoRef = useRef<HTMLVideoElement>(null);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const style: CaptionStyle = useMemo(() => ({ ...template.style, ...override }), [template, override]);

  const blocos = useMemo(() => agrupar(words, style.wordsPerBlock), [words, style.wordsPerBlock]);
  const bloco = blocoAtivo(blocos, tempo);
  const ativa = palavraAtiva(bloco, tempo);
  const cena = mockScenes.find((c) => tempo >= c.start && tempo < c.end);

  /* relógio da prévia */
  useEffect(() => {
    if (!tocando) return;
    let raf = 0;
    let anterior = performance.now();
    const loop = (agora: number) => {
      const v = videoRef.current;
      if (v && src) {
        setTempo(v.currentTime);
        if (v.ended) setTocando(false);
      } else {
        const dt = (agora - anterior) / 1000;
        setTempo((t) => {
          const prox = t + dt;
          if (prox >= duracao) {
            setTocando(false);
            return 0;
          }
          return prox;
        });
      }
      anterior = agora;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tocando, duracao, src]);

  const irPara = useCallback((t: number) => {
    const alvo = Math.max(0, t);
    setTempo(alvo);
    if (videoRef.current) videoRef.current.currentTime = alvo;
  }, []);

  const alternar = useCallback(() => {
    setTocando((v) => {
      const prox = !v;
      const el = videoRef.current;
      if (el) prox ? void el.play() : el.pause();
      return prox;
    });
  }, []);

  function enviar(f: File) {
    const url = URL.createObjectURL(f);
    setSrc(url);
    setNomeArquivo(f.name);
    setTempo(0);
    setTocando(false);
    setPasso(1);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => setDuracao(probe.duration || DURACAO_EXEMPLO);
    probe.src = url;
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

  const concluidos = [
    !!src,
    transcrito,
    transcrito,
    Object.keys(override).length > 0,
    tempo > 0,
    false,
  ];

  return (
    <div className="app">
      <header className="topo">
        <h1>
          Melhores Fimes <span>· criador de vídeos padronizados</span>
        </h1>
        <StepBar passos={PASSOS} atual={passo} concluidos={concluidos} onSelect={setPasso} />
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
        />

        <Preview
          src={src}
          videoRef={videoRef}
          bloco={bloco}
          ativa={ativa}
          style={style}
          tempo={tempo}
          cena={cena}
          guias={guias}
          onGuias={setGuias}
        />

        <CaptionPanel
          blocos={blocos}
          cenas={mockScenes}
          tempo={tempo}
          onEditar={editar}
          onIr={irPara}
          transcrito={transcrito}
          onTranscrever={transcrever}
        />
      </div>

      <Timeline
        duracao={duracao}
        tempo={tempo}
        tocando={tocando}
        blocos={blocos}
        cenas={mockScenes}
        onIr={irPara}
        onTocar={alternar}
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
