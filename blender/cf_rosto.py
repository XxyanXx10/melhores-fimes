"""
Série "Como funciona" — "Como o celular reconhece o seu rosto?" (pontinhos de luz, medidas, lista de números).

    blender -b --factory-startup --python blender/cf_rosto.py -- <tomada|todas> [--teste]

Os pontinhos são projetados de verdade no rosto do personagem (ray cast na malha), por isso nos closes
ele fica parado em (0, 0, 0) olhando para a câmera. Medidas do rosto (altura 1.15): olhos z 0.85 (x ±0.08),
nariz z 0.80, boca 0.77, queixo 0.72; a frente do rosto fica em y ≈ -0.17.
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from como_funciona import *  # noqa: E402,F401,F403
from cf_whatsapp import cadeado, risquinhos  # noqa: E402
from mathutils import Vector

TOMADAS = {
    'abertura': 6.42,   # "Como o celular reconhece o seu rosto? Ele não guarda uma foto sua. Ele guarda números."
    'pontos': 7.13,     # "No iPhone… trinta mil pontinhos de luz invisível na sua cara."
    'mede': 5.18,       # "Aí ele mede tudo: a distância entre os olhos, o nariz, o queixo."
    'lista': 5.19,      # "Cada medida vira um número… uma lista de números, tipo uma senha."
    'compara': 9.84,    # "Quando você pega o celular… compara as duas listas. Bateu? Desbloqueia. Não bateu? Trancado."
    'foto': 4.60,       # "Por isso uma foto sua não engana ele: a foto é lisa, não tem profundidade."
    'fim': 7.03,        # "ele te reconhece de óculos, de barba, ou acabando de acordar. Comenta aí."
}
VERMELHO_IR = (1.0, 0.15, 0.1)
NUMEROS = ['62', '41', '38', '77', '15', '93']
CLOSE_CAM = (0, -1.15, 0.86)
CLOSE_ALVO = (0, 0, 0.86)


def foto_personagem(nome, loc, png='feliz', larg=0.5, alt=0.5):
    """a "foto sua": o desenho 2D do personagem num papel"""
    r = vazio(nome, loc)
    caixa(nome + '_m', (larg + 0.06, 0.012, alt + 0.1), (0, 0, -0.02), material(nome + 'b', (0.97, 0.97, 0.95), rough=0.6)).parent = r
    m = bpy.data.materials.new(nome + 'img')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(f'D:/Edição de video simplificado/public/midia/personagem/{png}.png')
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 0.3
    fundo = caixa(nome + '_f', (larg, 0.006, alt), (0, -0.008, 0.01), material(nome + 'fd', (0.45, 0.3, 0.75), rough=0.6))
    fundo.parent = r
    p = plano(nome + '_p', (larg, alt), (0, -0.013, 0.01), m, rot=(math.pi / 2, 0, 0))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    p.parent = r
    return r


def pontos_no_rosto(arm, ini, fim, passo=0.012, x=(-0.17, 0.17), z=(0.68, 1.02), sumir_em=None):
    """grade de pontinhos vermelhos colada na malha, aparecendo de cima para baixo entre ini e fim"""
    bpy.context.view_layer.update()
    malha = next(o for o in arm.children if o.type == 'MESH')
    dg = bpy.context.evaluated_depsgraph_get()
    sc = bpy.context.scene
    m = material('ir', VERMELHO_IR, emissao=VERMELHO_IR, forca=6)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.0028, subdivisions=1)
    base = bpy.context.active_object
    base.data.materials.append(m)
    malha_ponto = base.data
    bpy.data.objects.remove(base)
    nz = int((z[1] - z[0]) / passo)
    nx = int((x[1] - x[0]) / passo)
    n = 0
    for i in range(nz):
        zz = z[1] - i * passo
        q = ini + int((fim - ini) * i / max(1, nz - 1))
        for j in range(nx):
            xx = x[0] + j * passo + (passo / 2 if i % 2 else 0)
            ok, loc, nor, idx, ob, _ = sc.ray_cast(dg, Vector((xx, -2, zz)), Vector((0, 1, 0)))
            if not ok or ob != malha:
                continue
            o = bpy.data.objects.new(f'ir{n}', malha_ponto)
            sc.collection.objects.link(o)
            o.location = loc - Vector((0, 0.002, 0))
            chave(o, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
            chave(o, 'scale', q, (1, 1, 1), 'CONSTANT')
            if sumir_em:
                chave(o, 'scale', sumir_em + (i % 4), (0.001, 0.001, 0.001), 'CONSTANT')
            n += 1
    return n


def afinar_letras(*nomes):
    """no close as letras são pequenas: a extrusão padrão da etiqueta engrossa e borra o contorno"""
    for n in nomes:
        t = bpy.data.objects[n + '_txt']
        t.data.extrude = 0.0012
        t.data.bevel_depth = 0.0003


def regua(nome, a, b, quadro, cor=(0.2, 0.9, 1.0)):
    """linha de medida entre dois pontos (com bolinhas nas pontas), crescendo do meio"""
    a, b = Vector(a), Vector(b)
    meio = (a + b) / 2
    d = b - a
    r = vazio(nome, tuple(meio))
    m = material(nome + 'm', cor, emissao=cor, forca=3)
    linha = caixa(nome + '_l', (d.length, 0.004, 0.004), (0, 0, 0), m)
    linha.parent = r
    r.rotation_euler = (0, -math.atan2(d.z, d.x), 0)
    for k, s in enumerate((-1, 1)):
        esfera(f'{nome}_p{k}', 0.008, (s * d.length / 2, 0, 0), m).parent = r
    aparecer(r, quadro, dur=6)
    return r


def coluna(prefixo, x, z0, cor, quadro0, passo=4, numeros=NUMEROS, y=PRAT):
    blocos = []
    for i, n in enumerate(numeros):
        b = bloco(f'{prefixo}{i}', n, (x, y, z0 - i * 0.2), cor)
        aparecer(b, quadro0 + i * passo)
        blocos.append(b)
    return blocos


def t_abertura():
    cam, alvo = preparar(TOMADAS['abertura'])
    fim = s2q(TOMADAS['abertura'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'apontar_e', 4, s2q(2.3))
    gesto(a, 'explicar', s2q(2.5), fim)
    cel = celular((-0.4, 0.4, 1.45), escala=1.0)
    c, _ = cadeado('cad', (-0.4, 0.33, 1.6), escala=0.7)
    titulo('t', 'COMO ELE RECONHECE\nO SEU ROSTO?', (0, PAREDE - 0.1, 2.5), cor_fundo=(0.92, 0.2, 0.2), largura=1.55, altura=0.5, tam=0.13)
    f = foto_personagem('foto', (0.0, -0.1, 1.05), larg=0.42, alt=0.42)
    chave(f, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(f, 'scale', s2q(2.4), (0.001, 0.001, 0.001), 'BACK')
    chave(f, 'scale', s2q(2.7), (1, 1, 1))
    chave(f, 'scale', s2q(4.4), (1, 1, 1))
    chave(f, 'scale', s2q(4.6), (0.001, 0.001, 0.001), 'CONSTANT')
    x = carimbo('nao', 'NÃO É FOTO', (0.0, -0.2, 1.05), s2q(3.2), largura=0.85, altura=0.24, tam=0.12)
    chave(x, 'scale', s2q(4.4), (1, 1, 1))
    chave(x, 'scale', s2q(4.6), (0.001, 0.001, 0.001), 'CONSTANT')
    random.seed(1)
    for i in range(18):
        b = bloco(f'n{i}', random.choice(['0', '1', '7', '3', '9', '42', '15']), (random.uniform(-1.0, 0.2), random.uniform(-0.1, 0.6), 0), CORES[i % 5])
        b.rotation_euler = (0, 0, math.radians(random.uniform(-20, 20)))
        cair(b, s2q(4.6) + i * 2, altura=2.4, dur=7)
    cam_padrao(cam, alvo, fim)


def t_pontos():
    cam, alvo = preparar(TOMADAS['pontos'])
    fim = s2q(TOMADAS['pontos'])
    a = apresentador('ian', (0, 0, 0), altura=1.15, giro=0)
    pose(a, 'bracos_baixo', 1)
    cam.data.dof.aperture_fstop = 16   # close: rótulos na frente do rosto também nítidos
    n = pontos_no_rosto(a, s2q(2.0), s2q(5.0))
    print('pontinhos:', n)
    cel = celular((-0.26, -0.45, 0.75), escala=0.22)
    cel.rotation_euler = (0, 0, math.radians(-25))
    flutuar(cel, 1, fim, amp=0.01)
    m = material('feixe', VERMELHO_IR, emissao=VERMELHO_IR, forca=2)
    for k in range(3):
        onda(f'f{k}', (-0.26, -0.43, 0.82), s2q(1.6) + k * 14, raio_final=0.2, dur=16, cor=VERMELHO_IR)
    e = etiqueta('n', '30.000 PONTINHOS', (0.1, 0.1, 0.12), (1, 1, 1), (0, -0.25, 1.12), largura=0.55, altura=0.08, tam=0.042)
    aparecer(e, s2q(3.7))
    i = etiqueta('inv', 'LUZ INVISÍVEL', VERMELHO_IR, (1, 1, 1), (0.0, -0.25, 0.6), largura=0.42, altura=0.07, tam=0.038)
    aparecer(i, s2q(5.4))
    afinar_letras('n', 'inv')
    cam_suave(cam, alvo, [(1, (0.12, -1.35, 0.9), (0, 0, 0.86)), (fim, (-0.05, -1.05, 0.86), (0, 0, 0.85))])


def t_mede():
    cam, alvo = preparar(TOMADAS['mede'])
    fim = s2q(TOMADAS['mede'])
    a = apresentador('ian', (0, 0, 0), altura=1.15, giro=0)
    pose(a, 'bracos_baixo', 1)
    cam.data.dof.aperture_fstop = 16   # close: rótulos na frente do rosto também nítidos
    pontos_no_rosto(a, 1, 2, passo=0.016)
    y = -0.235
    regua('olhos', (-0.085, y, 0.855), (0.085, y, 0.855), s2q(1.4))
    regua('nariz', (0.0, y, 0.835), (0.0, y, 0.79), s2q(2.6), cor=(1.0, 0.85, 0.2))
    regua('queixo', (-0.06, y + 0.04, 0.715), (0.06, y + 0.04, 0.715), s2q(3.5), cor=(0.4, 1.0, 0.5))
    for k, (txt, z, q, cor) in enumerate((('OLHOS', (0, 0.93), 1.5, (0.2, 0.75, 0.95)), ('NARIZ', (-0.14, 0.8), 2.7, (0.98, 0.72, 0.2)), ('QUEIXO', (0, 0.665), 3.6, (0.35, 0.78, 0.45)))):
        e = etiqueta(f'e{k}', txt, cor, (1, 1, 1), (z[0], -0.27, z[1]), largura=0.17, altura=0.055, tam=0.03)
        aparecer(e, s2q(q))
    afinar_letras('e0', 'e1', 'e2')
    cam_suave(cam, alvo, [(1, (0, -1.0, 0.86), (0, 0, 0.83)), (fim, (0, -0.9, 0.85), (0, 0, 0.82))])


def t_lista():
    cam, alvo = preparar(TOMADAS['lista'])
    fim = s2q(TOMADAS['lista'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, fim)
    coluna('n', -0.45, 2.35, AZUL_B, s2q(0.3), passo=5)
    c, _ = cadeado('cad', (0.15, 0.3, 1.95), escala=0.9)
    aparecer(c, s2q(3.6))
    t = titulo('t', 'SEU ROSTO\n= SENHA', (0.15, 0.3, 2.45), cor_fundo=(0.1, 0.1, 0.12), largura=0.8, altura=0.42, tam=0.12, quadro=s2q(3.2))
    cam_padrao(cam, alvo, fim)


def t_compara():
    cam, alvo = preparar(TOMADAS['compara'])
    fim = s2q(TOMADAS['compara'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(5.8))
    pose(a, 'comemorar', s2q(6.7), 'BACK')
    pose(a, 'comemorar', s2q(7.5))
    gesto(a, 'susto', s2q(8.4), fim - 2)
    for k, (txt, x) in enumerate((('SALVO', -0.65), ('AGORA', 0.05))):
        e = etiqueta(f'h{k}', txt, (0.1, 0.1, 0.12), (1, 1, 1), (x, PRAT - 0.05, 2.62), largura=0.45, altura=0.16, tam=0.08)
        aparecer(e, s2q(0.3) + k * 30)
    coluna('s', -0.65, 2.35, AZUL_B, s2q(0.4), passo=2)
    agora = coluna('a', 0.05, 2.35, AZUL_B, s2q(1.6), passo=6)
    for i in range(6):
        ig = etiqueta(f'ig{i}', '=', (0.35, 0.78, 0.45), (1, 1, 1), (-0.3, PRAT - 0.1, 2.44 - i * 0.2), largura=0.14, altura=0.14, tam=0.1)
        aparecer(ig, s2q(4.0) + i * 4)
    carimbo('ok', 'DESBLOQUEIA!', (-0.3, PRAT - 0.5, 1.55), s2q(6.75), cor=(0.15, 0.7, 0.35), largura=1.0, altura=0.24, tam=0.12, giro=6)
    ok2 = bpy.data.objects['ok']
    chave(ok2, 'scale', s2q(7.6), (1, 1, 1))
    chave(ok2, 'scale', s2q(7.7), (0.001, 0.001, 0.001), 'CONSTANT')
    # "não bateu": a coluna de agora troca por números vermelhos errados
    errados = ['18', '40', '91', '22', '57', '30']
    for i, b in enumerate(agora):
        chave(b, 'scale', s2q(7.6), (1, 1, 1))
        chave(b, 'scale', s2q(7.7), (0.001, 0.001, 0.001), 'CONSTANT')
        e = bloco(f'x{i}', errados[i], (0.05, PRAT, 2.35 - i * 0.2), (0.92, 0.2, 0.2))
        chave(e, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
        chave(e, 'scale', s2q(7.7), (1, 1, 1), 'CONSTANT')
        tremer(e, s2q(7.8), s2q(8.6), graus=10)
    carimbo('no', 'TRANCADO!', (-0.3, PRAT - 0.5, 1.5), s2q(8.4), largura=0.9, altura=0.24, tam=0.12)
    cam_suave(cam, alvo, [(1, (0, -2.75, 1.55), (0, 0.4, 1.65)), (fim, (-0.05, -2.5, 1.6), (0, 0.4, 1.7))])


def t_foto():
    cam, alvo = preparar(TOMADAS['foto'])
    fim = s2q(TOMADAS['foto'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'apontar_e', s2q(0.3), fim)
    f = foto_personagem('foto', (-0.35, PRAT - 0.2, 1.75), larg=0.8, alt=0.8)
    aparecer(f, 3)
    m = material('ir', VERMELHO_IR, emissao=VERMELHO_IR, forca=6)
    q0 = s2q(1.0)
    for i in range(14):
        for j in range(14):
            p = esfera(f'p{i}_{j}', 0.006, (-0.35 - 0.36 + j * 0.055, PRAT - 0.24, 1.75 + 0.36 - i * 0.055), m)
            chave(p, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
            chave(p, 'scale', q0 + i, (1, 1, 1), 'CONSTANT')
    e = etiqueta('lisa', 'LISA: SEM PROFUNDIDADE', (0.1, 0.1, 0.12), (1, 1, 1), (-0.35, PRAT - 0.3, 2.35), largura=1.25, altura=0.18, tam=0.075)
    aparecer(e, s2q(2.3))
    carimbo('ng', 'NÃO ENGANA!', (-0.35, PRAT - 0.45, 1.3), s2q(1.6), largura=0.95, altura=0.26, tam=0.13)
    cam_padrao(cam, alvo, fim)


def t_fim():
    cam, alvo = preparar(TOMADAS['fim'])
    fim = s2q(TOMADAS['fim'])
    a = apresentador('ian', (0.0, -0.45, 0), altura=1.2, giro=0)
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(4.6))
    gesto(a, 'acenar', s2q(4.9), fim)
    for k, (txt, q) in enumerate((('DE ÓCULOS', 1.0), ('DE BARBA', 1.9), ('ACABOU DE ACORDAR', 2.9))):
        e = etiqueta(f'c{k}', txt, (1, 1, 1), (0.1, 0.1, 0.12), (-0.1, PRAT - 0.2, 2.45 - k * 0.3), largura=1.1, altura=0.22, tam=0.09)
        aparecer(e, s2q(q))
        risquinhos(f'ok{k}', (0.55, PRAT - 0.25, 2.45 - k * 0.3), s2q(q) + 8, escala=1.6)
    confete((0, 0.0, 2.1), s2q(3.2), n=40)
    cam_suave(cam, alvo, [(1, (0, -2.5, 1.45), (0, 0.4, 1.5)), (fim, (0, -2.85, 1.45), (0, 0.4, 1.5))])


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('cf_rosto', TOMADAS, TOMADA_FN)
