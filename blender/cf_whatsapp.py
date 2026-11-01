"""
Série "Como funciona" — "Pra onde vai a sua mensagem do WhatsApp?" (criptografia, pacotes, cabo submarino, servidor).

    blender -b --factory-startup --python blender/cf_whatsapp.py -- <tomada|todas> [--teste]
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from como_funciona import *  # noqa: E402,F401,F403

TOMADAS = {
    'abertura': 3.48,   # "Pra onde vai a sua mensagem quando você aperta enviar?"
    'cadeado': 5.24,    # "o seu celular tranca a mensagem com um cadeado. Só o celular da outra pessoa tem a chave."
    'pacotes': 3.72,    # "Depois, ela vira pedacinhos, chamados pacotes."
    'caminho': 5.68,    # "Os pacotes saem pelo Wi-Fi ou pela antena, entram em cabos… fundo do mar."
    'mar': 4.76,        # "Isso mesmo: tem cabo de internet no fundo do oceano, ligando os continentes."
    'servidor': 7.10,   # "chegam num servidor… guarda e repassa. Ele não consegue ler nada, porque está trancado."
    'chega': 7.10,      # "o servidor manda… os pedaços se juntam, o cadeado abre, e aparecem os dois risquinhos."
    'fim': 4.22,        # "Tudo isso em menos de um segundo. Você sabia disso? Comenta aí."
}
VERDE_ZAP = (0.15, 0.75, 0.4)
OURO = (0.98, 0.75, 0.2)


def conversa(cel, texto_msg='Oi! Tudo bem?', mostrar=1):
    """bolha verde de mensagem dentro da tela do celular (filha do celular)"""
    topo = caixa('zap_topo', (0.57, 0.012, 0.12), (0, -0.04, 0.45), material('zapt', (0.05, 0.45, 0.35), emissao=(0.05, 0.45, 0.35), forca=0.3))
    topo.parent = cel
    b = etiqueta('msg', texto_msg, (0.82, 0.97, 0.75), (0.1, 0.1, 0.12), (0.04, -0.05, 0.15), largura=0.5, altura=0.16, tam=0.068)
    b.parent = cel
    b.location = (0.04, -0.05, 0.15)
    if mostrar > 1:
        aparecer(b, mostrar)
    return b


def cadeado(nome, loc, escala=1.0):
    """corpo dourado + alça; devolve (raiz, alça) — a alça sobe para abrir"""
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    ouro = material(nome + 'o', OURO, rough=0.25, metal=0.7)
    prata = material(nome + 'p', (0.8, 0.8, 0.85), rough=0.25, metal=0.8)
    caixa(nome + '_c', (0.36, 0.16, 0.3), (0, 0, 0), ouro, bevel=0.04).parent = r
    cilindro(nome + '_f', 0.035, 0.02, (0, -0.085, 0.02), material(nome + 'k', (0.1, 0.1, 0.1)), rot=(math.pi / 2, 0, 0)).parent = r
    alca = anel(nome + '_a', 0.12, 0.03, (0, 0, 0.15), prata, rot=(math.pi / 2, 0, 0))
    alca.parent = r
    return r, alca


def chave_ouro(nome, loc, escala=1.0):
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    m = material(nome + 'm', OURO, rough=0.25, metal=0.7)
    anel(nome + '_o', 0.08, 0.025, (-0.18, 0, 0), m, rot=(math.pi / 2, 0, 0)).parent = r
    caixa(nome + '_h', (0.3, 0.04, 0.04), (0.03, 0, 0), m).parent = r
    caixa(nome + '_d1', (0.03, 0.04, 0.08), (0.12, 0, -0.05), m).parent = r
    caixa(nome + '_d2', (0.03, 0.04, 0.06), (0.17, 0, -0.04), m).parent = r
    return r


def pacote(nome, loc, n, cor=VERDE_ZAP, lado=0.16):
    r = vazio(nome, loc)
    caixa(nome + '_c', (lado, lado, lado), (0, 0, 0), material(nome + 'm', cor, rough=0.35), bevel=0.02).parent = r
    texto_em(r, nome + '_t', str(n), lado * 0.6, (0, -lado / 2 - 0.006, 0))
    return r


def risquinhos(nome, loc, quadro, escala=1.0):
    """os dois "✓✓" azuis, feitos de barrinhas"""
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    azul = material(nome + 'm', (0.2, 0.6, 1.0), emissao=(0.2, 0.6, 1.0), forca=1.2)
    for k, dx in enumerate((0, 0.09)):
        a = caixa(f'{nome}_a{k}', (0.085, 0.02, 0.022), (dx - 0.03, 0, 0.03), azul)
        a.rotation_euler = (0, math.radians(45), 0)
        a.parent = r
        b = caixa(f'{nome}_b{k}', (0.17, 0.02, 0.022), (dx + 0.06, 0, 0.06), azul)
        b.rotation_euler = (0, math.radians(-45), 0)
        b.parent = r
    aparecer(r, quadro)
    return r


def roteador(nome, loc):
    r = vazio(nome, loc)
    caixa(nome + '_c', (0.5, 0.3, 0.1), (0, 0, 0.05), material(nome + 'm', (0.95, 0.95, 0.97), rough=0.3), bevel=0.03).parent = r
    preto = material(nome + 'p', (0.1, 0.1, 0.12))
    for x in (-0.18, 0.18):
        cilindro(f'{nome}_ant{x}', 0.015, 0.3, (x, 0.1, 0.25), preto).parent = r
    for i in range(4):
        caixa(f'{nome}_led{i}', (0.03, 0.01, 0.02), (-0.12 + i * 0.08, -0.155, 0.06), material(f'{nome}l{i}', (0.2, 1, 0.4), emissao=(0.2, 1, 0.4), forca=3)).parent = r
    return r


def servidor(nome, loc, altura=1.8):
    """armário de servidor com luzinhas piscando"""
    r = vazio(nome, loc)
    caixa(nome + '_c', (0.55, 0.5, altura), (0, 0, altura / 2), material(nome + 'm', (0.14, 0.15, 0.18), rough=0.3), bevel=0.02).parent = r
    leds = [material(f'{nome}_l{k}', c, emissao=c, forca=4) for k, c in enumerate(((0.2, 1, 0.4), (0.2, 0.6, 1), (1, 0.7, 0.2)))]
    for k, m in enumerate(leds):
        e = m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
        for f in range(1, 400, 9):
            e.default_value = 5 if (f // 9 + k) % 3 else 0.3
            e.keyframe_insert('default_value', frame=f)
    random.seed(len(nome))
    n = int(altura / 0.16)
    for i in range(n):
        z = 0.12 + i * 0.16
        caixa(f'{nome}_g{i}', (0.47, 0.01, 0.11), (0, -0.252, z), material(f'{nome}g', (0.22, 0.23, 0.27), rough=0.4)).parent = r
        for j in range(3):
            caixa(f'{nome}_d{i}_{j}', (0.025, 0.01, 0.025), (0.12 + j * 0.05, -0.26, z), leds[random.randrange(3)]).parent = r
    return r


def peixe(nome, loc, cor, escala=1.0):
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    m = material(nome + 'm', cor, rough=0.4)
    esfera(nome + '_c', 0.12, (0, 0, 0), m, achatar=0.7).parent = r
    o = esfera(nome + '_c', 0.12, (0, 0, 0), m)
    bpy.data.objects.remove(o)
    bpy.ops.mesh.primitive_cone_add(radius1=0.08, depth=0.12, location=(0.15, 0, 0), rotation=(0, math.pi / 2, 0), vertices=4)
    c = bpy.context.active_object
    c.name = nome + '_cauda'
    c.data.materials.append(m)
    c.parent = r
    esfera(nome + '_o', 0.02, (-0.07, -0.08, 0.03), material(nome + 'k', (0.05, 0.05, 0.05))).parent = r
    return r


def t_abertura():
    cam, alvo = preparar(TOMADAS['abertura'])
    fim = s2q(TOMADAS['abertura'])
    a = apresentador('ian', (0.38, -0.5, 0), altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'apontar_e', s2q(0.6), fim)
    cel = celular((-0.38, 0.35, 1.1), escala=1.15)
    conversa(cel, mostrar=s2q(1.6))
    titulo('t', 'PRA ONDE VAI\nSUA MENSAGEM?', (0, PAREDE - 0.1, 2.45), cor_fundo=VERDE_ZAP, largura=1.45, altura=0.5, tam=0.14)
    e = etiqueta('env', 'ENVIAR', VERDE_ZAP, (1, 1, 1), (-0.38, 0.25, 0.6), largura=0.5, altura=0.16, tam=0.08)
    chave(e, 'scale', s2q(1.5), (1, 1, 1))
    chave(e, 'scale', s2q(1.6), (0.85, 0.85, 0.85))
    chave(e, 'scale', s2q(1.75), (1, 1, 1), 'BACK')
    cam_suave(cam, alvo, [(1, (0, -2.45, 1.4), (0, 0.4, 1.4)), (fim, (0, -2.75, 1.32), (0, 0.4, 1.32))])


def t_cadeado():
    cam, alvo = preparar(TOMADAS['cadeado'])
    fim = s2q(TOMADAS['cadeado'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(2.8))
    gesto(a, 'apontar_e', s2q(3.0), fim)
    m = etiqueta('msg', 'Oi! Tudo bem?', (0.82, 0.97, 0.75), (0.1, 0.1, 0.12), (-0.35, PRAT, 1.75), largura=0.9, altura=0.3, tam=0.11)
    aparecer(m, 3)
    c, alca = cadeado('cad', (-0.35, PRAT - 0.15, 1.42), escala=1.3)
    chave(c, 'location', 1, (-0.35, PRAT - 0.15, 3.2), 'CONSTANT')
    chave(c, 'location', s2q(0.6), (-0.35, PRAT - 0.15, 3.2), 'BOUNCE')
    chave(c, 'location', s2q(1.3), (-0.35, PRAT - 0.15, 1.42))
    chave(alca, 'location', 1, (0, 0, 0.25), 'CONSTANT')
    chave(alca, 'location', s2q(1.5), (0, 0, 0.25), 'BACK')
    chave(alca, 'location', s2q(1.8), (0, 0, 0.15))
    titulo('tr', 'TRANCADA', (-0.35, PRAT - 0.2, 2.25), cor_fundo=(0.1, 0.1, 0.12), largura=0.95, altura=0.28, tam=0.14, quadro=s2q(1.8))
    k = chave_ouro('key', (-0.2, -0.2, 0.95), escala=1.4)
    aparecer(k, s2q(3.2))
    flutuar(k, s2q(3.2), fim)
    e = etiqueta('so', 'SÓ O OUTRO CELULAR\nTEM A CHAVE', OURO, (0.1, 0.1, 0.12), (-0.35, -0.2, 0.62), largura=1.0, altura=0.3, tam=0.08)
    aparecer(e, s2q(3.5))
    cam_padrao(cam, alvo, fim)


def t_pacotes():
    cam, alvo = preparar(TOMADAS['pacotes'])
    fim = s2q(TOMADAS['pacotes'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'susto', s2q(0.6), s2q(2.2))
    gesto(a, 'explicar', s2q(2.3), fim)
    bloco_ = caixa('inteiro', (0.9, 0.3, 0.3), (-0.3, PRAT, 1.7), material('intm', VERDE_ZAP, rough=0.35), bevel=0.04)
    sumir(bloco_, s2q(0.9), dur=3)
    random.seed(2)
    for i in range(6):
        x0 = -0.3 + (i % 3 - 1) * 0.28
        z0 = 1.62 + (i // 3) * 0.17
        p = pacote(f'pk{i}', (x0, PRAT, z0), i + 1)
        chave(p, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
        chave(p, 'scale', s2q(0.9), (1, 1, 1), 'CONSTANT')
        chave(p, 'location', s2q(0.9), (x0, PRAT, z0), 'BACK')
        destino = (-0.75 + i * 0.24, PRAT - 0.2 * random.random(), 1.6 + random.uniform(-0.15, 0.25))
        chave(p, 'location', s2q(1.5), destino)
        chave(p, 'rotation_euler', s2q(0.9), (0, 0, 0))
        chave(p, 'rotation_euler', s2q(1.5), (0, math.radians(random.uniform(-25, 25)), math.radians(random.uniform(-30, 30))))
        flutuar(p, s2q(1.6), fim, amp=0.03, periodo=24 + i * 4)
    titulo('t', 'PACOTES', (-0.2, PRAT + 0.1, 2.3), cor_fundo=OURO, cor_texto=(0.1, 0.1, 0.12), largura=1.0, altura=0.3, tam=0.15, quadro=s2q(1.8))
    cam_padrao(cam, alvo, fim, chegar=0.35)


def t_caminho():
    cam, alvo = preparar(TOMADAS['caminho'])
    fim = s2q(TOMADAS['caminho'])
    cel = celular((-1.05, 0.4, 0.75), escala=0.75)
    conversa(cel)
    roteador('wifi', (-0.25, 0.4, 0.75))
    caixa('mesa', (0.8, 0.5, 0.75), (-0.25, 0.4, 0.375), material('mesam', (0.75, 0.55, 0.35), rough=0.6))
    for k in range(3):
        onda(f'w{k}', (-0.25, 0.25, 1.1), s2q(0.3) + k * 18, raio_final=0.6, dur=22, cor=(0.2, 0.8, 1.0))
    cinza = material('cabo', (0.15, 0.15, 0.18), rough=0.4)
    cilindro('cabo1', 0.04, 1.8, (0.65, 0.3, 0.06), cinza, rot=(0, math.pi / 2, 0))
    cilindro('cabo2', 0.04, 0.75, (-0.25, 0.65, 0.4), cinza)
    # o caminho dos pacotes: celular → roteador → cabo no chão → some à direita
    rota = [(-1.05, 0.3, 1.0), (-0.25, 0.3, 0.95), (-0.25, 0.3, 0.12), (1.6, 0.25, 0.12)]
    for i in range(6):
        p = pacote(f'pk{i}', rota[0], i + 1, lado=0.12)
        q = s2q(0.4) + i * 7
        chave(p, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
        chave(p, 'scale', q, (1, 1, 1), 'CONSTANT')
        for j, pt in enumerate(rota):
            chave(p, 'location', q + j * 30, pt, 'LINEAR')
    t = etiqueta('t1', 'WI-FI', (0.2, 0.6, 1.0), (1, 1, 1), (-0.25, 0.1, 1.55), largura=0.5, altura=0.2, tam=0.1)
    aparecer(t, s2q(0.6))
    t2 = etiqueta('t2', 'CABOS', (0.1, 0.1, 0.12), (1, 1, 1), (0.6, 0.0, 0.45), largura=0.55, altura=0.2, tam=0.1)
    aparecer(t2, s2q(2.6))
    t3 = titulo('t3', 'ATÉ O FUNDO\nDO MAR', (0.45, 0.4, 2.0), cor_fundo=(0.1, 0.4, 0.8), largura=1.2, altura=0.46, tam=0.14, quadro=s2q(4.2))
    cam_suave(cam, alvo, [(1, (-0.5, -2.6, 1.5), (-0.5, 0.4, 1.0)), (s2q(3.0), (0.0, -2.8, 1.4), (0.0, 0.4, 0.9)), (fim, (0.5, -2.7, 1.2), (0.5, 0.4, 0.6))])


def t_mar():
    cam, alvo = preparar(TOMADAS['mar'], parede=(0.05, 0.25, 0.5), piso=(0.5, 0.44, 0.3))
    fim = s2q(TOMADAS['mar'])
    w = bpy.context.scene.world.node_tree.nodes['Background']
    w.inputs[0].default_value = (0.02, 0.2, 0.45, 1)
    luz('agua', 'AREA', (0, 0.2, 3.5), 300, alvo=(0, 0.3, 0), cor=(0.4, 0.75, 1.0), tamanho=4)
    cabo = cilindro('cabo', 0.09, 6, (0, 0.35, 0.1), material('cabo', (0.12, 0.12, 0.14), rough=0.4), rot=(0, math.pi / 2, 0))
    m = material('luzpk', (0.3, 1.0, 0.5), emissao=(0.3, 1.0, 0.5), forca=5)
    for i in range(8):
        b = esfera(f'pk{i}', 0.07, (-2.0, 0.24, 0.12), m)
        q = 2 + i * 14
        chave(b, 'location', 1, (-2.0, 0.24, 0.12), 'CONSTANT')
        chave(b, 'location', q, (-2.0, 0.24, 0.12), 'LINEAR')
        chave(b, 'location', q + 50, (2.0, 0.24, 0.12), 'LINEAR')
    random.seed(9)
    for i in range(6):
        y = random.uniform(-0.2, 1.0)
        z = random.uniform(0.5, 2.4)
        f = peixe(f'peixe{i}', (1.6, y, z), CORES[i % len(CORES)], escala=random.uniform(0.9, 1.5))
        chave(f, 'location', 1, (1.6 + i * 0.3, y, z), 'LINEAR')
        chave(f, 'location', fim, (-1.6 + i * 0.3, y, z + random.uniform(-0.2, 0.2)), 'LINEAR')
    for i in range(14):
        b = esfera(f'bolha{i}', random.uniform(0.015, 0.035), (random.uniform(-0.9, 0.9), random.uniform(-0.3, 0.6), 0.2),
                   material('bolha', (0.8, 0.95, 1.0), emissao=(0.8, 0.95, 1.0), forca=1.5))
        chave(b, 'location', 1, tuple(b.location), 'LINEAR')
        chave(b, 'location', fim, (b.location.x + random.uniform(-0.1, 0.1), b.location.y, random.uniform(2.0, 3.0)), 'LINEAR')
    for i, (x, h) in enumerate(((-0.9, 0.6), (-0.6, 0.4), (0.8, 0.7), (0.95, 0.45))):
        alga = cilindro(f'alga{i}', 0.03, h, (x, 0.7, h / 2), material('alga', (0.2, 0.6, 0.3), rough=0.6))
        tremer(alga, 1, fim, graus=6, passo=20)
    t = titulo('t', 'CABO NO FUNDO\nDO OCEANO', (0, 0.6, 1.9), cor_fundo=OURO, cor_texto=(0.1, 0.1, 0.12), largura=1.3, altura=0.5, tam=0.14, quadro=s2q(0.7))
    e = etiqueta('cont', 'LIGA OS CONTINENTES', (1, 1, 1), (0.1, 0.1, 0.12), (0, 0.1, 0.55), largura=1.2, altura=0.2, tam=0.08)
    aparecer(e, s2q(2.6))
    cam_suave(cam, alvo, [(1, (-0.3, -2.3, 0.8), (0, 0.35, 0.9)), (fim, (0.3, -2.1, 0.7), (0, 0.35, 0.85))])


def t_servidor():
    cam, alvo = preparar(TOMADAS['servidor'])
    fim = s2q(TOMADAS['servidor'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(4.0))
    gesto(a, 'pensando', s2q(4.6), fim)
    for i, x in enumerate((-0.85, -0.25, 0.35)):
        servidor(f'srv{i}', (x, 0.85, 0), altura=1.9 if i != 1 else 2.1)
    titulo('t', 'SERVIDOR', (-0.25, 0.4, 2.45), cor_fundo=(0.1, 0.1, 0.12), largura=1.0, altura=0.3, tam=0.15)
    for i in range(6):
        p = pacote(f'pk{i}', (-1.4, 0.3, 1.0 + i * 0.12), i + 1, lado=0.12)
        q = s2q(0.3) + i * 6
        chave(p, 'location', 1, (-1.6, 0.3, 1.0 + (i % 3) * 0.15), 'CONSTANT')
        chave(p, 'location', q, (-1.6, 0.3, 1.0 + (i % 3) * 0.15), 'LINEAR')
        chave(p, 'location', q + 30, (-0.25 + (i % 3 - 1) * 0.15, 0.4, 1.05 + (i // 3) * 0.15))
        c, _ = cadeado(f'mini{i}', (0, -0.09, 0.05), escala=0.25)
        c.parent = p
    e = etiqueta('guarda', 'GUARDA E REPASSA', OURO, (0.1, 0.1, 0.12), (-0.25, 0.1, 1.6), largura=1.15, altura=0.2, tam=0.09)
    aparecer(e, s2q(2.6))
    b = balao('ler', 'Não consigo ler!', (-0.25, 0.05, 1.95), meu=False, largura=0.95, tam=0.09)
    aparecer(b, s2q(4.7))
    c2, _ = cadeado('grande', (-0.65, 0.0, 0.7), escala=1.2)
    aparecer(c2, s2q(5.3))
    cam_padrao(cam, alvo, fim)


def t_chega():
    cam, alvo = preparar(TOMADAS['chega'])
    fim = s2q(TOMADAS['chega'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(4.4))
    pose(a, 'comemorar', s2q(5.2), 'BACK')
    pulinho(a, s2q(5.2), 0.1)
    pose(a, 'comemorar', fim)
    cel = celular((-0.35, 0.35, 1.5), escala=1.15)
    topo = caixa('zap_topo', (0.57, 0.012, 0.12), (0, -0.04, 0.45), material('zapt', (0.05, 0.45, 0.35), emissao=(0.05, 0.45, 0.35), forca=0.3))
    topo.parent = cel
    random.seed(6)
    for i in range(6):
        p = pacote(f'pk{i}', (0, 0, 0), i + 1, lado=0.11)
        ini = (random.uniform(-1.3, 0.8), random.uniform(-0.6, 0.2), random.uniform(2.6, 3.0))
        chave(p, 'location', 1, ini, 'CONSTANT')
        chave(p, 'location', s2q(0.3) + i * 4, ini, 'LINEAR')
        chave(p, 'location', s2q(1.8) + i * 4, (-0.35 + (i % 3 - 1) * 0.12, 0.1, 1.72 + (i // 3) * 0.12))
        chave(p, 'scale', s2q(3.0), (1, 1, 1))
        chave(p, 'scale', s2q(3.3), (0.001, 0.001, 0.001), 'CONSTANT')
    c, alca = cadeado('cad', (-0.35, 0.1, 1.78), escala=0.9)
    chave(c, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(c, 'scale', s2q(3.1), (0.9, 0.9, 0.9), 'BACK')
    chave(alca, 'location', s2q(3.6), (0, 0, 0.15), 'BACK')
    chave(alca, 'location', s2q(4.1), (0, 0, 0.3))
    chave(c, 'scale', s2q(4.4), (0.9, 0.9, 0.9))
    chave(c, 'scale', s2q(4.7), (0.001, 0.001, 0.001), 'CONSTANT')
    m = etiqueta('msg', 'Oi! Tudo bem?', (0.82, 0.97, 0.75), (0.1, 0.1, 0.12), (-0.33, 0.27, 1.72), largura=0.56, altura=0.17, tam=0.075)
    aparecer(m, s2q(4.6))
    risquinhos('ok', (-0.2, 0.25, 1.56), s2q(5.3), escala=1.6)
    t = titulo('t', 'ENTREGUE!', (-0.35, 0.0, 2.55), cor_fundo=(0.2, 0.6, 1.0), largura=1.05, altura=0.3, tam=0.14, quadro=s2q(5.4))
    cam_suave(cam, alvo, [(1, (0, -2.75, 1.5), (0, 0.4, 1.55)), (fim, (-0.15, -2.4, 1.55), (-0.15, 0.4, 1.6))])


def t_fim():
    cam, alvo = preparar(TOMADAS['fim'])
    fim = s2q(TOMADAS['fim'])
    a = apresentador('ian', (0.0, -0.45, 0), altura=1.2, giro=0)
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(1.9))
    gesto(a, 'acenar', s2q(2.1), fim)
    relogio('rel', (0, PAREDE - 0.05, 2.2), raio=0.38, quadro_ini=1, quadro_fim=fim, voltas=1)
    titulo('t', 'MENOS DE\n1 SEGUNDO', (0, PRAT, 1.6), cor_fundo=VERDE_ZAP, largura=1.0, altura=0.46, tam=0.13, quadro=s2q(0.4))
    confete((0, 0.0, 2.1), s2q(0.6), n=40)
    cam_suave(cam, alvo, [(1, (0, -2.5, 1.4), (0, 0.4, 1.45)), (fim, (0, -2.85, 1.42), (0, 0.4, 1.45))])


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('cf_whatsapp', TOMADAS, TOMADA_FN)
