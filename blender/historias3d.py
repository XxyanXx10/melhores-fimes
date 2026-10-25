"""
Peças comuns das histórias 3D da série "A IA que…" (robozinho do canal + objetos grátis da Kenney).

Cada história (apagou.py, investindo.py, carro.py, chantagem.py…) faz `from historias3d import *`
e só descreve as tomadas. Tudo em metros, câmera olhando para +Y, 30 fps.
"""
import bpy, math, os, random, sys
from mathutils import Matrix

sys.path.append(os.path.dirname(__file__))
from base3d import *  # noqa: E402,F401,F403

MODELOS = 'C:/Users/yaned/Videos/Melhores Fimes/3d/modelos'
SAIDAS = 'C:/Users/yaned/Videos/Melhores Fimes/3d'
VERMELHO = (0.85, 0.06, 0.06)
AMARELO = (0.98, 0.82, 0.15)
VERDE = (0.15, 0.7, 0.35)
AZUL = (0.12, 0.4, 0.92)
BRANCO = (0.97, 0.97, 0.99)
PRETO = (0.06, 0.06, 0.08)


def s2q(seg):
    """segundos dentro da tomada → quadro"""
    return max(1, round(seg * 30) + 1)


def mirar(de, para):
    return math.atan2(-(para[0] - de[0]), para[1] - de[1])


def robo(loc=(0, 0.6, 1.0), altura=0.8, giro=0.0, nome='robo'):
    """o robozinho do canal; o GLB é importado uma vez por cena e os outros são cópias (bem mais rápido)"""
    base = bpy.data.meshes.get('ROBO_BASE')
    if base is None:
        r0 = importar(f'{MODELOS}/robo.glb', 'robo_base', altura=1.0)
        base = r0.data
        base.name = 'ROBO_BASE'
        base.use_fake_user = True
        bpy.data.objects.remove(r0)
    me = base.copy()
    me.transform(Matrix.Scale(altura, 4))
    r = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(r)
    r.location = loc
    r.rotation_euler = (0, 0, giro)
    return r


def flutuar(obj, ini, fim, amp=0.035, periodo=36):
    z0 = obj.location.z
    f, lado = ini, 1
    while f <= fim + periodo:
        chave(obj, 'location', f, (obj.location.x, obj.location.y, z0 + amp * lado), 'SINE')
        f += periodo // 2
        lado = -lado


def tremer(obj, ini, fim, graus=10, passo=3):
    """sacode no eixo Y (pânico, susto)"""
    base = tuple(obj.rotation_euler)
    for i, f in enumerate(range(ini, fim, passo)):
        lado = graus if i % 2 else -graus
        chave(obj, 'rotation_euler', f, (base[0], math.radians(lado), base[2]), 'LINEAR')
    chave(obj, 'rotation_euler', fim, base, 'BEZIER')


def pular(obj, quadro, altura=0.25, dur=14):
    x, y, z = obj.location
    chave(obj, 'location', quadro, (x, y, z), 'SINE')
    chave(obj, 'location', quadro + dur // 2, (x, y, z + altura), 'SINE')
    chave(obj, 'location', quadro + dur, (x, y, z), 'BEZIER')


def titulo(nome, conteudo, loc, cor_fundo=VERMELHO, cor_texto=(1, 1, 1), largura=1.05, altura=0.55, tam=0.2, quadro=1):
    """placa grande de gancho, já cheia na tela no primeiro quadro (ou surgindo no quadro dado)"""
    t = etiqueta(nome, conteudo, cor_fundo, cor_texto, loc, largura=largura, altura=altura, tam=tam)
    if quadro <= 1:
        chave(t, 'scale', 1, (0.6, 0.6, 0.6), 'BACK')
        chave(t, 'scale', 7, (1, 1, 1))
    else:
        aparecer(t, quadro)
    return t


def sumir(obj, quadro, dur=6):
    s = tuple(obj.scale)
    chave(obj, 'scale', quadro, s, 'BEZIER')
    chave(obj, 'scale', quadro + dur, (0.001, 0.001, 0.001), 'CONSTANT')


def carimbo(nome, conteudo, loc, quadro, cor=VERMELHO, largura=0.9, altura=0.32, tam=0.17, giro=-12):
    """carimbo que bate na tela (vem grande e para inclinado)"""
    c = etiqueta(nome, conteudo, cor, (1, 1, 1), loc, largura=largura, altura=altura, tam=tam)
    c.rotation_euler = (0, math.radians(giro), 0)
    chave(c, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(c, 'scale', max(2, quadro), (2.4, 2.4, 2.4), 'BEZIER')
    chave(c, 'scale', max(2, quadro) + 5, (1, 1, 1), 'BACK')
    return c


def tela(nome, dims, loc, cor=(0.03, 0.06, 0.12), brilho=0.7, borda=(0.1, 0.1, 0.12)):
    """monitor/painel na parede: moldura + tela acesa. Devolve o empty raiz (texto vai como filho)"""
    raiz = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = loc
    b = caixa(nome + '_borda', (dims[0] + 0.1, 0.06, dims[1] + 0.1), (0, 0, 0), material(nome + 'b', borda, rough=0.4), bevel=0.03)
    t = caixa(nome + '_tela', (dims[0], 0.03, dims[1]), (0, -0.025, 0), material(nome + 't', cor, emissao=cor, forca=brilho), bevel=0.015)
    b.parent = raiz
    t.parent = raiz
    return raiz


def texto_em(pai, nome, conteudo, tam, rel, cor=(1, 1, 1), forca=0.9, extrude=0.008):
    t = texto(nome, conteudo, tam, (0, 0, 0), material(nome + 'm', cor, emissao=cor, forca=forca), extrude=extrude)
    t.parent = pai
    t.location = rel
    return t


def trocar(objs_quadros):
    """mostra cada objeto só no seu trecho: [(obj, quadro_em_que_aparece), ...] (o seguinte esconde o anterior)"""
    for i, (o, q) in enumerate(objs_quadros):
        prox = objs_quadros[i + 1][1] if i + 1 < len(objs_quadros) else None
        final = tuple(o.scale)
        chave(o, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
        chave(o, 'scale', max(2, q), (0.001, 0.001, 0.001), 'BACK')
        chave(o, 'scale', max(2, q) + 5, final, 'CONSTANT')
        if prox:
            chave(o, 'scale', prox, (0.001, 0.001, 0.001), 'CONSTANT')


def celular(loc=(0.32, 0.0, 1.55), escala=1.0):
    raiz = bpy.data.objects.new('celular', None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = loc
    raiz.scale = (escala, escala, escala)
    c = caixa('cel_corpo', (0.62, 0.04, 1.1), (0, 0, 0), material('cel', (0.08, 0.08, 0.1), rough=0.3), bevel=0.04)
    t = caixa('cel_tela', (0.57, 0.02, 1.03), (0, -0.025, 0), material('cel_tela', (0.92, 0.95, 0.98), emissao=(0.92, 0.95, 0.98), forca=0.5), bevel=0.02)
    c.parent = raiz
    t.parent = raiz
    return raiz


def balao(nome, conteudo, loc, meu=True, pai=None, largura=0.5, tam=0.062):
    cor = (0.2, 0.75, 0.45) if meu else (0.95, 0.95, 0.97)
    txt = (1, 1, 1) if meu else (0.1, 0.1, 0.12)
    linhas = len(conteudo.splitlines())
    b = etiqueta(nome, conteudo, cor, txt, loc, largura=largura, altura=0.09 + tam * 1.2 * linhas, tam=tam)
    if pai:
        b.parent = pai
        b.location = loc
    return b


def confete(centro, quadro, n=60, raio=1.2, cores=(AMARELO, VERMELHO, AZUL, VERDE, BRANCO)):
    random.seed(quadro)
    mats = [material(f'conf{i}', c, emissao=c, forca=0.4) for i, c in enumerate(cores)]
    for i in range(n):
        p = caixa(f'conf_{quadro}_{i}', (0.035, 0.005, 0.02), (centro[0] + random.uniform(-raio, raio), centro[1] + random.uniform(-0.4, 0.3),
                                                               centro[2] + random.uniform(-0.6, 0.4)), mats[i % len(mats)])
        p.rotation_euler = (random.uniform(0, 6), random.uniform(0, 6), random.uniform(0, 6))
        cair(p, quadro + random.randint(0, 12), altura=random.uniform(1.0, 2.2), dur=random.randint(18, 30))
        chave(p, 'rotation_euler', quadro + 40, (random.uniform(0, 12), random.uniform(0, 12), random.uniform(0, 12)), 'LINEAR')


def nota(nome, loc, giro=0.0):
    """cédula de dólar simplificada"""
    m = bpy.data.materials.get('nota_m') or material('nota_m', (0.45, 0.72, 0.42), rough=0.6)
    o = caixa(nome, (0.3, 0.13, 0.008), loc, m, bevel=0.002)
    o.rotation_euler = (0, 0, giro)
    return o


def luz_alarme(loc, ini, fim, periodo=12, energia=900, cor=(1.0, 0.12, 0.08)):
    """luz vermelha piscando (alarme)"""
    l = luz('alarme', 'POINT', loc, 0, cor=cor)
    for i, f in enumerate(range(ini, fim + 1, periodo // 2)):
        l.data.energy = energia if i % 2 == 0 else 60
        l.data.keyframe_insert('energy', frame=f)
    return l


def rodar(nome_arquivo, tomadas, fns):
    """parte comum do __main__: blender -b --python <historia>.py -- <tomada|todas> [--teste]"""
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    teste = '--teste' in args
    escolha = [a for a in args if not a.startswith('--')]
    nomes = list(tomadas) if not escolha or escolha[0] == 'todas' else escolha
    saida = f'{SAIDAS}/{nome_arquivo}'
    for nome in nomes:
        fns[nome]()
        renderizar(f'{saida}/{nome}', teste)
