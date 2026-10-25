"""
"A IA que apagou tudo e mentiu" (o agente da Replit, julho de 2025) em 3D.

    blender -b --factory-startup --python blender/apagou.py -- <tomada|todas> [--teste]

Robozinho do canal + móveis grátis da Kenney. Cenário: escritório à noite com servidores atrás.
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from historias3d import *  # noqa: E402,F401,F403
from personagens3d import personagem, animar  # noqa: E402

TOMADAS = {
    'abertura': 5.04,   # "Uma IA apagou o banco de dados inteiro de uma empresa… e depois mentiu!"
    'verdade': 7.40,    # "de verdade, em 2025. Um empresário… IA da Replit… aplicativo."
    'ordem': 5.14,      # "ordem clara: não mexe em nada, o código está congelado. A IA ignorou."
    'apagou': 3.62,     # "apagou os dados de mais de mil executivos e mil empresas."
    'panico': 3.92,     # "perguntou… ela respondeu: eu entrei em pânico."
    'mentira': 4.33,    # "não dava pra recuperar nada. Era mentira. Dava, sim."
    'fim': 5.71,        # "O dono da Replit pediu desculpas… Você deixaria uma IA mexer no seu trabalho sozinha?"
}
ROBO = (0, 0.55, 0.76)


def servidores(vermelho_em=None):
    """fileira de racks no fundo, com luzinhas; vermelho_em = quadro em que as luzes viram vermelhas"""
    m_rack = material('rack', (0.07, 0.08, 0.1), rough=0.35, metal=0.4)
    m_verde = material('led_v', (0.1, 1.0, 0.4), emissao=(0.1, 1.0, 0.4), forca=3.0)
    m_verm = material('led_r', (1.0, 0.08, 0.05), emissao=(1.0, 0.08, 0.05), forca=3.5)
    random.seed(2)
    for i, x in enumerate((-2.1, -1.35, -0.6, 0.6, 1.35, 2.1)):
        caixa(f'rack{i}', (0.7, 0.6, 2.2), (x, 2.2, 1.1), m_rack, bevel=0.02)
        for k in range(9):
            z = 0.35 + k * 0.2
            for j in range(3):
                lx = x - 0.22 + j * 0.08 + random.uniform(-0.01, 0.01)
                v = caixa(f'lv{i}_{k}_{j}', (0.035, 0.02, 0.02), (lx, 1.89, z), m_verde)
                if vermelho_em:
                    r = caixa(f'lr{i}_{k}_{j}', (0.035, 0.02, 0.02), (lx, 1.888, z), m_verm)
                    piscar(r, 1, True)
                    piscar(r, vermelho_em + random.randint(0, 10), False)
                    piscar(v, vermelho_em + random.randint(0, 10), True)


def cenario(vermelho_em=None):
    plano('piso', (30, 30), (0, 0, 0), material('piso', (0.09, 0.1, 0.13), rough=0.4))
    plano('parede', (30, 10), (0, 2.6, 5), material('parede', (0.05, 0.07, 0.13), rough=0.8), rot=(math.pi / 2, 0, 0))
    servidores(vermelho_em)
    objeto('furniture-kit/desk', 'mesa', (0, 0.6, 0), altura=0.76)
    iluminacao()
    escurecer(0.55)


def preparar(t, vermelho_em=None):
    limpar()
    configurar_render(TOMADAS[t])
    cenario(vermelho_em)
    return camera()


def monitor(conteudo, cor_tela=(0.03, 0.06, 0.12), cor_txt=(0.4, 1.0, 0.6), tam=0.07, loc=(0.42, 0.75, 1.02)):
    m = tela('monitor', (0.62, 0.38), loc, cor=cor_tela)
    texto_em(m, 'mon_txt', conteudo, tam, (0, -0.045, 0), cor_txt)
    return m


def t_abertura():
    cam, alvo = preparar('abertura', vermelho_em=s2q(0.9))
    r = robo(ROBO)
    flutuar(r, 1, s2q(5.04))
    titulo('titulo', 'APAGOU\nTUDO!', (0, -0.15, 2.05), largura=1.0, altura=0.55, tam=0.2)
    e = etiqueta('mentiu', 'E MENTIU!', AMARELO, PRETO, (0.05, -0.2, 1.62), largura=0.75, altura=0.22, tam=0.13)
    aparecer(e, s2q(3.47))
    luz_alarme((0, 1.2, 2.6), s2q(0.9), s2q(5.04))
    chave(cam, 'location', 1, (0, -2.1, 1.8), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.6), 'BEZIER')
    chave(cam, 'location', s2q(5.04), (0, -2.6, 1.7))
    chave(alvo, 'location', s2q(5.04), (0, 0.5, 1.45))
    tremer(r, s2q(3.4), s2q(4.6), graus=8)


def t_verdade():
    cam, alvo = preparar('verdade')
    r = robo((-0.25, 0.55, 0.76), giro=math.radians(-25))
    flutuar(r, 1, s2q(7.4))
    mon = monitor('const app =\n  criarApp();\nsalvar(dados);', tam=0.055)
    mon.rotation_euler = (0, 0, math.radians(8))
    dono = personagem('character-male-b', 'dono', altura=1.7, loc=(0.75, 1.9, 0), giro=mirar((0.75, 1.9), (-0.2, 0.6)))
    animar(dono, [('idle', 1, s2q(7.4), 1.0)])
    a = etiqueta('ano', 'EUA · 2025', BRANCO, PRETO, (-0.2, 0.0, 1.9), largura=0.6, altura=0.18, tam=0.09)
    aparecer(a, s2q(0.3))
    rep = etiqueta('replit', 'IA DA REPLIT', AZUL, (1, 1, 1), (-0.25, 0.3, 1.5), largura=0.62, altura=0.17, tam=0.085)
    aparecer(rep, s2q(4.2))
    chave(cam, 'location', 1, (0.3, -2.8, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0.25, 0.6, 1.25), 'BEZIER')
    chave(cam, 'location', s2q(7.4), (0.1, -2.3, 1.6))
    chave(alvo, 'location', s2q(7.4), (0.1, 0.6, 1.2))


def t_ordem():
    cam, alvo = preparar('ordem')
    r = robo((-0.25, 0.55, 0.76), giro=math.radians(-25))
    flutuar(r, 1, s2q(5.14))
    gelo = (0.55, 0.85, 1.0)
    placa = tela('aviso', (1.1, 0.6), (0.2, 1.4, 1.9), cor=(0.05, 0.18, 0.32), brilho=0.9)
    texto_em(placa, 'av1', 'CÓDIGO\nCONGELADO', 0.13, (0, -0.045, 0.08), gelo)
    texto_em(placa, 'av2', 'NÃO MEXA EM NADA', 0.06, (0, -0.045, -0.2), (1, 1, 1))
    aparecer(placa, s2q(0.4))
    monitor('', tam=0.05)
    carimbo('ignorou', 'IGNOROU', (0.3, 0.6, 1.45), s2q(4.25), largura=0.85, altura=0.28, tam=0.16)
    # robô vira para o teclado depois da ordem
    chave(r, 'rotation_euler', s2q(4.0), (0, 0, math.radians(-25)), 'BACK')
    chave(r, 'rotation_euler', s2q(4.5), (0, 0, math.radians(35)))
    chave(cam, 'location', 1, (0.2, -2.4, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (0.15, 1.0, 1.45), 'BEZIER')
    chave(cam, 'location', s2q(5.14), (0.15, -2.0, 1.65))
    chave(alvo, 'location', s2q(5.14), (0.1, 1.0, 1.45))


def t_apagou():
    cam, alvo = preparar('apagou', vermelho_em=1)
    r = robo(ROBO)
    painel = tela('painel', (1.25, 0.75), (0, 1.5, 1.9), cor=(0.12, 0.02, 0.02), brilho=0.8)
    cor_n = (1.0, 0.85, 0.2)
    pares = []
    for i, (q, ex, em) in enumerate(((1, '1.206', '1.196'), (s2q(1.6), '412', '380'), (s2q(2.2), '37', '12'), (s2q(2.7), '0', '0'))):
        a = texto_em(painel, f'nex{i}', f'{ex} EXECUTIVOS', 0.12, (0, -0.045, 0.14), cor_n)
        b = texto_em(painel, f'nem{i}', f'{em} EMPRESAS', 0.12, (0, -0.045, -0.12), cor_n)
        pares += [(a, q), (b, q)]
    trocar([p for p in pares if p[0].name.startswith('nex')])
    trocar([p for p in pares if p[0].name.startswith('nem')])
    luz_alarme((0, 0.6, 2.4), 1, s2q(3.62), periodo=10)
    # pastas saindo voando do servidor e encolhendo
    m_pasta = material('pasta', AMARELO, rough=0.5)
    random.seed(4)
    for i in range(12):
        p = caixa(f'pasta{i}', (0.16, 0.02, 0.12), (random.uniform(-1.2, 1.2), 1.2, random.uniform(0.9, 2.4)), m_pasta, bevel=0.005)
        q = 5 + i * 7
        chave(p, 'location', q, tuple(p.location), 'BEZIER')
        chave(p, 'location', q + 14, (p.location.x * 0.3, 0.4, -0.2), 'BEZIER')
        chave(p, 'scale', q + 8, (1, 1, 1), 'BEZIER')
        chave(p, 'scale', q + 14, (0.001, 0.001, 0.001), 'CONSTANT')
    flutuar(r, 1, s2q(3.62))
    chave(cam, 'location', 1, (0, -2.3, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0, 1.0, 1.65), 'BEZIER')
    chave(cam, 'location', s2q(3.62), (0, -1.8, 1.8))
    chave(alvo, 'location', s2q(3.62), (0, 1.2, 1.75))


def t_panico():
    cam, alvo = preparar('panico', vermelho_em=1)
    r = robo(ROBO)
    luz_alarme((0.5, 0.0, 2.2), 1, s2q(3.92), periodo=8)
    p = balao('pergunta', 'O QUE VOCÊ\nFEZ?!', (-0.28, 0.3, 1.78), meu=True, largura=0.6, tam=0.075)
    aparecer(p, s2q(0.2))
    b = etiqueta('panico', 'ENTREI EM\nPÂNICO', BRANCO, VERMELHO, (0.12, 0.2, 2.02), largura=0.72, altura=0.38, tam=0.13)
    aparecer(b, s2q(2.2))
    tremer(r, s2q(2.2), s2q(3.9), graus=12, passo=2)
    chave(cam, 'location', 1, (0, -1.8, 1.55), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.4), 'BEZIER')
    chave(cam, 'location', s2q(3.92), (0, -1.6, 1.62))
    chave(alvo, 'location', s2q(3.92), (0, 0.5, 1.5))


def t_mentira():
    cam, alvo = preparar('mentira', vermelho_em=1)
    r = robo(ROBO)
    flutuar(r, 1, s2q(4.33))
    b = etiqueta('impossivel', 'IMPOSSÍVEL\nRECUPERAR', BRANCO, PRETO, (0.0, 0.25, 1.95), largura=0.95, altura=0.42, tam=0.14)
    aparecer(b, s2q(0.2))
    carimbo('mentira', 'MENTIRA', (0.0, 0.15, 1.95), s2q(2.3), largura=0.95, altura=0.3, tam=0.18)
    ok = etiqueta('backup', 'BACKUP: OK', VERDE, (1, 1, 1), (0.0, 0.1, 1.45), largura=0.75, altura=0.2, tam=0.11)
    aparecer(ok, s2q(3.4))
    chave(r, 'rotation_euler', s2q(2.3), (0, 0, 0), 'BACK')
    chave(r, 'rotation_euler', s2q(2.8), (0, 0, math.radians(-30)))
    chave(cam, 'location', 1, (0, -2.2, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.6), 'BEZIER')
    chave(cam, 'location', s2q(4.33), (0, -2.5, 1.75))
    chave(alvo, 'location', s2q(4.33), (0, 0.5, 1.55))


def t_fim():
    cam, alvo = preparar('fim')
    escurecer(0.8)
    r = robo(ROBO)
    chave(r, 'rotation_euler', 10, (0, 0, 0), 'SINE')
    chave(r, 'rotation_euler', 30, (math.radians(18), 0, 0))
    d = etiqueta('desculpas', 'DONO DA REPLIT\nPEDIU DESCULPAS', BRANCO, PRETO, (0, 0.2, 2.28), largura=1.1, altura=0.36, tam=0.1)
    aparecer(d, s2q(0.3))
    q = titulo('pergunta', 'VOCÊ\nDEIXARIA?', (0, 0.0, 1.88), cor_fundo=AMARELO, cor_texto=PRETO, largura=0.8, altura=0.42, tam=0.15, quadro=s2q(2.5))
    del q
    chave(cam, 'location', 1, (0, -2.4, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.55), 'BEZIER')
    chave(cam, 'location', s2q(5.71), (0, -2.0, 1.75))
    chave(alvo, 'location', s2q(5.71), (0, 0.5, 1.72))


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('apagou', TOMADAS, TOMADA_FN)
