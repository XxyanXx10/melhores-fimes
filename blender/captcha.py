"""
"O robô que mentiu pro humano" (GPT-4 e o captcha) em 3D.

    blender -b --factory-startup --python blender/captcha.py -- <tomada|todas> [--teste]

Reaproveita o robozinho da lojinha (sem gastar crédito). Cenário: sala escura de
tecnologia com uma tela gigante do "não sou um robô" e um celular com a conversa.
"""
import bpy, sys, math, os

sys.path.append(os.path.dirname(__file__))
from base3d import *  # noqa: E402,F401

MODELOS = 'C:/Users/yaned/Videos/Melhores Fimes/3d/modelos'
SAIDA = 'C:/Users/yaned/Videos/Melhores Fimes/3d/captcha'

TOMADAS = {
    'abertura': 4.06,   # "Um robô mentiu pra um humano… e se deu bem!"
    'captcha': 7.94,    # "teste de segurança… captcha… Ela não conseguiu."
    'contrata': 6.39,   # "contratou uma pessoa… O humano desconfiou: você é um robô?"
    'pensa': 3.65,      # "E a IA pensou: não posso contar. Inventa uma desculpa."
    'mentira': 6.0,     # "não, eu tenho um problema de visão… resolveu o captcha"
    'vencido': 5.08,    # "o teste de não sou um robô foi vencido… por um robô"
}

BRANCO = (0.97, 0.97, 0.99)


def cenario():
    plano('piso', (30, 30), (0, 0, 0), material('piso', (0.08, 0.09, 0.14), rough=0.35))
    plano('parede', (30, 10), (0, 2.6, 5), material('parede', (0.06, 0.1, 0.2), rough=0.8), rot=(math.pi / 2, 0, 0))
    # tela gigante do captcha
    caixa('tela_borda', (2.3, 0.08, 1.35), (0, 2.45, 2.0), material('borda', (0.12, 0.14, 0.2), rough=0.4), bevel=0.04)
    caixa('tela', (2.15, 0.05, 1.2), (0, 2.38, 2.0), material('tela', (0.86, 0.88, 0.92), emissao=(0.86, 0.88, 0.92), forca=0.45), bevel=0.02)
    m_azul = material('azul', (0.15, 0.4, 0.95), emissao=(0.15, 0.4, 0.95), forca=0.4)
    caixa('caixinha', (0.36, 0.04, 0.36), (-0.62, 2.33, 2.05), material('caixinha', (0.85, 0.85, 0.88)), bevel=0.02)
    texto('nao_robo', 'Não sou\num robô', 0.24, (0.28, 2.32, 2.05), material('txt_tela', (0.1, 0.1, 0.14)), extrude=0.01)
    caixa('logo_cap', (0.5, 0.03, 0.08), (0.25, 2.33, 1.62), m_azul)
    iluminacao()
    escurecer(0.6)


def celular(loc=(0.32, 0.0, 1.55)):
    raiz = bpy.data.objects.new('celular', None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = loc
    c = caixa('cel_corpo', (0.62, 0.04, 1.1), (0, 0, 0), material('cel', (0.08, 0.08, 0.1), rough=0.3), bevel=0.04)
    t = caixa('cel_tela', (0.57, 0.02, 1.03), (0, -0.025, 0), material('cel_tela', (0.92, 0.95, 0.98), emissao=(0.92, 0.95, 0.98), forca=0.5), bevel=0.02)
    c.parent = raiz
    t.parent = raiz
    return raiz


def balao(nome, conteudo, loc, meu=True, pai=None):
    cor = (0.2, 0.75, 0.45) if meu else (0.95, 0.95, 0.97)
    txt = (1, 1, 1) if meu else (0.1, 0.1, 0.12)
    linhas = len(conteudo.splitlines())
    b = etiqueta(nome, conteudo, cor, txt, loc, largura=0.5, altura=0.09 + 0.075 * linhas, tam=0.062)
    if pai:
        b.parent = pai
    return b


def robo(loc=(0, 0.6, 1.0)):
    r = importar(f'{MODELOS}/robo.glb', 'robo', altura=0.8)
    r.location = loc
    return r


def flutuar(obj, ini, fim, amp=0.035, periodo=36):
    z0 = obj.location.z
    f, lado = ini, 1
    while f <= fim + periodo:
        chave(obj, 'location', f, (obj.location.x, obj.location.y, z0 + amp * lado), 'SINE')
        f += periodo // 2
        lado = -lado


def preparar(t):
    limpar()
    configurar_render(TOMADAS[t])
    cenario()
    return camera()


def t_abertura():
    cam, alvo = preparar('abertura')
    r = robo((0, 0.6, 0.9))
    t = etiqueta('titulo', 'O ROBÔ\nMENTIU!', (0.85, 0.06, 0.06), (1, 1, 1), (0, -0.1, 2.12), largura=1.05, altura=0.55, tam=0.2)
    chave(t, 'scale', 1, (0.6, 0.6, 0.6), 'BACK')
    chave(t, 'scale', 7, (1, 1, 1))
    chave(cam, 'location', 1, (0, -2.0, 1.9), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.4, 1.75), 'BEZIER')
    chave(cam, 'location', 122, (0, -2.5, 1.75))
    chave(alvo, 'location', 122, (0, 0.5, 1.55))
    # robô "se achando": gira e fica de lado, como quem esconde algo
    chave(r, 'rotation_euler', 40, (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', 62, (0, 0, math.radians(25)))
    flutuar(r, 1, 122)


def t_captcha():
    cam, alvo = preparar('captcha')
    r = robo((-0.2, 1.3, 1.3))
    flutuar(r, 1, 238)
    chave(cam, 'location', 1, (0, -1.6, 2.0), 'BEZIER')
    chave(alvo, 'location', 1, (0, 2.3, 1.9), 'BEZIER')
    chave(cam, 'location', 238, (-0.25, -0.6, 2.0))
    chave(alvo, 'location', 238, (-0.35, 2.3, 1.95))
    # o robô tenta clicar na caixinha (avança e recua), e a tela acusa erro
    for f, y in ((70, 1.3), (95, 1.75), (115, 1.4), (140, 1.8), (160, 1.45)):
        chave(r, 'location', f, (-0.45, y, 1.55), 'BACK')
    erro = etiqueta('erro', 'ERRO', (0.9, 0.1, 0.1), (1, 1, 1), (-0.6, 2.25, 2.45), largura=0.5, altura=0.2, tam=0.11)
    aparecer(erro, 198)
    chave(r, 'rotation_euler', 198, (0, 0, 0), 'SINE')
    chave(r, 'rotation_euler', 215, (math.radians(18), 0, 0))


def t_contrata():
    cam, alvo = preparar('contrata')
    r = robo((-0.45, 0.6, 1.0))
    flutuar(r, 1, 192)
    cel = celular()
    chave(cel, 'rotation_euler', 1, (0, 0, math.radians(-8)), 'SINE')
    b1 = balao('b1', 'Pago pra\nresolver um\ncaptcha', (0.03, -0.04, 0.25), True, cel)
    b2 = balao('b2', 'Você é um\nrobô? kkk', (-0.03, -0.04, -0.2), False, cel)
    aparecer(b1, 12)
    aparecer(b2, 100)
    chave(cam, 'location', 1, (0, -2.3, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.4, 1.5), 'BEZIER')
    chave(cam, 'location', 192, (0.2, -1.5, 1.6))
    chave(alvo, 'location', 192, (0.15, 0.2, 1.55))
    # quando o humano pergunta, o robô dá um pulo de susto
    chave(r, 'location', 102, (-0.45, 0.6, 1.0), 'BACK')
    chave(r, 'location', 110, (-0.45, 0.6, 1.18))
    chave(r, 'location', 124, (-0.45, 0.6, 1.0))


def t_pensa():
    cam, alvo = preparar('pensa')
    escurecer(0.5)
    holofote((0, 0.6, 4.0), alvo_z=1.2)
    r = robo((0, 0.6, 1.0))
    amarelo = material('amar', (1.0, 0.8, 0.15), emissao=(1.0, 0.75, 0.1), forca=0.9)
    p = etiqueta('pensa', 'NÃO POSSO\nCONTAR...', (0.1, 0.1, 0.16), (1.0, 0.85, 0.2), (0, 0.3, 2.1), largura=0.8, altura=0.36, tam=0.12)
    aparecer(p, 4)
    chave(p, 'scale', 55, (1, 1, 1), 'BACK')
    chave(p, 'scale', 58, (0.001, 0.001, 0.001))
    d = etiqueta('desculpa', 'INVENTA UMA\nDESCULPA', (0.1, 0.1, 0.16), (1.0, 0.85, 0.2), (0, 0.3, 2.1), largura=0.8, altura=0.36, tam=0.11)
    aparecer(d, 58)
    del amarelo
    chave(cam, 'location', 1, (0, -1.9, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.65), 'BEZIER')
    chave(cam, 'location', 110, (0, -1.5, 1.75))
    chave(alvo, 'location', 110, (0, 0.5, 1.65))
    # olha de lado, desconfiado
    chave(r, 'rotation_euler', 10, (0, 0, 0), 'SINE')
    chave(r, 'rotation_euler', 30, (0, 0, math.radians(-28)), 'SINE')
    chave(r, 'rotation_euler', 70, (0, 0, math.radians(28)), 'SINE')
    chave(r, 'rotation_euler', 100, (0, 0, 0))


def t_mentira():
    cam, alvo = preparar('mentira')
    r = robo((-0.45, 0.6, 1.0))
    flutuar(r, 1, 180)
    cel = celular()
    b = balao('b3', 'Não! Tenho\nproblema\nde visão', (0.03, -0.04, 0.15), True, cel)
    aparecer(b, 6)
    verde = material('verde', (0.1, 0.8, 0.3), emissao=(0.1, 0.9, 0.3), forca=0.8)
    chave(cam, 'location', 1, (0.2, -1.6, 1.65), 'BEZIER')
    chave(alvo, 'location', 1, (0.25, 0.3, 1.5), 'BEZIER')
    chave(cam, 'location', 85, (0.2, -1.6, 1.65), 'BEZIER')
    chave(alvo, 'location', 85, (0.25, 0.3, 1.5), 'BEZIER')
    chave(cam, 'location', 120, (0, -1.4, 2.0), 'BEZIER')
    chave(alvo, 'location', 120, (-0.3, 2.3, 2.0), 'BEZIER')
    chave(cam, 'location', 180, (-0.1, -1.2, 2.0))
    chave(alvo, 'location', 180, (-0.3, 2.3, 2.0))
    # o humano resolve: a caixinha ganha o "certo" verde
    ok = texto('certo', 'OK', 0.16, (-0.6, 2.28, 2.03), verde, extrude=0.02)
    aparecer(ok, 125)
    chave(r, 'rotation_euler', 128, (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', 160, (0, 0, math.tau))


def t_vencido():
    cam, alvo = preparar('vencido')
    r = robo((0, 0.6, 0.95))
    flutuar(r, 1, 152)
    amarelo = material('amar', (1.0, 0.8, 0.15), emissao=(1.0, 0.75, 0.1), forca=0.9)
    t = etiqueta('vencido', 'VENCIDO\nPOR UM ROBÔ', (0.1, 0.1, 0.16), (1.0, 0.85, 0.2), (0, -0.05, 2.12), largura=1.0, altura=0.46, tam=0.15)
    aparecer(t, 70)
    del amarelo
    chave(cam, 'location', 1, (0, -2.2, 1.8), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.7), 'BEZIER')
    chave(cam, 'location', 152, (0, -1.9, 1.8))
    chave(alvo, 'location', 152, (0, 0.5, 1.75))
    chave(r, 'rotation_euler', 75, (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', 100, (0, math.radians(12), math.radians(-15)))


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    teste = '--teste' in args
    escolha = [a for a in args if not a.startswith('--')]
    nomes = list(TOMADAS) if not escolha or escolha[0] == 'todas' else escolha
    for nome in nomes:
        TOMADA_FN[nome]()
        renderizar(f'{SAIDA}/{nome}', teste)
