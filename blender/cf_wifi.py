"""
Série "Como funciona" — "Como o Wi-Fi atravessa a parede?" (onda de rádio, paredes, o que atrapalha).

    blender -b --factory-startup --python blender/cf_wifi.py -- <tomada|todas> [--teste]
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from como_funciona import *  # noqa: E402,F401,F403
from cf_whatsapp import roteador, peixe  # noqa: E402

TOMADAS = {
    'abertura': 4.84,    # "Como o Wi-Fi atravessa a parede? O Wi-Fi é luz. Sério."
    'invisivel': 4.36,   # "uma luz que o seu olho não enxerga, chamada onda de rádio."
    'parede': 7.72,      # "A luz normal bate na parede e para. Mas a onda do Wi-Fi… passa pelo meio dos tijolos."
    'forca': 6.84,       # "cada parede rouba um pouco de força… dois cômodos depois, fraquinho."
    'odeia': 6.01,       # "o Wi-Fi odeia: espelho, metal e água. Até um aquário atrapalha."
    'dica': 4.91,        # "o roteador funciona melhor no alto, no meio da casa, e longe da geladeira."
    'fim': 4.56,         # "por que o sinal some no banheiro. Você sabia disso? Comenta aí."
}
AZUL_WIFI = (0.2, 0.75, 1.0)
TIJOLO = (0.75, 0.33, 0.22)


def parede_tijolos(nome, centro, larg=0.9, alt=1.6, esp=0.18):
    r = vazio(nome, centro)
    m1 = material(nome + 'a', TIJOLO, rough=0.8)
    m2 = material(nome + 'b', (0.68, 0.28, 0.2), rough=0.8)
    linhas = int(alt / 0.12)
    for i in range(linhas):
        desloc = 0.1 if i % 2 else 0
        x = -larg / 2 + desloc
        j = 0
        while x < larg / 2 - 0.05:
            w = min(0.2, larg / 2 - x)
            caixa(f'{nome}_{i}_{j}', (w - 0.012, esp, 0.108), (x + w / 2, 0, 0.06 + i * 0.12), m1 if (i + j) % 3 else m2, bevel=0.006).parent = r
            x += w
            j += 1
    return r


def barras_sinal(nome, loc, n, quadro, escala=1.0):
    """o ícone de sinal: 4 barrinhas, n acesas"""
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    acesa = material(nome + 'a', (0.2, 0.85, 0.4), emissao=(0.2, 0.85, 0.4), forca=1.5)
    apagada = material(nome + 'p', (0.75, 0.75, 0.78), rough=0.5)
    for i in range(4):
        h = 0.06 + i * 0.05
        caixa(f'{nome}_{i}', (0.05, 0.03, h), (-0.09 + i * 0.065, 0, h / 2), acesa if i < n else apagada, bevel=0.008).parent = r
    aparecer(r, quadro)
    return r


def ondas_wifi(nome, origem, ini, fim, raio=1.4, cada=14, cor=AZUL_WIFI, rot=(math.pi / 2, 0, 0)):
    k = 0
    for q in range(ini, fim - 10, cada):
        onda(f'{nome}{k}', origem, q, raio_final=raio, dur=30, cor=cor, rot=rot)
        k += 1


def t_abertura():
    cam, alvo = preparar(TOMADAS['abertura'])
    fim = s2q(TOMADAS['abertura'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'apontar_e', 4, s2q(2.0))
    gesto(a, 'explicar', s2q(2.2), fim)
    caixa('mesa', (0.6, 0.45, 0.8), (-0.45, 0.45, 0.4), material('mesam', (0.75, 0.55, 0.35), rough=0.6))
    roteador('wifi', (-0.45, 0.45, 0.8))
    ondas_wifi('o', (-0.45, 0.3, 1.1), 2, fim, raio=1.1)
    titulo('t', 'COMO O WI-FI\nATRAVESSA A PAREDE?', (0, PAREDE - 0.1, 2.45), cor_fundo=(0.1, 0.45, 0.85), largura=1.6, altura=0.5, tam=0.13)
    carimbo('luz', 'WI-FI É LUZ!', (-0.35, -0.1, 1.6), s2q(2.3), cor=(0.98, 0.72, 0.2), largura=0.95, altura=0.26, tam=0.13)
    cam_padrao(cam, alvo, fim)


def t_invisivel():
    cam, alvo = preparar(TOMADAS['invisivel'])
    fim = s2q(TOMADAS['invisivel'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'apontar_e', s2q(0.5), fim)
    # régua de luzes: as que o olho vê (arco-íris) e, depois do vermelho, a onda de rádio
    cores = [(0.55, 0.2, 0.9), (0.2, 0.35, 1.0), (0.2, 0.75, 1.0), (0.2, 0.85, 0.35), (1.0, 0.9, 0.2), (1.0, 0.55, 0.15), (0.95, 0.15, 0.15)]
    for i, c in enumerate(cores):
        b = caixa(f'arco{i}', (0.14, 0.12, 0.3), (-0.78 + i * 0.14, PRAT, 2.1), material(f'am{i}', c, emissao=c, forca=1.2))
        aparecer(b, 3 + i * 2)
    radio = caixa('radio', (0.55, 0.12, 0.3), (0.55, PRAT, 2.1), material('rm', (0.35, 0.35, 0.4), rough=0.4))
    aparecer(radio, s2q(1.6))
    e1 = etiqueta('vê', 'O OLHO VÊ', (1, 1, 1), (0.1, 0.1, 0.12), (-0.36, PRAT - 0.1, 2.42), largura=0.7, altura=0.17, tam=0.08)
    aparecer(e1, s2q(0.6))
    e2 = etiqueta('nv', 'ONDA DE RÁDIO', AZUL_WIFI, (1, 1, 1), (0.55, PRAT - 0.1, 1.82), largura=0.75, altura=0.17, tam=0.075)
    aparecer(e2, s2q(2.6))
    carimbo('inv', 'INVISÍVEL', (0.55, PRAT - 0.2, 2.42), s2q(1.9), largura=0.75, altura=0.2, tam=0.1)
    ondas_wifi('o', (0.55, PRAT - 0.1, 2.1), s2q(2.0), fim, raio=0.6, cada=10)
    cam_padrao(cam, alvo, fim)


def t_parede():
    cam, alvo = preparar(TOMADAS['parede'])
    fim = s2q(TOMADAS['parede'])
    a = apresentador('ian', (0.55, -0.1, 0), altura=1.05, giro=math.radians(-35))
    balancar(a, 1, fim)
    pose(a, 'pensando', 1)
    pose(a, 'comemorar', s2q(4.8), 'BACK')
    pulinho(a, s2q(4.8), 0.08)
    pose(a, 'comemorar', fim)
    parede_tijolos('tij', (0.0, 0.35, 0), larg=0.5, alt=1.8)
    lanterna = cilindro('lant', 0.07, 0.3, (-0.8, 0.35, 1.25), material('lm', (0.15, 0.15, 0.18), rough=0.3), rot=(0, math.pi / 2, 0))
    luzm = material('luzbola', (1.0, 0.92, 0.5), emissao=(1.0, 0.92, 0.5), forca=8)
    for k in range(3):
        b = esfera(f'luz{k}', 0.06, (-0.6, 0.35, 1.25), luzm)
        q = s2q(0.3) + k * 12
        chave(b, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
        chave(b, 'scale', q, (1, 1, 1), 'CONSTANT')
        chave(b, 'location', q, (-0.6, 0.35, 1.25), 'LINEAR')
        chave(b, 'location', q + 10, (-0.3, 0.35, 1.25), 'LINEAR')
        chave(b, 'scale', q + 10, (1.6, 1.6, 1.6), 'LINEAR')
        chave(b, 'scale', q + 13, (0.001, 0.001, 0.001), 'CONSTANT')
    carimbo('para', 'PAROU!', (-0.55, 0.0, 1.65), s2q(1.6), largura=0.6, altura=0.2, tam=0.1)
    sumir(bpy.data.objects['para'], s2q(2.6))
    caixa('mesa', (0.4, 0.35, 0.7), (-0.75, 0.35, 0.35), material('mesam', (0.75, 0.55, 0.35), rough=0.6))
    roteador('wifi', (-0.75, 0.35, 0.7))
    # a onda grande atravessa: anéis que passam pelo tijolo e continuam do outro lado
    for k in range(6):
        onda(f'w{k}', (-0.75, 0.2, 1.0), s2q(2.6) + k * 10, raio_final=1.6, dur=34, cor=AZUL_WIFI)
    e = etiqueta('palmo', 'ONDA DE ~12 cm', AZUL_WIFI, (1, 1, 1), (-0.45, 0.0, 2.15), largura=0.85, altura=0.2, tam=0.09)
    aparecer(e, s2q(3.2))
    t = titulo('t', 'PASSA PELO TIJOLO', (0, 0.2, 2.5), cor_fundo=(0.15, 0.7, 0.35), largura=1.4, altura=0.3, tam=0.13, quadro=s2q(5.4))
    cam_suave(cam, alvo, [(1, (-0.1, -2.6, 1.4), (-0.1, 0.4, 1.3)), (fim, (0.0, -2.8, 1.45), (0.0, 0.4, 1.35))])


def t_forca():
    cam, alvo = preparar(TOMADAS['forca'])
    fim = s2q(TOMADAS['forca'])
    # planta da casa vista de cima: três cômodos em fila
    branco = material('pareded', (0.96, 0.96, 0.96), rough=0.6)
    for x in (-1.5, -0.5, 0.5, 1.5):
        caixa(f'pd{x}', (0.06, 1.6, 0.5), (x, 0.3, 0.25), branco)
    for y in (-0.5, 1.1):
        caixa(f'ph{y}', (3.06, 0.06, 0.5), (0, y, 0.25), branco)
    for i, c in enumerate(((0.95, 0.88, 0.75), (0.85, 0.92, 0.82), (0.82, 0.88, 0.97))):
        plano(f'chao{i}', (0.97, 1.57), (-1.0 + i, 0.3, 0.005), material(f'cm{i}', c, rough=0.8))
    roteador('wifi', (-1.0, 0.3, 0.02))
    for k in range(7):
        onda(f'w{k}', (-1.0, 0.3, 0.12), 4 + k * 12, raio_final=2.4, dur=40, cor=AZUL_WIFI, rot=(0, 0, 0))
    a = apresentador('ian', (1.0, 0.3, 0), altura=0.8, giro=0)
    balancar(a, 1, fim)
    pose(a, 'pensando', 1)
    for i, (n, q) in enumerate(((4, 0.6), (2, 2.0), (1, 3.4))):
        b = barras_sinal(f'sig{i}', (-1.0 + i, 0.3, 0.55), n, s2q(q), escala=1.8)
        b.rotation_euler = (math.radians(-65), 0, 0)
    t = titulo('t', 'CADA PAREDE\nROUBA FORÇA', (0, 1.2, 0.75), cor_fundo=(0.92, 0.2, 0.2), largura=1.3, altura=0.45, tam=0.12, quadro=s2q(0.4))
    t.rotation_euler = (math.radians(-65), 0, 0)
    e = etiqueta('fraco', 'FRAQUINHO...', (0.1, 0.1, 0.12), (1, 1, 1), (0.85, -0.62, 0.45), largura=0.7, altura=0.18, tam=0.08)
    e.rotation_euler = (math.radians(-65), 0, 0)
    aparecer(e, s2q(4.4))
    cam_suave(cam, alvo, [(1, (0, -1.15, 4.7), (0, 0.45, 0.1)), (fim, (0.1, -1.0, 4.3), (0.1, 0.45, 0.1))])


def t_odeia():
    cam, alvo = preparar(TOMADAS['odeia'])
    fim = s2q(TOMADAS['odeia'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, fim)
    titulo('t', 'O WI-FI ODEIA', (-0.2, PRAT, 2.5), cor_fundo=(0.1, 0.1, 0.12), largura=1.2, altura=0.3, tam=0.14)
    # espelho, metal, água (aquário)
    esp = caixa('espelho', (0.45, 0.05, 0.6), (-0.8, PRAT, 1.75), material('esp', (0.95, 0.95, 0.98), rough=0.02, metal=1.0), bevel=0.02)
    caixa('esp_m', (0.5, 0.04, 0.65), (-0.8, PRAT + 0.02, 1.75), material('espm', (0.7, 0.55, 0.3), rough=0.4), bevel=0.02)
    aparecer(esp, s2q(1.8))
    met = caixa('metal', (0.42, 0.42, 0.62), (-0.2, PRAT, 1.45), material('met', (0.75, 0.77, 0.8), rough=0.25, metal=1.0), bevel=0.03)
    aparecer(met, s2q(2.7))
    vidro = material('vidro', (0.7, 0.9, 1.0), rough=0.05)
    agua = material('agua', (0.2, 0.55, 0.95), emissao=(0.2, 0.55, 0.95), forca=0.4)
    aq = caixa('aquario', (0.6, 0.35, 0.42), (-0.55, PRAT - 0.15, 0.75), agua, bevel=0.02)
    aparecer(aq, s2q(4.3))
    f = peixe('peixe', (-0.55, PRAT - 0.34, 0.8), (1.0, 0.55, 0.15), escala=0.9)
    aparecer(f, s2q(4.4))
    caixa('mesa', (0.7, 0.4, 0.54), (-0.55, PRAT - 0.15, 0.27), material('mesam', (0.75, 0.55, 0.35), rough=0.6))
    for i, (txt, x, z, q) in enumerate((('ESPELHO', -0.8, 2.15, 1.9), ('METAL', -0.2, 1.88, 2.8), ('ÁGUA', -0.55, 1.08, 4.4))):
        e = etiqueta(f'e{i}', txt, (0.92, 0.2, 0.2), (1, 1, 1), (x, PRAT - 0.4, z), largura=0.5, altura=0.16, tam=0.08)
        aparecer(e, s2q(q))
    cam_padrao(cam, alvo, fim)


def t_dica():
    cam, alvo = preparar(TOMADAS['dica'])
    fim = s2q(TOMADAS['dica'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'apontar_e', s2q(0.3), fim)
    caixa('prat', (0.6, 0.3, 0.04), (-0.35, PRAT, 2.0), material('pratm', (0.98, 0.98, 0.98), rough=0.4), bevel=0.01)
    roteador('wifi', (-0.35, PRAT, 2.02))
    ondas_wifi('o', (-0.35, PRAT - 0.15, 2.3), 4, fim, raio=1.3, cada=12)
    gel = caixa('geladeira', (0.5, 0.45, 1.3), (0.95, PRAT + 0.2, 0.65), material('gel', (0.92, 0.93, 0.95), rough=0.25, metal=0.4), bevel=0.04)
    for i, (txt, q) in enumerate((('NO ALTO', 0.4), ('NO MEIO DA CASA', 1.6), ('LONGE DA GELADEIRA', 2.8))):
        e = etiqueta(f'd{i}', txt, (0.15, 0.7, 0.35), (1, 1, 1), (-0.35, PRAT - 0.3, 1.6 - i * 0.26), largura=1.15, altura=0.2, tam=0.085)
        aparecer(e, s2q(q))
    cam_padrao(cam, alvo, fim)


def t_fim():
    cam, alvo = preparar(TOMADAS['fim'], parede=(0.92, 0.95, 0.97), piso=(0.75, 0.82, 0.86))
    fim = s2q(TOMADAS['fim'])
    # azulejo do banheiro: grade de juntas na parede
    junta = material('junta', (0.75, 0.8, 0.85))
    for i in range(14):
        caixa(f'jh{i}', (4, 0.01, 0.01), (0, PAREDE - 0.01, 0.2 * (i + 1)), junta)
    for j in range(20):
        caixa(f'jv{j}', (0.01, 0.01, 3), (-2 + j * 0.2, PAREDE - 0.01, 1.5), junta)
    a = apresentador('ian', (0.0, -0.45, 0), altura=1.2, giro=0)
    balancar(a, 1, fim)
    gesto(a, 'susto', 1, s2q(2.0))
    gesto(a, 'acenar', s2q(2.4), fim)
    b = barras_sinal('sig', (0.0, PRAT, 2.1), 0, 3, escala=2.2)
    carimbo('sem', 'SEM SINAL', (0.0, PRAT - 0.4, 1.65), s2q(0.6), largura=0.85, altura=0.24, tam=0.12)
    cam_suave(cam, alvo, [(1, (0, -2.5, 1.45), (0, 0.4, 1.5)), (fim, (0, -2.85, 1.45), (0, 0.4, 1.5))])


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('cf_wifi', TOMADAS, TOMADA_FN)
