"""
Guia visual de montagem: onde vai cada peça e o que entra em cada furo.

    python hardware/cad/guia_montagem.py

Gera hardware/cad/saida/previas/guia_montagem.png com duas vistas legendadas:
o interior visto de trás (sem a parte de trás do corpo) e o dispensador por fora.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parent / "video"))
import dispenser                    # noqa: E402
import render3d as r                # noqa: E402

W, H = 1400, 1050
r.tema("#f7f1e8", "#e9dcc8", "#cbbba5", (1.0, 0.92, 0.8), (1.0, 0.9, 0.75))
CAFE, AZUL = (40, 28, 20), (52, 104, 170)


def vista(itens, olho, alvo, rotulos, titulo):
    img = r.renderizar(itens, olho, alvo, W=W, H=H, ss=2)
    im = Image.fromarray(r.para_u8(img)).convert("RGB")
    d = ImageDraw.Draw(im)
    fn, ft = r.fonte(25), r.fonte(21, False)
    d.text((40, 30), titulo, font=r.fonte(38), fill=CAFE)
    for ponto, (dx, dy), nome, detalhe in rotulos:
        p = r.projetar(ponto, olho, alvo, W=W, H=H)
        if p is None:
            continue
        x, y = p
        tx, ty = x + dx, y + dy
        larg = max(d.textlength(nome, font=fn), d.textlength(detalhe, font=ft)) + 28
        x0 = tx if dx >= 0 else tx - larg
        x0 = min(max(x0, 20), W - larg - 20)
        ty = min(max(ty, 90), H - 86)
        caixa = [x0, ty, x0 + larg, ty + 66]
        borda = (caixa[0] if x < caixa[0] else caixa[2] if x > caixa[2] else (caixa[0] + caixa[2]) / 2,
                 ty + 33 if not (caixa[0] <= x <= caixa[2]) else (ty if y < ty else ty + 66))
        d.line([p, borda], fill=AZUL, width=3)
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=AZUL, outline="white", width=2)
        d.rounded_rectangle(caixa, radius=12, fill=(255, 255, 255), outline=AZUL, width=2)
        d.text((caixa[0] + 14, ty + 6), nome, font=fn, fill=CAFE)
        d.text((caixa[0] + 14, ty + 36), detalhe, font=ft, fill=(95, 75, 60))
    return im


def main():
    pecas, fant, _ = dispenser.construir()
    cores = dict(frente="#d9b48a", tras="#c9a57c", tampa="#9fd39a", portinha="#f2c879",
                 prateleira="#e6d36f", disco="#e0905a", calha="#7fc27a", painel_esq="#a9b4c2",
                 painel_dir="#a9b4c2", motor="#4a4a4a", lcd="#2f6b4f", rc522="#3a6ea5")
    pid = iter(range(1000))

    def it(nome, malha=None):
        return r.item(malha if malha is not None else (pecas.get(nome) or fant[nome]), cores[nome], next(pid))

    alvo = np.array([100, 60, 150])
    olho = r.orbita(alvo, 205, 30, 980)

    # 1. Paredes por dentro: o que fica preso no corpo
    itens = [it("frente"), it("painel_esq"), it("painel_dir"), it("lcd", fant["lcd"]), it("rc522", fant["rc522"])]
    paredes = vista(itens, olho, alvo, [
        ((100, 8, 257), (140, -170), "Tela LCD", "4 parafusos M3 x 6 nos 4 pinos da frente"),
        ((100, 8, 175), (170, -90), "Leitor RC522", "desce por cima nos 2 trilhos, atrás do coração"),
        ((14.5, 65, 225), (170, 60), "Painel esquerdo", "4 parafusos M3 x 8 nos 4 pinos da parede"),
        ((185.5, 65, 200), (-160, -150), "Painel direito (mesma peça)", "4 parafusos M3 x 8 nos 4 pinos da parede"),
        ((20, 70, 113), (-250, 120), "Apoio da prateleira", "degrau nas paredes, já vem no corpo"),
    ], "1. Paredes por dentro (vista de trás, sem a parte de trás)")

    # 2. Fundo: a calha
    itens = [it("frente"), it("calha")]
    fundo_v = vista(itens, olho, alvo, [
        ((100, 45, 75), (180, -160), "Calha (rampa)", "centrada na janela de baixo, encostada na frente"),
        ((68, 50, 6.5), (-320, 60), "Pés da calha", "cole no fundo (cola quente ou fita dupla face)"),
        ((100, -4, 7), (150, 130), "Lingueta", "passa pela janela e deita na bandeja"),
    ], "2. Fundo: a calha (antes da prateleira)")

    # 3. Mecanismo: prateleira, motor e disco
    disco = pecas["disco"].copy(); disco.apply_translation([0, 0, 70])
    itens = [it("frente"), it("calha"), it("prateleira"), it("motor", fant["motor"]), it("disco", disco)]
    mec = vista(itens, olho, alvo, [
        ((100, 95, 217), (-330, -170), "Disco (levantado)", "desce no eixo, com o coração sobre a saída"),
        ((165, 160, 124), (-330, 60), "Prateleira", "assenta no apoio; fios sobem pelos rasgos"),
        ((115.5, 110.5, 124), (230, 150), "Motor NEMA 17 (embaixo)", "4 parafusos M3 x 8 nesses 4 furos"),
        ((100, 47, 124), (230, -60), "Saída da dose (Ø 34)", "a dose cai por aqui na calha"),
    ], "3. Mecanismo: prateleira, motor e disco")

    # 4. Por fora, com a tampa e a portinha levantadas
    tampa = pecas["tampa"].copy(); tampa.apply_translation([0, 0, 50])
    portinha = pecas["portinha"].copy(); portinha.apply_translation([0, 0, 95])
    itens = [it("frente"), it("tras"), it("tampa", tampa), it("portinha", portinha)]
    alvo2 = np.array([100, 80, 185])
    olho2 = r.orbita(alvo2, -28, 18, 1080)
    fora = vista(itens, olho2, alvo2, [
        ((100, -30, 8), (-330, 40), "Bandeja", "faz parte da peça corpo_frente_baixo"),
        ((100, -2, 170), (-380, -40), "Coração da logo", "encoste a pulseira aqui (RC522 atrás)"),
        ((100, -1, 257), (200, -40), "Janela do LCD", "a tela fica atrás, presa nos pinos"),
        ((185, 15, 335), (90, -10), "Tampa", "4 parafusos M3 x 12 nos cantos"),
        ((100, 95, 380), (150, -40), "Portinha", "sai puxando pelo furo; abastece por cima"),
    ], "4. Por fora (tampa e portinha levantadas)")

    guia = Image.new("RGB", (W * 2, H * 2), (247, 241, 232))
    for k, im in enumerate((paredes, fundo_v, mec, fora)):
        guia.paste(im, ((k % 2) * W, (k // 2) * H))
    destino = AQUI / "saida" / "previas" / "guia_montagem.png"
    guia.save(destino)
    print(destino)


def trava():
    """trava_calha.png: a portinha da trava fechada e aberta, vista pela frente (sem o corpo)."""
    import iasis_cad as cad
    pecas, fant, _ = dispenser.construir()
    ye, ze = dispenser.PARAMETROS["porta_eixo"]
    ims = []
    for ang, tit in ((0, "FECHADA: a dose para atrás da portinha"), (90, "ABERTA: a portinha sobe e a dose sai")):
        porta = cad.girar(pecas["porta_trava"], -ang, (1, 0, 0), (0, ye, ze))
        cubo = cad.girar(pecas["cubo_trava"], -ang, (1, 0, 0), (0, ye, ze))
        itens = [r.item(pecas["calha"], "#7fc27a", 1), r.item(porta, "#e0905a", 2),
                 r.item(cubo, "#f2c879", 3), r.item(fant["servo_trava"], "#3a6ea5", 4)]
        alvo = np.array([112, 25, 52])
        olho = r.orbita(alvo, -38, 22, 400)
        im = Image.fromarray(r.para_u8(r.renderizar(itens, olho, alvo, W=1200, H=900, ss=2)))
        d = ImageDraw.Draw(im)
        d.text((30, 25), tit, font=r.fonte(34), fill=CAFE)
        d.text((30, 840), "laranja: portinha · amarelo: cubo do braço · azul: servo SG90", font=r.fonte(24, False),
               fill=(95, 75, 60))
        ims.append(im)
    out = Image.new("RGB", (2400, 900))
    out.paste(ims[0], (0, 0))
    out.paste(ims[1], (1200, 0))
    destino = AQUI / "saida" / "previas" / "trava_calha.png"
    out.save(destino)
    print(destino)


if __name__ == "__main__":
    main()
    trava()
