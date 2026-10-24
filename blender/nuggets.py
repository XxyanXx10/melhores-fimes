"""
"A IA que pediu 260 nuggets" (o drive-thru com IA do McDonald's, encerrado em 2024) em 3D.

    blender -b --factory-startup --python blender/nuggets.py -- <tomada|todas> [--teste]

Reaproveita o robozinho (sem gastar crédito). Cenário: guichê de drive-thru genérico
(sem marca) com painel de pedido; caixinhas de nuggets empilhando; sorvete com bacon.
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from base3d import *  # noqa: E402,F401

MODELOS = 'C:/Users/yaned/Videos/Melhores Fimes/3d/modelos'
SAIDA = 'C:/Users/yaned/Videos/Melhores Fimes/3d/nuggets'

TOMADAS = {
    'abertura': 3.54,   # "Uma IA anotou um pedido de duzentos e sessenta nuggets!"
    'drive': 7.92,      # "Isso aconteceu de verdade… drive-thru… ela se confundia."
    'pedido': 9.76,     # "duas amigas pediam pra parar… Dez, cinquenta, cem… duzentos e sessenta!"
    'sorvete': 2.78,    # "Teve gente recebendo sorvete com bacon, também."
    'fim': 4.3,         # "Resultado? Em 2024, o McDonald's encerrou o teste."
}


def cenario():
    plano('piso', (30, 30), (0, 0, 0), material('piso', (0.35, 0.35, 0.38), rough=0.7))
    plano('parede', (30, 10), (0, 2.4, 5), material('parede', (0.85, 0.42, 0.12), rough=0.7), rot=(math.pi / 2, 0, 0))
    caixa('faixa', (30, 0.05, 0.5), (0, 2.35, 3.1), material('faixa', (0.95, 0.85, 0.2), rough=0.5))
    caixa('balcao', (2.2, 0.6, 1.0), (0, 0.4, 0.5), material('balcao', (0.18, 0.2, 0.26), rough=0.4), bevel=0.04)
    caixa('tampo', (2.3, 0.7, 0.05), (0, 0.4, 1.02), material('tampo', (0.85, 0.85, 0.88), rough=0.3), bevel=0.01)
    # painel do pedido, onde o número de nuggets sobe
    caixa('painel_borda', (1.3, 0.08, 0.95), (0.85, 2.3, 2.15), material('pborda', (0.1, 0.1, 0.12), rough=0.4), bevel=0.03)
    caixa('painel', (1.2, 0.04, 0.85), (0.85, 2.24, 2.15), material('painel', (0.03, 0.06, 0.1), emissao=(0.05, 0.12, 0.2), forca=0.6), bevel=0.02)
    texto('placa_drive', 'DRIVE-THRU', 0.22, (-0.75, 2.3, 3.1), material('placa', (0.15, 0.1, 0.05)), extrude=0.03)
    iluminacao()


def robo(loc=(0, 0.75, 1.05)):
    r = importar(f'{MODELOS}/robo.glb', 'robo', altura=0.75)
    r.location = loc
    return r


def flutuar(obj, ini, fim, amp=0.03, periodo=36):
    z0 = obj.location.z
    f, lado = ini, 1
    while f <= fim + periodo:
        chave(obj, 'location', f, (obj.location.x, obj.location.y, z0 + amp * lado), 'SINE')
        f += periodo // 2
        lado = -lado


def caixinha(nome, loc, mat, giro=0.0):
    o = caixa(nome, (0.16, 0.1, 0.12), (loc[0], loc[1], loc[2] + 0.06), mat, bevel=0.01)
    o.rotation_euler = (0, 0, giro)
    return o


def preparar(t):
    limpar()
    configurar_render(TOMADAS[t])
    cenario()
    return camera()


def numero_no_painel(quadros_valores, cor=(1.0, 0.85, 0.2)):
    """troca o número do painel nos quadros dados: [(quadro, '10'), ...]"""
    m = material('num', cor, emissao=cor, forca=1.0)
    rotulo = texto('rotulo', 'NUGGETS', 0.13, (0.85, 2.2, 2.42), material('rot', (1, 1, 1), emissao=(1, 1, 1), forca=0.8), extrude=0.01)
    objs = []
    for i, (q, valor) in enumerate(quadros_valores):
        t = texto(f'num{i}', valor, 0.48, (0.85, 2.2, 2.02), m, extrude=0.02)
        prox = quadros_valores[i + 1][0] if i + 1 < len(quadros_valores) else 99999
        chave(t, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
        chave(t, 'scale', max(2, q), (0.001, 0.001, 0.001), 'BACK')
        chave(t, 'scale', max(2, q) + 5, (1, 1, 1), 'CONSTANT')
        if prox < 99999:
            chave(t, 'scale', prox, (0.001, 0.001, 0.001), 'CONSTANT')
        objs.append(t)
    return rotulo, objs


def t_abertura():
    cam, alvo = preparar('abertura')
    r = robo()
    flutuar(r, 1, 106)
    verm = material('verm', (0.9, 0.08, 0.08), emissao=(1, 0.1, 0.1), forca=0.9)
    t = texto('titulo', '260\nNUGGETS!', 0.25, (0, -0.2, 2.1), verm, extrude=0.06)
    chave(t, 'scale', 1, (0.6, 0.6, 0.6), 'BACK')
    chave(t, 'scale', 7, (1, 1, 1))
    caixa_mat = material('cx', (0.85, 0.12, 0.1), rough=0.4)
    random.seed(3)
    for i in range(14):
        c = caixinha(f'cx{i}', (random.uniform(-1.0, 1.0), random.uniform(-0.05, 0.1), 1.045), caixa_mat, random.uniform(-0.5, 0.5))
        cair(c, 20 + i * 4, altura=2.0)
    chave(cam, 'location', 1, (0, -2.2, 1.85), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.7), 'BEZIER')
    chave(cam, 'location', 106, (0, -2.6, 1.75))
    chave(alvo, 'location', 106, (0, 0.5, 1.55))


def t_drive():
    cam, alvo = preparar('drive')
    r = robo()
    flutuar(r, 1, 238)
    numero_no_painel([(1, '1')])
    tag = etiqueta('teste', 'IA NO\nDRIVE-THRU', (0.1, 0.5, 0.9), (1, 1, 1), (-0.42, 0.3, 2.0), largura=0.62, altura=0.34, tam=0.1)
    aparecer(tag, 40)
    chave(cam, 'location', 1, (0.15, -2.5, 1.8), 'BEZIER')
    chave(alvo, 'location', 1, (0.3, 1.0, 1.7), 'BEZIER')
    chave(cam, 'location', 238, (0.1, -1.9, 1.75))
    chave(alvo, 'location', 238, (0.2, 0.8, 1.65))
    # "só que ela se confundia": balança a cabeça, perdida
    for i, f in enumerate(range(185, 238, 9)):
        chave(r, 'rotation_euler', f, (0, math.radians(12 if i % 2 else -12), 0), 'SINE')


def t_pedido():
    cam, alvo = preparar('pedido')
    r = robo()
    flutuar(r, 1, 293)
    numero_no_painel([(1, '4'), (60, '6'), (120, '8'), (172, '10'), (196, '50'), (222, '100'), (255, '260')])
    for i, (q, loc) in enumerate(((40, (-0.45, -0.1, 2.05)), (95, (-0.15, -0.1, 2.4)), (150, (-0.5, -0.1, 1.7)))):
        e = etiqueta(f'para{i}', 'PARA!', (0.95, 0.95, 0.97), (0.85, 0.1, 0.1), loc, largura=0.5, altura=0.24, tam=0.15)
        aparecer(e, q)
    caixa_mat = material('cx', (0.85, 0.12, 0.1), rough=0.4)
    random.seed(5)
    n = 0
    # caixinhas empilham no balcão; a chuva aperta a cada número
    for faixa, (q0, q1, quantas) in enumerate(((10, 170, 6), (172, 196, 6), (196, 222, 10), (222, 255, 14), (255, 285, 26))):
        for k in range(quantas):
            x = random.uniform(-1.05, 1.05)
            y = random.uniform(-0.05, 0.25) if faixa < 4 else random.uniform(-0.9, 0.25)
            z = 1.045 if faixa < 4 else random.choice((1.045, 0.0))
            c = caixinha(f'cx{n}', (x, y, z), caixa_mat, random.uniform(-0.6, 0.6))
            cair(c, q0 + int(k * (q1 - q0) / max(1, quantas)), altura=2.2, dur=8)
            n += 1
    chave(cam, 'location', 1, (0.3, -2.4, 1.8), 'BEZIER')
    chave(alvo, 'location', 1, (0.4, 1.0, 1.75), 'BEZIER')
    chave(cam, 'location', 165, (0.6, -0.9, 2.0), 'BEZIER')
    chave(alvo, 'location', 165, (0.8, 2.2, 2.1), 'BEZIER')
    chave(cam, 'location', 252, (0.7, -0.6, 2.05), 'BEZIER')
    chave(alvo, 'location', 252, (0.85, 2.2, 2.1), 'BEZIER')
    chave(cam, 'location', 293, (0.2, -3.3, 2.0))
    chave(alvo, 'location', 293, (0.3, 0.9, 1.6))


def t_sorvete():
    cam, alvo = preparar('sorvete')
    raiz = bpy.data.objects.new('sorvete', None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = (0, 0.3, 1.05)
    bpy.ops.mesh.primitive_cone_add(radius1=0.09, radius2=0.0, depth=0.32, location=(0, 0, 0.16), rotation=(math.pi, 0, 0))
    cone = bpy.context.active_object
    cone.data.materials.append(material('casquinha', (0.85, 0.6, 0.3), rough=0.6))
    cone.parent = raiz
    creme = material('creme', (0.98, 0.95, 0.88), rough=0.4)
    for i, z in enumerate((0.34, 0.44)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1 - i * 0.015, location=(0, 0, z))
        s = bpy.context.active_object
        s.data.materials.append(creme)
        bpy.ops.object.shade_smooth()
        s.parent = raiz
    bacon = material('bacon', (0.6, 0.18, 0.1), rough=0.5)
    for i in range(4):
        b = caixa(f'bacon{i}', (0.2, 0.05, 0.015), (0, 0, 0), bacon, bevel=0.004)
        b.parent = raiz
        b.location = (0.0, 0.0, 0.52 + i * 0.03)
        b.rotation_euler = (0.2, 0.3 * (i - 1.5), i * 0.8)
        cair(b, 12 + i * 10, altura=0.8, dur=8)
    chave(raiz, 'rotation_euler', 1, (0, 0, 0), 'LINEAR')
    chave(raiz, 'rotation_euler', 83, (0, 0, math.radians(70)))
    t = etiqueta('com_bacon', 'SORVETE\nCOM BACON?!', (0.95, 0.85, 0.2), (0.15, 0.1, 0.05), (0, 0.1, 1.85), largura=0.55, altura=0.28, tam=0.085)
    aparecer(t, 48)
    chave(cam, 'location', 1, (0, -1.25, 1.6), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.3, 1.5), 'BEZIER')
    chave(cam, 'location', 83, (0, -1.05, 1.6))
    chave(alvo, 'location', 83, (0, 0.3, 1.52))


def t_fim():
    cam, alvo = preparar('fim')
    r = robo()
    numero_no_painel([(1, '260')])
    escurecer(0.6)
    verm = material('verm', (0.9, 0.08, 0.08), emissao=(1, 0.1, 0.1), forca=0.9)
    t = etiqueta('encerrado', 'TESTE\nENCERRADO', (0.85, 0.08, 0.08), (1, 1, 1), (-0.35, 0.1, 2.05), largura=0.75, altura=0.36, tam=0.12)
    aparecer(t, 30)
    del verm
    chave(r, 'rotation_euler', 25, (0, 0, 0), 'SINE')
    chave(r, 'rotation_euler', 45, (math.radians(22), 0, 0))
    chave(cam, 'location', 1, (0, -2.4, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.6, 1.6), 'BEZIER')
    chave(cam, 'location', 129, (0, -2.0, 1.75))
    chave(alvo, 'location', 129, (0, 0.6, 1.65))


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    teste = '--teste' in args
    escolha = [a for a in args if not a.startswith('--')]
    nomes = list(TOMADAS) if not escolha or escolha[0] == 'todas' else escolha
    for nome in nomes:
        TOMADA_FN[nome]()
        renderizar(f'{SAIDA}/{nome}', teste)
