# Abre um GLB e diz tamanho, orientação e materiais (para calibrar a cena)
import bpy, sys
from mathutils import Vector
arq = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=arq)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print('MALHAS', len(objs), [o.name for o in objs][:5])
print('MIN', tuple(round(v, 3) for v in mn), 'MAX', tuple(round(v, 3) for v in mx))
print('TAMANHO', tuple(round(v, 3) for v in (mx - mn)))
print('MATERIAIS', [m.name for m in bpy.data.materials][:5])
print('PARENTS', [(o.name, o.parent.name if o.parent else None) for o in bpy.context.scene.objects][:6])
