"""
Peças reutilizáveis para montar cenas 3D do canal no Blender (sem interface).

Usado pelos roteiros de cena (ex.: blender/lojinha.py). Tudo em metros, eixo Z
para cima, câmera olhando para +Y. Os modelos GLB da Magnific vêm virados para
+X: `importar` gira para olharem para a câmera, põe a origem na base e ajusta a
altura. Animação por quadros-chave; a interpolação de cada chave diz como o
trecho seguinte anda (BACK = passa do ponto e volta, BOUNCE = quica, SINE = suave).
"""
import bpy, math, os
from mathutils import Vector, Matrix

FPS = 30
FONTE = 'C:/Windows/Fonts/ariblk.ttf'


def limpar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'BEZIER'


def configurar_render(segundos):
    sc = bpy.context.scene
    for motor in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = motor
            break
        except Exception:
            pass
    sc.render.fps = FPS
    sc.frame_start = 1
    sc.frame_end = max(2, round(segundos * FPS))
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    try:
        sc.eevee.taa_render_samples = 32
        sc.eevee.use_raytracing = True
    except Exception:
        pass
    # "Standard" mantém as cores saturadas de desenho; o AgX deixava tudo lavado
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = -0.3
    w = bpy.data.worlds.new('mundo')
    sc.world = w
    w.use_nodes = True
    fundo = w.node_tree.nodes['Background']
    fundo.inputs[0].default_value = (0.32, 0.30, 0.38, 1)
    fundo.inputs[1].default_value = 0.3


def _apontar(obj, alvo):
    d = Vector(alvo) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def luz(nome, tipo, loc, energia, alvo=(0, 0.4, 1.2), cor=(1, 1, 1), tamanho=2.0):
    l = bpy.data.lights.new(nome, tipo)
    l.energy = energia
    l.color = cor
    if tipo == 'AREA':
        l.size = tamanho
    o = bpy.data.objects.new(nome, l)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    _apontar(o, alvo)
    return o


def iluminacao():
    luz('chave', 'AREA', (-2.4, -2.8, 3.8), 340, cor=(1.0, 0.95, 0.88), tamanho=3)
    luz('preench', 'AREA', (2.6, -2.2, 2.2), 120, cor=(0.8, 0.88, 1.0), tamanho=2.5)
    luz('recorte', 'AREA', (0.4, 1.9, 3.4), 220, cor=(1.0, 0.85, 0.75), tamanho=1.5)


def escurecer(fator):
    for nome in ('chave', 'preench', 'recorte'):
        bpy.data.objects[nome].data.energy *= fator
    bpy.context.scene.world.node_tree.nodes['Background'].inputs[1].default_value *= fator


def holofote(loc, alvo_z=1.2):
    o = luz('holofote', 'SPOT', loc, 1600, alvo=(0, 0.45, alvo_z), cor=(1.0, 0.93, 0.8))
    o.data.spot_size = math.radians(32)
    o.data.spot_blend = 0.35
    return o


def camera():
    sc = bpy.context.scene
    alvo = bpy.data.objects.new('alvo', None)
    sc.collection.objects.link(alvo)
    dados = bpy.data.cameras.new('cam')
    dados.lens = 30
    dados.dof.use_dof = True
    dados.dof.focus_object = alvo
    dados.dof.aperture_fstop = 3.2
    cam = bpy.data.objects.new('cam', dados)
    sc.collection.objects.link(cam)
    c = cam.constraints.new('TRACK_TO')
    c.target = alvo
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    sc.camera = cam
    return cam, alvo


def material(nome, cor, rough=0.5, metal=0.0, emissao=None, forca=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*cor, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emissao:
        p.inputs['Emission Color'].default_value = (*emissao, 1)
        p.inputs['Emission Strength'].default_value = forca
    return m


def _ativo(o):
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def plano(nome, tam, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = nome
    o.scale = (tam[0], tam[1], 1)
    o.data.materials.append(mat)
    return o


def caixa(nome, dims, loc, mat, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = nome
    o.scale = dims
    _ativo(o)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b = o.modifiers.new('chanfro', 'BEVEL')
        b.width = bevel
        b.segments = 3
    o.data.materials.append(mat)
    return o


def texto(nome, conteudo, tam, loc, mat, extrude=0.03):
    cu = bpy.data.curves.new(nome, 'FONT')
    cu.body = conteudo
    if os.path.exists(FONTE):
        cu.font = bpy.data.fonts.load(FONTE, check_existing=True)
    cu.size = tam
    cu.extrude = extrude
    cu.bevel_depth = min(0.01, extrude / 3)
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.space_line = 0.85
    o = bpy.data.objects.new(nome, cu)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (math.pi / 2, 0, 0)
    o.data.materials.append(mat)
    return o


def importar(caminho, nome, altura):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=caminho)
    novos = [o for o in bpy.data.objects if o not in antes]
    malhas = [o for o in novos if o.type == 'MESH']
    for o in novos:
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    o = malhas[0]
    if len(malhas) > 1:
        _ativo(o)
        for m in malhas[1:]:
            m.select_set(True)
        bpy.ops.object.join()
    o.parent = None
    _ativo(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = o.data
    pts = [v.co for v in me.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    base = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    me.transform(Matrix.Translation(-base))
    me.transform(Matrix.Rotation(-math.pi / 2, 4, 'Z'))  # frente de +X para -Y (câmera)
    me.transform(Matrix.Scale(altura / (mx.z - mn.z), 4))
    me.update()
    o.location = (0, 0, 0)
    o.rotation_euler = (0, 0, 0)
    o.scale = (1, 1, 1)
    o.name = nome
    return o


def chave(obj, prop, quadro, valor, interp='BEZIER'):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = interp
    setattr(obj, prop, valor)
    obj.keyframe_insert(prop, frame=quadro)


def aparecer(obj, quadro, dur=8):
    """surge com um "pulo" (escala passa do ponto e volta)"""
    final = tuple(obj.scale)
    mini = (0.001, 0.001, 0.001)
    chave(obj, 'scale', 1, mini, 'CONSTANT')
    chave(obj, 'scale', max(2, quadro), mini, 'BACK')
    chave(obj, 'scale', max(2, quadro) + dur, final, 'BEZIER')


def cair(obj, quadro, altura=2.0, dur=10):
    """cai do alto e quica no lugar onde já está"""
    fim = tuple(obj.location)
    topo = (fim[0], fim[1], fim[2] + altura)
    final = tuple(obj.scale)
    chave(obj, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(obj, 'scale', max(2, quadro), final, 'CONSTANT')
    chave(obj, 'location', 1, topo, 'CONSTANT')
    chave(obj, 'location', max(2, quadro), topo, 'BOUNCE')
    chave(obj, 'location', max(2, quadro) + dur, fim, 'BEZIER')


def piscar(obj, quadro, oculto):
    # a primeira chamada grava "visível" no quadro 1: sem isso o objeto ficava
    # escondido desde o começo (a primeira chave vale para trás)
    if not obj.get('_piscar'):
        obj['_piscar'] = 1
        obj.hide_render = False
        obj.keyframe_insert('hide_render', frame=1)
    obj.hide_render = oculto
    obj.keyframe_insert('hide_render', frame=quadro)


def moeda(nome, loc, mat):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.016, location=loc, vertices=32)
    o = bpy.context.active_object
    o.name = nome
    o.data.materials.append(mat)
    return o


def cubo(nome, base, lado, mat, giro=0.0):
    x, y, z = base
    o = caixa(nome, (lado, lado, lado), (x, y, z + lado / 2), mat, bevel=0.006)
    o.rotation_euler = (0, 0, giro)
    return o


def etiqueta(nome, conteudo, cor_fundo, cor_texto, loc, largura=0.34, altura=0.24, tam=0.07):
    raiz = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = loc
    fundo = caixa(nome + '_fundo', (largura, 0.03, altura), (0, 0, 0), material(nome + 'f', cor_fundo, rough=0.4), bevel=0.012)
    fundo.parent = raiz
    t = texto(nome + '_txt', conteudo, tam, (0, -0.025, 0), material(nome + 't', cor_texto, emissao=cor_texto, forca=0.6), extrude=0.008)
    t.parent = raiz
    return raiz


def seta_baixo(nome, loc, mat):
    raiz = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = loc
    haste = caixa(nome + '_haste', (0.11, 0.06, 0.3), (0, 0, 0.2), mat, bevel=0.01)
    haste.parent = raiz
    bpy.ops.mesh.primitive_cone_add(radius1=0.2, depth=0.24, location=(0, 0, -0.07), rotation=(math.pi, 0, 0), vertices=4)
    ponta = bpy.context.active_object
    ponta.name = nome + '_ponta'
    ponta.rotation_euler = (math.pi, 0, math.pi / 4)
    ponta.scale = (1, 0.35, 1)
    ponta.data.materials.append(mat)
    ponta.parent = raiz
    return raiz


def renderizar(pasta, teste=False):
    sc = bpy.context.scene
    os.makedirs(pasta, exist_ok=True)
    if teste:
        sc.render.resolution_percentage = 50
        fim = sc.frame_end
        for q in sorted({1, 12, fim // 3, fim // 2, (2 * fim) // 3, fim - 2}):
            sc.frame_set(max(1, q))
            sc.render.filepath = f'{pasta}_teste/q{q:04d}.png'
            bpy.ops.render.render(write_still=True)
        return
    sc.render.filepath = f'{pasta}/f'
    bpy.ops.render.render(animation=True)
