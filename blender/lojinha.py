"""
"A IA que tentou ter uma lojinha" em 3D — cena e tomadas no Blender.

    blender -b --factory-startup --python blender/lojinha.py -- <tomada|todas> [--teste]

--teste  renderiza só alguns quadros de cada tomada em meia resolução (conferir rápido)
sem ele renderiza a tomada inteira em PNG (1080x1920, 30 fps) para virar MP4 depois.

Tudo é montado por código a cada execução: cenário com formas simples (cara de
brinquedo), personagens e geladeira em GLB gerados na Magnific, textos 3D e
câmera com alvo. Os tempos das tomadas seguem a narração (ver TOMADAS).
"""
import bpy, sys, math, random, os
from mathutils import Vector

sys.path.append(os.path.dirname(__file__))
from base3d import *  # noqa: E402,F401

MODELOS = 'C:/Users/yaned/Videos/Melhores Fimes/3d/modelos'
SAIDA = 'C:/Users/yaned/Videos/Melhores Fimes/3d/lojinha'

# duração de cada tomada em segundos (tempos da narração)
TOMADAS = {
    'abertura': 4.56,     # 0.00–4.56  "Deram uma loja de verdade pra uma IA cuidar…"
    'missao': 6.36,       # 7.40–13.76 "geladeirinha, dinheiro no caixa, missão: dar lucro"
    'barato': 2.72,       # 13.76–16.48 "vendia mais barato do que pagava"
    'tungstenio': 7.84,   # 16.48–24.32 "cubo de tungstênio… encheu o estoque… prejuízo"
    'desconto': 2.52,     # 24.32–26.84 "Desconto? Era só pedir com jeitinho."
    'blazer': 8.32,       # 26.84–35.16 "blazer azul e gravata vermelha… não tem corpo"
    'prejuizo': 1.84,     # 35.16–37.00 "Resultado? Prejuízo."
}


def cenario():
    """Loja: piso, parede, balcão, geladeira, prateleira, caixa registradora, letreiro."""
    m_piso = material('piso', (0.72, 0.6, 0.48), rough=0.6)
    m_parede = material('parede', (0.16, 0.40, 0.46), rough=0.8)
    m_madeira = material('madeira', (0.62, 0.30, 0.12), rough=0.5)
    m_tampo = material('tampo', (0.95, 0.88, 0.78), rough=0.35)
    m_prat = material('prateleira', (0.95, 0.95, 0.97), rough=0.4)
    m_caixa = material('caixa', (0.8, 0.12, 0.12), rough=0.35)
    m_tela = material('tela', (0.05, 0.08, 0.1), emissao=(0.2, 0.9, 0.6), forca=1.5)
    m_gaveta = material('gaveta', (0.85, 0.85, 0.88), rough=0.3, metal=0.4)
    m_letreiro = material('letreiro', (1.0, 0.78, 0.1), emissao=(1.0, 0.7, 0.1), forca=1.2)
    m_placa = material('placa', (0.08, 0.1, 0.14), rough=0.5)

    plano('piso', (30, 30), (0, 0, 0), m_piso)
    plano('parede', (30, 10), (0, 2.25, 5), m_parede, rot=(math.pi / 2, 0, 0))

    caixa('balcao', (2.0, 0.7, 1.0), (0, 0.2, 0.5), m_madeira, bevel=0.04)
    caixa('tampo', (2.15, 0.82, 0.06), (0, 0.2, 1.03), m_tampo, bevel=0.02)

    gel = importar(f'{MODELOS}/geladeira.glb', 'geladeira', altura=1.9)
    gel.location = (-1.75, 1.15, 0)

    for z in (0.75, 1.35):
        caixa(f'prat{z}', (1.1, 0.5, 0.05), (1.75, 1.6, z), m_prat, bevel=0.01)
    for x in (1.22, 2.28):
        caixa(f'lado{x}', (0.05, 0.5, 1.6), (x, 1.6, 0.8), m_prat)

    # caixa registradora (a gaveta abre na última tomada)
    caixa('reg_base', (0.42, 0.36, 0.2), (0.62, 0.02, 1.16), m_caixa, bevel=0.03)
    caixa('reg_tela', (0.3, 0.05, 0.16), (0.62, 0.12, 1.36), m_tela, bevel=0.01, rot=(math.radians(-20), 0, 0))
    caixa('reg_gaveta', (0.38, 0.3, 0.07), (0.62, -0.05, 1.09), m_gaveta, bevel=0.01)

    caixa('placa', (2.1, 0.06, 1.25), (0, 2.2, 2.62), m_placa, bevel=0.03)
    texto('letreiro', 'LOJA\nDA IA', 0.48, (0, 2.15, 2.6), m_letreiro, extrude=0.04)


def robo(nome='robo', arquivo='robo.glb', loc=(0, 0.45, 1.15)):
    r = importar(f'{MODELOS}/{arquivo}', nome, altura=0.75)
    r.location = loc
    return r


def flutuar(obj, ini, fim, amp=0.035, periodo=36):
    """sobe e desce de leve, como quem paira no ar"""
    z0 = obj.location.z
    f, lado = ini, 1
    while f <= fim + periodo:
        chave(obj, 'location', f, (obj.location.x, obj.location.y, z0 + amp * lado), 'SINE')
        f += periodo // 2
        lado = -lado


def preparar(tomada):
    limpar()
    configurar_render(TOMADAS[tomada])
    iluminacao()
    cenario()
    return camera()


# ---------------------------------------------------------------- tomadas

def t_abertura():
    cam, alvo = preparar('abertura')
    r = robo()
    letras = bpy.data.objects['letreiro']
    # o letreiro "cai" no primeiro segundo: é o gancho visual
    chave(letras, 'scale', 1, (0.55, 0.55, 0.55), 'BACK')
    chave(letras, 'scale', 7, (1, 1, 1))
    chave(cam, 'location', 1, (0, -0.4, 2.62), 'BEZIER')
    chave(alvo, 'location', 1, (0, 2.15, 2.6), 'BEZIER')
    chave(cam, 'location', 40, (0, -0.6, 2.55), 'BEZIER')
    chave(alvo, 'location', 40, (0, 2.15, 2.5), 'BEZIER')
    chave(cam, 'location', 95, (0.25, -2.4, 1.75), 'BEZIER')
    chave(alvo, 'location', 95, (0, 0.45, 1.6), 'BEZIER')
    chave(cam, 'location', 140, (0.08, -1.75, 1.68))
    chave(alvo, 'location', 140, (0, 0.45, 1.58))
    # robô gira de alegria quando aparece
    chave(r, 'rotation_euler', 70, (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', 100, (0, 0, math.tau))
    flutuar(r, 1, 140)


def t_missao():
    cam, alvo = preparar('missao')
    r = robo()
    flutuar(r, 1, 191)
    # geladeira → caixa com moedas → robô com a missão
    chave(cam, 'location', 1, (-1.55, -0.85, 1.25), 'BEZIER')
    chave(alvo, 'location', 1, (-1.75, 1.0, 1.0), 'BEZIER')
    chave(cam, 'location', 55, (-1.45, -0.7, 1.3), 'BEZIER')
    chave(alvo, 'location', 55, (-1.7, 1.0, 1.05), 'BEZIER')
    chave(cam, 'location', 85, (0.75, -0.95, 1.55), 'BEZIER')
    chave(alvo, 'location', 85, (0.72, 0.05, 1.18), 'BEZIER')
    chave(cam, 'location', 115, (0.8, -0.85, 1.5), 'BEZIER')
    chave(alvo, 'location', 115, (0.75, 0.05, 1.18), 'BEZIER')
    chave(cam, 'location', 145, (0, -2.3, 1.85), 'BEZIER')
    chave(alvo, 'location', 145, (0, 0.4, 1.85), 'BEZIER')
    chave(cam, 'location', 191, (0, -2.1, 1.85))
    chave(alvo, 'location', 191, (0, 0.4, 1.85))
    ouro = material('ouro', (1.0, 0.72, 0.2), rough=0.25, metal=1.0)
    for i in range(9):
        m = moeda(f'moeda{i}', (0.98, -0.02, 1.07 + i * 0.018), ouro)
        aparecer(m, 78 + i * 3)
    # painel escuro próprio: o letreiro amarelo atrás não deixava ler
    t = etiqueta('missao', 'MISSÃO:\nDAR LUCRO', (0.05, 0.12, 0.08), (0.25, 1.0, 0.45), (0, -0.1, 2.2), largura=0.8, altura=0.42, tam=0.14)
    aparecer(t, 128)


def t_barato():
    cam, alvo = preparar('barato')
    r = robo()
    chave(cam, 'location', 1, (0.05, -2.55, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.4, 1.78), 'BEZIER')
    chave(cam, 'location', 82, (0, -2.3, 1.75))
    chave(alvo, 'location', 82, (0, 0.4, 1.78))
    eti_a = etiqueta('pagou', 'PAGOU\nR$ 5', (0.97, 0.97, 0.97), (0.08, 0.08, 0.1), (-0.42, -0.15, 1.55), largura=0.46, altura=0.34, tam=0.12)
    eti_b = etiqueta('vendeu', 'VENDEU\nR$ 2', (0.9, 0.15, 0.15), (1, 1, 1), (0.42, -0.15, 1.55), largura=0.46, altura=0.34, tam=0.12)
    aparecer(eti_a, 3)
    aparecer(eti_b, 22)
    # robô balança a cabeça, todo feliz com o "negócio"
    for i, f in enumerate(range(10, 82, 12)):
        chave(r, 'rotation_euler', f, (math.radians(8 if i % 2 else -6), 0, 0), 'SINE')
    flutuar(r, 1, 82)


def t_tungstenio():
    cam, alvo = preparar('tungstenio')
    r = robo()
    flutuar(r, 1, 235)
    metal = material('tungstenio', (0.72, 0.75, 0.8), rough=0.35, metal=0.55)
    vermelho = material('vermelho', (0.85, 0.03, 0.03), emissao=(1.0, 0.05, 0.05), forca=0.8)
    # o primeiro cubo cai no balcão
    c0 = cubo('cubo0', (0.3, -0.05, 1.06), 0.2, metal)
    cair(c0, 14, altura=2.2)
    chave(cam, 'location', 1, (0, -2.4, 1.65), 'BEZIER')
    chave(alvo, 'location', 1, (0.15, 0.25, 1.35), 'BEZIER')
    chave(cam, 'location', 40, (0.2, -1.9, 1.5), 'BEZIER')
    chave(alvo, 'location', 40, (0.25, 0.1, 1.2), 'BEZIER')
    chave(cam, 'location', 85, (0.4, -0.85, 1.25), 'BEZIER')
    chave(alvo, 'location', 85, (0.3, -0.05, 1.15), 'BEZIER')
    chave(cam, 'location', 130, (0.1, -4.4, 2.0), 'BEZIER')
    chave(alvo, 'location', 130, (0.5, 0.8, 1.05), 'BEZIER')
    chave(cam, 'location', 235, (0.1, -4.1, 1.95))
    chave(alvo, 'location', 235, (0.4, 0.6, 1.2))
    # "encheu o estoque disso": chuva de cubos no balcão, na prateleira e no chão
    random.seed(7)
    lugares = []
    for i in range(6):
        lugares.append((1.35 + i * 0.17, 1.6, 0.775 + 0.1))
        lugares.append((1.35 + i * 0.17, 1.6, 1.375 + 0.1))
    for i in range(7):
        lugares.append((-0.75 + i * 0.2, -0.05, 1.06))
    for i in range(14):
        lugares.append((0.9 + random.uniform(0, 1.6), random.uniform(-0.9, 0.9), 0.0))
    random.shuffle(lugares)
    for i, (x, y, z) in enumerate(lugares):
        c = cubo(f'cubo{i + 1}', (x, y, z), 0.15 + random.uniform(0, 0.06), metal, giro=random.uniform(-0.6, 0.6))
        cair(c, 135 + int(i * 55 / len(lugares)), altura=2.6)
    t = texto('preju', 'PREJUÍZO', 0.24, (0.15, -1.4, 1.55), vermelho, extrude=0.05)
    aparecer(t, 197)


def t_desconto():
    cam, alvo = preparar('desconto')
    r = robo()
    flutuar(r, 1, 76)
    chave(cam, 'location', 1, (0, -2.75, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.4, 1.62), 'BEZIER')
    chave(cam, 'location', 76, (0, -2.45, 1.7))
    chave(alvo, 'location', 76, (0, 0.4, 1.62))
    for i, (txt, loc) in enumerate((('-50%', (-0.5, 0.15, 2.05)), ('-70%', (0.5, 0.15, 1.85)), ('-90%', (-0.42, 0.1, 1.38)))):
        e = etiqueta(f'desc{i}', txt, (0.95, 0.15, 0.2), (1, 1, 1), loc, largura=0.48, altura=0.28, tam=0.15)
        aparecer(e, 4 + i * 9)
    # "com jeitinho": inclina a cabeça, fofo
    chave(r, 'rotation_euler', 28, (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', 40, (0, math.radians(14), 0), 'SINE')
    chave(r, 'rotation_euler', 66, (0, math.radians(14), 0), 'SINE')
    chave(r, 'rotation_euler', 76, (0, math.radians(4), 0))


def t_blazer():
    cam, alvo = preparar('blazer')
    escurecer(0.25)
    spot = holofote((0, 0.45, 4.2), alvo_z=1.2)
    r = robo('blazer', 'robo-blazer.glb', loc=(0, 0.45, 0.35))
    branco = material('branco', (1, 1, 1), emissao=(1, 1, 1), forca=2.0)
    # sobe de trás do balcão, se exibe, gira… e some: "ela não tem corpo"
    chave(r, 'location', 18, (0, 0.45, 0.35), 'BACK')
    chave(r, 'location', 58, (0, 0.45, 1.15))
    flutuar_de = 60
    chave(cam, 'location', 1, (0, -3.0, 1.6), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.45, 1.35), 'BEZIER')
    chave(cam, 'location', 120, (0, -1.75, 1.65), 'BEZIER')
    chave(alvo, 'location', 120, (0, 0.45, 1.55), 'BEZIER')
    chave(cam, 'location', 250, (0.05, -1.6, 1.65))
    chave(alvo, 'location', 250, (0, 0.45, 1.55))
    chave(r, 'rotation_euler', 125, (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', 168, (0, 0, math.tau))
    for f, oculto in ((192, True), (195, False), (199, True), (202, False), (206, True), (208, False), (212, True)):
        piscar(r, f, oculto)
    t = texto('interroga', '?', 0.6, (0, 0.45, 1.5), branco, extrude=0.06)
    aparecer(t, 226)
    del flutuar_de


def t_prejuizo():
    cam, alvo = preparar('prejuizo')
    r = robo()
    vermelho = material('vermelho', (0.85, 0.03, 0.03), emissao=(1.0, 0.05, 0.05), forca=0.8)
    gav = bpy.data.objects['reg_gaveta']
    chave(gav, 'location', 3, tuple(gav.location), 'BACK')
    chave(gav, 'location', 13, (gav.location.x, gav.location.y - 0.22, gav.location.z))
    chave(cam, 'location', 1, (0.32, -1.75, 1.65), 'BEZIER')
    chave(alvo, 'location', 1, (0.3, 0.1, 1.5), 'BEZIER')
    chave(cam, 'location', 56, (0.3, -1.5, 1.62))
    chave(alvo, 'location', 56, (0.3, 0.1, 1.5))
    seta = seta_baixo('seta', (0.62, -0.2, 1.62), vermelho)
    cair(seta, 14, altura=1.5)
    chave(r, 'rotation_euler', 8, (0, 0, 0), 'SINE')
    chave(r, 'rotation_euler', 24, (math.radians(22), 0, 0))


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    teste = '--teste' in args
    escolha = [a for a in args if not a.startswith('--')]
    nomes = list(TOMADAS) if not escolha or escolha[0] == 'todas' else escolha
    for nome in nomes:
        TOMADA_FN[nome]()
        renderizar(f'{SAIDA}/{nome}', teste)
