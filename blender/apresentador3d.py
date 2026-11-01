"""
O apresentador do canal em 3D: modelo gerado uma vez pelo Magnific (Tripo, a partir da imagem "base"
do personagem 2D), já com esqueleto. Aqui ele é importado e animado no Blender, sem custo por vídeo.

    from apresentador3d import apresentador, pose, gesto, balancar, falar_corpo
    a = apresentador(loc=(0, 0, 0), altura=1.2, giro=0)
    pose(a, 'bracos_baixo', 1)
    gesto(a, 'explicar', 30, 90)     # mexe as mãos enquanto explica
    gesto(a, 'apontar_d', 100, 160)  # aponta pra direita da tela
    gesto(a, 'acenar', 1, 40)

Ossos (Tripo): Root, Spine_0, Head_0..3, 0_Right_Limb_0..2 (braço direito), 0_Left_Limb_0..4
(braço esquerdo), 1_Right/Left_Limb_0..3 (pernas).
O rosto não mexe (é textura): a emoção vem do corpo, da câmera e da bolha 2D na edição.
"""
import bpy, math
from mathutils import Euler

MODELO = 'C:/Users/yaned/Videos/Melhores Fimes/3d/modelos/apresentador-rig.glb'
BRACO_D = 'tripo::0_Right_Limb_0'
ANTEBRACO_D = 'tripo::0_Right_Limb_1'
BRACO_E = 'tripo::0_Left_Limb_0'
ANTEBRACO_E = 'tripo::0_Left_Limb_1'
CABECA = 'tripo::Head_0'
TRONCO = 'tripo::Spine_0'
FRENTE = -math.pi / 2  # o modelo vem olhando para +X; assim ele olha para a câmera (-Y)


def apresentador(nome='ian', loc=(0, 0, 0), altura=1.2, giro=0.0):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=MODELO)
    novos = [o for o in bpy.data.objects if o not in antes]
    arm = next(o for o in novos if o.type == 'ARMATURE')
    for o in novos:
        if o.type == 'MESH' and o.parent is None:
            bpy.data.objects.remove(o)   # esfera solta que vem no arquivo
    arm.name = nome
    malha = next(o for o in arm.children if o.type == 'MESH')
    malha.name = nome + '_malha'
    bpy.context.view_layer.update()
    zs = [(malha.matrix_world @ v.co).z for v in malha.data.vertices]
    s = altura / (max(zs) - min(zs))
    arm.scale = tuple(c * s for c in arm.scale)
    arm.rotation_mode = 'XYZ'
    arm.rotation_euler = (0, 0, giro + FRENTE)
    arm.location = loc
    bpy.context.view_layer.update()
    pe = min((malha.matrix_world @ v.co).z for v in malha.data.vertices)
    arm.location.z += loc[2] - pe   # pés no chão
    arm['z0'] = arm.location.z
    for b in arm.pose.bones:
        b.rotation_mode = 'XYZ'
    arm['nome'] = nome
    return arm


def _pb(arm, osso):
    return arm.pose.bones[osso]


def _rot(arm, osso, quadro, graus, interp='BEZIER'):
    pb = _pb(arm, osso)
    pb.rotation_euler = Euler([math.radians(g) for g in graus], 'XYZ')
    pb.keyframe_insert('rotation_euler', frame=quadro)
    try:
        from base3d import interpolar
        interpolar(arm, f'pose.bones["{osso}"].rotation_euler', quadro, interp)
    except Exception:
        pass


# poses dos braços: (braço D, antebraço D, braço E, antebraço E) em graus XYZ, calibradas no teste
POSES = {
    # (braço D, antebraço D, braço E, antebraço E). D = braço que aparece à direita da tela.
    # Braço: Z+ abaixa o D / Z- abaixa o E. Antebraço: Z dobra o cotovelo pra frente do corpo.
    'bracos_baixo': ((0, 0, 85), (0, 0, 5), (0, 0, -85), (0, 0, -5)),
    'explica_1':    ((0, 0, 70), (0, 0, 110), (0, 0, -85), (0, 0, -5)),
    'explica_2':    ((0, 0, 85), (0, 0, 5), (0, 0, -70), (0, 0, -110)),
    'explica_3':    ((0, 0, 70), (0, 0, 110), (0, 0, -70), (0, 0, -110)),
    'apontar_d':    ((0, 0, 5), (0, 0, 5), (0, 0, -75), (0, 0, -10)),
    'apontar_e':    ((0, 0, 75), (0, 0, 10), (0, 0, -5), (0, 0, -5)),
    'acenar_1':     ((0, 0, -40), (60, 0, 0), (0, 0, -75), (0, 0, -10)),
    'acenar_2':     ((0, 0, -40), (20, 0, 0), (0, 0, -75), (0, 0, -10)),
    'comemorar':    ((0, 0, -50), (0, 0, 10), (0, 0, 50), (0, 0, -10)),
    'pensando':     ((0, 0, 75), (0, 0, 10), (0, 0, -40), (0, 0, -120)),
    'susto':        ((0, 0, -20), (0, 0, 60), (0, 0, 20), (0, 0, -60)),
}


def pose(arm, nome, quadro, interp='BEZIER'):
    bd, ad, be, ae = POSES[nome]
    _rot(arm, BRACO_D, quadro, bd, interp)
    _rot(arm, ANTEBRACO_D, quadro, ad, interp)
    _rot(arm, BRACO_E, quadro, be, interp)
    _rot(arm, ANTEBRACO_E, quadro, ae, interp)


def gesto(arm, tipo, ini, fim):
    """sequência de poses entre ini e fim, voltando aos braços baixos no fim"""
    if tipo == 'explicar':
        seq = ['explica_1', 'explica_3', 'explica_2', 'explica_3']
        passo = 14
    elif tipo == 'acenar':
        seq = ['acenar_1', 'acenar_2']
        passo = 7
    else:
        seq = [tipo]
        passo = fim - ini
    pose(arm, 'bracos_baixo', ini)
    f, i = ini + 6, 0
    while f < fim - 6:
        pose(arm, seq[i % len(seq)], f, 'BACK' if i == 0 else 'BEZIER')
        f += passo
        i += 1
    pose(arm, 'bracos_baixo', fim)


def balancar(arm, ini, fim, periodo=30):
    """respira e mexe a cabeça de leve: nunca fica parado"""
    f, lado = ini, 1
    while f <= fim:
        _rot(arm, CABECA, f, (3 * lado, 0, 4 * -lado), 'SINE')
        _rot(arm, TRONCO, f, (0, 0, 2 * lado), 'SINE')
        f += periodo // 2
        lado = -lado


def pulinho(arm, quadro, altura=0.08):
    z = arm.get('z0', arm.location.z)
    for q, dz, it in ((quadro, 0, 'SINE'), (quadro + 6, altura, 'SINE'), (quadro + 12, 0, 'BOUNCE')):
        arm.location.z = z + dz
        arm.keyframe_insert('location', index=2, frame=q)
    arm.location.z = z
