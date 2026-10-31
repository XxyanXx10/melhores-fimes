import { Img, interpolate, spring, staticFile } from 'remotion';
import type { CenaRemotion } from '../types';

/*
 * Cenas genéricas que servem para qualquer tema (IA, plano de saúde, finanças...).
 * Todas leem só os campos da cena e o frame relativo, igual às outras cenas.
 */

type P = { cena: CenaRemotion; frame: number; fps: number; escala: number; progresso: number };

const BRANCO = '#f5f7fb';
const CINZA = '#9aa3b2';

function Titulo({ cena, escala, cor }: { cena: CenaRemotion; escala: number; cor: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 34 * escala }}>
      <div style={{ fontSize: 62 * escala, fontWeight: 900, color: BRANCO, lineHeight: 1.08, letterSpacing: -1 * escala }}>
        {cena.titulo}
      </div>
      {cena.subtitulo && (
        <div style={{ fontSize: 34 * escala, fontWeight: 600, color: cor, marginTop: 14 * escala }}>{cena.subtitulo}</div>
      )}
    </div>
  );
}

/** Um número grande que conta até o valor (ex.: "11%", "R$ 2.400", "24h") */
export function CenaNumero({ cena, frame, fps, escala }: P) {
  const cor = cena.destaque || '#f5b301';
  const alvo = cena.valor ?? cena.itens[0] ?? '';
  const m = alvo.match(/^(\D*)([\d.,]+)(.*)$/);
  const p = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 1.2) });
  let texto = alvo;
  if (m) {
    const n = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
    const casas = (m[2].split(',')[1] ?? '').length;
    // "2027" escrito sem ponto (ano) continua sem ponto; "2.400" ganha o ponto de milhar
    const comMilhar = /\./.test(m[2]) || n >= 10000;
    const atual = (n * p).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: comMilhar });
    texto = `${m[1]}${atual}${m[3]}`;
  }
  const pulso = 1 + 0.04 * Math.sin(frame / 6) * p;
  return (
    <div style={{ textAlign: 'center' }}>
      <Titulo cena={cena} escala={escala} cor={cor} />
      <div style={{ fontSize: Math.min(210, 900 / (0.72 * Math.max(1, String(texto).length))) * escala, whiteSpace: 'nowrap', fontWeight: 900, color: cor, lineHeight: 1, transform: `scale(${pulso})`, textShadow: `0 0 ${40 * escala}px ${cor}66` }}>
        {texto}
      </div>
      {cena.itens.slice(cena.valor ? 0 : 1).map((it, i) => {
        const e = spring({ frame: frame - 20 - i * 8, fps, config: { damping: 18 } });
        return (
          <div key={i} style={{ fontSize: 36 * escala, color: CINZA, fontWeight: 600, marginTop: 18 * escala, opacity: e, transform: `translateY(${(1 - e) * 20 * escala}px)` }}>
            {it}
          </div>
        );
      })}
    </div>
  );
}

/** Barras que crescem; `valores` são as alturas (qualquer escala), `itens` os rótulos */
export function CenaGrafico({ cena, frame, fps, escala }: P) {
  const cor = cena.destaque || '#38bdf8';
  const vals = cena.valores?.length ? cena.valores : cena.itens.map((_, i) => i + 1);
  const max = Math.max(...vals, 1);
  const alturaMax = 430 * escala;
  return (
    <div>
      <Titulo cena={cena} escala={escala} cor={cor} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 34 * escala, height: alturaMax + 90 * escala }}>
        {vals.map((v, i) => {
          const e = spring({ frame: frame - 8 - i * 7, fps, config: { damping: 16 } });
          const ultima = i === vals.length - 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140 * escala }}>
              <div style={{ fontSize: 34 * escala, fontWeight: 800, color: ultima ? cor : BRANCO, opacity: e, marginBottom: 10 * escala }}>
                {cena.rotulosValor?.[i] ?? ''}
              </div>
              <div style={{ width: '100%', height: (v / max) * alturaMax * e, borderRadius: 18 * escala, background: ultima ? cor : 'rgba(255,255,255,.22)', boxShadow: ultima ? `0 0 ${30 * escala}px ${cor}88` : 'none' }} />
              <div style={{ fontSize: 28 * escala, color: CINZA, fontWeight: 600, marginTop: 14 * escala, textAlign: 'center' }}>{cena.itens[i] ?? ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ícones (emoji) com rótulo entrando um a um, em grade */
export function CenaIcones({ cena, frame, fps, escala }: P) {
  const cor = cena.destaque || '#22c55e';
  const n = cena.itens.length;
  const colunas = n <= 3 ? n : 2;
  return (
    <div>
      <Titulo cena={cena} escala={escala} cor={cor} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: 26 * escala }}>
        {cena.itens.map((it, i) => {
          const e = spring({ frame: frame - 8 - i * 9, fps, config: { damping: 12, stiffness: 140 } });
          return (
            <div key={i} style={{ background: 'rgba(255,255,255,.07)', border: `${3 * escala}px solid ${cor}88`, borderRadius: 30 * escala, padding: `${30 * escala}px ${18 * escala}px`, textAlign: 'center', opacity: Math.min(1, e), transform: `scale(${interpolate(e, [0, 1], [0.6, 1])})` }}>
              <div style={{ fontSize: 96 * escala, lineHeight: 1 }}>{cena.icones?.[i] ?? '✅'}</div>
              <div style={{ fontSize: 36 * escala, fontWeight: 800, color: BRANCO, marginTop: 16 * escala, lineHeight: 1.15 }}>{it}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Nomes (hospitais, ferramentas, marcas) aparecendo como "pins" em sequência */
export function CenaRede({ cena, frame, fps, escala }: P) {
  const cor = cena.destaque || '#ef4444';
  return (
    <div>
      <Titulo cena={cena} escala={escala} cor={cor} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 22 * escala }}>
        {cena.itens.map((it, i) => {
          const e = spring({ frame: frame - 8 - i * 7, fps, config: { damping: 11, stiffness: 150 } });
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 * escala, background: cor, color: '#fff', borderRadius: 999, padding: `${16 * escala}px ${30 * escala}px`, fontSize: 40 * escala, fontWeight: 800, opacity: Math.min(1, e), transform: `scale(${interpolate(e, [0, 1], [0.4, 1])})`, boxShadow: `0 ${8 * escala}px ${24 * escala}px ${cor}55` }}>
              <span>{cena.icones?.[i] ?? '📍'}</span>
              {it}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Um celular no meio da tela: conversa ou notificações chegando no ritmo da cena */
export function CenaCelular({ cena, frame, fps, escala, progresso }: P) {
  const cor = cena.destaque || '#22c55e';
  const e = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const flutua = Math.sin(frame / 18) * 8 * escala;
  const n = Math.max(1, cena.itens.length);
  // largo o bastante para a mensagem ser lida no celular de quem assiste
  const W = 720 * escala;
  // altura acompanha o número de mensagens: celular alto com 2 balões deixava a tela vazia em cima
  const H = Math.min(1000, 560 + n * 150) * escala;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {cena.titulo && (
        <div style={{ fontSize: 50 * escala, fontWeight: 900, color: BRANCO, textAlign: 'center', marginBottom: 26 * escala, opacity: e, textShadow: '0 4px 20px rgba(0,0,0,.8)' }}>
          {cena.titulo}
        </div>
      )}
      <div
        style={{
          width: W, height: H, borderRadius: 70 * escala, background: '#0b0d12', padding: 16 * escala,
          boxShadow: `0 ${30 * escala}px ${90 * escala}px rgba(0,0,0,.75), 0 0 0 ${4 * escala}px #2a2f3a`,
          transform: `translateY(${(1 - e) * 220 * escala + flutua}px) rotate(${(1 - e) * -6}deg)`,
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: 56 * escala, overflow: 'hidden', background: 'linear-gradient(180deg,#151a24,#0e1118)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 46 * escala, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 150 * escala, height: 30 * escala, borderRadius: 999, background: '#000' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 * escala, padding: `${14 * escala}px ${26 * escala}px`, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ width: 62 * escala, height: 62 * escala, borderRadius: '50%', background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 * escala }}>
              {cena.icones?.[0] ?? '🤖'}
            </div>
            <div>
              <div style={{ fontSize: 38 * escala, fontWeight: 800, color: BRANCO }}>{cena.app ?? 'Assistente'}</div>
              <div style={{ fontSize: 22 * escala, color: cor }}>online</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: `${24 * escala}px ${22 * escala}px`, display: 'flex', flexDirection: 'column', gap: 18 * escala, justifyContent: 'flex-end' }}>
            {cena.itens.map((msg, i) => {
              const ini = 0.08 + (i / n) * 0.75;
              if (progresso < ini) return null;
              const eu = (cena.autores?.[i] ?? (i === 0 ? 'eu' : 'app')) === 'eu';
              const digitando = !eu && progresso < ini + 0.06;
              const ent = Math.min(1, (progresso - ini) / 0.04);
              return (
                <div key={i} style={{ alignSelf: eu ? 'flex-end' : 'flex-start', maxWidth: '82%', opacity: ent, transform: `translateY(${(1 - ent) * 20 * escala}px)` }}>
                  <div style={{ background: eu ? cor : '#232a38', color: eu ? '#04130a' : BRANCO, borderRadius: 28 * escala, borderBottomRightRadius: eu ? 6 * escala : 28 * escala, borderBottomLeftRadius: eu ? 28 * escala : 6 * escala, padding: `${18 * escala}px ${26 * escala}px`, fontSize: 44 * escala, fontWeight: 600, lineHeight: 1.28 }}>
                    {digitando ? '• • •' : msg}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Frase de impacto: palavras grandes entrando uma a uma; as de `destaques` ganham cor */
/**
 * Frase de "edit" na tela preta: escreve letra por letra, dá um soco de zoom ao
 * terminar, pisca com brilho e segue num zoom lento até a cena sair.
 */
function CenaFraseEdit({ cena, frame, fps, escala }: P) {
  const cor = cena.destaque || '#F5D06F';
  const texto = cena.titulo.toUpperCase();
  const fonte = 'Impact, "Arial Black", sans-serif';
  const tam = Math.min(230, 1900 / Math.max(5, texto.length)) * escala;
  // soco: entra gigante e bate no tamanho certo; depois segue num zoom lento
  const soco = spring({ frame, fps, config: { damping: 8, stiffness: 260 } });
  const zoom = interpolate(soco, [0, 1], [2.4, 1]) + frame * 0.004;
  // pisca branco/dourado no ritmo (a cada 4 quadros nos primeiros 20)
  const fase = Math.floor(frame / 4) % 2 === 0;
  const corCentro = frame < 20 ? (fase ? '#ffffff' : cor) : cor;
  const flash = frame < 3 ? 1 - frame / 3 : 0;
  // ecos da frase enchem a tela, linha por linha, piscando
  const linhas = 9;
  return (
    <div style={{ position: 'relative', width: '100%', height: 1920 * escala, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
        {Array.from({ length: linhas }, (_, i) => {
          const aparece = frame >= 3 + Math.abs(i - (linhas - 1) / 2) * 2;
          const pisca = (Math.floor(frame / 3) + i) % 3 === 0 ? 0.55 : 0.22;
          const desliza = ((i % 2 ? 1 : -1) * frame * 3) % 200;
          return (
            <div key={i} style={{ fontFamily: fonte, fontSize: tam * 0.62, lineHeight: 1, whiteSpace: 'nowrap', color: 'transparent', WebkitTextStroke: `${2.5 * escala}px ${cor}`, opacity: aparece ? pisca : 0, transform: `translateX(${desliza * escala}px)` }}>
              {`${texto}  ${texto}  ${texto}`}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'relative', textAlign: 'center', transform: `scale(${zoom})`, fontFamily: fonte, fontSize: tam, lineHeight: 1, color: corCentro, letterSpacing: 2 * escala, textShadow: `0 0 ${40 * escala}px ${cor}cc, 0 ${8 * escala}px 0 #000`, padding: `0 ${30 * escala}px` }}>
        {texto}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash }} />
    </div>
  );
}

export function CenaFrase(props: P) {
  if (props.cena.animacao === 'edit') return <CenaFraseEdit {...props} />;
  const { cena, frame, fps, escala } = props;
  const cor = cena.destaque || '#f5b301';
  const palavras = cena.titulo.split(/\s+/).filter(Boolean);
  // "IA?" e "IA" valem igual: a pontuação sai dos dois lados
  const limpa = (x: string) => x.toLowerCase().replace(/[.,!?:;…]/g, '');
  const marcar = new Set((cena.destaques ?? []).map(limpa));
  return (
    <div style={{ textAlign: 'center', padding: `0 ${20 * escala}px` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${10 * escala}px ${26 * escala}px` }}>
        {palavras.map((w, i) => {
          const e = spring({ frame: frame - 4 - i * 5, fps, config: { damping: 10, stiffness: 160 } });
          const quente = marcar.has(limpa(w));
          // palavra comprida ("desligamento") encolhe para caber na largura (~0,72 em por letra em caixa alta)
          const cabe = 960 / (0.72 * Math.max(1, w.length));
          return (
            <span key={i} style={{ fontSize: Math.min(quente ? 150 : 110, cabe) * escala, fontWeight: 900, lineHeight: 1.02, color: quente ? cor : BRANCO, opacity: Math.min(1, e), transform: `scale(${interpolate(e, [0, 1], [1.8, 1])})`, display: 'inline-block', textTransform: 'uppercase', textShadow: quente ? `0 0 ${40 * escala}px ${cor}88` : '0 6px 24px rgba(0,0,0,.8)' }}>
              {w}
            </span>
          );
        })}
      </div>
      {cena.subtitulo && (
        <div style={{ fontSize: 40 * escala, color: CINZA, fontWeight: 700, marginTop: 30 * escala, opacity: spring({ frame: frame - 6 - palavras.length * 5, fps }) }}>
          {cena.subtitulo}
        </div>
      )}
    </div>
  );
}

/**
 * Logos das empresas (pasta public/midia/banco/logos). Em `icones` vai o nome do
 * arquivo ("openai", "googlegemini.svg", "midjourney.png"); em `itens`, o rótulo.
 */
export function CenaLogos({ cena, frame, fps, escala }: P) {
  const cor = cena.destaque || '#ffffff';
  const n = cena.icones?.length ?? 0;
  const lado = n <= 2 ? 300 : n <= 4 ? 240 : 190;
  return (
    <div>
      <Titulo cena={cena} escala={escala} cor={cor} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 28 * escala }}>
        {(cena.icones ?? []).map((nome, i) => {
          const e = spring({ frame: frame - 6 - i * 7, fps, config: { damping: 11, stiffness: 150 } });
          const arq = /\.(svg|png|jpe?g|webp)$/i.test(nome) ? nome : `${nome}.svg`;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, e), transform: `scale(${interpolate(e, [0, 1], [0.3, 1])}) rotate(${(1 - e) * -12}deg)` }}>
              <div style={{ width: lado * escala, height: lado * escala, borderRadius: 44 * escala, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 ${14 * escala}px ${40 * escala}px rgba(0,0,0,.55)` }}>
                <Img src={staticFile(`midia/banco/logos/${arq}`)} style={{ width: '62%', height: '62%', objectFit: 'contain' }} />
              </div>
              {cena.itens[i] && <div style={{ fontSize: 34 * escala, fontWeight: 800, color: BRANCO, marginTop: 14 * escala, textShadow: '0 4px 14px rgba(0,0,0,.8)' }}>{cena.itens[i]}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Fluxo entre ferramentas (ex.: ChatGPT → Claude → Gemini): cada etapa entra uma depois da
 * outra, a seta "desenha" de uma para a próxima, um ponto de luz percorre o caminho sem parar
 * e, no fim, uma seta de volta fecha o ciclo. `icones` = logos (em midia/banco/logos),
 * `itens` = "NOME|papel" de cada etapa, `subtitulo` = texto da seta de volta (opcional).
 */
export function CenaFluxo({ cena, frame, fps, escala }: P) {
  const cor = cena.destaque || '#a855f7';
  const n = Math.max(1, cena.itens.length);
  const passo = Math.round(fps * 1.1);
  const lado = 210 * escala;
  const vao = 150 * escala;
  const larguraTotal = n * lado + (n - 1) * vao;
  const xs = Array.from({ length: n }, (_, i) => i * (lado + vao));
  const fimSetas = 6 + (n - 1) * passo + passo;
  const ciclo = spring({ frame: frame - fimSetas, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.9) });
  // ponto de luz que anda pelo caminho inteiro (ida + volta) em loop
  const volta = (frame % Math.round(fps * 3.2)) / (fps * 3.2);
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 40 * escala }}>
        <div style={{ fontSize: 60 * escala, fontWeight: 900, color: BRANCO, letterSpacing: -1 * escala }}>{cena.titulo}</div>
      </div>
      <div style={{ position: 'relative', width: larguraTotal, height: lado + 230 * escala, margin: '0 auto' }}>
        {/* setas entre as etapas */}
        {xs.slice(0, -1).map((x, i) => {
          const p = interpolate(frame, [6 + i * passo + passo * 0.45, 6 + (i + 1) * passo], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={`s${i}`} style={{ position: 'absolute', left: x + lado + 14 * escala, top: lado / 2 - 4 * escala, width: (vao - 28 * escala) * p, height: 8 * escala, borderRadius: 8 * escala, background: `linear-gradient(90deg, ${cor}55, ${cor})`, boxShadow: `0 0 ${18 * escala}px ${cor}` }}>
              <div style={{ position: 'absolute', right: -6 * escala, top: -9 * escala, width: 0, height: 0, opacity: p > 0.95 ? 1 : 0, borderTop: `${13 * escala}px solid transparent`, borderBottom: `${13 * escala}px solid transparent`, borderLeft: `${20 * escala}px solid ${cor}` }} />
            </div>
          );
        })}
        {/* seta de volta (o ciclo), por baixo */}
        {n > 1 && (
          <svg width={larguraTotal} height={200 * escala} style={{ position: 'absolute', left: 0, top: lado + 20 * escala, overflow: 'visible', opacity: ciclo }}>
            <path
              d={`M ${xs[n - 1] + lado / 2} 0 C ${xs[n - 1] + lado / 2} ${150 * escala}, ${lado / 2} ${150 * escala}, ${lado / 2} 0`}
              fill="none" stroke={cor} strokeWidth={6 * escala} strokeDasharray={`${14 * escala} ${12 * escala}`}
              strokeDashoffset={-frame * 2 * escala} opacity={0.85}
            />
            {cena.subtitulo && (
              <text x={larguraTotal / 2} y={150 * escala} textAnchor="middle" fill={BRANCO} fontSize={30 * escala} fontWeight={800}>{cena.subtitulo}</text>
            )}
          </svg>
        )}
        {/* ponto de luz percorrendo a fila */}
        {frame > fimSetas && n > 1 && (
          <div style={{ position: 'absolute', top: lado / 2 - 11 * escala, left: lado / 2 + volta * (xs[n - 1]) - 11 * escala, width: 22 * escala, height: 22 * escala, borderRadius: '50%', background: '#fff', boxShadow: `0 0 ${24 * escala}px ${10 * escala}px ${cor}` }} />
        )}
        {/* as etapas */}
        {xs.map((x, i) => {
          const e = spring({ frame: frame - 6 - i * passo, fps, config: { damping: 11, stiffness: 150 } });
          const [nome, papel] = (cena.itens[i] ?? '').split('|');
          const icone = cena.icones?.[i];
          const arq = icone && (/\.(svg|png|jpe?g|webp)$/i.test(icone) ? icone : `${icone}.svg`);
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: 0, width: lado, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, e), transform: `scale(${interpolate(e, [0, 1], [0.4, 1])})` }}>
              <div style={{ width: lado, height: lado, borderRadius: 48 * escala, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 ${6 * escala}px ${cor}, 0 ${16 * escala}px ${44 * escala}px rgba(0,0,0,.6)` }}>
                {arq && <Img src={staticFile(`midia/banco/logos/${arq}`)} style={{ width: '60%', height: '60%', objectFit: 'contain' }} />}
              </div>
              <div style={{ fontSize: 38 * escala, fontWeight: 900, color: BRANCO, marginTop: 20 * escala, textShadow: '0 4px 14px rgba(0,0,0,.8)', whiteSpace: 'nowrap' }}>{nome}</div>
              {papel && <div style={{ fontSize: 28 * escala, fontWeight: 700, color: cor, marginTop: 6 * escala, whiteSpace: 'nowrap', textShadow: '0 4px 14px rgba(0,0,0,.8)' }}>{papel}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
