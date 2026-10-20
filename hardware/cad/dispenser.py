"""
IASIS — gera todas as peças do dispensador a partir dos STL originais.

    python hardware/cad/dispenser.py

Lê  hardware/cad/originais/*.stl  (cm, de cabeça para baixo)
Gera hardware/cad/saida/
       montagem/          peças no lugar em que ficam no dispensador (conferência)
       imprimir_inteiro/  tudo já deitado na posição de impressão (impressora ≥ 285 mm de altura)
       imprimir_dividido/ corpo cortado em 4 (impressora ≥ 210 × 210 × 150 mm)
       corpo_de_prova/    pedaços pequenos para testar folgas antes das peças grandes
       previas/           imagens de conferência

Referencial (mm): X = largura (0 esquerda → 200 direita, olhando a frente),
Y = profundidade (0 = face da frente, 200 = face de trás), Z = altura (0 = mesa).
Toda medida ajustável está em PARAMETROS. Nada é editado à mão nos STL.
"""
from __future__ import annotations

import math
import sys
from itertools import combinations
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[1] / ".claude/skills/iasis-cad/scripts"))
import iasis_cad as cad   # noqa: E402
import render             # noqa: E402

PARAMETROS = dict(
    # ── Acabamento da carcaça ──────────────────────────────────────────────
    raio_frente=30.0, raio_tampa_frente=8.0, raio_bandeja=12.0,
    parede=5.0, parede_bandeja=3.5,
    logo_largura=60.0, logo_centro_z=170.0, logo_relevo=2.0, ecg_profundidade=1.2,
    texto="IASIS", texto_altura=20.0, texto_centro_z=112.0, texto_relevo=1.2,
    entrada_diametro=12.0, entrada_x=100.0, entrada_z=150.0,

    # ── Encaixes ───────────────────────────────────────────────────────────
    junta_y=100.0, macho_recuo=1.7, macho_largura=1.6, macho_comprimento=5.0,
    folga=0.2,                    # por lado. Teste no corpo de prova e ajuste
    aba_altura=6.0, aba_espessura=2.5, aba_folga=0.25,
    corte_z=135.0,                # altura do corte da versão dividida

    # ── Tampa: 4 parafusos M3 × 16 ─────────────────────────────────────────
    tampa_parafusos=[(15, 15), (185, 15), (60, 188), (140, 188)],
    furo_guia_m3=2.5,             # furo para parafuso M3 entrar rosqueando no plástico
    furo_passante_m3=3.4,
    rebaixo_cabeca=7.0, rebaixo_tampa=12.0,   # escareado um pouco fundo: nada raspa no disco

    # ── Prateleira, disco e motor ──────────────────────────────────────────
    prateleira_topo=124.0, prateleira_espessura=5.0, apoio_largura=12,
    centro_disco=(100.0, 95.0),
    compartimentos=8,             # o firmware usa 8 (25 passos por compartimento)
    raio_bolsos=45.0, bolso_diametro=22.0,
    disco_diametro=126.0, disco_altura=20.0,
    disco_folga=0.0,              # o disco apoia na prateleira e gira pelo lado chato do eixo
    # NEMA 17 (medidas da norma; o comprimento do corpo varia de 34 a 48 mm)
    nema_lado=42.3, nema_furos=31.0, nema_ressalto=22.0, nema_comprimento=48.0,
    eixo_diametro=5.0, eixo_chato=4.5, eixo_comprimento=24.0,

    # ── Trava (servo SG90) ─────────────────────────────────────────────────
    # Medidas típicas do SG90: confira com o corpo de prova "suporte_servo".
    sg90_corpo=(22.8, 12.2, 22.7),   # comprimento, largura, altura
    sg90_eixo_da_ponta=5.9,          # do eixo até a ponta mais próxima do corpo
    sg90_aba_do_topo=4.3,            # do topo do corpo até o topo das abas
    sg90_aba_espessura=2.5,
    sg90_furos=27.8,                 # entre os furos das abas
    sg90_braco_acima_do_topo=4.5,    # do topo do corpo até o topo do braço
    paleta_raio=14.0, paleta_espessura=2.5, paleta_braco=24.7,
    labio_saida=2.0,                 # plástico que sobra sobre a paleta, em volta da saída

    # ── Eletrônica ─────────────────────────────────────────────────────────
    lcd_furos=(75.0, 31.0), lcd_moldura_profundidade=7.0,     # LCD 16x2 padrão
    rc522_placa=(60.0, 40.0), rc522_distancia_parede=4.0,
    painel_tamanho=(54.0, 80.0), painel_espessura=3.0, painel_passo_furos=8.0,
)


# ═══════════════════════════════════════════════════════════════════════════
#  Geometria auxiliar
# ═══════════════════════════════════════════════════════════════════════════
CONTORNO = box(-1, -60, 201, 201)


def disco_2d(c, r):
    return Point(c).buffer(r, resolution=48)


def furo_escareado(x, y, z_topo, P, profundidade):
    """Furo passante M3 com escareado de 90° saindo da face de cima (z_topo)."""
    r = P["rebaixo_cabeca"] / 2
    rf = P["furo_passante_m3"] / 2
    return cad.furo_chanfrado(x, y, rf, z_topo - profundidade, z_topo, r - rf)


def apoio_45(corpo, z_topo, largura, recorte=None):
    """Aba de apoio colada nas paredes internas, em degraus de 1 mm (45°, imprime sem suporte)."""
    degraus = []
    for k in range(int(largura)):
        z1 = z_topo - k
        z0 = z1 - 1
        interior = cad.boca(corpo, z0 + 0.5, z0 + 0.5, CONTORNO)
        banda = cad.faixa_interna(interior, -0.3, largura - k + 0.3)
        if recorte is not None:
            banda = banda.difference(recorte)
        degraus.append(cad.extrudar(banda, z0, z1))
    return cad.unir(degraus)


# ═══════════════════════════════════════════════════════════════════════════
#  Carcaça
# ═══════════════════════════════════════════════════════════════════════════
def carcaca(P):
    orig = AQUI / "originais"
    tras = cad.carregar_original(orig, "tras")
    frente = cad.carregar_original(orig, "frente")
    tampa = cad.carregar_original(orig, "tampa")
    topo = 280.0

    # 1. Frente arredondada
    R, w = P["raio_frente"], P["parede"]
    for canto, sentido in [((0, 0), (1, 1)), ((200, 0), (-1, 1))]:
        frente = cad.arredondar_canto_vertical(frente, canto, sentido, R, 0, topo, parede=w)
        tampa = cad.arredondar_canto_vertical(tampa, canto, sentido, R, topo, topo + 20)
    tampa = cad.arredondar_aresta(tampa, "YZ", (0, topo + 20), (1, -1), P["raio_tampa_frente"], 0, 200)
    for canto, sentido in [((35, -50), (1, 1)), ((165.1, -50), (-1, 1))]:
        frente = cad.arredondar_canto_vertical(frente, canto, sentido, P["raio_bandeja"], 0, 15.5,
                                               parede=P["parede_bandeja"])

    # 2. Logo e nome
    coracao, ecg = cad.logo_2d(P["logo_largura"])
    centro = (100, P["logo_centro_z"])
    relevo = cad.relevo_na_face_frontal(coracao, 0.0, P["logo_relevo"], centro)
    sulco = cad.relevo_na_face_frontal(ecg, -(P["logo_relevo"] - P["ecg_profundidade"]),
                                       P["ecg_profundidade"] + 0.5, centro)
    nome = cad.relevo_na_face_frontal(cad.texto_2d(P["texto"], P["texto_altura"]), 0.0,
                                      P["texto_relevo"], (100, P["texto_centro_z"]))
    frente = cad.unir([frente, cad.subtrair(relevo, sulco), nome])

    # 3. Entrada de energia
    ex, ez = P["entrada_x"], P["entrada_z"]
    esp = cad.espessura_ao_longo(tras, (ex, 200, ez), (0, -1, 0))
    tras = cad.subtrair(tras, cad.cilindro(P["entrada_diametro"] / 2, (ex, 201, ez), (ex, 200 - esp - 1, ez)))

    # 4. Fixações internas na parte da frente
    fix = []
    # 4a. LCD 16x2: 4 pinos na parede da frente, atrás da janela (centro X 100, Z 257,5)
    lx, lz = P["lcd_furos"]
    prof = P["lcd_moldura_profundidade"]
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = 100 + sx * lx / 2, 257.5 + sz * lz / 2
            fix.append(cad.subtrair(cad.cilindro(3.0, (x, 4.5, z), (x, 5 + prof, z)),
                                    cad.cilindro(P["furo_guia_m3"] / 2, (x, 6.5, z), (x, 6 + prof, z))))
    # 4b. RC522: dois trilhos com canal, atrás do coração (a placa desce por cima)
    pl, ph = P["rc522_placa"]
    yp = 5 + P["rc522_distancia_parede"]
    for lado in (-1, 1):
        borda = 100 + lado * pl / 2
        x0, x1 = sorted([borda - lado * 1.5, borda + lado * 4.5])
        trilho = cad.caixa(x0, x1, 4.5, yp + 3.5, 148, 195)
        canal_x0, canal_x1 = sorted([borda - lado * 2.0, borda + lado * 0.5])
        canal = cad.caixa(canal_x0, canal_x1, yp - 0.2, yp + 1.8, 150, 196)
        fix.append(cad.subtrair(trilho, canal))
    # 4c. Painéis de eletrônica nas paredes laterais (4 pinos cada)
    pw, ph_ = P["painel_tamanho"]
    for x_parede, sentido, zc in [(5.0, 1, 205.0), (195.0, -1, 180.0)]:
        for y in (45.0, 85.0):
            for z in (zc - 33, zc + 33):
                pino = cad.cilindro(4.0, (x_parede - sentido * 0.5, y, z), (x_parede + sentido * 8, y, z))
                guia = cad.cilindro(P["furo_guia_m3"] / 2, (x_parede + sentido * 1.5, y, z),
                                    (x_parede + sentido * 9, y, z))
                fix.append(cad.subtrair(pino, guia))
    # 4d. Ressaltos para os parafusos da tampa nos cantos da frente, com base em cone
    for (x, y) in P["tampa_parafusos"][:2]:
        fix.append(cad.cilindro(6.0, (x, y, 262), (x, y, 280)))
        fix.append(cad.cone(6.0, 6.0, (x, y, 262.01)))
    frente = cad.unir([frente] + fix)

    # 5. Apoio da prateleira (as duas metades), aberto no meio da frente para a calha passar
    corpo = cad.unir([tras, frente])
    zb = P["prateleira_topo"] - P["prateleira_espessura"]
    apoio = apoio_45(corpo, zb, P["apoio_largura"], recorte=box(72, -1, 128, 30))
    frente = cad.unir([frente, cad.intersectar(apoio, cad.caixa(-1, 201, -60, 100, 0, 300))])
    tras = cad.unir([tras, cad.intersectar(apoio, cad.caixa(-1, 201, 100, 201, 0, 300))])

    # 6. Furos-guia dos parafusos da tampa (cantos da frente nos ressaltos; atrás, no maciço)
    guias = [cad.cilindro(P["furo_guia_m3"] / 2, (x, y, 281), (x, y, 266))
             for (x, y) in P["tampa_parafusos"]]
    frente = cad.subtrair(frente, guias[:2])
    tras = cad.subtrair(tras, guias[2:])

    # 7. Encaixe macho-fêmea entre as metades
    jy = P["junta_y"]
    face = cad.secao(tras, "y", jy + 0.05).intersection(cad.secao(frente, "y", jy - 0.05))
    macho2d, femea2d = cad.macho_femea(face, P["macho_recuo"], P["macho_largura"],
                                       P["macho_comprimento"], P["folga"])
    L = P["macho_comprimento"]
    tras = cad.unir([tras, cad.extrudar_no_plano(macho2d, "XZ", jy - L, jy + 0.5)])
    frente = cad.subtrair(frente, cad.extrudar_no_plano(femea2d, "XZ", jy - L - 0.5, jy + 0.01))

    # 8. Tampa: aba que entra na boca e 4 furos com rebaixo para a cabeça
    corpo = cad.unir([tras, frente])
    abertura = cad.boca(corpo, topo - P["aba_altura"] - 0.5, topo - 0.01, CONTORNO)
    aba2d = cad.faixa_interna(abertura, P["aba_folga"], P["aba_espessura"])
    aba2d = aba2d.difference(box(55, -1, 145, 25))     # a placa do LCD sobe até perto do topo
    aba = cad.extrudar(aba2d, topo - P["aba_altura"], topo + 0.5)
    tampa = cad.unir([tampa, aba])
    furos = []
    for (x, y) in P["tampa_parafusos"]:
        furos.append(cad.cilindro(P["furo_passante_m3"] / 2, (x, y, 301), (x, y, 270)))
        furos.append(cad.cilindro(P["rebaixo_cabeca"] / 2, (x, y, 301), (x, y, 300 - P["rebaixo_tampa"])))
    tampa = cad.subtrair(tampa, furos)

    return dict(tras=tras, frente=frente, tampa=tampa), dict(entrada_espessura=esp)


# ═══════════════════════════════════════════════════════════════════════════
#  Mecanismo
# ═══════════════════════════════════════════════════════════════════════════
def geometria_trava(P):
    """Posições da trava: eixo do servo, saída e direções do braço."""
    cx, cy = P["centro_disco"]
    saida = (cx, cy - P["raio_bolsos"])                       # compartimento na frente
    eixo = (saida[0] + P["paleta_braco"], saida[1])          # servo à direita da saída
    return saida, eixo


def paleta_2d(P, angulo_extra=0.0):
    """Paleta vista de cima: disco sobre a saída + braço até o eixo. Fechada em 0°;
    abre girando +90° (o braço passa a apontar para a frente)."""
    saida, eixo = geometria_trava(P)
    forma = disco_2d(saida, P["paleta_raio"]).union(
        Polygon([(saida[0], saida[1] - 4), (eixo[0], eixo[1] - 4),
                 (eixo[0], eixo[1] + 4), (saida[0], saida[1] + 4)])).union(disco_2d(eixo, 5.0))
    from shapely import affinity
    return affinity.rotate(forma, angulo_extra, origin=eixo)


def mecanismo(P, carcaca_pecas):
    cx, cy = P["centro_disco"]
    zt = P["prateleira_topo"]
    zb = zt - P["prateleira_espessura"]
    saida, eixo = geometria_trava(P)
    corpo = cad.unir([carcaca_pecas["tras"], carcaca_pecas["frente"]])

    cl, cw, ch = P["sg90_corpo"]
    ef = P["sg90_eixo_da_ponta"]
    sx0, sx1 = eixo[0] - ef, eixo[0] - ef + cl          # corpo do servo indo para +X
    sy0, sy1 = eixo[1] - cw / 2, eixo[1] + cw / 2
    centro_corpo = (sx0 + sx1) / 2
    aba_ponta = centro_corpo + 16.2                      # fim da aba do lado de fora
    furos_suporte = [(aba_ponta + 3.0, eixo[1] - 6.0), (aba_ponta + 3.0, eixo[1] + 7.0)]

    # ── Prateleira: passa pela boca de cima e assenta no apoio ─────────────
    contorno = cad.boca(corpo, zb + 0.5, 279.9, CONTORNO).buffer(-0.5)
    prat = cad.extrudar(contorno, zb, zt)
    cortes = [cad.cilindro(P["nema_ressalto"] / 2 + 0.4, (cx, cy, zt + 1), (cx, cy, zb - 1))]
    h = P["nema_furos"] / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            cortes.append(furo_escareado(cx + sx * h, cy + sy * h, zt, P, P["prateleira_espessura"]))
    # saída dos remédios, com chanfro em cima para nada enroscar
    rb = P["bolso_diametro"] / 2
    cortes.append(cad.furo_chanfrado(*saida, rb, zb, zt, 1.2))
    # rebaixo por baixo onde a paleta gira (deixa só o lábio em volta da saída)
    varredura = unary_union([paleta_2d(P, a) for a in range(0, 91, 5)]).buffer(1.5)
    cortes.append(cad.extrudar(varredura, zb - 1, zt - P["labio_saida"]))
    # passagem de fios do motor e do servo
    for x in (25.0, 175.0):
        cortes.append(cad.caixa(x - 8, x + 8, cy - 12, cy + 12, zb - 1, zt + 1))
    # parafusos do suporte do servo
    for (x, y) in furos_suporte:
        cortes.append(furo_escareado(x, y, zt, P, P["prateleira_espessura"]))
    prat = cad.subtrair(prat, cortes)
    # marca do compartimento 1 (seta gravada na frente do disco)
    seta = Polygon([(cx - 4, cy - P["disco_diametro"] / 2 - 9), (cx + 4, cy - P["disco_diametro"] / 2 - 9),
                    (cx, cy - P["disco_diametro"] / 2 - 3)])
    prat = cad.subtrair(prat, cad.extrudar(seta, zt - 0.6, zt + 1))

    # ── Disco de compartimentos ────────────────────────────────────────────
    z0 = zt + P["disco_folga"]
    z1 = z0 + P["disco_altura"]
    n = P["compartimentos"]
    disco = cad.cilindro(P["disco_diametro"] / 2, (cx, cy, z0), (cx, cy, z1), secoes=128)
    cortes = []
    angulos = [-90 - k * 360 / n for k in range(n)]   # 1 na saída; numeração no sentido horário
    for k, a in enumerate(angulos):
        px = cx + P["raio_bolsos"] * math.cos(math.radians(a))
        py = cy + P["raio_bolsos"] * math.sin(math.radians(a))
        cortes.append(cad.furo_chanfrado(px, py, rb, z0, z1, 1.0))
        from shapely import affinity
        num = cad.texto_2d(str(k + 1), 6.0)
        rn = P["disco_diametro"] / 2 - 4.5
        num = affinity.rotate(num, a + 90, origin=(0, 0))
        num = affinity.translate(num, cx + rn * math.cos(math.radians(a)), cy + rn * math.sin(math.radians(a)))
        cortes.append(cad.extrudar(num, z1 - 0.6, z1 + 1))
    # furo do eixo em D (eixo de 5 mm com rebaixo plano)
    furo = disco_2d((cx, cy), P["eixo_diametro"] / 2 + 0.15).intersection(
        box(cx - 5, cy - 5, cx + 5, cy - P["eixo_diametro"] / 2 + P["eixo_chato"] + 0.15))
    cortes.append(cad.extrudar(furo, z0 - 1, z1 + 1))
    # marca do compartimento 1 na borda
    cortes.append(cad.caixa(cx - 1.2, cx + 1.2, cy - P["disco_diametro"] / 2 - 1,
                            cy - P["disco_diametro"] / 2 + 2.5, z0 - 1, z1 + 1))
    disco = cad.subtrair(disco, cortes)

    # ── Paleta da trava (presa no braço do servo) ──────────────────────────
    pz1 = zt - P["labio_saida"] - 0.5
    pz0 = pz1 - P["paleta_espessura"]
    paleta = cad.extrudar(paleta_2d(P, 0), pz0, pz1)
    # rebaixo para a cabeça do parafuso do braço e dois furinhos para prender o braço
    paleta = cad.subtrair(paleta, [
        cad.cilindro(3.2, (*eixo, pz0 - 1), (*eixo, pz0 + 1.5)),
        cad.cilindro(0.8, (eixo[0] - 9, eixo[1], pz0 - 1), (eixo[0] - 9, eixo[1], pz1 + 1)),
        cad.cilindro(0.8, (eixo[0] - 15, eixo[1], pz0 - 1), (eixo[0] - 15, eixo[1], pz1 + 1)),
    ])

    # ── Servo SG90 (posição) e suporte ─────────────────────────────────────
    topo_servo = pz0 - P["sg90_braco_acima_do_topo"]
    aba_topo = topo_servo - P["sg90_aba_do_topo"]
    aba_base = aba_topo - P["sg90_aba_espessura"]
    furos_abas = [centro_corpo - P["sg90_furos"] / 2, centro_corpo + P["sg90_furos"] / 2]
    base_z0 = aba_base - 3.0
    xf0, xf1 = aba_ponta + 0.5, aba_ponta + 5.5          # parede do fundo, depois da aba
    suporte = cad.caixa(sx0 - 5.5, xf1, sy0 - 4, sy1 + 5, base_z0, aba_base)
    suporte = cad.subtrair(suporte, cad.caixa(sx0 - 0.3, sx1 + 0.3, sy0 - 0.3, sy1 + 0.3, base_z0 - 1, aba_base + 1))
    # paredes: atrás (+Y) e no fundo (+X), longe de onde o braço gira
    suporte = cad.unir([
        suporte,
        cad.caixa(sx0 - 5.5, xf1, sy1 + 2, sy1 + 5, base_z0, zb),
        cad.caixa(xf0, xf1, sy0 - 4, sy1 + 5, base_z0, zb),
    ])
    suporte = cad.subtrair(suporte, [cad.cilindro(0.9, (x, eixo[1], base_z0 - 1), (x, eixo[1], aba_base + 1))
                                     for x in furos_abas] +
                           [cad.cilindro(P["furo_guia_m3"] / 2, (x, y, zb + 1), (x, y, zb - 10))
                            for (x, y) in furos_suporte])

    # ── Calha: leva o remédio da saída até a janela da bandeja ─────────────
    xa, xb = 82.0, 118.0
    rampa = cad.extrudar_no_plano(Polygon([(6, 5.5), (70, 5.5), (70, 58.5), (6, 6.5)]), "YZ", xa + 2.5, xb - 2.5)
    lado = Polygon([(6, 5.5), (72.5, 5.5), (72.5, 88), (30, 88), (6, 20)])
    calha = cad.unir([
        rampa,
        cad.extrudar_no_plano(lado, "YZ", xa, xa + 2.5),
        cad.extrudar_no_plano(lado, "YZ", xb - 2.5, xb),
        cad.caixa(xa, xb, 70, 72.5, 5.5, 88),
    ])

    # ── Painéis de eletrônica (2 iguais): grade de furos para M3 ou abraçadeira
    pw, ph = P["painel_tamanho"]
    pe = P["painel_espessura"]
    painel = cad.caixa(0, pe, 0, pw, 0, ph)
    furos = []
    passo = P["painel_passo_furos"]
    for y in np.arange(passo, pw - passo / 2, passo):
        for z in np.arange(passo, ph - passo / 2, passo):
            furos.append(cad.cilindro(1.7, (-1, y, z), (pe + 1, y, z), secoes=16))
    for y in (45.0 - 38.0, 85.0 - 38.0):
        for z in (40 - 33, 40 + 33):
            furos.append(cad.cilindro(1.75, (-1, y, z), (pe + 1, y, z)))
    painel_base = cad.subtrair(painel, furos)
    painel_esq = painel_base.copy(); painel_esq.apply_translation([13.0, 38.0, 205.0 - 40])
    painel_dir = painel_base.copy(); painel_dir.apply_translation([187.0 - pe, 38.0, 180.0 - 40])

    pecas = dict(prateleira=prat, disco=disco, paleta=paleta, suporte_servo=suporte, calha=calha,
                 painel_esq=painel_esq, painel_dir=painel_dir)

    # ── Fantasmas dos componentes (só para conferir colisão) ───────────────
    nl, ncomp = P["nema_lado"], P["nema_comprimento"]
    fant = dict(
        motor=cad.unir([cad.caixa(cx - nl / 2, cx + nl / 2, cy - nl / 2, cy + nl / 2, zb - ncomp, zb),
                        cad.cilindro(P["nema_ressalto"] / 2, (cx, cy, zb), (cx, cy, zb + 2)),
                        cad.extrudar(disco_2d((cx, cy), P["eixo_diametro"] / 2).intersection(
                            box(cx - 5, cy - 5, cx + 5, cy - P["eixo_diametro"] / 2 + P["eixo_chato"])),
                            zb, zb + P["eixo_comprimento"])]),
        servo=cad.unir([cad.caixa(sx0, sx1, sy0, sy1, topo_servo - ch, topo_servo),
                        cad.caixa(centro_corpo - 16.2, centro_corpo + 16.2, sy0, sy1, aba_base, aba_topo)]),
        lcd=cad.unir([cad.caixa(64.4, 135.6, 5.0, 5 + prof_lcd(P), 245.4, 269.6),
                      cad.caixa(60, 140, 5 + prof_lcd(P), 6.6 + prof_lcd(P), 239.5, 275.5)]),
        rc522=cad.caixa(100 - P["rc522_placa"][0] / 2, 100 + P["rc522_placa"][0] / 2,
                        5 + P["rc522_distancia_parede"], 6.6 + P["rc522_distancia_parede"], 150, 150 + P["rc522_placa"][1]),
    )
    info = dict(saida=saida, eixo=eixo, contorno_prateleira=contorno, furos_suporte=furos_suporte)
    return pecas, fant, info


def prof_lcd(P):
    return P["lcd_moldura_profundidade"]


# ═══════════════════════════════════════════════════════════════════════════
#  Versão dividida e corpos de prova
# ═══════════════════════════════════════════════════════════════════════════
def dividir(peca, P):
    """Corta uma metade do corpo na altura `corte_z`, com macho embaixo e fêmea em cima."""
    zc = P["corte_z"]
    baixo = cad.recortar(peca, -10, 210, -60, 210, -1, zc)
    cima = cad.recortar(peca, -10, 210, -60, 210, zc, 310)
    face = cad.secao(peca, "z", zc)
    macho2d, femea2d = cad.macho_femea(face, P["macho_recuo"], P["macho_largura"],
                                       P["macho_comprimento"], P["folga"])
    L = P["macho_comprimento"]
    baixo = cad.unir([baixo, cad.extrudar(macho2d, zc - 0.5, zc + L)])
    cima = cad.subtrair(cima, cad.extrudar(femea2d, zc - 0.01, zc + L + 0.5))
    return baixo, cima


def corpos_de_prova(p, P):
    zc = P["corte_z"]
    cx, cy = P["centro_disco"]
    _, eixo = geometria_trava(P)
    return {
        "1_junta_parte_de_tras": cad.recortar(p["tras"], -1, 30, 94, 112, 140, 165),
        "1_junta_parte_da_frente": cad.recortar(p["frente"], -1, 30, 88, 100.5, 140, 165),
        "2_tampa_canto": cad.recortar(p["tampa"], -1, 45, -1, 45, 270, 301),
        "2_corpo_canto_topo": cad.recortar(p["frente"], -1, 45, -1, 45, 255, 280),
        "3_divisao_baixo": cad.recortar(p["frente_baixo"], -1, 30, 40, 70, zc - 15, zc + 10),
        "3_divisao_cima": cad.recortar(p["frente_cima"], -1, 30, 40, 70, zc - 1, zc + 15),
        "4_disco_centro_no_eixo": cad.intersectar(p["disco"], cad.cilindro(16, (cx, cy, 100), (cx, cy, 200), secoes=128)),
        "5_suporte_servo": p["suporte_servo"],
    }


# ═══════════════════════════════════════════════════════════════════════════
#  Verificação
# ═══════════════════════════════════════════════════════════════════════════
def verificar(pecas, fant, info, P):
    ok = True
    print("── Peças (estanque, 1 corpo)")
    for n, m in pecas.items():
        print("  " + cad.relatorio(n, m))
        bom = m.is_watertight and m.body_count == 1
        ok &= bom
        if not bom:
            print(f"  ✗ {n} com problema na malha")

    print("── Sobreposição na montagem (tem que dar ~0 mm³)")
    montadas = {k: v for k, v in pecas.items() if not k.endswith(("_baixo", "_cima"))}
    tudo = {**montadas, **{f"[{k}]": v for k, v in fant.items()}}
    piores = []
    for (a, ma), (b, mb) in combinations(tudo.items(), 2):
        if a.startswith("[") and b.startswith("["):
            continue
        if not _caixas_tocam(ma, mb):
            continue
        v = cad.interferencia(ma, mb)
        if v > 1.0:
            piores.append((v, a, b))
    for v, a, b in sorted(piores, reverse=True):
        print(f"  ✗ {a} × {b}: {v:.1f} mm³")
    ok &= not piores
    if not piores:
        print("  todas as combinações ~0")

    print("── Paleta girando de 0° a 90° (fechada → aberta)")
    _, eixo = geometria_trava(P)
    colisoes = set()
    for ang in range(0, 91, 10):
        pal = cad.girar(pecas["paleta"], ang, (0, 0, 1), (*eixo, 0))
        for n in ("prateleira", "disco", "suporte_servo", "calha", "frente"):
            if cad.interferencia(pal, pecas[n]) > 1.0:
                colisoes.add(n)
        for n in ("motor",):
            if cad.interferencia(pal, fant[n]) > 1.0:
                colisoes.add("[" + n + "]")
    print("  sem colisão" if not colisoes else f"  ✗ bate em: {sorted(colisoes)}")
    ok &= not colisoes

    print("── Peças que entram pela boca de cima (prateleira, disco, calha)")
    corpo = cad.unir([pecas["tras"], pecas["frente"]])
    boca = cad.boca(corpo, 150, 279.9, CONTORNO)
    for n in ("prateleira", "disco", "calha", "suporte_servo"):
        pegada = (cad.secao(pecas[n], "z", PARAMETROS["prateleira_topo"] - 2.5) if n == "prateleira"
                  else _sombra_xy(pecas[n]))
        cabe = boca.buffer(0.01).contains(pegada)
        print(f"  {n}: {'passa' if cabe else '✗ NÃO passa'}")
        ok &= cabe

    print("── Furos-guia dos parafusos da tampa com plástico em volta (≥ 1,5 mm)")
    for (x, y) in P["tampa_parafusos"]:
        anel = cad.subtrair(cad.cilindro(P["furo_guia_m3"] / 2 + 1.5, (x, y, 268), (x, y, 279.5)),
                            cad.cilindro(P["furo_guia_m3"] / 2 + 0.01, (x, y, 267), (x, y, 281)))
        dentro = cad.intersectar(anel, corpo).volume / anel.volume
        print(f"  ({x}, {y}): {dentro * 100:.0f}% de material")
        ok &= dentro > 0.97

    print("── Tudo certo" if ok else "── ATENÇÃO: verificação falhou")
    return ok


def _caixas_tocam(a, b):
    la, ha = a.bounds
    lb, hb = b.bounds
    return np.all(la <= hb + 0.01) and np.all(lb <= ha + 0.01)


def _sombra_xy(m):
    from shapely.geometry import MultiPoint
    return MultiPoint(m.vertices[:, :2]).convex_hull


# ═══════════════════════════════════════════════════════════════════════════
#  Saída
# ═══════════════════════════════════════════════════════════════════════════
# Como cada peça vai na mesa: direção (no referencial de montagem) que fica para baixo
ORIENTACAO = {
    "corpo_parte_de_tras": (0, 1, 0),     # costas na mesa
    "corpo_parte_da_frente": (0, 0, -1),  # de pé
    "tampa": (0, 0, 1),                   # de cabeça para baixo (aba para cima)
    "prateleira": (0, 0, 1),              # de cabeça para baixo (lisa na mesa)
    "disco": (0, 0, -1),
    "paleta": (0, 0, -1),
    "suporte_servo": (0, 0, -1),
    "calha": (0, 0, -1),
    "painel_eletronica": (-1, 0, 0),      # deitado
}


def salvar(pecas, P):
    saida = AQUI / "saida"
    nomes = {"tras": "corpo_parte_de_tras", "frente": "corpo_parte_da_frente", "tampa": "tampa",
             "prateleira": "prateleira", "disco": "disco", "paleta": "paleta",
             "suporte_servo": "suporte_servo", "calha": "calha"}
    for k, nome in nomes.items():
        cad.salvar_stl(pecas[k], saida / "montagem" / f"{nome}.stl")
        cad.salvar_stl(cad.para_impressao(pecas[k], ORIENTACAO[nome]), saida / "imprimir_inteiro" / f"{nome}.stl")
    cad.salvar_stl(pecas["painel_esq"], saida / "montagem" / "painel_eletronica_esquerdo.stl")
    cad.salvar_stl(pecas["painel_dir"], saida / "montagem" / "painel_eletronica_direito.stl")
    painel = cad.para_impressao(pecas["painel_esq"], ORIENTACAO["painel_eletronica"])
    cad.salvar_stl(painel, saida / "imprimir_inteiro" / "painel_eletronica_x2.stl")

    # versão dividida: corpo em 4; o resto igual
    div = saida / "imprimir_dividido"
    for k in ("tampa", "prateleira", "disco", "paleta", "suporte_servo", "calha"):
        cad.salvar_stl(cad.para_impressao(pecas[k], ORIENTACAO[nomes[k]]), div / f"{nomes[k]}.stl")
    cad.salvar_stl(painel, div / "painel_eletronica_x2.stl")
    for k, baixo in [("tras_baixo", (0, 1, 0)), ("tras_cima", (0, 1, 0)),
                     ("frente_baixo", (0, 0, -1)), ("frente_cima", (0, 0, -1))]:
        nome = {"tras": "corpo_tras", "frente": "corpo_frente"}[k.split("_")[0]] + "_" + k.split("_")[1]
        cad.salvar_stl(cad.para_impressao(pecas[k], baixo), div / f"{nome}.stl")

    for nome, m in corpos_de_prova(pecas, P).items():
        baixo = (0, 0, 1) if nome.startswith("2_tampa") else (0, 0, -1)
        cad.salvar_stl(cad.para_impressao(m, baixo), saida / "corpo_de_prova" / f"{nome}.stl")
    return saida


def previas(pecas, fant, P, pasta):
    pasta.mkdir(parents=True, exist_ok=True)
    casca = [pecas["tras"], pecas["frente"], pecas["tampa"]]
    render.renderizar(casca, pasta / "montagem.png", vistas=("iso", "frente", "iso_tras", "direita"),
                      titulos=["isométrica", "frente", "traseira", "lateral direita"])
    # por dentro: sem a tampa e sem a metade da frente
    interno = [pecas["tras"], pecas["prateleira"], pecas["disco"], pecas["paleta"], pecas["suporte_servo"],
               pecas["calha"], pecas["painel_esq"], pecas["painel_dir"], fant["motor"], fant["servo"]]
    render.renderizar(interno, pasta / "interior.png", vistas=("iso", (-20, 55), "frente"),
                      titulos=["interior (sem frente e tampa)", "interior visto de cima", "interior de frente"],
                      cores=["#7fa7d9", "#e6d36f", "#e0a96d", "#d98fb5", "#c9c9c9", "#9fd39a",
                             "#b0b0b0", "#b0b0b0", "#555555", "#3a6ea5"])
    mec = [pecas["prateleira"], pecas["disco"], pecas["paleta"], pecas["suporte_servo"], fant["motor"], fant["servo"]]
    render.renderizar(mec, pasta / "mecanismo.png", vistas=("iso", (-35, -30), "topo"),
                      titulos=["mecanismo", "mecanismo por baixo", "de cima"],
                      cores=["#e6d36f", "#e0a96d", "#d98fb5", "#c9c9c9", "#555555", "#3a6ea5"])
    exp = []
    for k, d in [("tras", (0, 60, 0)), ("frente", (0, -60, 0)), ("tampa", (0, 0, 120)),
                 ("prateleira", (0, 0, 40)), ("disco", (0, 0, 80)), ("calha", (0, -30, -10))]:
        m = pecas[k].copy(); m.apply_translation(d); exp.append(m)
    render.renderizar(exp, pasta / "explodida.png", vistas=("iso",), titulos=["vista explodida"],
                      cores=["#7fa7d9", "#e0a96d", "#9fd39a", "#e6d36f", "#d98fb5", "#c9c9c9"])
    div = [pecas["tras_baixo"], pecas["tras_cima"], pecas["frente_baixo"], pecas["frente_cima"]]
    exp_div = []
    for m, d in zip(div, [(0, 30, 0), (0, 30, 40), (0, -30, 0), (0, -30, 40)]):
        c = m.copy(); c.apply_translation(d); exp_div.append(c)
    render.renderizar(exp_div, pasta / "versao_dividida.png", vistas=("iso",), titulos=["corpo dividido em 4"])
    cortes_folgas(pecas, pasta / "cortes_folgas.png")


def cortes_folgas(pecas, saida):
    """Cortes 2D ampliados das folgas: junta, tampa e saída do disco."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    def desenha(ax, geo, cor):
        for g in getattr(geo, "geoms", [geo]):
            if g.is_empty or g.geom_type != "Polygon":
                continue
            ax.fill(*g.exterior.xy, color=cor, alpha=0.65, lw=0.5, ec="k")
            for i in g.interiors:
                ax.fill(*i.xy, color="white", lw=0.5, ec="k")

    fig, axs = plt.subplots(1, 3, figsize=(16, 5.2))
    for n, c in [("tras", "#7fa7d9"), ("frente", "#e0a96d")]:
        desenha(axs[0], cad.secao(pecas[n], "z", 150).intersection(box(-1, 85, 15, 115)), c)
    axs[0].set_title("Junta das metades (corte Z=150)")
    for n, c in [("frente", "#e0a96d"), ("tampa", "#9fd39a")]:
        desenha(axs[1], cad.secao(pecas[n], "x", 30).intersection(box(-12, 262, 18, 302)), c)
    axs[1].set_title("Tampa sobre a frente (corte X=30)")
    for n, c in [("prateleira", "#e6d36f"), ("disco", "#e0a96d"), ("paleta", "#d98fb5")]:
        desenha(axs[2], cad.secao(pecas[n], "x", 100).intersection(box(25, 110, 75, 150)), c)
    axs[2].set_title("Saída: disco, lábio e paleta (corte X=100)")
    for ax in axs:
        ax.set_aspect("equal"); ax.grid(alpha=0.3); ax.set_xlabel("mm"); ax.set_ylabel("mm")
    plt.tight_layout(); plt.savefig(saida, dpi=100); plt.close(fig)


def construir(P=PARAMETROS):
    casca, info_c = carcaca(P)
    mec, fant, info_m = mecanismo(P, casca)
    pecas = {**casca, **mec}
    for lado in ("tras", "frente"):
        pecas[f"{lado}_baixo"], pecas[f"{lado}_cima"] = dividir(pecas[lado], P)
    return pecas, fant, {**info_c, **info_m}


if __name__ == "__main__":
    pecas, fant, info = construir()
    print(f"Parede de trás na entrada de energia: {info['entrada_espessura']:.1f} mm")
    ok = verificar(pecas, fant, info, PARAMETROS)
    saida = salvar(pecas, PARAMETROS)
    previas(pecas, fant, PARAMETROS, saida / "previas")
    print(f"Arquivos em {saida}")
    sys.exit(0 if ok else 1)
