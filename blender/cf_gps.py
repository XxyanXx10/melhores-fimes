"""
Série "Como funciona" — "Como o celular sabe onde você está?" (GPS).

    blender -b --factory-startup --python blender/cf_gps.py -- <tomada|todas> [--teste]
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from como_funciona import *  # noqa: E402,F401,F403

TOMADAS = {
    'abertura': 2.28,   # "Como o seu celular sabe onde você está?"
    'terra': 5.32,      # "Lá em cima, a uns vinte mil quilômetros, tem mais de trinta satélites…"
    'gritam': 5.68,     # "Cada um fica gritando… que horas são, e onde ele está."
    'atraso': 6.74,     # "O seu celular escuta… o sinal demora… esse atraso entrega a distância."
    'circulos': 8.78,   # "Com um satélite… com dois… com três, sobra um ponto só: você."
    'relogio': 7.32,    # "Por isso o relógio… um milionésimo de segundo… trezentos metros."
    'fim': 7.33,        # "o satélite nem sabe que você existe. Quem faz a conta é o seu celular. Comenta aí."
}
CEU = (0.55, 0.78, 0.98)
GRAMA = (0.5, 0.78, 0.42)


def tela_mapa(pai, larg=0.57, alt=1.03):
    """tela do celular com cara de mapa: fundo verde-claro, ruas brancas, um rio azul"""
    verde = material('mapa', (0.5, 0.82, 0.45), emissao=(0.5, 0.82, 0.45), forca=0.3)
    rua = material('rua', (1, 1, 1), emissao=(1, 1, 1), forca=0.4)
    rio = material('rio', (0.45, 0.7, 0.98), emissao=(0.45, 0.7, 0.98), forca=0.4)
    objs = [caixa('mapa_f', (larg, 0.01, alt), (0, -0.04, 0), verde)]
    for i, (x, z, w, h) in enumerate(((0, 0.2, larg, 0.04), (0, -0.25, larg, 0.03), (-0.12, 0, 0.035, alt), (0.16, 0, 0.03, alt))):
        objs.append(caixa(f'rua{i}', (w, 0.01, h), (x, -0.045, z), rua))
    r = caixa('rio', (0.06, 0.01, alt * 1.05), (0.02, -0.046, 0), rio)
    r.rotation_euler = (0, math.radians(25), 0)
    objs.append(r)
    for o in objs:
        o.parent = pai


def t_abertura():
    cam, alvo = preparar(TOMADAS['abertura'])
    a = apresentador('ian', (0.38, -0.5, 0), altura=1.15, giro=math.radians(-25))
    gesto(a, 'apontar_e', 4, s2q(2.2))
    balancar(a, 1, s2q(2.28))
    cel = celular((-0.38, 0.35, 1.05), escala=1.1)
    tela_mapa(cel)
    p = pino('voce', (-0.38, 0.25, 0.95), escala=0.9)
    cair(p, s2q(0.9), altura=1.0, dur=8)
    titulo('t', 'ONDE VOCÊ ESTÁ?', (0, PAREDE - 0.1, 2.35), cor_fundo=(0.92, 0.2, 0.2), largura=1.5, altura=0.32, tam=0.15)
    cam_suave(cam, alvo, [(1, (0, -2.4, 1.35), (0, 0.4, 1.35)), (s2q(2.28), (0, -2.7, 1.3), (0, 0.4, 1.3))])


def t_terra():
    cam, alvo = preparar(TOMADAS['terra'], sem_cenario=True)
    espaco()
    fim = s2q(TOMADAS['terra'])
    terra = esfera('terra', 1.0, (0, 0, 0), material('oceano', (0.15, 0.42, 0.9), rough=0.4))
    terra.rotation_mode = 'XYZ'
    random.seed(4)
    verde = material('continente', (0.3, 0.72, 0.35), rough=0.7)
    for i in range(22):
        th, ph = random.uniform(0, 2 * math.pi), random.uniform(-1.2, 1.2)
        pos = (math.cos(ph) * math.cos(th) * 0.93, math.cos(ph) * math.sin(th) * 0.93, math.sin(ph) * 0.93)
        c = esfera(f'cont{i}', random.uniform(0.18, 0.34), pos, verde, achatar=0.35)
        c.rotation_mode = 'QUATERNION'
        from mathutils import Vector
        c.rotation_quaternion = Vector(pos).to_track_quat('Z', 'Y')
        c.parent = terra
    chave(terra, 'rotation_euler', 1, (0, 0, 0), 'LINEAR')
    chave(terra, 'rotation_euler', fim, (0, 0, math.radians(70)), 'LINEAR')
    for i in range(7):
        piv = vazio(f'orb{i}')
        piv.rotation_mode = 'XYZ'
        inc = math.radians(-60 + i * 20)
        s = satelite(f'sat{i}', (1.45 + (i % 3) * 0.12, 0, 0), escala=0.5)
        s.parent = piv
        g0 = i * 52
        chave(piv, 'rotation_euler', 1, (inc, 0, math.radians(g0)), 'LINEAR')
        chave(piv, 'rotation_euler', fim, (inc, 0, math.radians(g0 + 75)), 'LINEAR')
        aparecer(s, 2 + i * 4, dur=8)
    e1 = etiqueta('km', '20.000 KM', (0.98, 0.72, 0.2), (0.1, 0.1, 0.12), (0, -1.5, 1.0), largura=1.0, altura=0.26, tam=0.15)
    aparecer(e1, s2q(1.4))
    e2 = etiqueta('n', '+30 SATÉLITES', (0.92, 0.2, 0.2), (1, 1, 1), (0, -1.5, -1.0), largura=1.3, altura=0.26, tam=0.15)
    aparecer(e2, s2q(3.0))
    cam_suave(cam, alvo, [(1, (0, -4.1, 0.25), (0, 0, 0)), (fim, (0.15, -3.7, 0.15), (0, 0, 0))])


def t_gritam():
    cam, alvo = preparar(TOMADAS['gritam'], parede=CEU, piso=GRAMA)
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-15))
    balancar(a, 1, s2q(5.68))
    pose(a, 'pensando', 1)
    pose(a, 'apontar_e', s2q(3.4), 'BACK')
    pose(a, 'apontar_e', s2q(5.4))
    for i, (x, z) in enumerate(((-0.7, 2.45), (0.0, 2.7), (0.7, 2.45))):
        s = satelite(f'sat{i}', (x, PRAT, z), escala=0.42)
        flutuar(s, 1, s2q(5.68), amp=0.04, periodo=40 + i * 6)
        for k in range(4):
            onda(f'on{i}_{k}', (x, PRAT, z - 0.15), s2q(0.3) + k * 30 + i * 7, raio_final=0.9, dur=28)
        h = balao(f'hora{i}', '12:00:00', (x, PRAT - 0.25, z - 0.55), meu=False, largura=0.6, tam=0.11)
        aqui = balao(f'aqui{i}', 'ESTOU\nAQUI!', (x, PRAT - 0.25, z - 0.58), meu=True, largura=0.5, tam=0.1)
        trocar([(h, s2q(0.5) + i * 5), (aqui, s2q(3.6) + i * 5)])
    cam_suave(cam, alvo, [(1, (0, -2.75, 1.4), (0, 0.4, 1.5)), (s2q(5.68), (-0.05, -2.55, 1.4), (0, 0.4, 1.55))])


def t_atraso():
    cam, alvo = preparar(TOMADAS['atraso'], parede=CEU, piso=GRAMA)
    fim = s2q(TOMADAS['atraso'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', s2q(2.2), fim)
    cel = celular((-0.45, PRAT, 0.7), escala=1.05)
    tela_mapa(cel)
    s = satelite('sat', (-0.3, PRAT, 2.55), escala=0.45)
    flutuar(s, 1, fim, amp=0.04)
    # o sinal: uma bolinha de luz que desce devagar do satélite até o celular
    m = material('sinal', (1.0, 0.85, 0.2), emissao=(1.0, 0.85, 0.2), forca=6)
    for k in range(3):
        b = esfera(f'sinal{k}', 0.09, (-0.32, PRAT - 0.05, 2.3), m)
        q0 = s2q(0.6) + k * 45
        chave(b, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
        chave(b, 'scale', q0, (1, 1, 1), 'CONSTANT')
        chave(b, 'location', q0, (-0.32, PRAT - 0.05, 2.3), 'LINEAR')
        chave(b, 'location', q0 + 40, (-0.45, PRAT - 0.05, 1.3), 'LINEAR')
        chave(b, 'scale', q0 + 40, (1, 1, 1), 'CONSTANT')
        chave(b, 'scale', q0 + 41, (0.001, 0.001, 0.001), 'CONSTANT')
        onda(f'chega{k}', (-0.45, PRAT - 0.06, 1.3), q0 + 40, raio_final=0.5, dur=14)
    r = relogio('cron', (0.5, PRAT, 2.05), raio=0.24, quadro_ini=s2q(2.2), quadro_fim=fim, voltas=4)
    aparecer(r, s2q(2.2))
    t = etiqueta('t', '0,07 s', (0.1, 0.1, 0.12), (1, 1, 1), (0.5, PRAT - 0.1, 1.67), largura=0.5, altura=0.2, tam=0.11)
    aparecer(t, s2q(2.6))
    titulo('d', 'ATRASO = DISTÂNCIA', (0, PRAT - 0.2, 2.75), cor_fundo=(0.92, 0.2, 0.2), largura=1.55, altura=0.3, tam=0.13, quadro=s2q(4.6))
    cam_suave(cam, alvo, [(1, (0, -2.75, 1.45), (0, 0.4, 1.55)), (fim, (-0.05, -2.5, 1.45), (0, 0.4, 1.55))])


def t_circulos():
    cam, alvo = preparar(TOMADAS['circulos'], parede=CEU, piso=GRAMA)
    fim = s2q(TOMADAS['circulos'])
    a = apresentador('ian', (0, 0, 0), altura=1.0, giro=0)
    balancar(a, 1, fim)
    pose(a, 'pensando', 1)
    pose(a, 'comemorar', s2q(7.9), 'BACK')
    pulinho(a, s2q(7.9), 0.1)
    centros = [((-1.0, 1.0), (0.98, 0.72, 0.2), 0.3), ((1.15, 1.25), (0.95, 0.35, 0.6), 3.0), ((-0.25, -1.05), (0.2, 0.8, 0.95), 5.2)]
    for i, ((cx, cy), cor, t) in enumerate(centros):
        raio = math.hypot(cx, cy)
        r = anel(f'circ{i}', raio, 0.035, (cx, cy, 0.03), material(f'cm{i}', cor, emissao=cor, forca=1.5))
        aparecer(r, s2q(t), dur=18)
        s = satelite(f'sat{i}', (cx, cy, 0.55), escala=0.35)
        aparecer(s, s2q(t) - 4)
        flutuar(s, s2q(t), fim, amp=0.04)
    p = pino('voce', (0, 0, 1.15), escala=1.1)
    cair(p, s2q(7.6), altura=1.6, dur=8)
    e = etiqueta('vc', 'VOCÊ', (0.92, 0.2, 0.2), (1, 1, 1), (0, -0.1, 1.85), largura=0.6, altura=0.24, tam=0.15)
    e.rotation_euler = (math.radians(-35), 0, 0)
    aparecer(e, s2q(7.9))
    cam_suave(cam, alvo, [(1, (0, -3.0, 4.6), (0, 0.15, 0.2)), (s2q(5.0), (0, -2.8, 4.3), (0, 0.15, 0.3)), (fim, (0, -2.3, 3.2), (0, 0.0, 0.7))])


def t_relogio():
    cam, alvo = preparar(TOMADAS['relogio'], parede=CEU, piso=GRAMA)
    fim = s2q(TOMADAS['relogio'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-20))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(3.0))
    gesto(a, 'susto', s2q(5.4), fim - 2)
    relogio('rel', (0, PAREDE - 0.05, 2.15), raio=0.5, quadro_ini=1, quadro_fim=fim, voltas=10)
    e = etiqueta('mi', '0,000001 s', (0.1, 0.1, 0.12), (1, 1, 1), (0, PRAT, 1.45), largura=0.95, altura=0.24, tam=0.13)
    aparecer(e, s2q(3.0))
    p = pino('voce', (0.42, -0.55, 1.22), escala=0.8)
    aparecer(p, 6)
    chave(p, 'location', s2q(5.0), (0.42, -0.55, 1.22), 'BACK')
    chave(p, 'location', s2q(5.8), (-0.75, 0.6, 0.0))
    tremer(p, s2q(5.8), s2q(6.6), graus=15)
    t = titulo('m', '300 METROS!', (-0.35, PRAT - 0.3, 0.95), cor_fundo=(0.92, 0.2, 0.2), largura=1.0, altura=0.3, tam=0.15, quadro=s2q(5.9))
    t.rotation_euler = (0, math.radians(-6), 0)
    cam_padrao(cam, alvo, fim, chegar=0.3)


def t_fim():
    cam, alvo = preparar(TOMADAS['fim'], parede=CEU, piso=GRAMA)
    fim = s2q(TOMADAS['fim'])
    a = apresentador('ian', (0.0, -0.45, 0), altura=1.2, giro=0)
    balancar(a, 1, fim)
    gesto(a, 'pensando', 1, s2q(3.3))
    pose(a, 'comemorar', s2q(3.5), 'BACK')
    pulinho(a, s2q(3.5), 0.12)
    pose(a, 'comemorar', s2q(5.0))
    gesto(a, 'acenar', s2q(5.2), fim)
    s = satelite('sat', (-0.55, PRAT, 2.55), escala=0.45)
    flutuar(s, 1, fim)
    q = balao('quem', 'QUEM?', (-0.55, PRAT - 0.3, 2.05), meu=False, largura=0.45, tam=0.1)
    aparecer(q, s2q(1.2))
    cel = celular((0.55, -0.2, 1.45), escala=0.5)
    aparecer(cel, s2q(3.2))
    tela_mapa(cel)
    p = pino('voce', (0.55, -0.26, 1.35), escala=0.45)
    aparecer(p, s2q(3.6))
    titulo('c', 'O CELULAR\nFAZ A CONTA', (0, PAREDE - 0.1, 2.45), cor_fundo=(0.1, 0.65, 0.5), largura=1.3, altura=0.5, tam=0.14, quadro=s2q(3.5))
    confete((0, 0.0, 2.1), s2q(3.5), n=50)
    cam_suave(cam, alvo, [(1, (0, -2.5, 1.35), (0, 0.4, 1.4)), (fim, (0, -2.85, 1.4), (0, 0.4, 1.42))])


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('cf_gps', TOMADAS, TOMADA_FN)
