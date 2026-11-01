"""
Peças comuns da série "Como funciona" (explicações em 3D apresentadas pelo personagem do canal).

Cada episódio (cf_gps.py, cf_imagem.py…) faz `from como_funciona import *`, define TOMADAS e as funções
t_<tomada>(), e chama rodar(). Formato 9:16: o apresentador fica grande embaixo e o assunto em cima.
O piloto (cf_chatgpt.py) nasceu antes deste módulo e tem as mesmas peças por dentro.
"""
import bpy, math, os, random, sys

sys.path.append(os.path.dirname(__file__))
from historias3d import *  # noqa: E402,F401,F403
from apresentador3d import apresentador, pose, gesto, balancar, pulinho  # noqa: E402,F401

AP = (0.32, -0.55, 0)       # apresentador grande, embaixo à direita
PAREDE = 1.3
PRAT = 0.5                  # profundidade da prateleira / das coisas em cena
CORES = [(0.95, 0.35, 0.35), (0.98, 0.72, 0.2), (0.35, 0.75, 0.45), (0.3, 0.55, 0.95), (0.7, 0.45, 0.9)]
AZUL_B = (0.3, 0.55, 0.95)
CAM = (0, -2.75, 1.3)
ALVO = (0, 0.4, 1.25)


def cenario(prateleira=None, parede=(0.62, 0.8, 0.95), piso=(0.93, 0.85, 0.7)):
    plano('piso', (30, 30), (0, 0, 0), material('piso', piso, rough=0.75))
    plano('parede', (30, 12), (0, PAREDE, 6), material('parede', parede, rough=0.85), rot=(math.pi / 2, 0, 0))
    caixa('rodape', (30, 0.05, 0.12), (0, PAREDE - 0.03, 0.06), material('rodape', (0.97, 0.97, 0.97), rough=0.5))
    if prateleira:
        caixa('prat', (2.3, 0.3, 0.04), (-0.05, PRAT, prateleira - 0.02), material('pratm', (0.98, 0.98, 0.98), rough=0.4), bevel=0.01)
    iluminacao()


def espaco():
    """fundo de espaço: sem parede, céu escuro com estrelinhas"""
    w = bpy.context.scene.world.node_tree.nodes['Background']
    w.inputs[0].default_value = (0.01, 0.015, 0.04, 1)
    w.inputs[1].default_value = 1.0
    random.seed(11)
    m = material('estrela', (1, 1, 1), emissao=(1, 1, 1), forca=4)
    for i in range(160):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.006, 0.016), subdivisions=1,
                                              location=(random.uniform(-4, 4), random.uniform(3, 5), random.uniform(-3, 6)))
        o = bpy.context.active_object
        o.name = f'estrela{i}'
        o.data.materials.append(m)
    luz('sol', 'SUN', (-3, -3, 4), 3.0, alvo=(0, 0, 0))


def preparar(segundos, prateleira=None, **kw):
    limpar()
    configurar_render(segundos)
    if kw.pop('sem_cenario', False):
        iluminacao()
    else:
        cenario(prateleira, **kw)
    return camera()


def largura_bloco(p):
    return max(0.2, 0.062 * len(p) + 0.1)


def bloco(nome, texto_, loc, cor, tam=0.09, alt=0.18):
    """bloco de brinquedo com a palavra na frente"""
    larg = largura_bloco(texto_)
    raiz = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = loc
    c = caixa(nome + '_c', (larg, 0.2, alt), (0, 0, alt / 2), material(nome + 'm', cor, rough=0.35), bevel=0.03)
    c.parent = raiz
    t = texto(nome + '_t', texto_, tam, (0, 0, 0), material(nome + 'tm', (1, 1, 1), emissao=(1, 1, 1), forca=0.4), extrude=0.01)
    t.parent = raiz
    t.location = (0, -0.105, alt / 2)
    raiz['larg'] = larg
    return raiz


def fileira(prefixo, palavras, z, cor=AZUL_B, x0=None, folga=0.03, cores=None, y=PRAT):
    """blocos lado a lado (centralizados, ou a partir de x0). Devolve (blocos, x do fim)"""
    larguras = [largura_bloco(p) for p in palavras]
    total = sum(larguras) + folga * (len(palavras) - 1)
    x = -total / 2 - 0.05 if x0 is None else x0
    blocos = []
    for i, (p, l) in enumerate(zip(palavras, larguras)):
        blocos.append(bloco(f'{prefixo}{i}', p, (x + l / 2, y, z), cores[i] if cores else cor))
        x += l + folga
    return blocos, x


def cam_suave(cam, alvo, pontos):
    for q, c, a in pontos:
        chave(cam, 'location', q, c, 'BEZIER')
        chave(alvo, 'location', q, a, 'BEZIER')


def cam_padrao(cam, alvo, fim, chegar=0.25):
    """aproximação lenta: a câmera nunca fica parada"""
    cx, cy, cz = CAM
    ax, ay, az = ALVO
    cam_suave(cam, alvo, [(1, (cx, cy, cz), (ax, ay, az)), (fim, (cx - 0.05, cy + chegar, cz - 0.03), (ax, ay, az - 0.02))])


def vazio(nome, loc=(0, 0, 0)):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return o


def esfera(nome, raio, loc, mat, sub=4, achatar=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=raio, location=loc, segments=48, ring_count=24)
    o = bpy.context.active_object
    o.name = nome
    o.scale = (1, 1, achatar)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def cilindro(nome, raio, alt, loc, mat, rot=(0, 0, 0), lados=40):
    bpy.ops.mesh.primitive_cylinder_add(radius=raio, depth=alt, location=loc, rotation=rot, vertices=lados)
    o = bpy.context.active_object
    o.name = nome
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def anel(nome, raio, espessura, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=raio, minor_radius=espessura, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=12)
    o = bpy.context.active_object
    o.name = nome
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def satelite(nome, loc, escala=1.0):
    """corpo dourado, dois painéis solares azuis e uma antena"""
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    ouro = bpy.data.materials.get('sat_ouro') or material('sat_ouro', (0.95, 0.72, 0.25), rough=0.3, metal=0.6)
    painel = bpy.data.materials.get('sat_painel') or material('sat_painel', (0.12, 0.25, 0.75), rough=0.25, metal=0.3)
    cinza = bpy.data.materials.get('sat_cinza') or material('sat_cinza', (0.8, 0.8, 0.85), rough=0.4)
    for o in (caixa(nome + '_c', (0.22, 0.22, 0.26), (0, 0, 0), ouro, bevel=0.02),
              caixa(nome + '_p1', (0.42, 0.02, 0.18), (-0.36, 0, 0), painel, bevel=0.005),
              caixa(nome + '_p2', (0.42, 0.02, 0.18), (0.36, 0, 0), painel, bevel=0.005),
              caixa(nome + '_h', (0.3, 0.015, 0.015), (0, 0, 0), cinza),
              cilindro(nome + '_a', 0.012, 0.16, (0, 0, -0.2), cinza),
              esfera(nome + '_d', 0.07, (0, 0, -0.29), cinza, achatar=0.4)):
        o.parent = r
    return r


def pino(nome, loc, cor=(0.92, 0.2, 0.2), escala=1.0):
    """o alfinete do mapa: bola em cima, ponta embaixo (a ponta fica em loc)"""
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    m = material(nome + 'm', cor, rough=0.3)
    b = esfera(nome + '_b', 0.13, (0, 0, 0.32), m)
    bpy.ops.mesh.primitive_cone_add(radius1=0.09, radius2=0.0, depth=0.26, location=(0, 0, 0.13), rotation=(math.pi, 0, 0), vertices=32)
    c = bpy.context.active_object
    c.name = nome + '_p'
    c.data.materials.append(m)
    centro = esfera(nome + '_o', 0.05, (0, -0.11, 0.33), material(nome + 'w', (1, 1, 1), emissao=(1, 1, 1), forca=0.3))
    for o in (b, c, centro):
        o.parent = r
    return r


def onda(nome, origem, quadro, raio_final=1.2, dur=24, cor=(1.0, 0.85, 0.2), rot=(math.pi / 2, 0, 0)):
    """anel que nasce num ponto e se expande sumindo (sinal de rádio)"""
    o = anel(nome, 1.0, 0.012, origem, material(nome + 'm', cor, emissao=cor, forca=2.5), rot=rot)
    chave(o, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(o, 'scale', max(2, quadro), (0.02, 0.02, 0.02), 'LINEAR')
    chave(o, 'scale', max(2, quadro) + dur, (raio_final, raio_final, raio_final), 'CONSTANT')
    chave(o, 'scale', max(2, quadro) + dur + 1, (0.001, 0.001, 0.001), 'CONSTANT')
    return o


def relogio(nome, loc, raio=0.4, quadro_ini=1, quadro_fim=200, voltas=3):
    """relógio de parede com ponteiro girando"""
    r = vazio(nome, loc)
    cilindro(nome + '_aro', raio + 0.04, 0.06, (0, 0, 0), material(nome + 'a', (0.15, 0.15, 0.18), rough=0.3), rot=(math.pi / 2, 0, 0)).parent = r
    cilindro(nome + '_f', raio, 0.065, (0, -0.005, 0), material(nome + 'f', (0.98, 0.98, 0.98), rough=0.5), rot=(math.pi / 2, 0, 0)).parent = r
    preto = material(nome + 'p', (0.08, 0.08, 0.1))
    for h in range(12):
        a = h * math.pi / 6
        m = caixa(f'{nome}_m{h}', (0.02, 0.01, 0.06), (math.sin(a) * raio * 0.82, -0.04, math.cos(a) * raio * 0.82), preto)
        m.rotation_euler = (0, a, 0)
        m.parent = r
    piv = vazio(nome + '_piv', (0, -0.05, 0))
    piv.parent = r
    p = caixa(nome + '_ptr', (0.025, 0.01, raio * 0.8), (0, 0, raio * 0.35), material(nome + 'v', (0.9, 0.15, 0.15)))
    p.parent = piv
    piv.rotation_mode = 'XYZ'
    chave(piv, 'rotation_euler', quadro_ini, (0, 0, 0), 'LINEAR')
    chave(piv, 'rotation_euler', quadro_fim, (0, voltas * 2 * math.pi, 0), 'LINEAR')
    return r


def deslizar(obj, q0, q1, destino, interp='BEZIER'):
    chave(obj, 'location', q0, tuple(obj.location), interp)
    chave(obj, 'location', q1, destino, 'BEZIER')
