"""
Série "Como funciona" — ep. "Como o ChatGPT escreve uma resposta?" — apresentado pelo personagem 3D do canal.

    blender -b --factory-startup --python blender/cf_chatgpt.py -- <tomada|todas> [--teste]

Visual de brinquedo: sala colorida, blocos de palavras que caem e empilham, barras de chance que crescem.
Formato 9:16: o apresentador fica grande embaixo e o assunto em cima (prateleira, placas, barras).
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from historias3d import *  # noqa: E402,F401,F403
from apresentador3d import apresentador, pose, gesto, balancar, pulinho  # noqa: E402

TOMADAS = {
    'abertura': 5.63,   # "Como o ChatGPT escreve uma resposta? Ele não procura a resposta pronta…"
    'adivinha': 2.73,   # "Ele adivinha. Uma palavra de cada vez."
    'tokens': 6.48,     # "a capital do Brasil é… o texto vira pedacinhos, chamados tokens."
    'chances': 7.64,    # "qual pedaço tem mais chance… Brasília, Rio, São Paulo"
    'escolhe': 6.93,    # "Ele escolhe Brasília… Milhares de vezes, em poucos segundos."
    'leu': 9.73,        # "Mas como ele sabe as chances? Ele leu… sites, livros, conversas…"
    'alucina': 7.60,    # "É por isso que às vezes ele inventa… alucinação."
    'fim': 7.14,        # "não pensa como a gente… maior adivinhador de palavras do mundo. Comenta aí."
}
AP = (0.32, -0.55, 0)       # apresentador grande, embaixo à direita
PAREDE = 1.3
PRAT = 0.5                  # profundidade da prateleira dos blocos
CORES = [(0.95, 0.35, 0.35), (0.98, 0.72, 0.2), (0.35, 0.75, 0.45), (0.3, 0.55, 0.95), (0.7, 0.45, 0.9)]
AZUL_B = (0.3, 0.55, 0.95)
CAM = (0, -2.75, 1.3)
ALVO = (0, 0.4, 1.25)


def cenario(prateleira=None):
    plano('piso', (30, 30), (0, 0, 0), material('piso', (0.93, 0.85, 0.7), rough=0.75))
    plano('parede', (30, 12), (0, PAREDE, 6), material('parede', (0.62, 0.8, 0.95), rough=0.85), rot=(math.pi / 2, 0, 0))
    caixa('rodape', (30, 0.05, 0.12), (0, PAREDE - 0.03, 0.06), material('rodape', (0.97, 0.97, 0.97), rough=0.5))
    if prateleira:
        caixa('prat', (2.3, 0.3, 0.04), (-0.05, PRAT, prateleira - 0.02), material('pratm', (0.98, 0.98, 0.98), rough=0.4), bevel=0.01)
    iluminacao()


def preparar(t, prateleira=None):
    limpar()
    configurar_render(TOMADAS[t])
    cenario(prateleira)
    return camera()


def largura_bloco(p):
    return max(0.2, 0.062 * len(p) + 0.1)


def bloco(nome, texto_, loc, cor, tam=0.09, alt=0.18):
    """bloco de brinquedo com a palavra na frente"""
    larg = largura_bloco(texto_)
    raiz = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = loc
    c = caixa(nome + '_c', (larg, 0.2, alt), (0, 0, alt / 2), material(nome + 'm', cor, rough=0.35), bevel=0.03)
    c.parent = raiz
    t = texto(nome + '_t', texto_, tam, (0, 0, 0), material(nome + 'tm', (1, 1, 1), emissao=(1, 1, 1), forca=0.4), extrude=0.01)
    t.parent = raiz
    t.location = (0, -0.105, alt / 2)
    raiz['larg'] = larg
    return raiz


def fileira(prefixo, palavras, z, cor=AZUL_B, x0=None, folga=0.03, cores=None):
    """blocos lado a lado na prateleira (centralizados, ou a partir de x0). Devolve (blocos, x do fim)"""
    larguras = [largura_bloco(p) for p in palavras]
    total = sum(larguras) + folga * (len(palavras) - 1)
    x = -total / 2 - 0.05 if x0 is None else x0
    blocos = []
    for i, (p, l) in enumerate(zip(palavras, larguras)):
        blocos.append(bloco(f'{prefixo}{i}', p, (x + l / 2, PRAT, z), cores[i] if cores else cor))
        x += l + folga
    return blocos, x


def barra(nome, x, cor, altura_final, q0, q1, rotulo):
    piv = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(piv)
    piv.location = (x, 0.55, 0)
    b = caixa(nome + '_b', (0.36, 0.36, 1.0), (0, 0, 0.5), material(nome + 'm', cor, rough=0.35), bevel=0.04)
    b.parent = piv
    chave(piv, 'scale', 1, (1, 1, 0.001), 'CONSTANT')
    chave(piv, 'scale', q0, (1, 1, 0.001), 'BACK')
    chave(piv, 'scale', q1, (1, 1, altura_final))
    e = etiqueta(nome + '_e', rotulo, (1, 1, 1), (0.1, 0.1, 0.12), (x, 0.3, altura_final + 0.16), largura=0.58, altura=0.2, tam=0.095)
    aparecer(e, q1 - 2)
    return piv


def cam_suave(cam, alvo, pontos):
    for q, c, a in pontos:
        chave(cam, 'location', q, c, 'BEZIER')
        chave(alvo, 'location', q, a, 'BEZIER')


def cam_padrao(cam, alvo, fim, chegar=0.25):
    """aproximação lenta: a câmera nunca fica parada"""
    cx, cy, cz = CAM
    ax, ay, az = ALVO
    cam_suave(cam, alvo, [(1, (cx, cy, cz), (ax, ay, az)), (fim, (cx - 0.05, cy + chegar, cz - 0.03), (ax, ay, az - 0.02))])


def t_abertura():
    cam, alvo = preparar('abertura')
    a = apresentador('ian', (0.05, -0.5, 0), altura=1.15, giro=math.radians(-8))
    gesto(a, 'acenar', 1, 40)
    balancar(a, 1, s2q(5.63))
    gesto(a, 'explicar', 60, s2q(5.63))
    tela('telao', (1.55, 0.85), (0, PAREDE - 0.04, 2.0), cor=(0.97, 0.98, 1.0), brilho=0.35, borda=(0.15, 0.15, 0.18))
    titulo('t', 'COMO O CHATGPT\nESCREVE?', (0, PAREDE - 0.12, 2.0), cor_fundo=(0.1, 0.65, 0.5), largura=1.4, altura=0.62, tam=0.17)
    b = balao('pergunta', 'Ele procura\na resposta?', (-0.48, -0.3, 1.4), meu=True, largura=0.8, tam=0.1)
    aparecer(b, s2q(2.8))
    carimbo('nao', 'NÃO!', (-0.45, -0.32, 1.05), s2q(4.3), largura=0.5, altura=0.22, tam=0.13)
    cam_suave(cam, alvo, [(1, (0, -2.4, 1.3), (0, 0.4, 1.3)), (s2q(5.63), (0, -2.75, 1.32), (0, 0.4, 1.3))])


def t_adivinha():
    cam, alvo = preparar('adivinha', prateleira=1.55)
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    pose(a, 'pensando', 1)
    balancar(a, 1, s2q(2.73))
    blocos, _ = fileira('p', ['UMA', 'PALAVRA', 'DE', 'CADA', 'VEZ'], 1.55, cores=CORES)
    for i, b in enumerate(blocos):
        cair(b, s2q(0.9) + i * 9, altura=1.2, dur=8)
    titulo('t', 'ELE ADIVINHA', (0, PRAT + 0.1, 2.25), cor_fundo=(0.95, 0.35, 0.35), largura=1.25, altura=0.3, tam=0.15)
    cam_padrao(cam, alvo, s2q(2.73))


def t_tokens():
    cam, alvo = preparar('tokens', prateleira=1.55)
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    gesto(a, 'explicar', 1, s2q(6.48))
    balancar(a, 1, s2q(6.48))
    blocos, _ = fileira('f', ['A', 'CAPITAL', 'DO', 'BRASIL', 'É…'], 1.55, folga=0.0)
    for i, b in enumerate(blocos):
        aparecer(b, s2q(0.4) + i * 5)
    # "vira pedacinhos": separam, inclinam e ganham o rótulo TOKENS
    random.seed(5)
    for i, b in enumerate(blocos):
        x0 = b.location.x
        chave(b, 'location', s2q(3.6), (x0, PRAT, 1.55))
        chave(b, 'location', s2q(4.2), (x0 + (i - 2) * 0.07, PRAT - 0.05, 1.62), 'BACK')
        chave(b, 'rotation_euler', s2q(3.6), (0, 0, 0))
        chave(b, 'rotation_euler', s2q(4.4), (0, math.radians(random.uniform(-10, 10)), 0))
    titulo('tk', 'TOKENS', (0, PRAT + 0.1, 2.2), cor_fundo=(0.98, 0.72, 0.2), cor_texto=(0.1, 0.1, 0.12), largura=0.9, altura=0.3, tam=0.16, quadro=s2q(4.3))
    cam_padrao(cam, alvo, s2q(6.48))


def t_chances():
    cam, alvo = preparar('chances')
    a = apresentador('ian', (0.55, -0.5, 0), altura=1.15, giro=math.radians(-30))
    balancar(a, 1, s2q(7.64))
    gesto(a, 'apontar_e', s2q(2.6), s2q(6.8))
    titulo('t', 'QUAL VEM DEPOIS?', (-0.05, PRAT + 0.2, 2.3), cor_fundo=(0.1, 0.1, 0.12), largura=1.5, altura=0.3, tam=0.14)
    barra('b1', -0.65, (0.35, 0.78, 0.45), 1.45, s2q(2.9), s2q(3.6), 'BRASÍLIA')
    barra('b2', -0.2, (0.98, 0.72, 0.2), 0.4, s2q(4.7), s2q(5.2), 'RIO')
    barra('b3', 0.25, (0.95, 0.35, 0.35), 0.06, s2q(5.6), s2q(6.0), 'SÃO PAULO')
    cam_suave(cam, alvo, [(1, (0, -2.75, 1.25), (0, 0.4, 1.15)), (s2q(7.64), (-0.1, -2.55, 1.2), (-0.05, 0.4, 1.1))])


def t_escolhe():
    cam, alvo = preparar('escolhe', prateleira=1.55)
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, s2q(6.93))
    pulinho(a, s2q(1.2))
    gesto(a, 'comemorar', s2q(1.0), s2q(2.2))
    _, x = fileira('f', ['A', 'CAPITAL', 'DO', 'BRASIL', 'É'], 1.55, x0=-1.03, folga=0.0)
    br = bloco('bras', 'BRASÍLIA', (0, PRAT, 1.55), (0.35, 0.78, 0.45))
    destino = x + br['larg'] / 2
    chave(br, 'location', 1, (0.0, PRAT - 0.3, 2.3), 'CONSTANT')
    chave(br, 'location', s2q(0.3), (0.0, PRAT - 0.3, 2.3), 'BACK')
    chave(br, 'location', s2q(1.1), (destino, PRAT, 1.55))
    # "faz tudo de novo": uma chuva de blocos empilhando no chão, rápido
    random.seed(3)
    for i in range(30):
        p = random.choice(['E', 'A', 'É', 'DE', 'UMA', 'CIDADE', 'O', 'QUE', 'SIM', 'FICA'])
        b = bloco(f'r{i}', p, (random.uniform(-0.95, 0.05), random.uniform(0.1, 0.8), (i // 7) * 0.18), CORES[i % len(CORES)])
        b.rotation_euler = (0, 0, math.radians(random.uniform(-15, 15)))
        cair(b, s2q(2.7) + i * 3, altura=2.2, dur=6)
    titulo('t', 'MILHARES DE VEZES', (-0.05, PRAT + 0.1, 2.25), cor_fundo=(0.7, 0.45, 0.9), largura=1.5, altura=0.3, tam=0.14, quadro=s2q(4.1))
    cam_suave(cam, alvo, [(1, (0, -2.55, 1.35), (0, 0.4, 1.35)), (s2q(2.6), (0, -2.75, 1.3), (0, 0.4, 1.25)), (s2q(6.93), (-0.05, -2.95, 1.35), (-0.05, 0.4, 1.2))])


def t_leu():
    cam, alvo = preparar('leu')
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, s2q(9.73))
    gesto(a, 'pensando', 1, s2q(2.2))
    gesto(a, 'susto', s2q(2.4), s2q(4.5))
    gesto(a, 'explicar', s2q(6.6), s2q(9.6))
    random.seed(8)
    capas = [(0.85, 0.2, 0.2), (0.2, 0.45, 0.85), (0.95, 0.7, 0.15), (0.25, 0.65, 0.35), (0.6, 0.3, 0.75)]
    n = 0
    for col in range(5):
        for alt in range(14 - abs(col - 2) * 2):
            livro = caixa(f'l{n}', (0.24, 0.32, 0.07), (-0.95 + col * 0.26, 0.55, 0.035 + alt * 0.072), material(f'lm{n % 5}', capas[n % 5], rough=0.6), bevel=0.008)
            livro.rotation_euler = (0, 0, math.radians(random.uniform(-7, 7)))
            cair(livro, s2q(1.6) + n * 2, altura=2.4, dur=6)
            n += 1
    for i, (rot, q) in enumerate((('SITES', 4.2), ('LIVROS', 4.9), ('CONVERSAS', 5.6))):
        e = etiqueta(f'e{i}', rot, CORES[i + 1], (1, 1, 1), (-0.6 + i * 0.5, 0.25, 1.75 - (i % 2) * 0.22), largura=0.5, altura=0.17, tam=0.075)
        aparecer(e, s2q(q))
    titulo('t', 'LEU MUITO TEXTO', (-0.05, PRAT + 0.2, 2.3), cor_fundo=(0.1, 0.65, 0.5), largura=1.45, altura=0.3, tam=0.14)
    cam_suave(cam, alvo, [(1, (0, -2.5, 1.3), (0, 0.4, 1.25)), (s2q(9.73), (-0.05, -2.95, 1.35), (-0.05, 0.4, 1.2))])


def t_alucina():
    cam, alvo = preparar('alucina', prateleira=1.55)
    a = apresentador('ian', AP, altura=1.15, giro=math.radians(-25))
    balancar(a, 1, s2q(7.6))
    gesto(a, 'pensando', 1, s2q(3.0))
    gesto(a, 'susto', s2q(5.2), s2q(7.4))
    palavras = ['O', 'BRASIL', 'TEM', '28', 'ESTADOS']
    blocos, _ = fileira('f', palavras, 1.55, cores=[(0.95, 0.35, 0.35) if p == '28' else AZUL_B for p in palavras])
    for i, b in enumerate(blocos):
        aparecer(b, s2q(0.6) + i * 6)
    tremer(blocos[3], s2q(3.0), s2q(4.0), graus=12)
    carimbo('errado', 'INVENTOU!', (0.0, PRAT - 0.35, 1.25), s2q(3.2), largura=0.85, altura=0.26, tam=0.14)
    titulo('t', 'ALUCINAÇÃO', (0, PRAT + 0.1, 2.25), cor_fundo=(0.1, 0.1, 0.12), largura=1.25, altura=0.34, tam=0.17, quadro=s2q(5.2))
    cam_padrao(cam, alvo, s2q(7.6), chegar=0.35)


def t_fim():
    cam, alvo = preparar('fim')
    a = apresentador('ian', (0.0, -0.45, 0), altura=1.2, giro=0)
    balancar(a, 1, s2q(7.14))
    gesto(a, 'explicar', 1, s2q(2.4))
    pose(a, 'comemorar', s2q(2.6), 'BACK')
    pulinho(a, s2q(2.6), 0.12)
    pose(a, 'comemorar', s2q(4.6))
    gesto(a, 'acenar', s2q(4.8), s2q(7.1))
    titulo('t', 'O MAIOR\nADIVINHADOR\nDE PALAVRAS', (0, PAREDE - 0.1, 2.05), cor_fundo=(0.98, 0.72, 0.2), cor_texto=(0.1, 0.1, 0.12), largura=1.45, altura=0.8, tam=0.16, quadro=s2q(2.5))
    confete((0, 0.0, 2.1), s2q(2.6), n=70)
    cam_suave(cam, alvo, [(1, (0, -2.45, 1.3), (0, 0.4, 1.3)), (s2q(7.14), (0, -2.8, 1.35), (0, 0.4, 1.32))])


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('cf_chatgpt', TOMADAS, TOMADA_FN)
