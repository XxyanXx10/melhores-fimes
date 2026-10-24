"""
Hologramas estilo "assistente do Homem de Ferro" para o vídeo da parede.

    blender -b --factory-startup --python vfx/jarvis_holo.py -- <pasta_trabalho> [--teste]

Renderiza só a CAMADA dos hologramas (fundo preto, tudo emissivo em ciano) em
1080x1920 a 30 fps, já na linha do tempo cortada (começa 5,5 s depois do vídeo
original). A composição com o vídeo, o recorte da pessoa e o brilho é feita
depois em vfx/jarvis_compor.py. Câmera ortográfica: 1 unidade = 100 px, então as
posições abaixo são os pixels do quadro (x, y a partir do canto de cima).
"""
import bpy, sys, os, math, json

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'blender'))
from base3d import limpar, texto, chave, importar  # noqa: E402

PASTA = sys.argv[sys.argv.index('--') + 1]
TESTE = '--teste' in sys.argv
FPS = 30
CORTE = 5.5                     # segundos cortados do começo do vídeo original
DUR = 34.5
CIANO = (0.25, 0.85, 1.0)
LARANJA = (1.0, 0.55, 0.15)


def Q(t):
    """segundo (já cortado) → quadro"""
    return max(1, round(t * FPS) + 1)


def P(x, y, z=0.0):
    """pixel do quadro → posição na cena"""
    return (x / 100.0, z, -y / 100.0)


def emissor(nome, cor=CIANO, forca=3.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*cor, 1)
    em.inputs['Strength'].default_value = forca
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs[0])
    m['_em'] = em.name
    return m


def holograma(nome, cor=CIANO):
    """casca de holograma: quase transparente no meio, borda acesa e listras horizontais"""
    m = emissor(nome, cor, 0.0)
    nt = m.node_tree
    em = nt.nodes[m['_em']]
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 1.6
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = 0.06
    mr.inputs['To Max'].default_value = 1.6
    nt.links.new(pw.outputs[0], mr.inputs['Value'])
    # listras: seno da altura no mundo (uma a cada ~6 px)
    co = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(co.outputs['Position'], sep.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 100.0
    nt.links.new(sep.outputs['Z'], mul.inputs[0])
    sn = nt.nodes.new('ShaderNodeMath')
    sn.operation = 'SINE'
    nt.links.new(mul.outputs[0], sn.inputs[0])
    lst = nt.nodes.new('ShaderNodeMapRange')
    lst.inputs['From Min'].default_value = -1
    lst.inputs['To Min'].default_value = 0.55
    lst.inputs['To Max'].default_value = 1.0
    nt.links.new(sn.outputs[0], lst.inputs['Value'])
    fator = nt.nodes.new('ShaderNodeMath')
    fator.operation = 'MULTIPLY'
    nt.links.new(mr.outputs[0], fator.inputs[0])
    nt.links.new(lst.outputs[0], fator.inputs[1])
    cor_n = nt.nodes.new('ShaderNodeVectorMath')
    cor_n.operation = 'SCALE'
    cor_n.inputs[0].default_value = cor
    nt.links.new(fator.outputs[0], cor_n.inputs['Scale'])
    nt.links.new(cor_n.outputs[0], em.inputs['Color'])
    return m


def brilho(mat, quadro, valor, interp='BEZIER'):
    """liga/desliga um grupo inteiro mexendo na força da emissão"""
    bpy.context.preferences.edit.keyframe_new_interpolation_type = interp
    s = mat.node_tree.nodes[mat['_em']].inputs['Strength']
    s.default_value = valor
    s.keyframe_insert('default_value', frame=quadro)


def grupo(nome, centro):
    g = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(g)
    g.location = P(*centro)
    return g


def filho(o, pai, rel=(0, 0, 0)):
    o.parent = pai
    o.location = rel
    return o


def anel(nome, raio, esp, mat, pai, segs=96):
    bpy.ops.mesh.primitive_torus_add(major_radius=raio, minor_radius=esp, major_segments=segs, minor_segments=6, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object
    o.name = nome
    o.data.materials.append(mat)
    return filho(o, pai)


def tracejado(nome, raio, n, mat, pai, comp=0.18, larg=0.035):
    """anel de traços (vários retângulos em volta), gira junto"""
    raiz = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(raiz)
    filho(raiz, pai)
    for i in range(n):
        a = i / n * math.tau
        bpy.ops.mesh.primitive_plane_add(size=1, rotation=(math.pi / 2, 0, 0))
        p = bpy.context.active_object
        p.scale = (larg, comp, 1)
        p.data.materials.append(mat)
        filho(p, raiz, (math.cos(a) * raio, 0, math.sin(a) * raio))
        p.rotation_euler = (math.pi / 2, a + math.pi / 2, 0)
    return raiz


def linha(nome, a, b, mat, pai, esp=0.02):
    """segmento reto entre dois pontos (em unidades locais do pai)"""
    bpy.ops.mesh.primitive_plane_add(size=1, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object
    o.name = nome
    dx, dz = b[0] - a[0], b[2] - a[2]
    o.scale = (math.hypot(dx, dz), esp, 1)
    o.data.materials.append(mat)
    filho(o, pai, ((a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2))
    o.rotation_euler = (math.pi / 2, -math.atan2(dz, dx), 0)
    return o


def rotulo(nome, txt, tam, rel, mat, pai):
    t = texto(nome, txt, tam, (0, 0, 0), mat, extrude=0.0)
    return filho(t, pai, rel)


def girar(o, eixo, voltas_por_seg, t0=0.0, t1=DUR):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    base = list(o.rotation_euler)
    i = 'xyz'.index(eixo)
    v0, v1 = base.copy(), base.copy()
    v0[i] = base[i]
    v1[i] = base[i] + voltas_por_seg * math.tau * (t1 - t0)
    o.rotation_euler = v0
    o.keyframe_insert('rotation_euler', frame=Q(t0))
    o.rotation_euler = v1
    o.keyframe_insert('rotation_euler', frame=Q(t1))


def escala(o, quadro, s, interp='BEZIER'):
    chave(o, 'scale', quadro, (s, s, s), interp)


def mover(o, quadro, xy, interp='BEZIER'):
    chave(o, 'location', quadro, P(*xy), interp)


# ------------------------------------------------------------------ cena
limpar()
sc = bpy.context.scene
for motor in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        sc.render.engine = motor
        break
    except Exception:
        pass
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.resolution_percentage = 50 if TESTE else 100
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, Q(DUR)
sc.view_settings.view_transform = 'Standard'
try:
    sc.eevee.taa_render_samples = 16
except Exception:
    pass
w = bpy.data.worlds.new('preto')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0, 0, 0, 1)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 19.2
cam.location = (5.4, -30, -9.6)
cam.rotation_euler = (math.pi / 2, 0, 0)
sc.camera = cam

# tempos (já cortados) vindos do rastreio
ENTRA, TOQUE1, TOQUE2 = 1.5, 4.6, 10.0
GESTO0, GESTO1 = 12.9, 18.7
PUXA0, PUXA1 = 21.0, 22.1
TOQUE3, SAI0, SAI1 = 25.1, 30.9, 32.6

# --- 0. espera: linha de varredura subindo pela parede e cantos de mira
m_espera = emissor('espera', CIANO, 0.0)
g0 = grupo('espera', (790, 820))
bpy.ops.mesh.primitive_plane_add(size=1, rotation=(math.pi / 2, 0, 0))
scan = bpy.context.active_object
scan.scale = (6.0, 0.02, 1)
scan.data.materials.append(m_espera)
filho(scan, g0)
chave(scan, 'location', 1, (0, 0, -7.5), 'LINEAR')
chave(scan, 'location', Q(1.6), (0, 0, 7.0))
for i, (sx, sz) in enumerate(((-1, 1), (1, 1), (-1, -1), (1, -1))):
    linha(f'canto{i}a', (sx * 2.9, 0, sz * 6.2), (sx * 2.3, 0, sz * 6.2), m_espera, g0, 0.03)
    linha(f'canto{i}b', (sx * 2.9, 0, sz * 6.2), (sx * 2.9, 0, sz * 5.6), m_espera, g0, 0.03)
brilho(m_espera, 1, 0.0)
brilho(m_espera, 4, 2.0)
brilho(m_espera, Q(ENTRA + 0.6), 2.0)
brilho(m_espera, Q(ENTRA + 1.0), 0.0)

# --- 1. boot: mira circular na parede + "SISTEMA ONLINE"
m_boot = emissor('boot', CIANO, 0.0)
m_boot2 = emissor('boot_txt', (0.85, 0.97, 1.0), 0.0)
g1 = grupo('boot', (830, 800))
a1 = anel('b_ext', 2.6, 0.018, m_boot, g1)
a2 = anel('b_int', 1.55, 0.012, m_boot, g1)
t1 = tracejado('b_traco', 2.95, 60, m_boot, g1)
t2 = tracejado('b_traco2', 1.95, 24, m_boot, g1, comp=0.32, larg=0.05)
linha('b_h', (-3.3, 0, 0), (-1.7, 0, 0), m_boot, g1)
linha('b_h2', (1.7, 0, 0), (3.3, 0, 0), m_boot, g1)
linha('b_v', (0, 0, 1.7), (0, 0, 3.3), m_boot, g1)
rotulo('b_txt', 'SISTEMA ONLINE', 0.34, (0, 0, -3.55), m_boot2, g1)
girar(t1, 'y', 0.12)
girar(t2, 'y', -0.25)
escala(g1, 1, 0.001, 'CONSTANT')
escala(g1, Q(ENTRA), 0.001, 'BACK')
escala(g1, Q(ENTRA + 0.9), 1.0)
escala(g1, Q(TOQUE1), 1.0)
escala(g1, Q(TOQUE1 + 0.6), 0.25)
for m in (m_boot, m_boot2):
    brilho(m, Q(ENTRA), 0.0)
    brilho(m, Q(ENTRA + 0.5), 3.0)
    brilho(m, Q(TOQUE1 + 0.2), 3.0)
    brilho(m, Q(TOQUE1 + 0.6), 0.0)

# --- 2. globo: abre no primeiro toque, depois vira um mostrador pequeno no canto
m_globo = emissor('globo', CIANO, 0.0)
m_globo_txt = emissor('globo_txt', (0.85, 0.97, 1.0), 0.0)
m_alerta = emissor('alerta', LARANJA, 0.0)
g2 = grupo('globo', (830, 615))
bpy.ops.mesh.primitive_uv_sphere_add(radius=1.7, segments=24, ring_count=14)
esf = bpy.context.active_object
wf = esf.modifiers.new('fio', 'WIREFRAME')
wf.thickness = 0.018
esf.data.materials.append(m_globo)
filho(esf, g2)
esf.rotation_euler = (math.radians(20), 0, 0)
girar(esf, 'z', 0.15)
anel('g_eq', 2.15, 0.012, m_globo, g2)
tg = tracejado('g_traco', 2.45, 40, m_globo, g2, comp=0.12)
girar(tg, 'y', 0.2)
linha('g_l1', (-1.8, 0, -2.75), (1.8, 0, -2.75), m_globo, g2, 0.015)
for i, (txt, mat) in enumerate((('REDE: OK   ENERGIA 98%', m_globo_txt), ('SINAL FORTE', m_globo_txt), ('ALERTA: CAFÉ BAIXO', m_alerta))):
    rotulo(f'g_r{i}', txt, 0.2, (0, 0, -3.05 - i * 0.34), mat, g2)
escala(g2, 1, 0.001, 'CONSTANT')
escala(g2, Q(TOQUE1), 0.001, 'BACK')
mover(g2, Q(TOQUE1), (830, 615), 'BEZIER')
escala(g2, Q(TOQUE1 + 0.8), 1.0)
mover(g2, Q(TOQUE1 + 0.8), (840, 720))
escala(g2, Q(TOQUE2), 1.0)
mover(g2, Q(TOQUE2), (840, 720))
escala(g2, Q(TOQUE2 + 0.8), 0.42)
mover(g2, Q(TOQUE2 + 0.8), (930, 300))
escala(g2, Q(SAI0), 0.42)
mover(g2, Q(SAI0), (930, 300))
escala(g2, Q(SAI1), 0.001)
for m, v in ((m_globo, 3.0), (m_globo_txt, 3.0), (m_alerta, 3.0)):
    brilho(m, Q(TOQUE1), 0.0)
    brilho(m, Q(TOQUE1 + 0.3), v)
    brilho(m, Q(SAI0), v)
    brilho(m, Q(SAI1), 0.0)

# --- 3. robô em holograma: sobe do nada no segundo toque, gira com a mão, cresce no "puxar"
RX, RY, RH = 830, 1000, 5.0
m_robo = holograma('robo')
m_scan = emissor('scan', (0.85, 1.0, 1.0), 0.0)
m_base = emissor('robo_base', CIANO, 0.0)
g3 = grupo('robo', (RX, RY))
corpo = importar('C:/Users/yaned/Videos/Melhores Fimes/3d/modelos/robo.glb', 'holo_robo', altura=RH)
corpo.data.materials.clear()
corpo.data.materials.append(m_robo)
filho(corpo, g3, (0, 0, -RH / 2))
base = anel('r_base', 1.8, 0.02, m_base, g3)
base.location = (0, 0, -RH / 2 - 0.15)
base.rotation_euler = (math.radians(-15), 0, 0)
tb = tracejado('r_traco', 2.15, 48, m_base, g3, comp=0.1)
tb.location = (0, 0, -RH / 2 - 0.15)
tb.rotation_euler = (math.radians(75), 0, 0)
# corpo "montado" de baixo para cima: escala Z de 0 a 1 + linha de varredura
chave(corpo, 'scale', 1, (1, 1, 0.001), 'CONSTANT')
chave(corpo, 'scale', Q(TOQUE2 + 0.1), (1, 1, 0.001), 'BEZIER')
chave(corpo, 'scale', Q(TOQUE2 + 2.0), (1, 1, 1))
bpy.ops.mesh.primitive_plane_add(size=1, rotation=(math.pi / 2, 0, 0))
sl = bpy.context.active_object
sl.scale = (4.2, 0.03, 1)
sl.data.materials.append(m_scan)
filho(sl, g3, (0, -2, -RH / 2))
chave(sl, 'location', Q(TOQUE2 + 0.1), (0, -2, -RH / 2), 'BEZIER')
chave(sl, 'location', Q(TOQUE2 + 2.0), (0, -2, RH / 2))
brilho(m_scan, Q(TOQUE2), 0.0)
brilho(m_scan, Q(TOQUE2 + 0.2), 4.0)
brilho(m_scan, Q(TOQUE2 + 1.9), 4.0)
brilho(m_scan, Q(TOQUE2 + 2.2), 0.0)
# giro: devagar sempre, e acompanhando a mão nos gestos (x do pulso direito, rastreado)
rastreio = json.load(open(os.path.join(PASTA, 'rastreio.json')))['quadros']
desloc = round(CORTE * FPS)
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'BEZIER'
ang = 0.0
xs = []
for f in range(Q(TOQUE2), Q(SAI1) + 1, 3):
    t = (f - 1) / FPS
    q = rastreio[min(len(rastreio) - 1, f - 1 + desloc)]
    if GESTO0 <= t <= GESTO1 and q.get('pulso_d') and q['pulso_d'][2] > 0.5:
        xs.append(q['pulso_d'][0])
        xs = xs[-4:]
        alvo = (sum(xs) / len(xs) - 600) / 70.0  # mão para a direita → robô gira
        ang += (alvo - ang) * 0.5 if abs(alvo - ang) < 3 else 0
        ang += 0.03
    else:
        ang += 0.06  # giro de vitrine
    corpo.rotation_euler = (0, 0, ang)
    corpo.keyframe_insert('rotation_euler', frame=f)
girar(tb, 'z', 0.15)
for m, v in ((m_robo, 2.2), (m_base, 3.0)):
    brilho(m, Q(TOQUE2), 0.0)
    brilho(m, Q(TOQUE2 + 0.4), v)
    brilho(m, Q(SAI0), v)
    brilho(m, Q(SAI1), 0.0)
# "puxar para cima": cresce e sobe
escala(g3, Q(PUXA0), 1.0)
mover(g3, Q(PUXA0), (RX, RY))
escala(g3, Q(PUXA1), 1.2, 'BACK')
mover(g3, Q(PUXA1), (RX, 930))
escala(g3, Q(SAI0), 1.2)
mover(g3, Q(SAI0), (RX, 930))
escala(g3, Q(SAI1), 0.001)

# ficha do robô, empilhada embaixo da base (aparece quando ele começa a mexer)
m_rot = emissor('rotulos', (0.85, 0.97, 1.0), 0.0)
g4 = grupo('rotulos', (RX, RY + 330))
linha('rl_topo', (-1.9, 0, 0.32), (1.9, 0, 0.32), m_rot, g4, 0.015)
for i, txt in enumerate(('PROTÓTIPO MK-1', 'NÚCLEO ESTÁVEL', 'ESTRUTURA 98%')):
    rotulo(f'rt{i}', txt, 0.2 if i else 0.26, (0, 0, -i * 0.36), m_rot, g4)
brilho(m_rot, Q(GESTO0), 0.0)
brilho(m_rot, Q(GESTO0 + 0.5), 3.0)
brilho(m_rot, Q(PUXA0), 3.0)
brilho(m_rot, Q(PUXA0 + 0.3), 0.0)

# --- 4. painéis que "explodem" para fora quando ele puxa, e voltam no toque final
m_pain = emissor('paineis', CIANO, 0.0)
destinos = [(720, 430), (960, 560), (730, 1450), (960, 1340)]
for k, dest in enumerate(destinos):
    gp = grupo(f'painel{k}', (RX, 930))
    for j, (a, b) in enumerate((((-1.1, 0, 0.7), (1.1, 0, 0.7)), ((-1.1, 0, -0.7), (1.1, 0, -0.7)),
                                ((-1.1, 0, 0.7), (-1.1, 0, -0.7)), ((1.1, 0, 0.7), (1.1, 0, -0.7)))):
        linha(f'p{k}b{j}', a, b, m_pain, gp, 0.025)
    for j in range(5):
        bpy.ops.mesh.primitive_plane_add(size=1, rotation=(math.pi / 2, 0, 0))
        barra = bpy.context.active_object
        barra.data.materials.append(m_pain)
        filho(barra, gp, (-0.75 + j * 0.37, 0, -0.55))
        alt0 = 0.2 + ((j * 37 + k * 11) % 7) / 10
        for f in range(Q(PUXA1), Q(SAI0), 12):
            alt = alt0 * (0.6 + 0.4 * math.sin(f * 0.21 + j + k))
            chave(barra, 'scale', f, (0.22, alt, 1), 'SINE')
            barra.location = (-0.75 + j * 0.37, 0, -0.55 + alt / 2)
            barra.keyframe_insert('location', frame=f)
    escala(gp, 1, 0.001, 'CONSTANT')
    escala(gp, Q(PUXA0 + 0.3 + k * 0.08), 0.001, 'BACK')
    mover(gp, Q(PUXA0 + 0.3 + k * 0.08), (RX, 930))
    escala(gp, Q(PUXA1 + 0.3 + k * 0.08), 1.0)
    mover(gp, Q(PUXA1 + 0.3 + k * 0.08), dest)
    escala(gp, Q(TOQUE3 + 0.4), 1.0)
    mover(gp, Q(TOQUE3 + 0.4), dest)
    escala(gp, Q(TOQUE3 + 1.1), 0.001)
    mover(gp, Q(TOQUE3 + 1.1), (RX, 930))
brilho(m_pain, Q(PUXA0), 0.0)
brilho(m_pain, Q(PUXA0 + 0.4), 3.0)
brilho(m_pain, Q(TOQUE3 + 0.6), 3.0)
brilho(m_pain, Q(TOQUE3 + 1.1), 0.0)

# --- 5. toque lá em cima: "PROJETO SALVO"
m_salvo = emissor('salvo', (0.85, 1.0, 0.9), 0.0)
g5 = grupo('salvo', (830, 470))
rotulo('s_txt', 'PROJETO SALVO', 0.5, (0, 0, 0), m_salvo, g5)
linha('s_l1', (-2.6, 0, -0.5), (2.6, 0, -0.5), m_salvo, g5, 0.025)
linha('s_l2', (-2.6, 0, 0.55), (2.6, 0, 0.55), m_salvo, g5, 0.025)
escala(g5, 1, 0.001, 'CONSTANT')
escala(g5, Q(TOQUE3 + 0.2), 0.001, 'BACK')
escala(g5, Q(TOQUE3 + 0.7), 1.0)
escala(g5, Q(SAI0), 1.0)
escala(g5, Q(SAI0 + 0.6), 0.001)
brilho(m_salvo, Q(TOQUE3 + 0.1), 0.0)
brilho(m_salvo, Q(TOQUE3 + 0.3), 3.5)
brilho(m_salvo, Q(SAI0), 3.5)
brilho(m_salvo, Q(SAI0 + 0.6), 0.0)

# --- 6. desligando: um anel que encolhe até sumir
m_fim = emissor('fim', CIANO, 0.0)
g6 = grupo('fim', (RX, 930))
anel('f_anel', 3.2, 0.03, m_fim, g6)
escala(g6, 1, 1.0, 'CONSTANT')
escala(g6, Q(SAI0), 1.0, 'BEZIER')
escala(g6, Q(SAI1 + 0.4), 0.001)
brilho(m_fim, Q(SAI0 - 0.1), 0.0)
brilho(m_fim, Q(SAI0 + 0.2), 3.5)
brilho(m_fim, Q(SAI1 + 0.3), 3.5)
brilho(m_fim, Q(SAI1 + 0.5), 0.0)

os.makedirs(os.path.join(PASTA, 'holo_teste' if TESTE else 'holo'), exist_ok=True)
if TESTE:
    for t in (0.8, 2.6, 5.6, 9.0, 11.2, 15.0, 22.6, 26.5, 31.6):
        sc.frame_set(Q(t))
        sc.render.filepath = os.path.join(PASTA, 'holo_teste', f't{t:05.1f}.png')
        bpy.ops.render.render(write_still=True)
else:
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = os.path.join(PASTA, 'holo', 'h')
    bpy.ops.render.render(animation=True)
