"""
O apresentador do canal em 3D (a versão boneco/brinquedo do personagem 2D do dono):
cabelo black power cacheado, pele morena, olhos grandes castanhos, sobrancelhas grossas,
cavanhaque, moletom preto com coroa branca no peito, calça cargo preta e tênis preto e branco.

Feito só com formas simples (sem modelo baixado), como os bonecos dos vídeos "Como funciona".

    from apresentador import apresentador, expressao, falar, acenar, pular_alegre
    a = apresentador('ian', loc=(0, 0, 0), altura=1.2)
    falar(a, 1, 120)              # boca abre e fecha
    expressao(a, 'surpreso', 60)  # muda a cara a partir do quadro 60

Expressões: base, feliz, surpreso, bravo, pensativo, triste, assustado, confiante.
"""
import bpy, math, random
from mathutils import Vector

PELE = (0.62, 0.30, 0.13)
CABELO = (0.025, 0.02, 0.02)
MOLETOM = (0.035, 0.035, 0.04)
BRANCO = (0.95, 0.95, 0.95)


def _mat(nome, cor, rough=0.55, emissao=0.0, sss=0.0):
    m = bpy.data.materials.get(nome)
    if m:
        return m
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*cor, 1)
    p.inputs['Roughness'].default_value = rough
    if sss:
        try:
            p.inputs['Subsurface Weight'].default_value = sss
            p.inputs['Subsurface Radius'].default_value = (0.4, 0.2, 0.1)
        except Exception:
            pass
    if emissao:
        p.inputs['Emission Color'].default_value = (*cor, 1)
        p.inputs['Emission Strength'].default_value = emissao
    return m


def _filho(o, pai, loc=(0, 0, 0), rot=(0, 0, 0)):
    o.parent = pai
    o.location = loc
    o.rotation_euler = rot
    return o


def _vazio(nome, pai=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(e)
    if pai:
        e.parent = pai
    e.location = loc
    return e


def _esfera(nome, raio, mat, pai, loc, escala=(1, 1, 1), segs=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=raio, segments=segs, ring_count=segs // 2)
    o = bpy.context.active_object
    o.name = nome
    o.scale = escala
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return _filho(o, pai, loc)


def _cilindro(nome, raio, alt, mat, pai, loc, rot=(0, 0, 0), escala=(1, 1, 1), bisel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=raio, depth=alt, vertices=32)
    o = bpy.context.active_object
    o.name = nome
    o.scale = escala
    o.data.materials.append(mat)
    if bisel:
        b = o.modifiers.new('bisel', 'BEVEL')
        b.width = bisel
        b.segments = 4
    bpy.ops.object.shade_smooth()
    return _filho(o, pai, loc, rot)


def _cubo(nome, dims, mat, pai, loc, bisel=0.02, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = nome
    o.scale = dims
    o.data.materials.append(mat)
    b = o.modifiers.new('bisel', 'BEVEL')
    b.width = bisel
    b.segments = 4
    b.limit_method = 'NONE'
    bpy.ops.object.shade_smooth()
    return _filho(o, pai, loc, rot)


def apresentador(nome='ian', loc=(0, 0, 0), altura=1.2, giro=0.0, semente=7):
    """Monta o boneco. Medidas internas pensadas para altura 1 (escala no fim). Devolve o vazio raiz,
    com partes nomeadas em raiz['partes'] para animar."""
    random.seed(semente)
    pele = _mat('ap_pele', PELE, rough=0.5, sss=0.15)
    cab = _mat('ap_cabelo', CABELO, rough=0.65)
    mol = _mat('ap_moletom', MOLETOM, rough=0.8)
    calca = _mat('ap_calca', (0.03, 0.03, 0.035), rough=0.85)
    branco = _mat('ap_branco', BRANCO, rough=0.35)
    iris = _mat('ap_iris', (0.18, 0.08, 0.03), rough=0.2)
    pupila = _mat('ap_pupila', (0.01, 0.01, 0.01), rough=0.1)
    brilho = _mat('ap_brilho', (1, 1, 1), emissao=2.0)
    pelo = _mat('ap_pelo', (0.04, 0.025, 0.02), rough=0.7)
    boca_m = _mat('ap_boca', (0.25, 0.05, 0.05), rough=0.4)

    raiz = _vazio(nome)
    corpo = _vazio(nome + '_corpo', raiz)               # balança ao andar/falar

    # --- pernas e tênis
    for lado, x in (('E', -0.085), ('D', 0.085)):
        _cilindro(f'{nome}_perna{lado}', 0.07, 0.24, calca, corpo, (x, 0, 0.17))
        _cubo(f'{nome}_bolso{lado}', (0.03, 0.06, 0.06), calca, corpo, (x + (0.07 if x > 0 else -0.07), 0, 0.18), bisel=0.012)
        _cubo(f'{nome}_tenis{lado}', (0.09, 0.15, 0.06), _mat('ap_tenis', (0.04, 0.04, 0.045), rough=0.4), corpo, (x, -0.025, 0.035), bisel=0.03)
        _cubo(f'{nome}_sola{lado}', (0.095, 0.155, 0.022), branco, corpo, (x, -0.025, 0.011), bisel=0.01)
        _cubo(f'{nome}_swoosh{lado}', (0.004, 0.07, 0.02), branco, corpo, (x + (0.046 if x > 0 else -0.046), -0.02, 0.04), bisel=0.002)

    # --- tronco (moletom) com bolso canguru, capuz e coroa
    tronco = _cilindro(nome + '_tronco', 0.15, 0.26, mol, corpo, (0, 0, 0.42), escala=(1.05, 0.82, 1), bisel=0.06)
    _cubo(nome + '_canguru', (0.2, 0.02, 0.08), mol, corpo, (0, -0.118, 0.37), bisel=0.02)
    _cilindro(nome + '_barra', 0.155, 0.03, mol, corpo, (0, 0, 0.3), escala=(1.05, 0.82, 1), bisel=0.01)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.11, minor_radius=0.045, location=(0, 0, 0))
    capuz = bpy.context.active_object
    capuz.name = nome + '_capuz'
    capuz.data.materials.append(mol)
    bpy.ops.object.shade_smooth()
    _filho(capuz, corpo, (0, 0.02, 0.555), (math.radians(-12), 0, 0))
    for x in (-0.03, 0.03):  # cordões
        _cilindro(f'{nome}_cordao{x}', 0.006, 0.09, branco, corpo, (x, -0.125, 0.5))
    # coroa branca no peito (lado esquerdo do boneco = direita de quem olha)
    coroa = _vazio(nome + '_coroa', corpo, (0.065, -0.126, 0.47))
    _cubo(nome + '_coroa_base', (0.04, 0.004, 0.008), branco, coroa, (0, 0, 0), bisel=0.002)
    for i, dx in enumerate((-0.017, 0, 0.017)):
        bpy.ops.mesh.primitive_cone_add(radius1=0.008, depth=0.022, vertices=4)
        c = bpy.context.active_object
        c.data.materials.append(branco)
        _filho(c, coroa, (dx, 0, 0.014 + (0.004 if dx == 0 else 0)))

    # --- braços (pivô no ombro) e mãos
    bracos = {}
    for lado, x, s in (('E', -0.17, -1), ('D', 0.17, 1)):
        piv = _vazio(f'{nome}_ombro{lado}', corpo, (x, 0, 0.52))
        _cilindro(f'{nome}_manga{lado}', 0.05, 0.2, mol, piv, (0, 0, -0.1), bisel=0.02)
        _cilindro(f'{nome}_punho{lado}', 0.048, 0.025, mol, piv, (0, 0, -0.205))
        _esfera(f'{nome}_mao{lado}', 0.045, pele, piv, (0, 0, -0.24))
        piv.rotation_euler = (0, math.radians(8 * s), 0)
        bracos[lado] = piv

    # --- cabeça (pivô no pescoço)
    cabeca = _vazio(nome + '_cabeca', corpo, (0, 0, 0.58))
    cabeca.scale = (1.3, 1.3, 1.3)  # chibi: cabeça grande
    _cilindro(nome + '_pescoco', 0.05, 0.06, pele, cabeca, (0, 0, 0.0))
    _esfera(nome + '_rosto', 0.2, pele, cabeca, (0, 0, 0.19), escala=(1.0, 0.92, 1.0))
    for x in (-0.195, 0.195):
        _esfera(f'{nome}_orelha{x}', 0.045, pele, cabeca, (x, 0.0, 0.18), escala=(0.55, 0.8, 1))
    # olhos grandes
    olhos = {}
    for lado, x in (('E', -0.072), ('D', 0.072)):
        o = _vazio(f'{nome}_olho{lado}', cabeca, (x, -0.16, 0.2))
        _esfera(f'{nome}_branco{lado}', 0.052, branco, o, (0, 0, 0), escala=(0.95, 0.45, 1.1))
        _esfera(f'{nome}_iris{lado}', 0.036, iris, o, (0, -0.02, -0.004), escala=(1, 0.4, 1.08))
        _esfera(f'{nome}_pupila{lado}', 0.02, pupila, o, (0, -0.033, -0.004), escala=(1, 0.4, 1.08))
        _esfera(f'{nome}_luz{lado}', 0.009, brilho, o, (0.012, -0.04, 0.016), escala=(1, 0.4, 1))
        olhos[lado] = o
    # pálpebras (piscar / olhos fechados de feliz): cobrem o olho quando escalam em Z
    palpebras = {}
    for lado, x in (('E', -0.072), ('D', 0.072)):
        p = _esfera(f'{nome}_palpebra{lado}', 0.056, pele, cabeca, (x, -0.158, 0.25), escala=(1.0, 0.5, 0.05))
        palpebras[lado] = p
    # sobrancelhas grossas
    sobr = {}
    for lado, x in (('E', -0.075), ('D', 0.075)):
        s = _cubo(f'{nome}_sobr{lado}', (0.075, 0.02, 0.018), pelo, cabeca, (x, -0.168, 0.285), bisel=0.008)
        sobr[lado] = s
    # nariz, boca, bigode e cavanhaque
    _esfera(nome + '_nariz', 0.022, pele, cabeca, (0, -0.19, 0.15), escala=(1.2, 0.8, 0.8))
    boca = _esfera(nome + '_boca', 0.04, boca_m, cabeca, (0, -0.175, 0.095), escala=(1.0, 0.3, 0.12))
    dentes = _cubo(nome + '_dentes', (0.05, 0.006, 0.01), branco, cabeca, (0, -0.186, 0.104), bisel=0.003)
    dentes.scale = (0.001, 0.001, 0.001)
    _cubo(nome + '_bigode', (0.07, 0.012, 0.01), pelo, cabeca, (0, -0.183, 0.122), bisel=0.004)
    _esfera(nome + '_cavanhaque', 0.025, pelo, cabeca, (0, -0.168, 0.045), escala=(1.1, 0.5, 0.9))

    # cabelo black power: muitos cachos em volta e por cima da cabeça
    cachos = _vazio(nome + '_cabelo', cabeca, (0, 0, 0.19))
    n = 0
    for i in range(260):
        # pontos numa casca em volta da cabeça, mais concentrados em cima e atrás
        th = random.uniform(0, math.tau)
        z = random.uniform(-0.15, 1.0)
        r = math.sqrt(max(0.0, 1 - z * z))
        v = Vector((math.cos(th) * r, math.sin(th) * r, z))
        if v.y < -0.35 and v.z < 0.55:  # deixa o rosto livre
            continue
        if v.z < 0.0 and abs(v.x) > 0.8 and v.y < 0.2:  # deixa as orelhas aparecendo
            continue
        dist = random.uniform(0.2, 0.245)
        raio = random.uniform(0.032, 0.05)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=raio, subdivisions=2)
        c = bpy.context.active_object
        c.data.materials.append(cab)
        bpy.ops.object.shade_smooth()
        _filho(c, cachos, tuple(v * dist * Vector((1.12, 1.05, 1.15))), (random.uniform(0, 3), random.uniform(0, 3), 0))
        n += 1
    # franjinha de cachos caindo na testa
    for i in range(14):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.025, 0.035), subdivisions=2)
        c = bpy.context.active_object
        c.data.materials.append(cab)
        bpy.ops.object.shade_smooth()
        _filho(c, cachos, (random.uniform(-0.13, 0.13), random.uniform(-0.17, -0.12), random.uniform(0.11, 0.17)))

    raiz.scale = (altura, altura, altura)
    raiz.location = loc
    raiz.rotation_euler = (0, 0, giro)
    raiz['nome'] = nome
    return raiz


def _parte(raiz, sufixo):
    return bpy.data.objects[f"{raiz['nome']}_{sufixo}"]


def _chave(o, prop, quadro, valor, interp='BEZIER'):
    setattr(o, prop, valor)
    o.keyframe_insert(prop, frame=quadro)
    try:
        from base3d import interpolar
        interpolar(o, prop, quadro, interp)
    except Exception:
        pass


# expressão = (rotação das sobrancelhas, altura delas, escala da boca (x, z), dentes, pálpebras 0..1)
EXPRESSOES = {
    'base':       ((0, 0), 0.285, (1.0, 0.12), False, 0.0),
    'feliz':      ((-8, 8), 0.292, (1.4, 0.32), True, 0.35),
    'surpreso':   ((-12, 12), 0.305, (0.75, 0.75), False, 0.0),
    'bravo':      ((22, -22), 0.272, (1.0, 0.1), False, 0.15),
    'pensativo':  ((-15, 5), 0.29, (0.6, 0.12), False, 0.1),
    'triste':     ((-20, 20), 0.282, (0.8, 0.1), False, 0.25),
    'assustado':  ((-18, 18), 0.302, (0.9, 0.6), True, 0.0),
    'confiante':  ((8, -8), 0.282, (1.2, 0.18), True, 0.2),
}


def expressao(raiz, nome, quadro, transicao=4):
    rot, alt, (bx, bz), dentes, palp = EXPRESSOES[nome]
    for lado, r in (('E', rot[0]), ('D', rot[1])):
        s = _parte(raiz, f'sobr{lado}')
        _chave(s, 'rotation_euler', quadro, s.rotation_euler.copy())
        _chave(s, 'location', quadro, s.location.copy())
        _chave(s, 'rotation_euler', quadro + transicao, (0, math.radians(r), 0))
        _chave(s, 'location', quadro + transicao, (s.location.x, s.location.y, alt))
        p = _parte(raiz, f'palpebra{lado}')
        _chave(p, 'scale', quadro, p.scale.copy())
        _chave(p, 'scale', quadro + transicao, (1.0, 0.5, 0.05 + palp * 0.9))
    b = _parte(raiz, 'boca')
    _chave(b, 'scale', quadro, b.scale.copy())
    _chave(b, 'scale', quadro + transicao, (bx, 0.3, bz))
    d = _parte(raiz, 'dentes')
    _chave(d, 'scale', quadro + transicao, (0.05 * bx, 0.006, 0.012) if dentes else (0.001, 0.001, 0.001), 'CONSTANT')
    raiz[f'boca_base_{quadro}'] = (bx, bz)
    raiz['boca_atual'] = (bx, bz)


def falar(raiz, ini, fim, ritmo=5, abertura=0.28):
    """boca abrindo e fechando (sem leitura labial, só o ritmo da fala)"""
    b = _parte(raiz, 'boca')
    bx, bz = raiz.get('boca_atual', (1.0, 0.12))
    random.seed(ini)
    f = ini
    aberta = False
    while f < fim:
        z = (bz + abertura * random.uniform(0.6, 1.0)) if not aberta else bz
        _chave(b, 'scale', f, (bx * (0.85 if not aberta else 1), 0.3, z), 'SINE')
        aberta = not aberta
        f += ritmo + random.choice((0, 0, 1, 2))
    _chave(b, 'scale', fim, (bx, 0.3, bz), 'SINE')


def piscar(raiz, quadros):
    for q in quadros:
        for lado in ('E', 'D'):
            p = _parte(raiz, f'palpebra{lado}')
            base = p.scale.copy()
            _chave(p, 'scale', q, base, 'LINEAR')
            _chave(p, 'scale', q + 2, (1.0, 0.5, 1.0), 'LINEAR')
            _chave(p, 'scale', q + 5, base, 'LINEAR')


def acenar(raiz, ini, lado='D', vezes=3):
    o = _parte(raiz, f'ombro{lado}')
    s = 1 if lado == 'D' else -1
    _chave(o, 'rotation_euler', ini, o.rotation_euler.copy())
    q = ini + 6
    for i in range(vezes):
        _chave(o, 'rotation_euler', q, (0, math.radians(150 * s), math.radians(-15)), 'SINE')
        _chave(o, 'rotation_euler', q + 5, (0, math.radians(120 * s), math.radians(15)), 'SINE')
        q += 10
    _chave(o, 'rotation_euler', q + 6, (0, math.radians(8 * s), 0))


def apontar(raiz, ini, fim, lado='D', angulo=80):
    """aponta pro lado (mostrando algo na tela)"""
    o = _parte(raiz, f'ombro{lado}')
    s = 1 if lado == 'D' else -1
    _chave(o, 'rotation_euler', ini, o.rotation_euler.copy())
    _chave(o, 'rotation_euler', ini + 6, (math.radians(-10), math.radians(angulo * s), 0), 'BACK')
    _chave(o, 'rotation_euler', fim - 6, (math.radians(-10), math.radians(angulo * s), 0))
    _chave(o, 'rotation_euler', fim, (0, math.radians(8 * s), 0))


def balancar(raiz, ini, fim, amp=0.012, periodo=24):
    """respira/balança de leve o tempo todo (o boneco nunca fica parado)"""
    c = _parte(raiz, 'corpo')
    cab = _parte(raiz, 'cabeca')
    f, lado = ini, 1
    while f <= fim:
        _chave(c, 'location', f, (0, 0, amp * lado), 'SINE')
        _chave(cab, 'rotation_euler', f, (math.radians(2 * lado), 0, math.radians(3 * -lado)), 'SINE')
        f += periodo // 2
        lado = -lado


def pular_alegre(raiz, quadro, altura=0.12):
    c = _parte(raiz, 'corpo')
    _chave(c, 'location', quadro, (0, 0, 0), 'SINE')
    _chave(c, 'location', quadro + 6, (0, 0, altura), 'SINE')
    _chave(c, 'location', quadro + 12, (0, 0, 0), 'BOUNCE')
    for lado, s in (('E', -1), ('D', 1)):
        o = _parte(raiz, f'ombro{lado}')
        _chave(o, 'rotation_euler', quadro, o.rotation_euler.copy())
        _chave(o, 'rotation_euler', quadro + 6, (0, math.radians(140 * s), 0), 'BACK')
        _chave(o, 'rotation_euler', quadro + 18, (0, math.radians(8 * s), 0))
