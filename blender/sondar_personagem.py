# Abre personagens GLB animados: lista animações e tamanho, e renderiza todos lado a lado
import bpy, sys, os, math
from mathutils import Vector
sys.path.append(os.path.dirname(__file__))
from base3d import limpar, configurar_render, iluminacao, camera, plano, material  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
pasta, saida = args[0], args[1]
arqs = sorted(f for f in os.listdir(pasta) if f.startswith('character') and f.endswith('.glb'))
limpar()
configurar_render(1)
bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 2400, 700
iluminacao()
plano('piso', (40, 40), (0, 0, 0), material('p', (0.8, 0.8, 0.82)))
for i, a in enumerate(arqs):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(pasta, a))
    novos = [o for o in bpy.data.objects if o not in antes]
    raiz = [o for o in novos if o.parent is None][0]
    raiz.location.x = (i - (len(arqs) - 1) / 2) * 1.2
    if i == 0:
        pts = [o.matrix_world @ Vector(c) for o in novos if o.type == 'MESH' for c in o.bound_box]
        print('ALTURA', round(max(p.z for p in pts) - min(p.z for p in pts), 3), 'FRENTE?', [o.type for o in novos][:6])
print('ACOES', [a.name for a in bpy.data.actions][:40])
cam, alvo = camera()
cam.data.lens = 50
cam.data.dof.use_dof = False
cam.location = (0, -16, 1.2)
alvo.location = (0, 0, 0.6)
bpy.context.scene.render.filepath = saida
bpy.ops.render.render(write_still=True)
