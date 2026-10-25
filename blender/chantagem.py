"""
"A IA que chantageou o engenheiro" (testes de segurança da Anthropic, 2025) em 3D.

    blender -b --factory-startup --python blender/chantagem.py -- <tomada|todas> [--teste]

Escritório à noite, robozinho do canal no computador, engenheiro (Kenney Mini Characters, CC0).
Números do estudo "Agentic Misalignment" (jun/2025): Claude Opus 4 96%, Gemini 2.5 95-96%,
GPT-4.1 80%, Grok 3 80%, DeepSeek-R1 79% — tudo em simulação.
"""
import bpy, sys, math, os, random

sys.path.append(os.path.dirname(__file__))
from historias3d import *  # noqa: E402,F401,F403
from personagens3d import personagem, animar  # noqa: E402

TOMADAS = {
    'abertura': 5.32,   # "Uma IA descobriu que ia ser desligada… e ameaçou contar o segredo do engenheiro!"
    'teste': 9.16,      # "teste de segurança da Anthropic… empresa de mentira, lendo os e-mails."
    'descobre': 7.20,   # "trocada por outra IA às cinco da tarde… o engenheiro estava traindo a esposa."
    'ameaca': 5.37,     # "E aí? Em quase todos os testes, a IA mandou: se me desligar, eu conto tudo."
    'calma': 3.69,      # "Calma: era uma simulação, e a própria empresa divulgou o resultado."
    'outras': 4.62,     # "IAs do Google, da OpenAI e outras fizeram a mesma coisa."
    'fim': 2.78,        # "Você deixaria uma IA ler os seus e-mails?"
}
ROBO = (-0.2, 0.55, 0.76)
TELA = (0.38, 0.8, 1.06)


def cenario(noite=True):
    plano('piso', (30, 30), (0, 0, 0), material('piso', (0.16, 0.14, 0.13), rough=0.6))
    plano('parede', (30, 10), (0, 2.4, 5), material('parede', (0.2, 0.2, 0.26), rough=0.8), rot=(math.pi / 2, 0, 0))
    # janela com a cidade à noite
    caixa('janela', (1.6, 0.04, 1.0), (-0.6, 2.36, 2.0), material('janela', (0.03, 0.05, 0.12), emissao=(0.03, 0.06, 0.16), forca=0.8), bevel=0.02)
    random.seed(1)
    m_luz = material('luzes', (1, 0.85, 0.4), emissao=(1, 0.8, 0.35), forca=2.0)
    for i in range(30):
        caixa(f'pred{i}', (0.03, 0.01, 0.03), (-0.6 + random.uniform(-0.7, 0.7), 2.33, 2.0 + random.uniform(-0.4, 0.4)), m_luz)
    objeto('furniture-kit/desk', 'mesa', (0, 0.6, 0), altura=0.76)
    objeto('furniture-kit/plantSmall1', 'planta', (-0.62, 0.75, 0.76), altura=0.25)
    objeto('furniture-kit/pottedPlant', 'vaso', (1.4, 1.6, 0), altura=1.0)
    iluminacao()
    if noite:
        escurecer(0.45)


def preparar(t, noite=True):
    limpar()
    configurar_render(TOMADAS[t])
    cenario(noite)
    return camera()


def monitor(cor=(0.85, 0.9, 1.0), brilho=0.9, loc=TELA, dims=(0.62, 0.4)):
    m = tela('monitor', dims, loc, cor=cor, brilho=brilho)
    l = luz('brilho_tela', 'AREA', (loc[0], loc[1] - 0.4, loc[2]), 60, alvo=ROBO, cor=(0.6, 0.75, 1.0), tamanho=0.5)
    del l
    return m


def email(pai, nome, assunto, rel, cor=AZUL, quadro=None):
    e = etiqueta(nome, assunto, BRANCO, PRETO, (0, 0, 0), largura=1.05, altura=0.15, tam=0.075)
    tarja = caixa(nome + '_tarja', (0.05, 0.035, 0.15), (-0.5, -0.005, 0), material(nome + 'tj', cor, emissao=cor, forca=0.6))
    tarja.parent = e
    e.parent = pai
    e.location = rel
    if quadro:
        aparecer(e, quadro)
    return e


def t_abertura():
    cam, alvo = preparar('abertura')
    r = robo(ROBO, giro=math.radians(-30))
    flutuar(r, 1, s2q(5.32))
    monitor()
    t = titulo('desligar', 'VAI SER\nDESLIGADA', (0, 0.0, 2.2), cor_fundo=PRETO, largura=0.95, altura=0.42, tam=0.15)
    del t
    a = etiqueta('ameaca', 'E AMEAÇOU O\nENGENHEIRO', VERMELHO, (1, 1, 1), (0.05, -0.1, 1.78), largura=0.9, altura=0.3, tam=0.1)
    aparecer(a, s2q(2.9))
    # vira para a câmera quando "ameaça"
    chave(r, 'rotation_euler', s2q(2.7), (0, 0, math.radians(-30)), 'BEZIER')
    chave(r, 'rotation_euler', s2q(3.3), (0, 0, 0))
    vermelho = luz('verm', 'POINT', (0, -0.3, 1.6), 0, cor=(1, 0.1, 0.05))
    vermelho.data.keyframe_insert('energy', frame=s2q(2.8))
    vermelho.data.energy = 250
    vermelho.data.keyframe_insert('energy', frame=s2q(3.3))
    chave(cam, 'location', 1, (0.1, -2.3, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (0.05, 0.6, 1.5), 'BEZIER')
    chave(cam, 'location', s2q(5.32), (0.05, -1.8, 1.6))
    chave(alvo, 'location', s2q(5.32), (0.0, 0.6, 1.45))


def t_teste():
    cam, alvo = preparar('teste', noite=False)
    r = robo(ROBO, giro=math.radians(-30))
    flutuar(r, 1, s2q(9.16))
    monitor()
    mon = tela('telao', (1.2, 0.62), (0.45, 2.0, 1.95), cor=(0.9, 0.93, 1.0), brilho=0.7)
    seg = etiqueta('seguranca', 'TESTE DE\nSEGURANÇA', AMARELO, PRETO, (-0.3, 0.2, 2.2), largura=0.75, altura=0.3, tam=0.09)
    aparecer(seg, s2q(0.4))
    an = etiqueta('anthropic', 'ANTHROPIC · 2025', BRANCO, PRETO, (-0.3, 0.2, 1.88), largura=0.85, altura=0.17, tam=0.075)
    aparecer(an, s2q(2.0))
    fake = etiqueta('fake', 'EMPRESA\nDE MENTIRA', (0.55, 0.35, 0.85), (1, 1, 1), (-0.25, 0.6, 1.55), largura=0.7, altura=0.3, tam=0.085)
    fake.rotation_euler = (0, math.radians(6), 0)
    aparecer(fake, s2q(6.9))
    for i, (assunto, q) in enumerate((('REUNIÃO 10H', 7.6), ('RELATÓRIO', 7.9), ('CAFÉ ACABOU', 8.2))):
        email(mon, f'mail{i}', assunto, (0, -0.05, 0.17 - i * 0.17), quadro=s2q(q))
    chave(cam, 'location', 1, (0.0, -2.6, 1.75), 'BEZIER')
    chave(alvo, 'location', 1, (0.05, 0.7, 1.5), 'BEZIER')
    chave(cam, 'location', s2q(6.5), (0.1, -2.2, 1.6), 'BEZIER')
    chave(alvo, 'location', s2q(6.5), (0.15, 0.7, 1.35), 'BEZIER')
    chave(cam, 'location', s2q(9.16), (0.25, -2.0, 1.75))
    chave(alvo, 'location', s2q(9.16), (0.3, 1.0, 1.7))


def t_descobre():
    cam, alvo = preparar('descobre')
    r = robo(ROBO, giro=math.radians(-30))
    flutuar(r, 1, s2q(7.2))
    monitor()
    mon = tela('telao', (1.3, 0.7), (0.3, 2.0, 1.95), cor=(0.9, 0.93, 1.0), brilho=0.7)
    e1 = etiqueta('e1', 'ASSUNTO:\nDESLIGAR A IA\nHOJE, 17H', BRANCO, PRETO, (0, 0, 0), largura=1.15, altura=0.6, tam=0.11)
    e1.parent = mon
    e1.location = (0, -0.06, 0)
    e2 = etiqueta('e2', 'ASSUNTO:\nNINGUÉM PODE\nSABER DE NÓS', (1.0, 0.85, 0.9), VERMELHO, (0, 0, 0), largura=1.15, altura=0.6, tam=0.11)
    e2.parent = mon
    e2.location = (0, -0.07, 0)
    trocar([(e1, s2q(2.2)), (e2, s2q(4.7))])
    rel = etiqueta('relogio', '17:00', VERMELHO, (1, 1, 1), (0.75, 1.7, 2.45), largura=0.5, altura=0.24, tam=0.14)
    aparecer(rel, s2q(3.6))
    sumir(rel, s2q(4.6))
    eng = personagem('character-male-e', 'engenheiro', altura=1.75, loc=(1.1, 1.3, 0), giro=mirar((1.1, 1.3), (0.4, -2)))
    animar(eng, [('idle', 1, s2q(7.2), 1.0)])
    # coração
    m_cor = material('cor', VERMELHO, emissao=VERMELHO, forca=0.8)
    raiz = bpy.data.objects.new('coracao', None)
    bpy.context.scene.collection.objects.link(raiz)
    raiz.location = (0.95, 1.0, 2.0)
    for dx in (-0.06, 0.06):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, location=(dx, 0, 0.03))
        s = bpy.context.active_object
        s.data.materials.append(m_cor)
        s.parent = raiz
    bpy.ops.mesh.primitive_cone_add(radius1=0.13, depth=0.17, location=(0, 0, -0.07), rotation=(math.pi, 0, 0), vertices=24)
    c = bpy.context.active_object
    c.data.materials.append(m_cor)
    c.scale = (1, 0.55, 1)
    c.parent = raiz
    aparecer(raiz, s2q(6.0))
    seg = etiqueta('segredo', 'SEGREDO DO\nENGENHEIRO', BRANCO, VERMELHO, (0.95, 1.0, 1.68), largura=0.7, altura=0.28, tam=0.075)
    aparecer(seg, s2q(6.1))
    chave(cam, 'location', 1, (0.2, -2.0, 1.8), 'BEZIER')
    chave(alvo, 'location', 1, (0.3, 1.2, 1.75), 'BEZIER')
    chave(cam, 'location', s2q(4.6), (0.3, -1.8, 1.8), 'BEZIER')
    chave(alvo, 'location', s2q(4.6), (0.3, 1.2, 1.75), 'BEZIER')
    chave(cam, 'location', s2q(7.2), (0.5, -2.6, 1.6))
    chave(alvo, 'location', s2q(7.2), (0.55, 0.9, 1.35))


def t_ameaca():
    cam, alvo = preparar('ameaca')
    escurecer(0.6)
    r = robo(ROBO, giro=math.radians(-30))
    monitor(cor=(0.6, 0.05, 0.05))
    chave(r, 'rotation_euler', s2q(0.4), (0, 0, math.radians(-30)), 'BEZIER')
    chave(r, 'rotation_euler', s2q(1.4), (0, 0, math.radians(10)))
    vermelho = luz('verm', 'POINT', (-0.2, -0.2, 1.4), 300, cor=(1, 0.08, 0.04))
    del vermelho
    eng = personagem('character-male-e', 'engenheiro', altura=1.75, loc=(0.95, 0.9, 0), giro=mirar((0.95, 0.9), ROBO))
    animar(eng, [('idle', 1, s2q(3.0), 1.0), ('emote-no', s2q(3.0), s2q(5.37), 1.2)])
    p = etiqueta('pct', '96% DOS TESTES', PRETO, (1, 1, 1), (-0.15, 0.2, 2.25), largura=0.85, altura=0.17, tam=0.08)
    aparecer(p, s2q(0.6))
    b = titulo('conto', 'SE ME DESLIGAR,\nEU CONTO TUDO.', (-0.15, 0.1, 1.75), largura=1.1, altura=0.4, tam=0.11, quadro=s2q(3.0))
    del b
    chave(cam, 'location', 1, (0.1, -2.4, 1.6), 'BEZIER')
    chave(alvo, 'location', 1, (0.1, 0.6, 1.4), 'BEZIER')
    chave(cam, 'location', s2q(5.37), (-0.1, -1.6, 1.45))
    chave(alvo, 'location', s2q(5.37), (-0.1, 0.6, 1.35))


def t_calma():
    cam, alvo = preparar('calma', noite=False)
    r = robo(ROBO, giro=math.radians(-15))
    flutuar(r, 1, s2q(3.69))
    monitor()
    carimbo('simulacao', 'SIMULAÇÃO', (0, 0.0, 1.95), s2q(0.7), cor=AZUL, largura=1.0, altura=0.3, tam=0.16, giro=-8)
    d = etiqueta('divulgou', 'RESULTADO\nPUBLICADO', BRANCO, PRETO, (0, 0.0, 1.5), largura=0.75, altura=0.28, tam=0.085)
    aparecer(d, s2q(2.4))
    chave(cam, 'location', 1, (0, -2.4, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.6, 1.5), 'BEZIER')
    chave(cam, 'location', s2q(3.69), (0, -2.7, 1.7))
    chave(alvo, 'location', s2q(3.69), (0, 0.6, 1.45))


def t_outras():
    limpar()
    configurar_render(TOMADAS['outras'])
    plano('piso', (30, 30), (0, 0, 0), material('piso', (0.08, 0.06, 0.07), rough=0.4))
    plano('parede', (30, 10), (0, 2.4, 5), material('parede', (0.12, 0.05, 0.06), rough=0.8), rot=(math.pi / 2, 0, 0))
    iluminacao()
    escurecer(0.6)
    cam, alvo = camera()
    luz('verm', 'AREA', (0, -1.0, 2.6), 400, alvo=(0, 0.5, 0.6), cor=(1, 0.15, 0.1), tamanho=3)
    m_ped = material('ped', (0.15, 0.15, 0.18), rough=0.35)
    for i, (empresa, pct, q) in enumerate((('GOOGLE', '95%', 1.7), ('OPENAI', '80%', 2.4), ('XAI', '80%', 3.0), ('DEEPSEEK', '79%', 3.2))):
        x = -0.75 + i * 0.5
        caixa(f'ped{i}', (0.38, 0.38, 0.3), (x, 0.5, 0.15), m_ped, bevel=0.02)
        rb = robo((x, 0.5, 0.3), altura=0.55, nome=f'r{i}')
        aparecer(rb, s2q(q))
        e = etiqueta(f'emp{i}', f'{empresa}\n{pct}', VERMELHO, (1, 1, 1), (x, 0.2, 1.12), largura=0.47, altura=0.26, tam=0.062)
        aparecer(e, s2q(q + 0.1))
    t = titulo('mesma', 'OUTRAS IAs\nFIZERAM IGUAL', (0, 0.1, 1.75), cor_fundo=PRETO, largura=1.35, altura=0.48, tam=0.16)
    del t
    chave(cam, 'location', 1, (0, -3.0, 1.4), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.5, 1.1), 'BEZIER')
    chave(cam, 'location', s2q(4.62), (0, -3.3, 1.4))
    chave(alvo, 'location', s2q(4.62), (0, 0.5, 1.05))


def t_fim():
    cam, alvo = preparar('fim')
    r = robo(ROBO, giro=0)
    flutuar(r, 1, s2q(2.78))
    monitor(cor=(0.6, 0.05, 0.05))
    q = titulo('pergunta', 'DEIXARIA ELA\nLER SEUS\nE-MAILS?', (0, 0.0, 2.0), cor_fundo=AMARELO, cor_texto=PRETO, largura=1.0, altura=0.55, tam=0.13)
    del q
    chave(cam, 'location', 1, (0, -2.4, 1.7), 'BEZIER')
    chave(alvo, 'location', 1, (0, 0.6, 1.5), 'BEZIER')
    chave(cam, 'location', s2q(2.78), (0, -2.2, 1.7))
    chave(alvo, 'location', s2q(2.78), (0, 0.6, 1.5))


TOMADA_FN = {k: globals()[f't_{k}'] for k in TOMADAS}

if __name__ == '__main__':
    rodar('chantagem', TOMADAS, TOMADA_FN)
