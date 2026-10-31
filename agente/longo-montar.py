"""
Monta um vídeo longo (16:9) a partir de uma gravação de tela + narração por segmentos.

    <venv>/python.exe agente/longo-montar.py ideias/longos/<nome>.montagem.json [--so 0-3] [--previa]

A montagem diz, bloco a bloco (um bloco = um segmento narrado, ou uma "pausa" só com música),
quais trechos da gravação entram e quando: cada tomada começa numa palavra da narração ("em").
Cada tomada pode ter área (recorte), velocidade (timelapse), zoom lento, um selo no canto e um
texto de destaque. Por cima de tudo: cartão de etapa, legenda da narração, música que abaixa na
fala, efeitos sonoros e masterização.

--previa: só os 2 s iniciais de cada tomada em 960x540, para conferir os cortes bem rápido.
--so a-b: só refaz as tomadas dos blocos a até b (o resto fica do render anterior).
"""
import json, math, os, re, subprocess, sys, unicodedata
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CFG = json.load(open(os.path.join(RAIZ, 'server', 'config.json'), encoding='utf-8-sig'))
FF = CFG.get('ffmpeg', 'ffmpeg')
W, H, FPS = 1920, 1080, 30
F_TITULO = 'C:/Windows/Fonts/ariblk.ttf'
F_TEXTO = 'C:/Windows/Fonts/arialbd.ttf'
SFX = os.path.join(RAIZ, 'public', 'midia', 'sfx-meme')

arq = sys.argv[1]
M = json.load(open(arq, encoding='utf-8'))
VERTICAL = M.get('formato') == '9:16'
if VERTICAL:
    W, H = 1080, 1920
R = json.load(open(os.path.join(RAIZ, M['roteiro']), encoding='utf-8'))
SEG = {s['id']: s for s in R['segmentos']}
PREVIA = '--previa' in sys.argv
BASE = '--base' in sys.argv
SO = None
if '--so' in sys.argv:
    a, b = sys.argv[sys.argv.index('--so') + 1].split('-')
    SO = (int(a), int(b))
TRAB = M['trabalho']
os.makedirs(os.path.join(TRAB, 'tomadas'), exist_ok=True)


def norm(t):
    t = unicodedata.normalize('NFD', t.lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn' and (c.isalnum() or c == '?'))


def limpar_txt(t):
    return re.sub(r'[\u2190-\u2bff\U0001F000-\U0001FFFF\u2700-\u27bf]\s*', '', t).strip()


def ffmpeg(args):
    subprocess.run([FF, '-y', '-loglevel', 'error', *args], check=True)


# ------------------------------------------------------------------ linha do tempo
GAP = 0.35   # respiro depois de cada fala
blocos = []
t = 0.0
for i, b in enumerate(M['blocos']):
    if 'seg' in b:
        s = SEG[b['seg']]
        dur = s['duracao'] + GAP
        palavras = s.get('palavras', [])
    else:
        dur = b['pausa']
        palavras = []
    tomadas = []
    cursor = 0.0
    for tm in b['tomadas']:
        em = tm['em']
        if isinstance(em, str):
            alvo = norm(em)
            ini = next((w['start'] for w in palavras if w['start'] >= cursor - 0.05 and norm(w['text']).startswith(alvo)), None)
            if ini is None:
                print(f'  ! bloco {i}: não achei "{em}" depois de {cursor:.1f}s', file=sys.stderr)
                ini = cursor + 1.5
            ini = max(0.0, ini - 0.12)
        else:
            ini = float(em)
        tomadas.append({**tm, 'ini': ini})
        cursor = ini + 0.3
    for k, tm in enumerate(tomadas):
        tm['fim'] = tomadas[k + 1]['ini'] if k + 1 < len(tomadas) else dur
        tm['dur'] = round(tm['fim'] - tm['ini'], 3)
    blocos.append({**b, 'i': i, 't0': t, 'dur': dur, 'tomadas': tomadas, 'palavras': palavras})
    t += dur
TOTAL = t
print(f'duração total: {int(TOTAL // 60)}min {TOTAL % 60:.1f}s, {sum(len(b["tomadas"]) for b in blocos)} tomadas')


# ------------------------------------------------------------------ sobreposições (PIL)
def caixa_texto(d, txt, fonte, cx, y, fundo, cor, pad=(34, 18), raio=18):
    if d.textlength(txt, font=fonte) > W - 2 * pad[0] - 60 and ' ' in txt:
        pal = txt.split(' ')
        linhas, atual = [], ''
        for p_ in pal:
            prova = (atual + ' ' + p_).strip()
            if d.textlength(prova, font=fonte) > W - 2 * pad[0] - 60 and atual:
                linhas.append(atual)
                atual = p_
            else:
                atual = prova
        linhas.append(atual)
        for i_, ln in enumerate(linhas):
            caixa_texto(d, ln, fonte, cx, y + i_ * (fonte.size + 2 * pad[1] + 8), fundo, cor, pad, raio)
        return
    l, t_, r, b = d.textbbox((0, 0), txt, font=fonte)
    w, h = r - l, b - t_
    x0, y0 = cx - w / 2 - pad[0], y
    d.rounded_rectangle([x0, y0, x0 + w + 2 * pad[0], y0 + h + 2 * pad[1]], raio, fill=fundo)
    d.text((x0 + pad[0] - l, y0 + pad[1] - t_), txt, font=fonte, fill=cor)


def sobreposicao(caminho, tm, cartao=None):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if tm.get('selo'):
        f = ImageFont.truetype(F_TITULO, 34)
        txt = limpar_txt(tm['selo'])
        l, t_, r, b = d.textbbox((0, 0), txt, font=f)
        x1 = W - 50
        x0 = x1 - (r - l) - 56
        y_s = 150 if VERTICAL else 46
        d.rounded_rectangle([x0, y_s, x1, y_s + (b - t_) + 36], 14, fill=(220, 28, 40, 235))
        d.text((x0 + 28 - l, y_s + 18 - t_), txt, font=f, fill=(255, 255, 255, 255))
    if tm.get('lado'):
        f = ImageFont.truetype(F_TITULO, 44)
        if VERTICAL:
            for txt, y_, cor in ((tm.get('rotulo', 'ANTES'), H / 2 - 110, (255, 255, 255, 240)), (tm['lado'].get('rotulo', 'DEPOIS'), H / 2 + 30, (255, 214, 10, 245))):
                caixa_texto(d, limpar_txt(txt), f, W / 2, y_, cor, (15, 15, 20, 255))
        else:
            for txt, cx_, cor in ((tm.get('rotulo', 'ANTES'), W / 4, (255, 255, 255, 240)), (tm['lado'].get('rotulo', 'DEPOIS'), 3 * W / 4, (255, 214, 10, 245))):
                caixa_texto(d, limpar_txt(txt), f, cx_, H - 170, cor, (15, 15, 20, 255))
    if tm.get('texto'):
        f = ImageFont.truetype(F_TITULO, 58)
        caixa_texto(d, limpar_txt(tm['texto']), f, W / 2, 260 if VERTICAL else 130, (255, 214, 10, 245), (15, 15, 20, 255))
    if cartao:
        sombra = Image.new('RGBA', (W, H), (0, 0, 0, 170))
        img = Image.alpha_composite(sombra, img)
        d = ImageDraw.Draw(img)
        f1, f2 = ImageFont.truetype(F_TITULO, 150), ImageFont.truetype(F_TITULO, 64)
        for txt, f, y, cor in ((cartao[0], f1, 380, (255, 214, 10, 255)), (cartao[1], f2, 570, (255, 255, 255, 255))):
            l, t_, r, b = d.textbbox((0, 0), txt, font=f)
            d.text(((W - (r - l)) / 2 - l, y - t_), txt, font=f, fill=cor)
        d.rectangle([W / 2 - 160, 545, W / 2 + 160, 553], fill=(220, 28, 40, 255))
    img.save(caminho)


# ------------------------------------------------------------------ tomadas
def fonte(tm):
    return M['fontes'][tm['fonte']] if 'fonte' in tm else M['fonte']


def area(tm):
    a = tm.get('area', 'tela')
    return M['areas'][a] if isinstance(a, str) else a


def render_tomada(b, k, tm, saida):
    dur = min(tm['dur'], 2.0) if PREVIA else tm['dur']
    vel = float(tm.get('vel', 1))
    x, y, w, h = area(tm)
    cx, cy, cw, ch = M['cobrir']
    # o quadrado da webcam: só é coberto (delogo) nas cenas escuras do jogo; nas telas claras a área desvia dele
    nome_area = tm.get('area', 'tela') if isinstance(tm.get('area', 'tela'), str) else ''
    cobrir = f'delogo=x={cx}:y={cy}:w={cw}:h={ch},' if nome_area in M.get('cobrirSo', []) else ''
    z0, z1 = tm.get('zoom', [1.0, 1.0])
    n = max(1, round(dur * FPS))
    ow, oh = (W // 2, H // 2) if PREVIA else (W, H)
    cartao = b.get('cartao') if k == 0 else None
    ov = saida.replace('.mp4', '.png')
    sobreposicao(ov, tm, None)
    filtros = (
        f'[0:v]setpts=(PTS-STARTPTS)/{vel},fps={FPS},{cobrir}'
        f'crop={w}:{h}:{x}:{y},split[a][b];'
        f'[a]scale={ow}:{oh}:force_original_aspect_ratio=increase,crop={ow}:{oh},boxblur=24:2,eq=brightness=-0.22[fundo];'
        f'[b]scale={ow}:{oh}:force_original_aspect_ratio=decrease[frente];'
        f'[fundo][frente]overlay=(W-w)/2:(H-h)/2,'
        f"zoompan=z='{z0}+({z1}-{z0})*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={ow}x{oh}:fps={FPS}[v];"
        f'[1:v]scale={ow}:{oh},format=rgba,fade=in:st=0.12:d=0.25:alpha=1[o];[v][o]overlay=0:0:shortest=0'
    )
    if tm.get('congelar'):
        filtros = filtros.replace(f'[0:v]setpts=(PTS-STARTPTS)/{vel},fps={FPS},',
                                  f'[0:v]trim=end_frame=1,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={dur + 1},fps={FPS},')
    if tm.get('lado'):
        L = tm['lado']
        x2, y2, w2, h2 = L['area'] if not isinstance(L['area'], str) else M['areas'][L['area']]
        meia = ow // 2
        if VERTICAL:   # no vertical a divisão é em cima / embaixo
            meio_h = oh // 2
        cobrir2 = f'delogo=x={cx}:y={cy}:w={cw}:h={ch},'
        filtros = (
            f'[0:v]setpts=(PTS-STARTPTS)/{vel},fps={FPS},{cobrir}crop={w}:{h}:{x}:{y},'
            f'scale={meia}:{oh}:force_original_aspect_ratio=increase,crop={meia}:{oh}[e];'
            f'[2:v]setpts=PTS-STARTPTS,fps={FPS},{cobrir2}crop={w2}:{h2}:{x2}:{y2},'
            f'scale={meia}:{oh}:force_original_aspect_ratio=increase,crop={meia}:{oh}[d];'
            f'[e][d]hstack,drawbox=x={meia - 3}:y=0:w=6:h={oh}:color=white@0.9:t=fill[v];'
            f'[1:v]scale={ow}:{oh},format=rgba,fade=in:st=0.12:d=0.25:alpha=1[o];[v][o]overlay=0:0:shortest=0'
        ) if not VERTICAL else (
            f'[0:v]setpts=(PTS-STARTPTS)/{vel},fps={FPS},{cobrir}crop={w}:{h}:{x}:{y},'
            f'scale={ow}:{meio_h}:force_original_aspect_ratio=increase,crop={ow}:{meio_h}[e];'
            f'[2:v]setpts=PTS-STARTPTS,fps={FPS},{cobrir2}crop={w2}:{h2}:{x2}:{y2},'
            f'scale={ow}:{meio_h}:force_original_aspect_ratio=increase,crop={ow}:{meio_h}[d];'
            f'[e][d]vstack,drawbox=x=0:y={meio_h - 3}:w={ow}:h=6:color=white@0.9:t=fill[v];'
            f'[1:v]scale={ow}:{oh},format=rgba,fade=in:st=0.12:d=0.25:alpha=1[o];[v][o]overlay=0:0:shortest=0'
        )
    entradas = []
    if vel >= 20:
        entradas += ['-skip_frame', 'nokey']
    entradas += ['-ss', str(tm['src']), '-t', str(dur * vel + 1), '-i', fonte(tm), '-loop', '1', '-t', str(dur), '-i', ov]
    if tm.get('lado'):
        L = tm['lado']
        entradas += ['-ss', str(L['src']), '-t', str(dur + 1), '-i', M['fontes'][L['fonte']] if 'fonte' in L else M['fonte']]
    if cartao:
        cv = saida.replace('.mp4', '-cartao.png')
        sobreposicao(cv, {}, cartao)
        entradas += ['-loop', '1', '-t', str(min(2.4, dur)), '-i', cv]
        filtros += f'[c1];[2:v]scale={ow}:{oh},format=rgba,fade=out:st=1.9:d=0.5:alpha=1[c];[c1][c]overlay=0:0:eof_action=pass'
    filtros += '[saida]'
    ffmpeg([*entradas, '-filter_complex', filtros, '-map', '[saida]', '-t', str(dur), '-r', str(FPS),
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', saida])


lista = []
for b in blocos:
    for k, tm in enumerate(b['tomadas']):
        nome = os.path.join(TRAB, 'tomadas', f'b{b["i"]:02d}t{k:02d}.mp4')
        lista.append(nome)
        if SO and not (SO[0] <= b['i'] <= SO[1]) and os.path.exists(nome):
            continue
        print(f'  bloco {b["i"]:02d} tomada {k:02d}: {tm["src"]}s x{tm.get("vel", 1)} por {tm["dur"]:.1f}s', flush=True)
        render_tomada(b, k, tm, nome)

video = os.path.join(TRAB, 'video.mp4')
with open(os.path.join(TRAB, 'lista.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(f"file '{p.replace(os.sep, '/')}'" for p in lista))
ffmpeg(['-f', 'concat', '-safe', '0', '-i', os.path.join(TRAB, 'lista.txt'), '-c', 'copy', video])
if PREVIA:
    print('prévia:', video)
    sys.exit(0)


# ------------------------------------------------------------------ legenda (ASS)
def ts(s):
    return f'{int(s // 3600)}:{int(s % 3600 // 60):02d}:{s % 60:05.2f}'


linhas = []
for b in blocos:
    atual = []
    for w in b['palavras']:
        atual.append(w)
        txt = ' '.join(x['text'] for x in atual)
        if len(atual) >= 7 or len(txt) > 38 or re.search(r'[.!?…:]$', w['text']):
            linhas.append((b['t0'] + atual[0]['start'], b['t0'] + atual[-1]['end'] + 0.15, txt))
            atual = []
    if atual:
        linhas.append((b['t0'] + atual[0]['start'], b['t0'] + atual[-1]['end'] + 0.15, ' '.join(x['text'] for x in atual)))
for k in range(len(linhas) - 1):
    if linhas[k][1] > linhas[k + 1][0]:
        linhas[k] = (linhas[k][0], linhas[k + 1][0], linhas[k][2])
ass = os.path.join(TRAB, 'legenda.ass')
with open(ass, 'w', encoding='utf-8') as f:
    f.write('[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\n'
            'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
            'Style: Fala,Arial Black,54,&H00FFFFFF,&H00FFFFFF,&H50000000,&H50000000,0,0,0,0,100,100,0,0,3,12,0,2,120,120,64,1\n\n'
            '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n')
    for a, z, txt in linhas:
        f.write(f'Dialogue: 0,{ts(a)},{ts(z)},Fala,,0,0,0,,{txt.upper()}\n')

# ------------------------------------------------------------------ áudio
entradas, partes, rot = [], [], []
k = 0
for b in blocos:
    if 'seg' in b:
        entradas += ['-i', SEG[b['seg']]['audio']]
        ms = int(b['t0'] * 1000)
        partes.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.0,adelay={ms}|{ms}[n{k}]')
        rot.append(f'[n{k}]')
        k += 1
n_voz = k
partes.append(''.join(rot) + f'amix=inputs={n_voz}:normalize=0,apad=whole_dur={TOTAL}[voz]')
efeitos = []
for b in blocos:
    for e in b.get('sfx', []):
        efeitos.append((b['t0'] + e['em'], e['nome'], e.get('volume', 0.4), e.get('max', 3)))
    for tm in b['tomadas']:
        if tm.get('sfx'):
            efeitos.append((b['t0'] + tm['ini'] + 0.1, tm['sfx'], 0.35, 2.5))
rot = []
for b in blocos:
    for tm in b['tomadas']:
        if tm.get('som') and float(tm.get('vel', 1)) == 1 and not tm.get('congelar'):
            entradas += ['-ss', str(tm['src']), '-t', str(tm['dur']), '-i', fonte(tm)]
            ms = int((b['t0'] + tm['ini']) * 1000)
            partes.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo,volume={tm["som"]},afade=t=in:d=0.15,'
                          f'afade=t=out:st={max(0, tm["dur"] - 0.2)}:d=0.2,adelay={ms}|{ms}[e{k}]')
            rot.append(f'[e{k}]')
            k += 1
for t0, nome, vol, mx in efeitos:
    p = os.path.join(SFX, nome + '.mp3')
    if not os.path.exists(p):
        print('  ! sfx não encontrado:', nome, file=sys.stderr)
        continue
    entradas += ['-i', p]
    ms = int(t0 * 1000)
    partes.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{mx},afade=t=out:st={max(0, mx - 0.4)}:d=0.4,volume={vol},adelay={ms}|{ms}[e{k}]')
    rot.append(f'[e{k}]')
    k += 1
if BASE:
    partes.append(f'[voz]' + ''.join(rot) + f'amix=inputs={1 + len(rot)}:normalize=0:duration=first,atrim=0:{TOTAL}[out]')
else:
    entradas += ['-stream_loop', '-1', '-i', os.path.join(RAIZ, M['musica'])]
    partes.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{TOTAL},volume={M.get("volumeMusica", 0.08)},'
                  f'afade=t=in:d=2,afade=t=out:st={TOTAL - 3}:d=3[mus]')
    partes.append('[voz]asplit[voz1][voz2]')
    partes.append('[mus][voz2]sidechaincompress=threshold=0.03:ratio=5:attack=30:release=500[musd]')
    todos = '[voz1][musd]' + ''.join(rot)
    partes.append(f'{todos}amix=inputs={2 + len(rot)}:normalize=0:duration=first,atrim=0:{TOTAL}[out]')
mix = os.path.join(TRAB, 'mix.wav')
ffmpeg([*entradas, '-filter_complex', ';'.join(partes), '-map', '[out]', '-ar', '48000', '-ac', '2', mix])

# ------------------------------------------------------------------ final
if BASE:
    base = M['saidaBase']
    # reencoda com quadro constante: a colagem com "-c copy" deixava buracos de tempo que o Remotion não acha
    ffmpeg(['-i', video, '-i', mix, '-map', '0:v', '-map', '1:a', '-r', str(FPS), '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'fast',
            '-crf', '17', '-g', str(FPS), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', base])
    linha = [{'bloco': b['i'], 'seg': b.get('seg'), 't0': round(b['t0'], 3), 'dur': round(b['dur'], 3),
              'tomadas': [{k_: v for k_, v in tm.items() if k_ in ('ini', 'dur', 'src', 'fonte', 'texto', 'selo', 'personagem')} for tm in b['tomadas']],
              'palavras': [{**w, 'start': round(b['t0'] + w['start'], 3), 'end': round(b['t0'] + w['end'], 3)} for w in b['palavras']]}
             for b in blocos]
    json.dump({'duracao': round(TOTAL, 3), 'blocos': linha}, open(os.path.join(TRAB, 'linha.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('ok base', base)
    sys.exit(0)
saida = M['saida']
os.makedirs(os.path.dirname(saida), exist_ok=True)
ass_f = ass.replace('\\', '/').replace(':', '\\:')
ffmpeg(['-i', video, '-i', mix, '-vf', f"subtitles='{ass_f}'", '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', saida])
subprocess.run(['node', os.path.join(RAIZ, 'agente', 'masterizar.mjs'), saida], check=True)
print('ok', saida)
