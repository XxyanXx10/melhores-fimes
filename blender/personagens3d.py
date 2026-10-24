"""
Personagens humanos animados (pacote grátis CC0 "Mini Characters", da Kenney).

Cada GLB traz um esqueleto e ~30 animações prontas: idle, walk, sprint, emote-yes,
emote-no, interact-left/right, pick-up, sit, jump, fall, die, attack-*…
`personagem()` importa e deixa pronto; `animar()` monta a sequência de animações
na linha do tempo (NLA), com transição suave entre uma e outra.
"""
import bpy, math

KENNEY = 'C:/Users/yaned/Videos/Melhores Fimes/3d/personagens/kenney-mini-characters/pacote/Models/GLB format'


def personagem(arquivo, nome, altura=1.7, loc=(0, 0, 0), giro=0.0):
    antes_obj = set(bpy.data.objects)
    antes_acoes = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=f'{KENNEY}/{arquivo}.glb')
    novos = [o for o in bpy.data.objects if o not in antes_obj]
    arm = [o for o in novos if o.type == 'ARMATURE'][0]
    # malhas soltas que vêm junto (ex.: "Icosphere") não fazem parte do boneco
    for o in novos:
        if o.type == 'MESH' and o.parent is None:
            bpy.data.objects.remove(o)
    arm.name = nome
    # mede a altura real do boneco já deformado pelo esqueleto (o número do pacote não bate)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    zs = []
    for o in arm.children_recursive:
        if o.type == 'MESH':
            ev = o.evaluated_get(dg)
            zs += [(ev.matrix_world @ v.co).z for v in ev.to_mesh().vertices]
            ev.to_mesh_clear()
    medida = (max(zs) - min(zs)) if zs else 2.0
    arm.scale = tuple(s * altura / medida for s in arm.scale)
    arm.location = loc
    arm.rotation_euler = (0, 0, giro)
    # guarda as animações deste boneco pelo nome simples (o import duplica com ".001")
    arm['acoes'] = {a.name.split('.')[0]: a.name for a in bpy.data.actions if a not in antes_acoes}
    ad = arm.animation_data
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    ad.action = None
    return arm


def animar(arm, sequencia, mistura=4):
    """sequencia: [(acao, quadro_inicio, quadro_fim, velocidade)] — repete a ação até preencher o trecho"""
    ad = arm.animation_data
    acoes = arm['acoes']
    for i, (nome, ini, fim, vel) in enumerate(sequencia):
        acao = bpy.data.actions[acoes[nome]]
        trilha = ad.nla_tracks.new()
        trilha.name = f'{i:02d}-{nome}'
        s = trilha.strips.new(nome, int(ini), acao)
        s.scale = 1.0 / vel
        compr = (acao.frame_range[1] - acao.frame_range[0]) * s.scale
        s.repeat = max(1.0, (fim - ini) / max(1.0, compr))
        s.blend_in = mistura if i else 0
        s.blend_out = mistura if i < len(sequencia) - 1 else 0
        s.extrapolation = 'HOLD_FORWARD' if i == len(sequencia) - 1 else 'NOTHING'
        s.use_auto_blend = False
