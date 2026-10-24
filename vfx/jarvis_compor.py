"""
Junta tudo do vídeo "assistente do Homem de Ferro": vídeo original, hologramas do
Blender (com brilho), recorte da pessoa por cima, luz dos hologramas na parede e
nele, brilho na ponta do dedo, ondas nos toques, indicador de voz e legenda.

    venv/Scripts/python.exe vfx/jarvis_compor.py <pasta_trabalho> <saida.mp4> <ffmpeg> [--teste 4.6,15,22.6]

<pasta_trabalho> tem plate.mp4, rastreio.json, mascaras/, holo/ e voz/falas.json.
Com --teste grava só aqueles segundos em <pasta>/comp_teste/*.png.
Sai sem áudio: a mixagem é feita depois (vfx/jarvis_audio.mjs).
"""
import json, math, os, subprocess, sys, wave
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PASTA, SAIDA, FFMPEG = sys.argv[1], sys.argv[2], sys.argv[3]
TESTE = [float(x) for x in sys.argv[sys.argv.index('--teste') + 1].split(',')] if '--teste' in sys.argv else None
FPS, W, H = 30, 1080, 1920
CORTE = round(5.5 * FPS)
N = round(34.5 * FPS)
TOQUES = [4.6, 10.0, 25.1]
JANELAS_DEDO = [(4.0, 5.4), (9.4, 10.8), (12.9, 18.9), (20.8, 22.4), (24.6, 25.9)]
GESTOS = (12.9, 18.9)
FONTE = 'C:/Windows/Fonts/bahnschrift.ttf'
CIANO = np.array([1.0, 0.85, 0.25], np.float32)   # BGR
rng = np.random.default_rng(7)


def rampa(t, a, b):
    return float(np.clip((t - a) / (b - a), 0, 1))


def env(t, a, b, c, d):
    """0 antes de a, sobe até b, fica em 1, desce de c até d"""
    return rampa(t, a, b) * (1 - rampa(t, c, d))


# ---------------------------------------------------------------- ponta do dedo
rast = json.load(open(os.path.join(PASTA, 'rastreio.json')))['quadros']


def ponta(q):
    ref = q.get('indicador_d') if q.get('indicador_d') and q['indicador_d'][2] > 0.4 else None
    if q.get('maos'):
        if ref:
            return min(q['maos'], key=lambda m: (m[0] - ref[0]) ** 2 + (m[1] - ref[1]) ** 2)
        return max(q['maos'], key=lambda m: m[0])  # mão mais perto da parede
    return ref[:2] if ref else None


pontas = []
ult, falta = None, 0
for q in rast:
    p = ponta(q)
    if p is None:
        falta += 1
        pontas.append(ult if falta <= 6 else None)
        continue
    falta = 0
    ult = p if ult is None else [ult[0] * 0.45 + p[0] * 0.55, ult[1] * 0.45 + p[1] * 0.55]
    pontas.append(ult)


def ponta_em(i):
    k = min(len(pontas) - 1, i + CORTE)
    return pontas[k]


# ---------------------------------------------------------------- voz (para o indicador e a legenda)
falas = json.load(open(os.path.join(PASTA, 'voz', 'falas.json')))['falas']
nivel = np.zeros(N + 10, np.float32)
for f in falas:
    with wave.open(f['arquivo']) as wv:
        sr, nc, sw = wv.getframerate(), wv.getnchannels(), wv.getsampwidth()
        a = np.frombuffer(wv.readframes(wv.getnframes()), np.int16 if sw == 2 else np.int32).astype(np.float32)
    a = a.reshape(-1, nc).mean(1) / (32768.0 if sw == 2 else 2 ** 31)
    por = sr // FPS
    for j in range(len(a) // por):
        k = round(f['em'] * FPS) + j
        if k < len(nivel):
            nivel[k] = max(nivel[k], float(np.sqrt(np.mean(a[j * por:(j + 1) * por] ** 2))))
nivel = np.clip(nivel / (nivel.max() or 1) * 1.4, 0, 1)

fonte_leg = ImageFont.truetype(FONTE, 46)
fonte_hud = ImageFont.truetype(FONTE, 26)
fonte_hud_p = ImageFont.truetype(FONTE, 20)


def quebrar(txt, fonte, larg):
    linhas, atual = [], ''
    for p in txt.split():
        prova = (atual + ' ' + p).strip()
        if fonte.getlength(prova) > larg and atual:
            linhas.append(atual)
            atual = p
        else:
            atual = prova
    return linhas + [atual]


def camada_texto(i, t):
    """HUD fixo + legenda da fala atual, desenhados com PIL (aceita acento). Devolve BGR float e alfa."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    on = env(t, 1.4, 2.0, 32.4, 33.2)
    if on > 0:
        a = int(235 * on)
        c = (120, 225, 255, a)
        # cantos da "lente"
        for (x, y, sx, sy) in ((40, 40, 1, 1), (W - 40, 40, -1, 1), (40, H - 40, 1, -1), (W - 40, H - 40, -1, -1)):
            d.line([(x, y), (x + 70 * sx, y)], fill=c, width=3)
            d.line([(x, y), (x, y + 70 * sy)], fill=c, width=3)
        d.text((70, 70), 'J.A.R.V.I.S.', font=fonte_hud, fill=c)
        pisca = (i // 15) % 2 == 0
        d.text((70, 104), ('●' if pisca else '○') + '  SISTEMAS ONLINE', font=fonte_hud_p, fill=c)
        d.text((W - 70, 70), f'{int(t // 60):02d}:{t % 60:05.2f}', font=fonte_hud_p, fill=c, anchor='ra')
        # indicador de voz: barras em círculo que pulsam quando ele fala
        cx, cy, r = 150, 250, 46
        v = float(nivel[min(i, len(nivel) - 1)])
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=2)
        d.ellipse([cx - 8 - 10 * v, cy - 8 - 10 * v, cx + 8 + 10 * v, cy + 8 + 10 * v], fill=(170, 240, 255, a))
        for k in range(28):
            ang = k / 28 * math.tau + i * 0.02
            ruido = 0.55 + 0.45 * math.sin(i * 0.9 + k * 1.7)
            comp = 6 + 34 * v * ruido
            x0, y0 = cx + math.cos(ang) * (r + 6), cy + math.sin(ang) * (r + 6)
            x1, y1 = cx + math.cos(ang) * (r + 6 + comp), cy + math.sin(ang) * (r + 6 + comp)
            d.line([(x0, y0), (x1, y1)], fill=c, width=3)
    # legenda da fala (vai aparecendo letra por letra)
    for f in falas:
        ini, fim = f['em'], f['em'] + f['duracao'] + 0.35
        if ini <= t <= fim:
            txt = f['texto'].upper()
            n = int(len(txt) * min(1, (t - ini) / max(0.4, f['duracao'] * 0.55)))
            sai = 1 - rampa(t, fim - 0.25, fim)
            linhas = quebrar(txt[:n], fonte_leg, W - 160)
            y = 1560
            for ln in linhas:
                d.text((W // 2, y), ln, font=fonte_leg, fill=(235, 250, 255, int(255 * sai)), anchor='ma',
                       stroke_width=3, stroke_fill=(10, 40, 60, int(220 * sai)))
                y += 58
    arr = np.asarray(img, np.float32) / 255.0
    return arr[..., [2, 1, 0]], arr[..., 3:4]


# ---------------------------------------------------------------- efeitos desenhados
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
vinheta = 1 - 0.38 * np.clip(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2, 0, 1)[..., None]


def ondas(i, t):
    """anéis que saem do ponto do toque, na parede (ficam atrás da pessoa)"""
    cam = np.zeros((H, W, 3), np.float32)
    for tq in TOQUES:
        dt = t - tq
        if not 0 <= dt <= 1.1:
            continue
        p = ponta_em(round(tq * FPS))
        if p is None:
            continue
        for k in range(3):
            d = dt - k * 0.12
            if d < 0:
                continue
            r = int(20 + d * 320)
            a = max(0, 1 - d / 0.9)
            cv2.circle(cam, (int(p[0]), int(p[1])), r, (a, a, a), max(1, int(5 * a)), cv2.LINE_AA)
        if dt < 0.25:
            cv2.circle(cam, (int(p[0]), int(p[1])), int(30 + dt * 120), (1, 1, 1), -1, cv2.LINE_AA)
    return cam * CIANO


rastro = []


def dedo(i, t):
    """brilho na ponta do indicador nas horas em que ele mexe no holograma, com rastro nos gestos"""
    cam = np.zeros((H, W, 3), np.float32)
    forca = max(env(t, a - 0.15, a + 0.15, b - 0.2, b) for a, b in JANELAS_DEDO)
    p = ponta_em(i)
    if p is not None and forca > 0:
        rastro.append((p, i))
    while rastro and i - rastro[0][1] > 10:
        rastro.pop(0)
    if p is None or forca <= 0:
        return cam
    if GESTOS[0] <= t <= GESTOS[1] and len(rastro) > 1:
        for k in range(1, len(rastro)):
            a = k / len(rastro)
            cv2.line(cam, tuple(map(int, rastro[k - 1][0])), tuple(map(int, rastro[k][0])), (a * 0.8,) * 3, int(2 + 8 * a), cv2.LINE_AA)
    cv2.circle(cam, (int(p[0]), int(p[1])), 9, (1, 1, 1), -1, cv2.LINE_AA)
    halo = cv2.GaussianBlur(cam, (0, 0), 14) * 3.0
    return np.clip((cam * 0.6 + halo) * forca, 0, 2) * np.array([1.0, 0.92, 0.6], np.float32)


def borrar(img, sigma, fator=4):
    p = cv2.resize(img, (W // fator, H // fator), interpolation=cv2.INTER_AREA)
    p = cv2.GaussianBlur(p, (0, 0), sigma / fator)
    return cv2.resize(p, (W, H), interpolation=cv2.INTER_LINEAR)


def tela(a, b):
    return 1 - (1 - np.clip(a, 0, 1)) * (1 - np.clip(b, 0, 1))


def glitch(h, i, t):
    perto = any(0 <= t - tq < 0.15 for tq in TOQUES) or (i % 67 in (0, 1) and 2 < t < 31)
    if not perto:
        return h
    g = h.copy()
    for _ in range(5):
        y0 = int(rng.integers(0, H - 80))
        alt = int(rng.integers(8, 60))
        g[y0:y0 + alt] = np.roll(g[y0:y0 + alt], int(rng.integers(-18, 18)), axis=1)
    g[..., 2] = np.roll(g[..., 2], 5, axis=1)
    g[..., 0] = np.roll(g[..., 0], -5, axis=1)
    return g


# ---------------------------------------------------------------- quadro a quadro
def compor(i, plate):
    t = i / FPS
    base = plate.astype(np.float32) / 255.0
    escurece = env(t, 1.3, 2.6, 31.8, 33.4)
    base = base * (1 - 0.24 * escurece) * np.array([1 + 0.07 * escurece, 1 + 0.02 * escurece, 1 - 0.1 * escurece], np.float32)
    caminho = os.path.join(PASTA, 'holo', f'h{i + 1:04d}.png')
    holo = cv2.imread(caminho, cv2.IMREAD_COLOR)
    holo = holo.astype(np.float32) / 255.0 if holo is not None else np.zeros_like(base)
    holo = glitch(holo, i, t) * (0.92 + 0.08 * float(rng.random()))
    holo[..., 2] = np.roll(holo[..., 2], 2, axis=1)
    holo[..., 0] = np.roll(holo[..., 0], -2, axis=1)
    holo = holo + ondas(i, t)
    brilho_p = borrar(holo, 12)
    brilho_g = borrar(holo, 48)
    luz = borrar(holo, 160, 8)                       # luz que o holograma joga na parede e nele
    camada = holo + 0.9 * brilho_p + 0.7 * brilho_g
    flash = sum(max(0.0, 1 - (t - tq) / 0.18) for tq in TOQUES if 0 <= t - tq < 0.18)
    fundo = tela(base + luz * 0.55 + flash * 0.08, camada)
    m = cv2.imread(os.path.join(PASTA, 'mascaras', f'{min(len(rast), i + CORTE + 1):05d}.png'), cv2.IMREAD_GRAYSCALE)
    m = (m.astype(np.float32) / 255.0)[..., None] if m is not None else np.zeros((H, W, 1), np.float32)
    pessoa = base + luz * 0.35 + flash * 0.05
    out = fundo * (1 - m) + pessoa * m
    out = tela(out, dedo(i, t))
    txt, alfa = camada_texto(i, t)
    brilho_txt = borrar(txt * alfa, 10) * 0.8
    out = tela(out, brilho_txt)
    out = out * (1 - alfa) + txt * alfa
    out = out * vinheta + rng.normal(0, 0.012, (H // 2, W // 2, 1)).repeat(2, 0).repeat(2, 1).astype(np.float32)
    out *= rampa(t, 0, 0.35) * (1 - rampa(t, 33.7, 34.5))
    return (np.clip(out, 0, 1) * 255).astype(np.uint8)


cap = cv2.VideoCapture(os.path.join(PASTA, 'plate.mp4'))
cap.set(cv2.CAP_PROP_POS_FRAMES, CORTE)
if TESTE:
    alvo = {round(s * FPS): s for s in TESTE}
    os.makedirs(os.path.join(PASTA, 'comp_teste'), exist_ok=True)
    for i in range(max(alvo) + 1):
        ok, fr = cap.read()
        if i in alvo:
            cv2.imwrite(os.path.join(PASTA, 'comp_teste', f't{alvo[i]:05.1f}.png'), compor(i, fr))
        elif i in {k - d for k in alvo for d in range(1, 11)}:
            compor(i, fr)  # aquece o rastro do dedo
    sys.exit(0)

enc = subprocess.Popen([FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS),
                        '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', SAIDA], stdin=subprocess.PIPE)
for i in range(N):
    ok, fr = cap.read()
    if not ok:
        break
    enc.stdin.write(compor(i, fr).tobytes())
    if i % 60 == 0:
        print('quadro', i, '/', N, flush=True)
enc.stdin.close()
enc.wait()
print('fim', SAIDA)
