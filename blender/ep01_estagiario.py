"""
"O Estagiário Robô" — ep. 1: o estagiário que inventava respostas (alucinação).

    blender -b --factory-startup --python blender/ep01_estagiario.py -- <tomada|todas> [--teste]

Elenco: robozinho (GLB da Magnific, já existente), chefe e colega (Kenney Mini
Characters, CC0, com animações prontas). Escritório montado com formas simples.
Os trechos de informação (manchete real e a multa) entram como cenas 2D no plano.
"""
import bpy, sys, math, os

sys.path.append(os.path.dirname(__file__))
from base3d import *  # noqa: E402,F401
from personagens3d import personagem, animar  # noqa: E402

MODELOS = 'C:/Users/yaned/Videos/Melhores Fimes/3d/modelos'
SAIDA = 'C:/Users/yaned/Videos/Melhores Fimes/3d/ep01'

TOMADAS = {
    'abertura': 3.40,     # 0.00–3.40  "QUEM INVENTOU ISSO?!" / "Calma, que eu explico."
    'entrada': 3.72,      # 3.40–7.12  "Primeiro dia do estagiário novo… e ele é uma IA."
    'pedido': 4.64,       # 7.12–11.76 "Robozinho, me traz três processos… Pra ontem!"
    'pronto': 2.96,       # 11.76–14.72 "Prontinho, chefe! Fiz em dois segundos!"
    'inventado': 4.20,    # 14.72–18.92 "Rápido… confiante… e totalmente inventado."
    'naoexiste': 4.58,    # 18.92–23.50 "Esses processos não existem!" / "Mas eles pareciam tão reais…"
    'alucinacao': 7.82,   # 23.50–31.32 "Isso tem nome: alucinação… adivinha a próxima palavra."
    'colega': 2.64,       # 42.12–44.76 "Então não dá pra confiar na IA?"
    'dica': 4.60,         # 44.76–49.36 "Dá. Mas sempre peça a fonte… e confira."
    'final': 5.56,        # 49.36–54.92 "agora eu só trago processo de verdade!" / "E confere duas vezes!"
    'titulo': 2.77,       # 54.92–57.69 "Segue o canal pra ver o próximo dia do estagiário."
}

CHEFE_MESA = (-1.25, 1.75, 0)
ROBO_LOC = (1.05, 1.05, 0.85)


def cenario():
    plano('piso', (30, 30), (0, 0, 0), material('carpete', (0.36, 0.42, 0.52), rough=0.9))
    plano('parede', (30, 10), (0, 3.0, 5), material('parede', (0.74, 0.7, 0.62), rough=0.8), rot=(math.pi / 2, 0, 0))
    caixa('faixa', (30, 0.04, 0.12), (0, 2.97, 1.0), material('faixa', (0.15, 0.5, 0.55), rough=0.6))
    # janela com luz do dia
    caixa('janela_moldura', (1.6, 0.06, 1.15), (-1.7, 2.96, 1.85), material('moldura', (0.95, 0.95, 0.97)), bevel=0.02)
    caixa('janela', (1.45, 0.04, 1.0), (-1.7, 2.93, 1.85), material('vidro', (0.7, 0.86, 1.0), emissao=(0.7, 0.86, 1.0), forca=1.2))
    # relógio de parede
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.05, location=(0.4, 2.95, 2.3), rotation=(math.pi / 2, 0, 0))
    bpy.context.active_object.data.materials.append(material('relogio', (0.98, 0.98, 0.98)))
    madeira = material('mesa', (0.72, 0.5, 0.3), rough=0.5)
    escura = material('mesa_base', (0.25, 0.27, 0.32), rough=0.5)
    tela = material('monitor', (0.05, 0.12, 0.18), emissao=(0.2, 0.75, 0.95), forca=0.8)
    preto = material('preto', (0.06, 0.06, 0.08), rough=0.4)
    # o monitor do robô fica no canto da mesa, virado para ele: no meio, tampava o rosto
    for nome, (x, y), larg, mx in (('chefe', (-1.25, 1.2), 1.5, 0.25), ('robo', (1.05, 0.55), 1.2, 0.45), ('colega', (2.7, 1.9), 1.2, 0.25)):
        caixa(f'mesa_{nome}', (larg, 0.7, 0.05), (x, y, 0.76), madeira, bevel=0.01)
        caixa(f'base_{nome}', (larg - 0.1, 0.6, 0.72), (x, y + 0.02, 0.37), escura)
        giro_m = math.radians(35) if nome == 'robo' else 0
        caixa(f'monitor_{nome}', (0.55, 0.04, 0.34), (x + mx, y + 0.2, 1.05), preto, bevel=0.01, rot=(0, 0, giro_m))
        caixa(f'tela_{nome}', (0.5, 0.02, 0.29), (x + mx - 0.013 * math.sin(giro_m), y + 0.175, 1.05), tela, rot=(0, 0, giro_m))
        caixa(f'pe_{nome}', (0.05, 0.05, 0.14), (x + mx, y + 0.22, 0.85), preto)
    # planta e arquivo
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.4, location=(-2.6, 2.5, 0.2))
    bpy.context.active_object.data.materials.append(material('vaso', (0.85, 0.4, 0.25)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.42, location=(-2.6, 2.5, 0.75))
    bpy.context.active_object.data.materials.append(material('folhas', (0.2, 0.55, 0.25), rough=0.8))
    bpy.ops.object.shade_smooth()
    caixa('arquivo', (0.6, 0.55, 1.3), (3.0, 2.6, 0.65), material('arquivo', (0.6, 0.65, 0.72), rough=0.4, metal=0.3), bevel=0.02)
    iluminacao()
    bpy.context.scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.32


def robo(loc=ROBO_LOC, giro=0.0):
    r = importar(f'{MODELOS}/robo.glb', 'robo', altura=0.7)
    r.location = loc
    r.rotation_euler = (0, 0, giro)
    return r


def flutuar(obj, ini, fim, amp=0.03, periodo=36):
    x, y, z0 = obj.location
    f, lado = ini, 1
    while f <= fim + periodo:
        chave(obj, 'location', f, (x, y, z0 + amp * lado), 'SINE')
        f += periodo // 2
        lado = -lado


def falar(obj, ini, fim):
    """robô "falando": pulinhos rápidos"""
    flutuar(obj, ini, fim, amp=0.04, periodo=10)


def mirar(de, para):
    """giro em Z para um personagem (que olha para -Y) ficar de frente para um ponto"""
    return math.atan2(para[0] - de[0], -(para[1] - de[1]))


def balao(nome, conteudo, loc, cor=(0.97, 0.97, 0.99), cor_txt=(0.1, 0.1, 0.14), larg=0.75, tam=0.11):
    linhas = len(conteudo.splitlines())
    return etiqueta(nome, conteudo, cor, cor_txt, loc, largura=larg, altura=0.1 + 0.14 * linhas * tam / 0.11, tam=tam)


def preparar(t):
    limpar()
    configurar_render(TOMADAS[t])
    cenario()
    return camera()


# ------------------------------------------------------------------ tomadas

def t_abertura():
    cam, alvo = preparar('abertura')
    chefe_loc = (0.3, 0.45, 0)
    ch = personagem('character-female-d', 'chefe', loc=chefe_loc, giro=mirar(chefe_loc, (0.3, -3)))
    animar(ch, [('attack-melee-right', 1, 30, 0.9), ('emote-no', 30, 102, 1.0)])
    r = robo(giro=mirar(ROBO_LOC, chefe_loc))
    # o robô treme, paralisado
    for f in range(1, 103, 2):
        chave(r, 'location', f, (ROBO_LOC[0] + (0.012 if f % 4 == 1 else -0.012), ROBO_LOC[1], ROBO_LOC[2]), 'CONSTANT')
    verm = material('verm', (0.9, 0.05, 0.05), emissao=(1, 0.08, 0.08), forca=0.9)
    t = texto('grito', '?!', 0.42, (0.3, 0.3, 1.98), verm, extrude=0.08)
    chave(t, 'scale', 1, (0.6, 0.6, 0.6), 'BACK')
    chave(t, 'scale', 6, (1, 1, 1))
    chave(cam, 'location', 1, (0.15, -2.0, 1.5), 'BEZIER')
    chave(alvo, 'location', 1, (0.3, 0.45, 1.35), 'BEZIER')
    chave(cam, 'location', 12, (0.2, -1.65, 1.5), 'BEZIER')
    chave(alvo, 'location', 12, (0.3, 0.45, 1.4), 'BEZIER')
    chave(cam, 'location', 60, (0.25, -1.7, 1.5), 'BEZIER')
    chave(alvo, 'location', 60, (0.32, 0.45, 1.4), 'BEZIER')
    chave(cam, 'location', 102, (0.55, -2.6, 1.6))
    chave(alvo, 'location', 102, (0.65, 0.8, 1.2))


def t_entrada():
    cam, alvo = preparar('entrada')
    ch = personagem('character-female-d', 'chefe', loc=CHEFE_MESA)
    animar(ch, [('idle', 1, 112, 1.0)])
    r = robo((3.6, 1.05, 1.3), giro=math.radians(70))
    chave(r, 'location', 1, (3.6, 1.05, 1.3), 'BEZIER')
    chave(r, 'location', 45, ROBO_LOC, 'BACK')
    chave(r, 'rotation_euler', 40, (0, 0, math.radians(70)), 'BEZIER')
    chave(r, 'rotation_euler', 55, (0, 0, 0))
    flutuar(r, 56, 112)
    tag = balao('cracha', 'ESTAGIÁRIO\nNOVO', (ROBO_LOC[0], 0.8, 1.85), cor=(1.0, 0.82, 0.15), larg=0.62, tam=0.1)
    aparecer(tag, 52)
    ia = balao('e_ia', 'É UMA IA!', (ROBO_LOC[0], 0.8, 1.6), cor=(0.15, 0.5, 0.95), cor_txt=(1, 1, 1), larg=0.55, tam=0.09)
    aparecer(ia, 88)
    chave(cam, 'location', 1, (0.2, -3.6, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (0.3, 1.2, 1.15), 'BEZIER')
    chave(cam, 'location', 112, (0.5, -2.9, 1.65))
    chave(alvo, 'location', 112, (0.55, 1.1, 1.25))


def t_pedido():
    cam, alvo = preparar('pedido')
    destino = (0.25, 0.4, 0)
    ch = personagem('character-female-d', 'chefe', loc=CHEFE_MESA, giro=mirar(CHEFE_MESA, destino))
    animar(ch, [('walk', 1, 58, 1.0), ('interact-right', 58, 139, 0.8)])
    chave(ch, 'location', 1, CHEFE_MESA, 'LINEAR')
    chave(ch, 'location', 58, destino, 'BEZIER')
    chave(ch, 'rotation_euler', 50, (0, 0, mirar(CHEFE_MESA, destino)), 'BEZIER')
    chave(ch, 'rotation_euler', 64, (0, 0, mirar(destino, ROBO_LOC)))
    r = robo(giro=mirar(ROBO_LOC, destino))
    flutuar(r, 1, 139)
    b = balao('pedido', '3 PROCESSOS.\nPRA ONTEM!', (0.25, 0.2, 2.05), larg=0.8)
    aparecer(b, 70)
    chave(cam, 'location', 1, (-0.4, -3.0, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (-0.4, 1.2, 1.2), 'BEZIER')
    chave(cam, 'location', 70, (0.55, -2.2, 1.65), 'BEZIER')
    chave(alvo, 'location', 70, (0.6, 0.7, 1.4), 'BEZIER')
    chave(cam, 'location', 139, (0.6, -2.0, 1.65))
    chave(alvo, 'location', 139, (0.62, 0.7, 1.45))


def papeis(quadros):
    branco = material('papel', (0.97, 0.97, 0.95), rough=0.6)
    tinta = material('tinta', (0.15, 0.15, 0.2))
    folhas = []
    for i, q in enumerate(quadros):
        raiz = bpy.data.objects.new(f'papel{i}', None)
        bpy.context.scene.collection.objects.link(raiz)
        raiz.location = (0.78 + i * 0.03, 0.42 - i * 0.02, 0.79 + i * 0.008)
        raiz.rotation_euler = (0, 0, math.radians(-8 + i * 7))
        f = caixa(f'folha{i}', (0.3, 0.4, 0.006), (0, 0, 0), branco)
        f.parent = raiz
        t = texto(f'txt{i}', f'PROCESSO\n{i + 1}', 0.06, (0, 0.05, 0.005), tinta, extrude=0.002)
        t.rotation_euler = (0, 0, 0)
        t.parent = raiz
        cair(raiz, q, altura=0.8, dur=8)
        folhas.append(raiz)
    return folhas


def t_pronto():
    cam, alvo = preparar('pronto')
    chefe_loc = (0.25, 0.4, 0)
    ch = personagem('character-female-d', 'chefe', loc=chefe_loc, giro=mirar(chefe_loc, ROBO_LOC))
    animar(ch, [('idle', 1, 89, 1.0)])
    r = robo(giro=mirar(ROBO_LOC, chefe_loc))
    chave(r, 'rotation_euler', 4, (0, 0, mirar(ROBO_LOC, chefe_loc)), 'BACK')
    chave(r, 'rotation_euler', 28, (0, 0, mirar(ROBO_LOC, chefe_loc) + math.tau))
    falar(r, 1, 89)
    papeis([18, 24, 30])
    chave(cam, 'location', 1, (0.9, -1.6, 1.5), 'BEZIER')
    chave(alvo, 'location', 1, (0.9, 0.7, 1.15), 'BEZIER')
    chave(cam, 'location', 89, (0.9, -1.35, 1.45))
    chave(alvo, 'location', 89, (0.9, 0.7, 1.1))


def t_inventado():
    cam, alvo = preparar('inventado')
    r = robo()
    flutuar(r, 1, 126)
    for p in papeis([1, 1, 1]):
        pass
    verm = material('verm', (0.85, 0.04, 0.04), emissao=(1, 0.06, 0.06), forca=0.8)
    selo = texto('selo', 'INVENTADO', 0.075, (0.82, 0.4, 0.83), verm, extrude=0.01)
    selo.rotation_euler = (0, 0, math.radians(12))
    chave(selo, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(selo, 'scale', 82, (2.0, 2.0, 2.0), 'BACK')
    chave(selo, 'scale', 88, (1, 1, 1))
    chave(cam, 'location', 1, (0.8, -0.35, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0.82, 0.42, 0.85), 'BEZIER')
    chave(cam, 'location', 126, (0.82, -0.05, 1.5))
    chave(alvo, 'location', 126, (0.82, 0.42, 0.82))


def t_naoexiste():
    cam, alvo = preparar('naoexiste')
    chefe_loc = (0.25, 0.4, 0)
    ch = personagem('character-female-d', 'chefe', loc=chefe_loc, giro=mirar(chefe_loc, ROBO_LOC))
    animar(ch, [('emote-no', 1, 72, 1.0), ('idle', 72, 138, 1.0)])
    papeis([1, 1, 1])
    b = balao('naoexiste', 'NÃO EXISTEM!', (0.55, 0.2, 2.02), cor=(0.9, 0.12, 0.12), cor_txt=(1, 1, 1), larg=0.8)
    aparecer(b, 6)
    r = robo(giro=mirar(ROBO_LOC, chefe_loc))
    flutuar(r, 1, 72)
    # "mas pareciam tão reais…": abaixa a cabeça, triste
    chave(r, 'rotation_euler', 75, (0, 0, mirar(ROBO_LOC, chefe_loc)), 'SINE')
    chave(r, 'rotation_euler', 92, (math.radians(22), 0, mirar(ROBO_LOC, chefe_loc)))
    chave(cam, 'location', 1, (0.6, -2.1, 1.6), 'BEZIER')
    chave(alvo, 'location', 1, (0.6, 0.7, 1.35), 'BEZIER')
    chave(cam, 'location', 75, (0.7, -1.9, 1.55), 'BEZIER')
    chave(alvo, 'location', 75, (0.7, 0.7, 1.3), 'BEZIER')
    chave(cam, 'location', 138, (0.75, -1.75, 1.5))
    chave(alvo, 'location', 138, (0.75, 0.8, 1.3))


def t_alucinacao():
    cam, alvo = preparar('alucinacao')
    escurecer(0.55)
    holofote((ROBO_LOC[0], 1.0, 4.0), alvo_z=1.1)
    r = robo()
    flutuar(r, 1, 235)
    roxo = material('roxo', (0.6, 0.25, 1.0), emissao=(0.6, 0.25, 1.0), forca=1.0)
    t = texto('aluc', 'ALUCINAÇÃO', 0.2, (ROBO_LOC[0], 0.55, 1.95), roxo, extrude=0.04)
    aparecer(t, 5)
    chave(t, 'location', 95, (ROBO_LOC[0], 0.55, 1.95), 'BEZIER')
    chave(t, 'location', 110, (ROBO_LOC[0], 0.55, 2.42))
    # "ela adivinha a próxima palavra": as palavras aparecem uma a uma
    palavras = [('A IA', -0.45, 2.12), ('ADIVINHA', 0.15, 2.12), ('A PRÓXIMA', -0.32, 1.86), ('PALAVRA', 0.33, 1.86)]
    for i, (p, dx, z) in enumerate(palavras):
        e = balao(f'pal{i}', p, (ROBO_LOC[0] + dx, 0.45, z), cor=(0.97, 0.97, 0.99), larg=0.1 + 0.075 * len(p), tam=0.085)
        aparecer(e, 112 + i * 18)
    q = balao('pal_q', '???', (ROBO_LOC[0] + 0.78, 0.45, 1.86), cor=(1.0, 0.82, 0.15), larg=0.3, tam=0.085)
    aparecer(q, 190)
    chave(cam, 'location', 1, (ROBO_LOC[0], -1.9, 1.8), 'BEZIER')
    chave(alvo, 'location', 1, (ROBO_LOC[0], 0.8, 1.75), 'BEZIER')
    chave(cam, 'location', 235, (ROBO_LOC[0], -1.6, 1.8))
    chave(alvo, 'location', 235, (ROBO_LOC[0], 0.8, 1.75))


def t_colega():
    cam, alvo = preparar('colega')
    col_loc = (1.95, 1.35, 0)
    co = personagem('character-male-e', 'colega', loc=col_loc, giro=mirar(col_loc, (1.6, -2.0)))
    animar(co, [('interact-left', 1, 79, 0.8)])
    r = robo(giro=mirar(ROBO_LOC, col_loc))
    flutuar(r, 1, 79)
    b = balao('duvida', '?', (1.95, 1.1, 2.0), larg=0.25, tam=0.16)
    aparecer(b, 8)
    chave(cam, 'location', 1, (1.9, -1.4, 1.6), 'BEZIER')
    chave(alvo, 'location', 1, (1.6, 1.15, 1.4), 'BEZIER')
    chave(cam, 'location', 79, (1.95, -1.15, 1.58))
    chave(alvo, 'location', 79, (1.65, 1.15, 1.42))


def t_dica():
    cam, alvo = preparar('dica')
    r = robo()
    flutuar(r, 1, 138)
    cores = [(0.85, 0.2, 0.2), (0.2, 0.45, 0.85), (0.2, 0.65, 0.3), (0.95, 0.7, 0.15)]
    for i, cor in enumerate(cores):
        lv = caixa(f'livro{i}', (0.32, 0.24, 0.06), (0.75, 0.45, 0.79 + 0.03 + i * 0.062), material(f'livro{i}', cor, rough=0.6), bevel=0.006)
        lv.rotation_euler = (0, 0, math.radians(-6 + i * 5))
        cair(lv, 12 + i * 7, altura=1.0, dur=7)
    verde = (0.15, 0.7, 0.35)
    d = balao('dica', 'PEÇA A FONTE\nE CONFIRA!', (ROBO_LOC[0], 0.6, 1.95), cor=verde, cor_txt=(1, 1, 1), larg=0.85)
    aparecer(d, 45)
    chave(cam, 'location', 1, (0.9, -1.8, 1.55), 'BEZIER')
    chave(alvo, 'location', 1, (0.95, 0.7, 1.35), 'BEZIER')
    chave(cam, 'location', 138, (0.95, -1.55, 1.55))
    chave(alvo, 'location', 138, (0.95, 0.7, 1.4))


def t_final():
    cam, alvo = preparar('final')
    chefe_loc = (0.25, 0.4, 0)
    ch = personagem('character-female-d', 'chefe', loc=chefe_loc, giro=mirar(chefe_loc, ROBO_LOC))
    animar(ch, [('idle', 1, 96, 1.0), ('emote-yes', 96, 167, 1.0)])
    r = robo(giro=mirar(ROBO_LOC, chefe_loc))
    falar(r, 1, 96)
    chave(r, 'rotation_euler', 98, (0, 0, mirar(ROBO_LOC, chefe_loc)), 'BACK')
    chave(r, 'rotation_euler', 120, (0, 0, mirar(ROBO_LOC, chefe_loc) + math.tau))
    v = balao('verdade', 'SÓ PROCESSO\nDE VERDADE!', (ROBO_LOC[0], 0.75, 1.9), cor=(0.15, 0.7, 0.35), cor_txt=(1, 1, 1), larg=0.85)
    aparecer(v, 8)
    chave(v, 'scale', 92, (1, 1, 1), 'BACK')
    chave(v, 'scale', 96, (0.001, 0.001, 0.001))
    dx = balao('duasvezes', 'CONFERE\n2 VEZES!', (0.25, 0.2, 2.0), larg=0.7)
    aparecer(dx, 100)
    chave(cam, 'location', 1, (0.6, -2.2, 1.6), 'BEZIER')
    chave(alvo, 'location', 1, (0.65, 0.7, 1.4), 'BEZIER')
    chave(cam, 'location', 167, (0.6, -1.95, 1.6))
    chave(alvo, 'location', 167, (0.65, 0.7, 1.45))


def t_titulo():
    cam, alvo = preparar('titulo')
    ch = personagem('character-female-d', 'chefe', loc=CHEFE_MESA)
    animar(ch, [('idle', 1, 83, 1.0)])
    col_loc = (2.75, 2.4, 0)
    co = personagem('character-male-e', 'colega', loc=col_loc)
    animar(co, [('idle', 1, 83, 1.0)])
    r = robo()
    chave(r, 'rotation_euler', 10, (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', 40, (0, 0, math.tau))
    flutuar(r, 1, 83)
    t = etiqueta('titulo', 'O ESTAGIÁRIO\nROBÔ', (0.1, 0.1, 0.16), (1.0, 0.82, 0.2), (0.3, 0.2, 2.25), largura=1.6, altura=0.75, tam=0.26)
    aparecer(t, 4)
    s = etiqueta('ep', 'episódio 1', (1.0, 0.82, 0.2), (0.1, 0.1, 0.16), (0.3, 0.15, 1.75), largura=0.6, altura=0.16, tam=0.08)
    aparecer(s, 14)
    chave(cam, 'location', 1, (0.3, -2.6, 1.8), 'BEZIER')
    chave(alvo, 'location', 1, (0.35, 1.2, 1.6), 'BEZIER')
    chave(cam, 'location', 83, (0.3, -3.1, 1.85))
    chave(alvo, 'location', 83, (0.35, 1.2, 1.55))


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    teste = '--teste' in args
    escolha = [a for a in args if not a.startswith('--')]
    nomes = list(TOMADAS) if not escolha or escolha[0] == 'todas' else escolha
    for nome in nomes:
        TOMADA_FN[nome]()
        renderizar(f'{SAIDA}/{nome}', teste)
