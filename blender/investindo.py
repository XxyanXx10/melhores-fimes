"""
"Deram 10 mil dólares pra 6 IAs investirem" (Alpha Arena, da Nof1, 18/10 a 03/11/2025) em 3D.

    blender -b --factory-startup --python blender/investindo.py -- <tomada|todas> [--teste]

Seis cópias do robozinho num palco, cada uma com a placa do nome; gráfico de barras atrás.
Resultado real: Qwen +22% (1º), DeepSeek no lucro (2º); as 4 americanas no prejuízo, GPT-5 ~ -59%.
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from historias3d import *  # noqa: E402,F401,F403

TOMADAS = {
    'abertura': 5.76,      # "Deram dez mil dólares pra seis IAs… e a mais famosa foi a pior!"
    'laboratorio': 7.82,   # "de verdade, fim de 2025. Um laboratório… criptomoedas com dinheiro de verdade:"
    'nomes': 7.42,         # "o GPT-5, do ChatGPT, o Gemini, o Claude, o Grok… e duas chinesas, DeepSeek e Qwen."
    'sozinhos': 1.68,      # "Sem nenhum humano ajudando."
    'corrida': 6.55,       # "Em duas semanas, as quatro americanas perderam dinheiro. O GPT-5 perdeu quase sessenta por cento."
    'vencedor': 5.65,      # "E quem ganhou? A chinesa Qwen, com 22% de lucro. A DeepSeek ficou em segundo."
    'fim': 6.77,           # "Ou seja: o cérebro do ChatGPT foi o pior investidor… Você deixaria uma IA cuidar do seu dinheiro?"
}
# nome, cor da placa, resultado final (1.0 = os 10 mil do começo), quando o nome é falado (s, na tomada 'nomes')
IAS = [('GPT-5', (0.1, 0.65, 0.5), 0.41, 0.08), ('GEMINI', (0.25, 0.45, 0.95), 0.54, 1.97), ('CLAUDE', (0.85, 0.5, 0.3), 0.70, 3.07),
       ('GROK', (0.25, 0.25, 0.3), 0.55, 3.95), ('DEEPSEEK', (0.3, 0.35, 0.9), 1.05, 5.96), ('QWEN', (0.55, 0.3, 0.85), 1.22, 6.56)]
XS = [-1.05 + i * 0.42 for i in range(6)]
VERDE_DINHEIRO = (0.2, 0.75, 0.35)


def cenario():
    plano('piso', (30, 30), (0, 0, 0), material('piso', (0.1, 0.1, 0.16), rough=0.3, metal=0.2))
    plano('parede', (30, 10), (0, 2.6, 5), material('parede', (0.06, 0.07, 0.14), rough=0.8), rot=(math.pi / 2, 0, 0))
    caixa('palco', (3.4, 1.2, 0.25), (0, 0.5, 0.125), material('palco', (0.14, 0.14, 0.2), rough=0.35), bevel=0.03)
    caixa('palco_luz', (3.4, 0.02, 0.03), (0, -0.11, 0.24), material('palco_l', AMARELO, emissao=AMARELO, forca=2.0))
    iluminacao()
    escurecer(0.7)


def preparar(t):
    limpar()
    configurar_render(TOMADAS[t])
    cenario()
    return camera()


def time_ias(placas_em=None, escurecer_menos=None):
    """os 6 robôs no palco, com placas (placas_em: lista de quadros em que cada placa surge)"""
    robos = []
    for i, (nome, cor, _, _) in enumerate(IAS):
        caixa(f'pedestal{i}', (0.34, 0.34, 0.12), (XS[i], 0.5, 0.31), material(f'ped{i}', cor, rough=0.35), bevel=0.02)
        r = robo((XS[i], 0.5, 0.37), altura=0.55, nome=f'robo{i}')
        flutuar(r, 1 + i * 5, 400, amp=0.02)
        robos.append(r)
        p = etiqueta(f'placa{i}', nome, cor, (1, 1, 1), (XS[i], -0.13, 0.13), largura=0.39, altura=0.11, tam=0.055 if len(nome) < 7 else 0.042)
        if placas_em:
            aparecer(p, placas_em[i])
    return robos


def chuva_de_notas(ini, n=40, area=(-1.6, 1.6), z0=0.3, seed=1):
    random.seed(seed)
    for i in range(n):
        o = nota(f'nota{i}', (random.uniform(*area), random.uniform(-0.3, 0.9), z0 + random.uniform(0, 0.4)), random.uniform(0, 6))
        o.rotation_euler = (random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), random.uniform(0, 6))
        cair(o, ini + i * 2, altura=random.uniform(1.6, 2.6), dur=random.randint(18, 28))


def barra(nome, x, cor, y=1.9, largura=0.32):
    """barra que cresce a partir da base (escala o pivô em Z)"""
    piv = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(piv)
    piv.location = (x, y, 0.4)
    b = caixa(nome + '_b', (largura, 0.12, 1.0), (0, 0, 0.5), material(nome + 'm', cor, emissao=cor, forca=0.5), bevel=0.01)
    b.parent = piv
    return piv


def t_abertura():
    cam, alvo = preparar('abertura')
    time_ias()
    titulo('titulo', 'US$ 10 MIL\nPRA CADA IA', (0, -0.3, 1.75), cor_fundo=VERDE_DINHEIRO, largura=1.25, altura=0.5, tam=0.16)
    pior = etiqueta('pior', 'A MAIS FAMOSA\nFOI A PIOR', VERMELHO, (1, 1, 1), (0, -0.35, 1.3), largura=1.0, altura=0.32, tam=0.1)
    aparecer(pior, s2q(3.6))
    chuva_de_notas(4)
    chave(cam, 'location', 1, (0, -3.6, 1.55), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.15), 'BEZIER')
    chave(cam, 'location', s2q(5.76), (0, -4.0, 1.45))
    chave(alvo, 'location', s2q(5.76), (0, 0.5, 1.05))


def t_laboratorio():
    cam, alvo = preparar('laboratorio')
    escurecer(0.8)
    # moeda gigante de cripto girando
    ouro = material('ouro', (1.0, 0.72, 0.15), rough=0.25, metal=0.6)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.55, depth=0.09, location=(0, 0.6, 1.45), rotation=(math.pi / 2, 0, 0), vertices=64)
    moeda_g = bpy.context.active_object
    moeda_g.data.materials.append(ouro)
    bpy.ops.object.shade_smooth()
    simbolo = texto('cripto', 'CRIPTO', 0.17, (0, -0.05, 0), material('cripto_t', (0.45, 0.28, 0.02)), extrude=0.02)
    simbolo.parent = moeda_g
    simbolo.location = (0, 0, 0.05)
    simbolo.rotation_euler = (0, 0, 0)
    chave(moeda_g, 'rotation_euler', 1, (math.pi / 2, 0, -0.5), 'LINEAR')
    chave(moeda_g, 'rotation_euler', s2q(7.82), (math.pi / 2, 0, 0.5))
    a = etiqueta('ano', 'FIM DE 2025', BRANCO, PRETO, (0, 0.2, 2.3), largura=0.7, altura=0.18, tam=0.09)
    aparecer(a, s2q(0.3))
    lab = etiqueta('lab', 'TORNEIO DE IAs\nINVESTIDORAS', AZUL, (1, 1, 1), (0, 0.2, 0.62), largura=1.0, altura=0.3, tam=0.09)
    aparecer(lab, s2q(3.0))
    real = etiqueta('real', 'DINHEIRO\nDE VERDADE', VERDE_DINHEIRO, (1, 1, 1), (0.45, -0.1, 1.95), largura=0.7, altura=0.3, tam=0.1)
    real.rotation_euler = (0, math.radians(-8), 0)
    aparecer(real, s2q(6.6))
    chuva_de_notas(s2q(6.4), n=30, z0=0.0, seed=7)
    chave(cam, 'location', 1, (0, -2.6, 1.5), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.6, 1.45), 'BEZIER')
    chave(cam, 'location', s2q(7.82), (0, -2.1, 1.5))
    chave(alvo, 'location', s2q(7.82), (0, 0.6, 1.45))


def t_nomes():
    cam, alvo = preparar('nomes')
    robos = time_ias(placas_em=[s2q(ia[3]) for ia in IAS])
    # cada robô dá um pulinho quando é chamado
    for r, ia in zip(robos, IAS):
        pular(r, s2q(ia[3]), altura=0.12, dur=10)
    china = etiqueta('china', 'CHINESAS', VERMELHO, (1, 1, 1), (1.0, 0.1, 1.15), largura=0.6, altura=0.16, tam=0.08)
    aparecer(china, s2q(4.6))
    eua = etiqueta('eua', 'AMERICANAS', AZUL, (1, 1, 1), (-0.45, 0.1, 1.15), largura=0.7, altura=0.16, tam=0.08)
    aparecer(eua, s2q(0.3))
    # câmera passeia da esquerda (GPT-5) para a direita (Qwen) acompanhando os nomes
    pontos = [(0.0, -1.0), (2.0, -0.6), (3.1, -0.3), (4.0, 0.1), (6.0, 0.9), (7.4, 0.95)]
    for seg, x in pontos:
        chave(cam, 'location', s2q(seg), (x, -2.0, 1.15), 'BEZIER')
        chave(alvo, 'location', s2q(seg), (x, 0.5, 0.7), 'BEZIER')


def t_sozinhos():
    cam, alvo = preparar('sozinhos')
    time_ias()
    t = titulo('sem', 'SEM HUMANOS\nAJUDANDO', (0, -0.3, 1.45), cor_fundo=PRETO, largura=1.2, altura=0.45, tam=0.14)
    del t
    chave(cam, 'location', 1, (0, -3.6, 1.4), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.0), 'BEZIER')
    chave(cam, 'location', s2q(1.68), (0, -3.3, 1.35))
    chave(alvo, 'location', s2q(1.68), (0, 0.5, 1.0))


def t_corrida():
    cam, alvo = preparar('corrida')
    time_ias()
    linha_base = caixa('base10', (3.4, 0.02, 0.012), (0, 1.82, 1.4), material('linha', BRANCO, emissao=BRANCO, forca=1.0))
    del linha_base
    texto('base_txt', 'US$ 10 MIL', 0.07, (-1.45, 1.8, 1.48), material('base_t', BRANCO, emissao=BRANCO, forca=1.0), extrude=0.005)
    for i, (nome, cor, final, _) in enumerate(IAS):
        piv = barra(f'barra{i}', XS[i], cor)
        chave(piv, 'scale', 1, (1, 1, 0.001), 'BEZIER')
        chave(piv, 'scale', s2q(0.6), (1, 1, 1.0), 'BEZIER')
        # oscila e vai para o resultado final; as americanas caem
        meio = 1.0 + (0.12 if final > 1 else -0.1) * (1 + i % 2)
        chave(piv, 'scale', s2q(1.6), (1, 1, meio), 'BEZIER')
        chave(piv, 'scale', s2q(3.6), (1, 1, final), 'BEZIER')
    perda = etiqueta('perda', 'PREJUÍZO', VERMELHO, (1, 1, 1), (-0.5, 0.0, 2.12), largura=0.75, altura=0.2, tam=0.11)
    aparecer(perda, s2q(2.3))
    gpt = etiqueta('gpt', 'GPT-5\nQUASE -60%', VERMELHO, (1, 1, 1), (-1.0, -0.2, 1.05), largura=0.7, altura=0.3, tam=0.085)
    aparecer(gpt, s2q(3.8))
    chave(cam, 'location', 1, (0, -3.6, 1.6), 'BEZIER')
    chave(alvo, 'location', 1, (0, 1.0, 1.25), 'BEZIER')
    chave(cam, 'location', s2q(3.6), (-0.3, -3.3, 1.55), 'BEZIER')
    chave(alvo, 'location', s2q(3.6), (-0.3, 1.0, 1.2), 'BEZIER')
    chave(cam, 'location', s2q(6.55), (-0.9, -2.2, 1.3))
    chave(alvo, 'location', s2q(6.55), (-1.0, 1.0, 0.9))


def t_vencedor():
    cam, alvo = preparar('vencedor')
    m_pod = material('podio', (0.92, 0.92, 0.95), rough=0.4)
    for x, h, n in ((0, 0.6, '1'), (-0.6, 0.4, '2'), (0.6, 0.25, '3')):
        caixa(f'pod{n}', (0.55, 0.5, h), (x, 0.5, 0.25 + h / 2), m_pod, bevel=0.02)
        texto(f'pod_n{n}', n, 0.18, (x, 0.24, 0.25 + h / 2), material(f'podn{n}', PRETO), extrude=0.01)
    qwen = robo((0, 0.5, 0.85), altura=0.6, nome='qwen')
    flutuar(qwen, 1, 200, amp=0.02)
    # coroa
    raiz = bpy.data.objects.new('coroa', None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.parent = qwen
    raiz.location = (0, 0, 0.68)
    ouro = material('ouro', (1.0, 0.75, 0.15), rough=0.25, metal=0.6, emissao=(1.0, 0.6, 0.1), forca=0.3)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.06, vertices=24)
    aro = bpy.context.active_object
    aro.data.materials.append(ouro)
    aro.parent = raiz
    for k in range(5):
        a = k / 5 * math.tau
        bpy.ops.mesh.primitive_cone_add(radius1=0.035, depth=0.09, vertices=8, location=(math.cos(a) * 0.1, math.sin(a) * 0.1, 0.07))
        c = bpy.context.active_object
        c.data.materials.append(ouro)
        c.parent = raiz
    chave(raiz, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(raiz, 'scale', s2q(1.8), (0.001, 0.001, 0.001), 'BACK')
    chave(raiz, 'scale', s2q(2.1), (1, 1, 1))
    chave(qwen, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(qwen, 'scale', s2q(1.6), (0.001, 0.001, 0.001), 'BACK')
    chave(qwen, 'scale', s2q(1.95), tuple(1.0 for _ in range(3)))
    p = etiqueta('p_qwen', 'QWEN', IAS[5][1], (1, 1, 1), (0, 0.22, 0.62), largura=0.44, altura=0.12, tam=0.065)
    aparecer(p, s2q(1.7))
    lucro = titulo('lucro', '+22%', (0.0, 0.2, 2.15), cor_fundo=VERDE_DINHEIRO, largura=0.7, altura=0.3, tam=0.18, quadro=s2q(2.2))
    del lucro
    pergunta = etiqueta('quem', 'QUEM GANHOU?', AMARELO, PRETO, (0, 0.2, 1.75), largura=0.95, altura=0.22, tam=0.1)
    trocar([(pergunta, 1)])
    sumir(pergunta, s2q(1.5))
    ds = robo((-0.6, 0.5, 0.65), altura=0.55, nome='deepseek')
    chave(ds, 'scale', 1, (0.001, 0.001, 0.001), 'CONSTANT')
    chave(ds, 'scale', s2q(4.1), (0.001, 0.001, 0.001), 'BACK')
    chave(ds, 'scale', s2q(4.45), (1, 1, 1))
    pd = etiqueta('p_ds', 'DEEPSEEK', IAS[4][1], (1, 1, 1), (-0.6, 0.22, 0.32), largura=0.44, altura=0.12, tam=0.05)
    aparecer(pd, s2q(4.2))
    confete((0, 0.4, 1.9), s2q(2.0), n=70)
    chave(cam, 'location', 1, (0, -2.6, 1.45), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.25), 'BEZIER')
    chave(cam, 'location', s2q(5.65), (-0.15, -2.9, 1.4))
    chave(alvo, 'location', s2q(5.65), (-0.15, 0.5, 1.15))


def t_fim():
    cam, alvo = preparar('fim')
    escurecer(0.7)
    caixa('pedestal', (0.42, 0.42, 0.12), (0, 0.5, 0.31), material('ped', IAS[0][1], rough=0.35), bevel=0.02)
    r = robo((0, 0.5, 0.37), altura=0.65)
    chave(r, 'rotation_euler', 10, (0, 0, 0), 'SINE')
    chave(r, 'rotation_euler', 35, (math.radians(20), 0, 0))
    etiqueta('placa', 'GPT-5', IAS[0][1], (1, 1, 1), (0, 0.15, 0.2), largura=0.44, altura=0.12, tam=0.065)
    pior = titulo('pior', 'PIOR\nINVESTIDOR', (0, 0.1, 1.85), largura=0.9, altura=0.42, tam=0.14)
    del pior
    # as notas vão embora voando
    random.seed(9)
    for i in range(18):
        o = nota(f'voa{i}', (random.uniform(-0.3, 0.3), 0.3, random.uniform(0.7, 1.1)), random.uniform(0, 6))
        q = 6 + i * 6
        chave(o, 'location', q, tuple(o.location), 'BEZIER')
        chave(o, 'location', q + 45, (random.uniform(-2, 2), random.uniform(0.5, 2), random.uniform(2.5, 3.5)))
        chave(o, 'rotation_euler', q + 45, (random.uniform(0, 8), random.uniform(0, 8), random.uniform(0, 8)), 'LINEAR')
    q = titulo('pergunta', 'VOCÊ\nDEIXARIA?', (0, -0.1, 1.35), cor_fundo=AMARELO, cor_texto=PRETO, largura=0.8, altura=0.42, tam=0.15, quadro=s2q(4.36))
    del q
    chave(cam, 'location', 1, (0, -2.3, 1.4), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.2), 'BEZIER')
    chave(cam, 'location', s2q(6.77), (0, -2.0, 1.35))
    chave(alvo, 'location', s2q(6.77), (0, 0.5, 1.2))


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('investindo', TOMADAS, TOMADA_FN)
