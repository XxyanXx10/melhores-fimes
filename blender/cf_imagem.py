"""
Série "Como funciona" — "Como a IA cria uma imagem do nada?" (difusão: começa no chuvisco e vai limpando).

    blender -b --factory-startup --python blender/cf_imagem.py -- <tomada|todas> [--teste]
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from como_funciona import *  # noqa: E402,F401,F403

TOMADAS = {
    'abertura': 4.22,    # "Como a IA cria uma imagem do nada? Ela não pinta. Ela limpa."
    'chuvisco': 6.70,    # "Ela começa com uma tela cheia de chuvisco… Aí você pede: um gato de óculos."
    'limpa': 9.10,       # "E ela começa a tirar o chuvisco… se aqui tivesse um gato de óculos…"
    'passos': 7.34,      # "Passo um: só borrão. Passo dez: uma forma. Passo trinta: orelha, bigode, óculos."
    'aprendeu': 11.84,   # "Mas como ela aprendeu? Milhões de fotos, sujaram… aprendeu a limpar uma que nunca existiu."
    'diferente': 6.21,   # "Por isso cada imagem sai diferente… Você sabia disso? Comenta aí."
}
TV = (-0.1, 0.6, 1.85)


def gato(nome, loc, cor=(0.95, 0.6, 0.25), escala=1.0, oculos=True):
    """gatinho de brinquedo olhando para a câmera"""
    r = vazio(nome, loc)
    r.scale = (escala, escala, escala)
    pelo = material(nome + 'pelo', cor, rough=0.7)
    preto = bpy.data.materials.get('gato_preto') or material('gato_preto', (0.04, 0.04, 0.05), rough=0.3)
    rosa = bpy.data.materials.get('gato_rosa') or material('gato_rosa', (0.98, 0.55, 0.6), rough=0.5)
    branco = bpy.data.materials.get('gato_branco') or material('gato_branco', (0.97, 0.97, 0.97), rough=0.5)
    partes = [esfera(nome + '_corpo', 0.2, (0, 0.06, -0.28), pelo, achatar=0.9),
              esfera(nome + '_cab', 0.28, (0, 0, 0), pelo, achatar=0.88),
              esfera(nome + '_foc', 0.11, (0, -0.22, -0.07), branco, achatar=0.7),
              esfera(nome + '_nar', 0.035, (0, -0.31, -0.03), rosa)]
    for lado in (-1, 1):
        bpy.ops.mesh.primitive_cone_add(radius1=0.1, radius2=0.0, depth=0.18, location=(lado * 0.16, 0.0, 0.26), rotation=(0, lado * 0.35, 0), vertices=24)
        o = bpy.context.active_object
        o.name = f'{nome}_orelha{lado}'
        o.data.materials.append(pelo)
        partes.append(o)
        partes.append(esfera(f'{nome}_olho{lado}', 0.045, (lado * 0.1, -0.24, 0.06), preto))
        for k in (-1, 1):
            b = caixa(f'{nome}_big{lado}{k}', (0.2, 0.005, 0.006), (lado * 0.2, -0.27, -0.06 + k * 0.025), preto)
            b.rotation_euler = (0, lado * k * 0.15, 0)
            partes.append(b)
    if oculos:
        aro = bpy.data.materials.get('oculos') or material('oculos', (0.08, 0.08, 0.1), rough=0.2, metal=0.4)
        for lado in (-1, 1):
            partes.append(anel(f'{nome}_lente{lado}', 0.075, 0.012, (lado * 0.1, -0.29, 0.06), aro, rot=(math.pi / 2, 0, 0)))
        partes.append(caixa(nome + '_ponte', (0.05, 0.012, 0.012), (0, -0.3, 0.08), aro))
    for o in partes:
        o.parent = r
    return r


def chuvisco_mat(nome, quadro_fim, opaco=None, semente=0.0):
    """chuvisco de TV fora do ar, fervendo; opaco = [(quadro, 0..1)] some aos poucos (1 = só chuvisco)"""
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    saida = nt.nodes.new('ShaderNodeOutputMaterial')
    mix = nt.nodes.new('ShaderNodeMixShader')
    transp = nt.nodes.new('ShaderNodeBsdfTransparent')
    emi = nt.nodes.new('ShaderNodeEmission')
    ruido = nt.nodes.new('ShaderNodeTexNoise')
    ruido.noise_dimensions = '4D'
    ruido.inputs['Scale'].default_value = 220
    ruido.inputs['Detail'].default_value = 1.0
    rampa = nt.nodes.new('ShaderNodeValToRGB')
    rampa.color_ramp.elements[0].position = 0.42
    rampa.color_ramp.elements[1].position = 0.58
    emi.inputs['Strength'].default_value = 1.2
    nt.links.new(ruido.outputs['Fac'], rampa.inputs['Fac'])
    nt.links.new(rampa.outputs['Color'], emi.inputs['Color'])
    nt.links.new(transp.outputs[0], mix.inputs[1])
    nt.links.new(emi.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], saida.inputs['Surface'])
    w = ruido.inputs['W']
    w.default_value = semente
    w.keyframe_insert('default_value', frame=1)
    w.default_value = semente + quadro_fim * 0.9
    w.keyframe_insert('default_value', frame=quadro_fim)
    fac = mix.inputs['Fac']
    for q, v in (opaco or [(1, 1.0)]):
        fac.default_value = v
        fac.keyframe_insert('default_value', frame=q)
    for fc in curvas(nt):
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass
    return m


def tv(nome, loc, larg=1.3, alt=0.95, fundo=(0.98, 0.9, 0.7)):
    """moldura funda (caixa sem frente) com fundo colorido; o que vai dentro fica entre o fundo e a frente"""
    r = vazio(nome, loc)
    escuro = material(nome + 'm', (0.12, 0.12, 0.15), rough=0.35)
    p = 0.08
    for nm, d, l in (('cima', (larg + 2 * p, 0.6, p), (0, 0, alt / 2 + p / 2)), ('baixo', (larg + 2 * p, 0.6, p), (0, 0, -alt / 2 - p / 2)),
                     ('esq', (p, 0.6, alt), (-larg / 2 - p / 2, 0, 0)), ('dir', (p, 0.6, alt), (larg / 2 + p / 2, 0, 0))):
        caixa(f'{nome}_{nm}', d, l, escuro, bevel=0.02).parent = r
    caixa(nome + '_fundo', (larg, 0.02, alt), (0, 0.29, 0), material(nome + 'f', fundo, emissao=fundo, forca=0.3)).parent = r
    return r


def painel_chuvisco(nome, pai, larg, alt, mat):
    o = plano(nome, (larg, alt), (0, -0.28, 0), mat, rot=(math.pi / 2, 0, 0))
    o.parent = pai
    return o


def t_abertura():
    cam, alvo = preparar(TOMADAS['abertura'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-20))
    gesto(a, 'explicar', 1, s2q(4.2))
    balancar(a, 1, s2q(4.22))
    t = tv('tv', TV)
    painel_chuvisco('chuv', t, 1.3, 0.95, chuvisco_mat('chuvm', s2q(4.22)))
    titulo('t', 'COMO A IA\nCRIA UMA IMAGEM?', (TV[0], 0.2, TV[2]), cor_fundo=(0.7, 0.45, 0.9), largura=1.3, altura=0.55, tam=0.14)
    carimbo('pinta', 'NÃO PINTA', (-0.35, -0.2, 1.05), s2q(2.4), largura=0.8, altura=0.24, tam=0.13)
    carimbo('limpa', 'ELA LIMPA!', (-0.35, -0.25, 0.75), s2q(3.4), cor=(0.15, 0.7, 0.35), largura=0.85, altura=0.24, tam=0.13, giro=8)
    cam_padrao(cam, alvo, s2q(4.22))


def t_chuvisco():
    cam, alvo = preparar(TOMADAS['chuvisco'])
    fim = s2q(TOMADAS['chuvisco'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'apontar_e', s2q(0.4), s2q(3.8))
    gesto(a, 'explicar', s2q(4.4), fim)
    t = tv('tv', TV)
    painel_chuvisco('chuv', t, 1.3, 0.95, chuvisco_mat('chuvm', fim))
    e = etiqueta('fora', 'TV FORA DO AR', (0.1, 0.1, 0.12), (1, 1, 1), (TV[0], 0.25, TV[2] + 0.66), largura=1.05, altura=0.22, tam=0.11)
    aparecer(e, s2q(2.0))
    b = balao('pedido', '"Um gato\nde óculos"', (-0.45, -0.3, 1.05), meu=True, largura=0.75, tam=0.1)
    aparecer(b, s2q(4.6))
    cam_suave(cam, alvo, [(1, (0, -2.6, 1.55), (TV[0], 0.4, 1.6)), (fim, (0, -2.8, 1.35), (0, 0.4, 1.3))])


def t_limpa():
    cam, alvo = preparar(TOMADAS['limpa'])
    fim = s2q(TOMADAS['limpa'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(3.2))
    gesto(a, 'pensando', s2q(3.4), fim)
    t = tv('tv', TV)
    g = gato('gato', (0, 0.05, 0.0), escala=0.95)
    g.parent = t
    painel_chuvisco('chuv', t, 1.3, 0.95, chuvisco_mat('chuvm', fim, opaco=[(1, 1.0), (s2q(1.0), 1.0), (fim, 0.86)]))
    b = balao('pensa', 'E se aqui tivesse\num gato de óculos?', (-0.3, -0.3, 1.08), meu=False, largura=1.05, tam=0.085)
    aparecer(b, s2q(3.4))
    s = etiqueta('pouco', 'UM POUQUINHO DE CADA VEZ', (0.98, 0.72, 0.2), (0.1, 0.1, 0.12), (TV[0], 0.25, TV[2] + 0.66), largura=1.45, altura=0.2, tam=0.085)
    aparecer(s, s2q(1.6))
    cam_padrao(cam, alvo, fim, chegar=0.3)


def t_passos():
    cam, alvo = preparar(TOMADAS['passos'])
    fim = s2q(TOMADAS['passos'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    pose(a, 'apontar_e', s2q(0.3), 'BACK')
    pose(a, 'apontar_e', s2q(4.6))
    pose(a, 'comemorar', s2q(5.0), 'BACK')
    pulinho(a, s2q(5.0), 0.1)
    pose(a, 'comemorar', fim)
    t = tv('tv', TV)
    g = gato('gato', (0, 0.05, 0.0), escala=0.95)
    g.parent = t
    # passo 1 quase tudo chuvisco; passo 10 aparece a forma; passo 30 limpo
    painel_chuvisco('chuv', t, 1.3, 0.95, chuvisco_mat('chuvm', fim, opaco=[(1, 0.85), (s2q(1.5), 0.8), (s2q(2.0), 0.55), (s2q(3.6), 0.45),
                                                                              (s2q(4.2), 0.12), (s2q(5.2), 0.0)]))
    marcas = []
    for i, (txt, q) in enumerate((('PASSO 1', 0.0), ('PASSO 10', 1.6), ('PASSO 30', 3.8))):
        e = etiqueta(f'p{i}', txt, (0.1, 0.1, 0.12), (1, 1, 1), (TV[0], 0.25, TV[2] + 0.66), largura=0.85, altura=0.24, tam=0.13)
        marcas.append((e, s2q(q)))
    trocar(marcas)
    for i, (txt, q, x, z) in enumerate((('ORELHA', 4.6, -0.45, 2.42), ('BIGODE', 5.0, 0.38, 1.62), ('ÓCULOS', 5.5, -0.5, 1.45))):
        e = etiqueta(f'r{i}', txt, CORES[i], (1, 1, 1), (x, -0.15, z), largura=0.55, altura=0.17, tam=0.085)
        aparecer(e, s2q(q))
    confete((TV[0], 0.2, 2.3), s2q(5.2), n=40, raio=0.8)
    cam_suave(cam, alvo, [(1, (0, -2.75, 1.45), (TV[0], 0.4, 1.6)), (fim, (-0.05, -2.5, 1.55), (TV[0], 0.4, 1.65))])


def polaroide(nome, loc, ceu, morro, giro=0.0):
    """fotinho de papel: moldura branca, céu, sol e morro"""
    r = vazio(nome, loc)
    r.rotation_euler = (0, math.radians(giro), 0)
    branco = bpy.data.materials.get('pol_branco') or material('pol_branco', (0.97, 0.97, 0.95), rough=0.6)
    caixa(nome + '_m', (0.36, 0.015, 0.42), (0, 0, 0), branco).parent = r
    caixa(nome + '_c', (0.3, 0.01, 0.3), (0, -0.01, 0.03), material(nome + 'c', ceu, emissao=ceu, forca=0.25)).parent = r
    sol = bpy.data.materials.get('pol_sol') or material('pol_sol', (1.0, 0.85, 0.2), emissao=(1.0, 0.85, 0.2), forca=0.5)
    cilindro(nome + '_s', 0.045, 0.01, (0.07, -0.017, 0.11), sol, rot=(math.pi / 2, 0, 0)).parent = r
    m = caixa(nome + '_mo', (0.2, 0.01, 0.2), (-0.03, -0.016, -0.08), material(nome + 'mo', morro, rough=0.6))
    m.rotation_euler = (0, math.radians(45), 0)
    m.parent = r
    caixa(nome + '_ch', (0.3, 0.012, 0.06), (0, -0.018, -0.1), material(nome + 'ch', morro, rough=0.6)).parent = r
    return r


def t_aprendeu():
    cam, alvo = preparar(TOMADAS['aprendeu'])
    fim = s2q(TOMADAS['aprendeu'])
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, fim)
    gesto(a, 'pensando', 1, s2q(1.9))
    gesto(a, 'explicar', s2q(2.0), s2q(7.4))
    gesto(a, 'comemorar', s2q(8.0), fim - 2)
    random.seed(21)
    ceus = [(0.55, 0.78, 0.98), (0.98, 0.7, 0.5), (0.7, 0.6, 0.95), (0.6, 0.9, 0.9)]
    morros = [(0.3, 0.7, 0.35), (0.45, 0.55, 0.3), (0.25, 0.5, 0.75), (0.6, 0.4, 0.3)]
    for i in range(36):
        p = polaroide(f'pol{i}', (random.uniform(-1.0, 0.1), random.uniform(0.3, 0.9), 0.02 + (i // 9) * 0.02), ceus[i % 4], morros[i % 4])
        p.rotation_euler = (math.radians(-88), 0, math.radians(random.uniform(-40, 40)))
        cair(p, s2q(1.9) + i * 2, altura=2.0, dur=8)
    titulo('t', 'MILHÕES DE FOTOS', (-0.05, PRAT + 0.2, 2.45), cor_fundo=(0.92, 0.2, 0.2), largura=1.45, altura=0.3, tam=0.14, quadro=s2q(2.2))
    # a foto da vez: suja de chuvisco e volta limpa (o treino)
    f = polaroide('foto', (-0.35, PRAT - 0.25, 1.75), ceus[0], morros[0])
    f.scale = (2.4, 2.4, 2.4)
    aparecer(f, s2q(3.8))
    ch = plano('fsuja', (0.3, 0.3), (0, -0.03, 0.03), chuvisco_mat('fsujam', fim, opaco=[(1, 0.0), (s2q(4.6), 0.0), (s2q(5.2), 0.95),
                                                                                       (s2q(6.0), 0.95), (s2q(7.2), 0.0)], semente=7),
               rot=(math.pi / 2, 0, 0))
    ch.parent = f
    for i, (txt, q, cor) in enumerate((('SUJA', 4.8, (0.1, 0.1, 0.12)), ('LIMPA', 6.6, (0.15, 0.7, 0.35)))):
        e = etiqueta(f'e{i}', txt, cor, (1, 1, 1), (0.35, PRAT - 0.3, 2.05 - i * 0.28), largura=0.5, altura=0.2, tam=0.1)
        aparecer(e, s2q(q))
    n = titulo('nunca', 'UMA FOTO QUE\nNUNCA EXISTIU', (-0.35, PRAT - 0.32, 1.75), cor_fundo=(0.7, 0.45, 0.9), largura=1.1, altura=0.5, tam=0.12, quadro=s2q(9.6))
    n.rotation_euler = (0, math.radians(-4), 0)
    cam_suave(cam, alvo, [(1, (0, -2.6, 1.3), (0, 0.4, 1.2)), (s2q(3.6), (0, -2.75, 1.4), (0, 0.4, 1.35)), (fim, (-0.1, -2.5, 1.45), (-0.1, 0.4, 1.4))])


def t_diferente():
    cam, alvo = preparar(TOMADAS['diferente'])
    fim = s2q(TOMADAS['diferente'])
    a = apresentador('ian', (0.0, -0.5, 0), altura=1.15, giro=0)
    balancar(a, 1, fim)
    gesto(a, 'explicar', 1, s2q(3.8))
    gesto(a, 'acenar', s2q(4.0), fim)
    for i, (x, cor, sem) in enumerate(((-0.52, (0.95, 0.6, 0.25), 0.0), (0.52, (0.55, 0.55, 0.6), 31.0))):
        t = tv(f'tv{i}', (x, 0.6, 2.0), larg=0.88, alt=0.7, fundo=((0.98, 0.9, 0.7) if i == 0 else (0.75, 0.88, 0.98)))
        g = gato(f'gato{i}', (0, 0.05, -0.05), cor=cor, escala=0.68, oculos=True)
        g.parent = t
        painel_chuvisco(f'chuv{i}', t, 0.88, 0.7, chuvisco_mat(f'chuvm{i}', fim, opaco=[(1, 1.0), (s2q(0.6), 1.0), (s2q(2.6), 0.0)], semente=sem))
    e = titulo('d', 'CADA CHUVISCO,\nUMA IMAGEM', (0, PRAT + 0.2, 2.75), cor_fundo=(0.1, 0.65, 0.5), largura=1.4, altura=0.46, tam=0.12, quadro=s2q(2.8))
    cam_suave(cam, alvo, [(1, (0, -2.6, 1.5), (0, 0.4, 1.6)), (fim, (0, -2.9, 1.5), (0, 0.4, 1.6))])


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('cf_imagem', TOMADAS, TOMADA_FN)
