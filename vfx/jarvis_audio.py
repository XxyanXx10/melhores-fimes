"""
Áudio do vídeo "assistente do Homem de Ferro": sons de interface sintetizados aqui
(nada baixado), falas do assistente nos tempos certos, música baixa que abaixa
quando ele fala e o som ambiente do vídeo original.

    venv/Scripts/python.exe vfx/jarvis_audio.py <pasta_trabalho> <musica.mp3> <ffmpeg> <saida.wav>
"""
import json, math, os, subprocess, sys, wave
import numpy as np

PASTA, MUSICA, FFMPEG, SAIDA = sys.argv[1:5]
SR = 48000
DUR = 34.5
CORTE = 5.5
rng = np.random.default_rng(3)
sfx = np.zeros((int(SR * (DUR + 1)), 2), np.float32)


def t_(seg):
    return np.arange(int(SR * seg)) / SR


def por(seg, som, vol=1.0, pan=0.0):
    i = int(seg * SR)
    s = som[: len(sfx) - i] * vol
    sfx[i:i + len(s), 0] += s * (1 - max(0, pan))
    sfx[i:i + len(s), 1] += s * (1 + min(0, pan))


def env(n, ataque=0.005, queda=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / ataque) * np.exp(-t / queda)


def varredura(f0, f1, seg, forma='sin'):
    t = t_(seg)
    f = f0 * (f1 / f0) ** (t / seg)
    fase = 2 * math.pi * np.cumsum(f) / SR
    return np.sin(fase) if forma == 'sin' else np.sign(np.sin(fase)) * 0.4


def passa_banda(x, f0, f1, q=4.0):
    """biquad com frequência deslizando de f0 a f1 (ruído vira 'whoosh')"""
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    n = len(x)
    for k in range(n):
        if k % 64 == 0:
            f = f0 * (f1 / f0) ** (k / n)
            w = 2 * math.pi * f / SR
            al = math.sin(w) / (2 * q)
            a0 = 1 + al
            b0, b2 = al / a0, -al / a0
            a1, a2 = -2 * math.cos(w) / a0, (1 - al) / a0
        v = b0 * x[k] + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x[k], y1, v
        y[k] = v
    return y / (np.abs(y).max() or 1)


def bip(f, seg=0.07, vol=1.0):
    t = t_(seg)
    return (np.sin(2 * math.pi * f * t) + 0.3 * np.sin(4 * math.pi * f * t)) * env(len(t), 0.002, seg / 3) * vol


def toque():
    t = t_(0.6)
    s = (np.sin(2 * math.pi * 1760 * t) * 0.6 + np.sin(2 * math.pi * 2640 * t) * 0.35 + np.sin(2 * math.pi * 3520 * t) * 0.15)
    s *= env(len(t), 0.002, 0.18)
    clique = rng.normal(0, 1, len(t)) * env(len(t), 0.0005, 0.006)
    sub = np.sin(2 * math.pi * 70 * t) * env(len(t), 0.003, 0.09)
    return s * 0.55 + clique * 0.25 + sub * 0.6


def whoosh(seg, f0, f1, q=2.5):
    r = passa_banda(rng.normal(0, 1, int(SR * seg)), f0, f1, q)
    t = t_(seg)
    return r * np.sin(np.pi * t / seg) ** 1.5


def boom(seg=1.6):
    t = t_(seg)
    f = 55 * np.exp(-t * 1.2) + 30
    return np.sin(2 * math.pi * np.cumsum(f) / SR) * env(len(t), 0.004, 0.55)


# --- ligar (1.5): grave + subida + bipes do HUD
por(1.35, boom(), 0.9)
por(1.4, varredura(180, 1400, 0.9) * np.sin(np.pi * t_(0.9) / 0.9) * (0.6 + 0.4 * np.sin(2 * math.pi * 18 * t_(0.9))), 0.35)
for k, f in enumerate((1600, 2000, 2400, 3000)):
    por(1.9 + k * 0.11, bip(f), 0.35, pan=0.4 - k * 0.25)
# zumbido de fundo enquanto o sistema está ligado
tz = t_(31.2)
hum = (np.sin(2 * math.pi * 55 * tz) + 0.5 * np.sin(2 * math.pi * 110 * tz) + 0.15 * np.sin(2 * math.pi * 330 * tz))
hum *= np.minimum(1, tz / 1.0) * np.minimum(1, (31.2 - tz) / 0.6) * (0.85 + 0.15 * np.sin(2 * math.pi * 0.4 * tz))
por(1.6, hum, 0.07)
# --- toques
for tq in (4.6, 10.0, 25.1):
    por(tq - 0.02, toque(), 0.8)
# globo abrindo: brilho subindo
por(4.62, whoosh(0.8, 600, 5000, 3), 0.25)
por(4.65, varredura(900, 2600, 0.5) * env(int(SR * 0.5), 0.05, 0.25), 0.18, pan=0.3)
# robô montando: varredura com tiques
por(10.1, whoosh(1.9, 300, 3500, 4), 0.28)
tt = t_(1.9)
tiques = np.zeros_like(tt)
for k in range(int(1.9 * 14)):
    i = int(k / 14 * SR)
    b = bip(2600 + k * 40, 0.025)
    tiques[i:i + len(b)] += b[: len(tiques) - i]
por(10.1, tiques, 0.2)
por(12.05, bip(1320, 0.18) + bip(1980, 0.18), 0.35)
# gestos: bipes de dados baixinhos
for k in range(18):
    por(13.0 + k * 0.32 + rng.random() * 0.1, bip(2000 + rng.integers(0, 1600), 0.04), 0.12, pan=float(rng.uniform(-0.5, 0.5)))
# puxar para cima: whoosh grande + grave + painéis estalando
por(20.85, whoosh(1.1, 150, 4000, 2), 0.6)
por(21.55, boom(1.4), 0.75)
for k in range(4):
    por(21.35 + k * 0.08, bip(2400 + k * 300, 0.05), 0.3, pan=(-0.4, 0.4)[k % 2])
# projeto salvo: arpejo de confirmação
for k, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
    por(25.3 + k * 0.09, bip(f, 0.22), 0.32)
# desligando: descida
por(30.9, varredura(1400, 70, 1.7) * env(int(SR * 1.7), 0.02, 0.8), 0.32)
por(31.0, whoosh(1.6, 4000, 200, 3), 0.25)
por(32.5, bip(660, 0.12), 0.25)

sfx = np.clip(sfx, -1, 1)
tmp = os.path.join(PASTA, 'audio')
os.makedirs(tmp, exist_ok=True)
arq_sfx = os.path.join(tmp, 'sfx.wav')
with wave.open(arq_sfx, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((sfx * 32767).astype(np.int16).tobytes())

falas = json.load(open(os.path.join(PASTA, 'voz', 'falas.json'), encoding='utf8'))['falas']
cmd = [FFMPEG, '-y', '-loglevel', 'error', '-ss', str(CORTE), '-t', str(DUR), '-i', os.path.join(PASTA, 'plate.mp4'),
       '-i', MUSICA, '-i', arq_sfx]
for f in falas:
    cmd += ['-i', f['arquivo']]
partes = ['[0:a]aresample=48000,volume=0.45[amb]',
          '[1:a]aresample=48000,atrim=0:%s,volume=0.11,afade=t=in:d=1.5,afade=t=out:st=%s:d=2[mus]' % (DUR, DUR - 2.2)]
vozes = []
for k, f in enumerate(falas):
    ms = int(f['em'] * 1000)
    partes.append(f'[{3 + k}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.5,adelay={ms}|{ms}[v{k}]')
    vozes.append(f'[v{k}]')
partes.append(''.join(vozes) + f'amix=inputs={len(vozes)}:normalize=0,apad=whole_dur={DUR}[voz]')
partes.append('[voz]asplit[voz1][voz2]')
partes.append('[mus][voz2]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[musd]')
partes.append('[amb][musd][2:a][voz1]amix=inputs=4:normalize=0:duration=longest,atrim=0:%s[out]' % DUR)
cmd += ['-filter_complex', ';'.join(partes), '-map', '[out]', '-ar', '48000', '-ac', '2', SAIDA]
subprocess.run(cmd, check=True)
print('ok', SAIDA)
