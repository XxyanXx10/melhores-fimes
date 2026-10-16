import { useEffect, useState } from 'react';
import { SERVIDOR } from '../transcrever';

type Roteiro = { titulo: string; gancho: string; desenvolvimento: string; cta: string };
type Ideia = {
  id: string;
  fonte: string;
  titulo: string;
  link: string;
  data: string;
  resumo: string;
  nota?: number;
  angulo?: string;
  status: 'nova' | 'aprovada' | 'descartada' | 'roteiro' | 'audio' | 'pendente-cenas' | 'feito';
  roteiro?: Roteiro;
  projeto?: string;
  /** final com chamada de produto (link na bio); padrão é conteúdo puro */
  comChamada?: boolean;
};
type Andamento = { etapa: 'parado' | 'rodando' | 'pronto' | 'erro'; nome?: string; detalhe?: string; erro?: string; atual?: number; total?: number };

const ROTULO: Record<Ideia['status'], string> = {
  nova: 'Nova',
  aprovada: '✅ Aprovada',
  descartada: 'Descartada',
  roteiro: '📝 Roteiro pronto',
  audio: '🎙️ Áudio pronto',
  'pendente-cenas': '🎬 Falta montar cenas',
  feito: '✔️ Feito',
};

async function post(rota: string, corpo: unknown) {
  const r = await fetch(`${SERVIDOR}${rota}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.erro ?? 'falhou');
  return j;
}

/**
 * Aba de ideias: notícias do dia → você aprova → roteiro (Gemini) → revisa →
 * voz do Yan + vídeo base. Depois o agente monta as cenas ("faz os pendentes").
 */
export function Ideias({ onFechar, onAbrirProjeto }: { onFechar: () => void; onAbrirProjeto: (arq: string) => void }) {
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [atualizado, setAtualizado] = useState<string | null>(null);
  const [andamento, setAndamento] = useState<Andamento>({ etapa: 'parado' });
  const [filtro, setFiltro] = useState<'todas' | 'aprovadas' | 'producao'>('todas');
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const r = await fetch(`${SERVIDOR}/ideias`).then((x) => x.json());
    setIdeias(r.ideias ?? []);
    setAtualizado(r.atualizado);
    setAndamento(r.andamento ?? { etapa: 'parado' });
  }
  useEffect(() => {
    void carregar();
  }, []);
  // enquanto algo roda, atualiza a cada 3 s
  useEffect(() => {
    if (andamento.etapa !== 'rodando') return;
    const t = setInterval(() => void carregar(), 3000);
    return () => clearInterval(t);
  }, [andamento.etapa]);

  const acao = (fn: () => Promise<unknown>) => () => {
    setErro(null);
    void fn()
      .then(carregar)
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  };

  const aprovadasSemRoteiro = ideias.filter((i) => i.status === 'aprovada').map((i) => i.id);
  const comRoteiro = ideias.filter((i) => i.status === 'roteiro').map((i) => i.id);
  const visiveis = ideias.filter((i) =>
    filtro === 'aprovadas'
      ? i.status === 'aprovada' || i.status === 'roteiro'
      : filtro === 'producao'
        ? ['audio', 'pendente-cenas', 'feito'].includes(i.status)
        : i.status !== 'descartada',
  );
  const rodando = andamento.etapa === 'rodando';

  return (
    <div className="ideias">
      <header className="ideias-topo">
        <div>
          <h1>💡 Ideias de Conteúdo</h1>
          <p>
            Notícias do dia com nota do Gemini. Aprove as que valem vídeo → gere os roteiros → revise → gere voz e vídeo base.
            {atualizado && ` Atualizado em ${new Date(atualizado).toLocaleString('pt-BR')}.`}
          </p>
        </div>
        <button type="button" className="chip" onClick={onFechar}>
          ← Voltar ao Canal Dark
        </button>
      </header>

      <div className="ideias-acoes">
        <button type="button" className="chip chip-topo" disabled={rodando} onClick={acao(() => post('/ideias/buscar', {}))}>
          🔄 Buscar novidades
        </button>
        <button type="button" className="chip chip-topo" disabled={rodando || !aprovadasSemRoteiro.length} onClick={acao(() => post('/ideias/roteiros', { ids: aprovadasSemRoteiro }))}>
          📝 Escrever roteiros ({aprovadasSemRoteiro.length})
        </button>
        <button type="button" className="chip chip-topo chip-dark" disabled={rodando || !comRoteiro.length} onClick={acao(() => post('/ideias/produzir', { ids: comRoteiro }))}>
          🎙️ Gerar voz + vídeo base ({comRoteiro.length})
        </button>
        <span className="ideias-filtro">
          {(['todas', 'aprovadas', 'producao'] as const).map((f) => (
            <button key={f} type="button" className={`chip ${filtro === f ? 'is-active' : ''}`} onClick={() => setFiltro(f)}>
              {f === 'todas' ? 'Todas' : f === 'aprovadas' ? 'Aprovadas / roteiro' : 'Em produção'}
            </button>
          ))}
        </span>
      </div>

      {andamento.etapa !== 'parado' && (
        <div className={`ideias-andamento is-${andamento.etapa}`}>
          {andamento.etapa === 'rodando' && '⏳ '}
          {andamento.etapa === 'erro' ? `Erro: ${andamento.erro}` : andamento.detalhe}
          {andamento.total ? ` (${andamento.atual}/${andamento.total})` : ''}
        </div>
      )}
      {erro && <div className="ideias-andamento is-erro">{erro}</div>}

      <ul className="ideias-lista">
        {visiveis.map((i) => (
          <li key={i.id} className={`ideia is-${i.status}`}>
            <div className="ideia-cab">
              <span className="ideia-nota">{i.nota ?? '–'}</span>
              <div className="ideia-texto">
                <a href={i.link} target="_blank" rel="noreferrer">
                  {i.titulo}
                </a>
                <small>
                  {i.fonte} · {new Date(i.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {ROTULO[i.status]}
                </small>
                {i.angulo && <em>Ângulo: {i.angulo}</em>}
              </div>
              <div className="ideia-botoes">
                {i.status === 'nova' && (
                  <>
                    <button type="button" className="chip" onClick={acao(() => post('/ideias/marcar', { ids: [i.id], status: 'aprovada' }))}>
                      ✅ Pode fazer
                    </button>
                    <button type="button" className="chip" onClick={acao(() => post('/ideias/marcar', { ids: [i.id], status: 'descartada' }))}>
                      ✕
                    </button>
                  </>
                )}
                {(i.status === 'nova' || i.status === 'aprovada' || i.status === 'roteiro') && (
                  <button
                    type="button"
                    className={`chip ${i.comChamada ? 'is-active' : ''}`}
                    title="Com chamada: o final oferece o material e manda pro link na bio. Sem chamada: só conteúdo."
                    onClick={acao(() => post('/ideias/chamada', { id: i.id, comChamada: !i.comChamada }))}
                  >
                    {i.comChamada ? '📣 Com chamada' : '🎯 Só conteúdo'}
                  </button>
                )}
                {i.status === 'aprovada' && (
                  <button type="button" className="chip" onClick={acao(() => post('/ideias/marcar', { ids: [i.id], status: 'nova' }))}>
                    Desfazer
                  </button>
                )}
                {i.projeto && (
                  <button type="button" className="chip" onClick={() => onAbrirProjeto(i.projeto!)}>
                    Abrir projeto
                  </button>
                )}
              </div>
            </div>
            {i.roteiro && i.status === 'roteiro' && <EditorRoteiro ideia={i} onSalvo={carregar} />}
            {i.roteiro && i.status !== 'roteiro' && (
              <p className="ideia-roteiro-lido">
                <b>{i.roteiro.titulo}</b> — {i.roteiro.gancho} {i.roteiro.desenvolvimento} {i.roteiro.cta}
              </p>
            )}
          </li>
        ))}
        {!visiveis.length && <li className="ideia">Nada aqui ainda. Clique em “Buscar novidades”.</li>}
      </ul>
    </div>
  );
}

function EditorRoteiro({ ideia, onSalvo }: { ideia: Ideia; onSalvo: () => void }) {
  const [r, setR] = useState<Roteiro>(ideia.roteiro!);
  const palavras = `${r.gancho} ${r.desenvolvimento} ${r.cta}`.split(/\s+/).filter(Boolean).length;
  const campo = (k: keyof Roteiro, rotulo: string, linhas = 2) => (
    <label>
      {rotulo}
      <textarea rows={linhas} value={r[k]} onChange={(e) => setR({ ...r, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="ideia-roteiro">
      {campo('titulo', 'Título do vídeo', 1)}
      {campo('gancho', 'Gancho')}
      {campo('desenvolvimento', 'Desenvolvimento', 4)}
      {campo('cta', ideia.comChamada ? 'Chamada (CTA)' : 'Fechamento')}
      <div className="ideia-roteiro-rodape">
        <small>
          {palavras} palavras ≈ {Math.round(palavras / 2.8)} s
        </small>
        <button type="button" className="chip" onClick={() => void post('/ideias/roteiro', { id: ideia.id, roteiro: r }).then(onSalvo)}>
          💾 Salvar roteiro
        </button>
        <button type="button" className="chip" onClick={() => void post('/ideias/marcar', { ids: [ideia.id], status: 'aprovada' }).then(onSalvo)}>
          ↺ Refazer roteiro
        </button>
      </div>
    </div>
  );
}
