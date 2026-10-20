"""
Camada 2D do vídeo v2: mascote Iasinho, legenda da narração, título da cena,
marca e partículas. Tudo desenhado com PIL por cima dos quadros 3D.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import render3d as r

RAIZ = Path(__file__).resolve().parents[2]

CREME = (246, 239, 230)
BEGE = (232, 213, 185)
CAFE = (31, 22, 17)
CARAMELO = (201, 138, 75)
AZUL_CLARO = (175, 208, 238)
AZUL = (91, 147, 207)
MARINHO = (16, 29, 51)


def _heart_svg():
    import sys
    sys.path.insert(0, str(RAIZ / ".claude/skills/iasis-cad/scripts"))
    import iasis_cad as cad
    return cad._caminho_svg(cad.LOGO_CORACAO), cad._caminho_svg(cad.LOGO_ECG, passos=2)


CORACAO_SVG, ECG_SVG = _heart_svg()


# ─── Mascote ────────────────────────────────────────────────────────────────
def _degrade_vertical(tam, c1, c2):
    w, h = tam
    g = np.linspace(0, 1, h)[:, None, None]
    arr = (np.array(c1)[None, None, :] * (1 - g) + np.array(c2)[None, None, :] * g)
    return Image.fromarray(np.repeat(arr, w, axis=1).astype(np.uint8), "RGB")


def mascote(t, falando=False, aponta=None, humor="feliz", escala=1.0):
    """Desenha o Iasinho num quadro RGBA próprio (≈ 300 × 300 px em escala 1).

    t: tempo (s) — asas, piscar e boca são animados a partir dele.
    aponta: ângulo em graus para o braço direito apontar (None = aceno suave).
    humor: "feliz", "surpreso" ou "preocupado".
    """
    S = 2  # desenha em 2× e reduz (bordas lisas)
    L = int(320 * escala * S)
    img = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = L / 2, L / 2 + 10 * S * escala
    k = 1.25 * escala * S  # escala do coração do SVG (96 de largura → ~240 px a 2×)

    def P(p):
        return (cx + (p[0] - 60) * k, cy + (p[1] - 58.5) * k)

    # asas (atrás do corpo), batendo a ~5 Hz
    bate = math.sin(t * 2 * math.pi * 5.0)
    for lado in (-1, 1):
        asa = Image.new("RGBA", (L, L), (0, 0, 0, 0))
        da = ImageDraw.Draw(asa)
        ax, ay = cx + lado * 52 * k / 1.25, cy - 30 * k / 1.25
        w, h = 46 * k / 1.25, 24 * k / 1.25
        da.ellipse([ax - w, ay - h, ax + w, ay + h], fill=(255, 255, 255, 235), outline=(200, 220, 240, 255),
                   width=int(2 * S))
        ang = lado * (25 + 22 * bate)
        asa = asa.rotate(ang, center=(ax - lado * w * 0.8, ay), resample=Image.BICUBIC)
        img = Image.alpha_composite(img, asa)
    d = ImageDraw.Draw(img)

    # corpo: coração com degradê azul e borda
    pts = [P(p) for p in CORACAO_SVG]
    mascara = Image.new("L", (L, L), 0)
    ImageDraw.Draw(mascara).polygon(pts, fill=255)
    corpo = _degrade_vertical((L, L), AZUL_CLARO, AZUL)
    img.paste(corpo, (0, 0), mascara)
    d = ImageDraw.Draw(img)
    d.line(pts + [pts[0]], fill=(60, 105, 165, 255), width=int(3 * S), joint="curve")
    # brilho no canto e bochechas: numa camada à parte (desenho direto com alfa "fura" o corpo)
    luz = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    dl = ImageDraw.Draw(luz)
    dl.ellipse([P((30, 26))[0], P((30, 26))[1], P((44, 34))[0], P((44, 34))[1]], fill=(255, 255, 255, 120))
    for ox in (-30, 30):
        bx, by = P((60 + ox, 64))
        dl.ellipse([bx - 7 * k, by - 4 * k, bx + 7 * k, by + 4 * k], fill=(255, 140, 160, 150))
    img = Image.alpha_composite(img, luz)
    d = ImageDraw.Draw(img)

    # olhos (piscam a cada ~3,7 s)
    piscando = (t % 3.7) < 0.13
    for ox in (-17, 17):
        ex, ey = P((60 + ox, 50))
        rx, ry = 11 * k, (2 * k if piscando else 13 * k)
        if humor == "surpreso" and not piscando:
            ry *= 1.15
        d.ellipse([ex - rx, ey - ry, ex + rx, ey + ry], fill=(255, 255, 255, 255), outline=MARINHO + (255,),
                  width=int(2 * S))
        if not piscando:
            pr = 6.2 * k
            px, py = ex + 2 * k, ey + 2 * k
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=MARINHO + (255,))
            d.ellipse([px - pr * 0.25 - 2 * k, py - pr * 0.6, px - pr * 0.25 + 1 * k, py - pr * 0.6 + 3 * k],
                      fill=(255, 255, 255, 255))
        if humor == "preocupado":
            d.line([ex - rx, ey - ry - 4 * k + ox * 0.15 * k, ex + rx, ey - ry - 4 * k - ox * 0.15 * k],
                   fill=MARINHO + (255,), width=int(3 * S))
    # boca: fala = abre e fecha; parado = sorriso
    mx, my = P((60, 68))
    if falando:
        abre = (0.35 + 0.65 * abs(math.sin(t * 2 * math.pi * 3.1))) * 7 * k
        d.ellipse([mx - 7 * k, my - abre * 0.5, mx + 7 * k, my + abre], fill=(120, 30, 50, 255))
    elif humor == "surpreso":
        d.ellipse([mx - 4 * k, my - 3 * k, mx + 4 * k, my + 5 * k], fill=(120, 30, 50, 255))
    elif humor == "preocupado":
        d.arc([mx - 8 * k, my, mx + 8 * k, my + 10 * k], 200, 340, fill=MARINHO + (255,), width=int(3 * S))
    else:
        d.arc([mx - 9 * k, my - 7 * k, mx + 9 * k, my + 5 * k], 20, 160, fill=MARINHO + (255,), width=int(3 * S))

    # bracinhos: aponta com o braço do lado para onde mira
    lado_aponta = None
    if aponta is not None:
        lado_aponta = 1 if math.cos(math.radians(aponta)) >= 0 else -1
    for lado in (-1, 1):
        sx, sy = P((60 + lado * 40, 62))
        if lado == lado_aponta:
            a = math.radians(aponta)
            comp = 42 * k
            fx, fy = sx + comp * math.cos(a), sy - comp * math.sin(a)
        else:
            onda = math.sin(t * 2 * math.pi * 1.2 + lado) * (18 if lado == 1 else 8)
            a = math.radians((-30 if lado == 1 else 210) + onda)
            if lado_aponta is not None:          # o outro braço fica relaxado
                a = math.radians(-60 if lado == 1 else 240)
            comp = 30 * k
            fx, fy = sx + comp * math.cos(a), sy - comp * math.sin(a)
        d.line([sx, sy, fx, fy], fill=(60, 105, 165, 255), width=int(5 * S))
        d.ellipse([fx - 6 * S, fy - 6 * S, fx + 6 * S, fy + 6 * S], fill=(255, 255, 255, 255),
                  outline=(60, 105, 165, 255), width=int(2 * S))

    img = img.resize((L // S, L // S), Image.LANCZOS)
    # sombra suave
    sombra = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sombra.putalpha(img.getchannel("A").point(lambda a: int(a * 0.35)).filter(ImageFilter.GaussianBlur(10)))
    base = Image.new("RGBA", img.size, (0, 0, 0, 0))
    base.paste(sombra, (6, 14), sombra)
    return Image.alpha_composite(base, img)


# ─── Textos ─────────────────────────────────────────────────────────────────
def legenda_narracao(camada, texto, alfa):
    """Frase da narração, centralizada embaixo."""
    if alfa <= 0.01 or not texto:
        return
    d = ImageDraw.Draw(camada)
    W, H = camada.size
    f = r.fonte(38, False)
    # quebra em até 2 linhas
    palavras, linhas, atual = texto.split(), [], ""
    for p in palavras:
        teste = (atual + " " + p).strip()
        if d.textlength(teste, font=f) > W * 0.62 and atual:
            linhas.append(atual); atual = p
        else:
            atual = teste
    linhas.append(atual)
    lw = max(d.textlength(l, font=f) for l in linhas)
    h = 34 + 50 * len(linhas)
    x0, y0 = (W - lw) / 2 - 36, H - h - 56
    a = int(255 * alfa)
    d.rounded_rectangle([x0, y0, x0 + lw + 72, y0 + h], radius=24, fill=CAFE + (int(195 * alfa),))
    for i, l in enumerate(linhas):
        d.text(((W - d.textlength(l, font=f)) / 2, y0 + 17 + 50 * i), l, font=f, fill=CREME + (a,))


def titulo_cena(camada, titulo, descricao, alfa):
    """Etiqueta de cena no alto à esquerda, para o público (ex.: "Visto de cima")."""
    if alfa <= 0.01:
        return
    d = ImageDraw.Draw(camada)
    ft, fd = r.fonte(40), r.fonte(26, False)
    a = int(255 * alfa)
    lt = d.textlength(titulo, font=ft)
    ld = d.textlength(descricao, font=fd) if descricao else 0
    w = max(lt, ld) + 70
    h = 104 if descricao else 70
    x0, y0 = 56 - (1 - alfa) * 40, 52
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=20, fill=BEGE + (int(235 * alfa),))
    d.rounded_rectangle([x0, y0, x0 + 10, y0 + h], radius=5, fill=AZUL + (a,))
    d.text((x0 + 34, y0 + 14), titulo, font=ft, fill=CAFE + (a,))
    if descricao:
        d.text((x0 + 35, y0 + 64), descricao, font=fd, fill=(110, 80, 55, a))


def marca(camada):
    """Logo pequena no canto inferior direito."""
    W, H = camada.size
    d = ImageDraw.Draw(camada)
    k, cx, cy = 0.33, W - 172, H - 62
    pts = [(cx + (p[0] - 60) * k, cy + (p[1] - 58.5) * k) for p in CORACAO_SVG]
    d.polygon(pts, fill=AZUL + (230,))
    d.line([(cx + (p[0] - 60) * k, cy + (p[1] - 58.5) * k) for p in ECG_SVG], fill=MARINHO + (230,), width=3)
    d.text((cx + 26, cy - 18), "IASIS", font=r.fonte(30), fill=CREME + (220,))


# ─── Partículas (efeito da explosão) ────────────────────────────────────────
def explosao(camada, centro, t_desde, n=70, semente=7):
    """Faíscas e anel saindo de `centro` (px) durante ~1,4 s depois do estouro."""
    if t_desde < 0 or t_desde > 1.6:
        return
    rng = np.random.default_rng(semente)
    d = ImageDraw.Draw(camada)
    cx, cy = centro
    # anel de choque
    raio = 40 + 900 * (1 - (1 - min(t_desde / 0.9, 1)) ** 3)
    a = int(200 * max(0, 1 - t_desde / 0.9))
    if a > 0:
        d.ellipse([cx - raio, cy - raio * 0.55, cx + raio, cy + raio * 0.55], outline=BEGE + (a,), width=6)
    cores = [BEGE, CARAMELO, AZUL_CLARO, CREME, AZUL]
    for i in range(n):
        ang = rng.uniform(0, 2 * math.pi)
        vel = rng.uniform(250, 900)
        tam = rng.uniform(3, 9)
        dist = vel * t_desde * (1 - 0.35 * t_desde)
        x, y = cx + dist * math.cos(ang), cy + dist * math.sin(ang) * 0.7 + 120 * t_desde ** 2
        alfa = int(255 * max(0, 1 - t_desde / 1.5))
        c = cores[i % len(cores)]
        d.ellipse([x - tam, y - tam, x + tam, y + tam], fill=c + (alfa,))


def sombra_chao(img_rgb, centro, largura, altura, intensidade=0.55):
    """Sombra elíptica e desfocada sob o objeto (desenhada no fundo)."""
    W, H = img_rgb.size
    m = Image.new("L", (W, H), 0)
    cx, cy = centro
    ImageDraw.Draw(m).ellipse([cx - largura / 2, cy - altura / 2, cx + largura / 2, cy + altura / 2],
                              fill=int(255 * intensidade))
    m = m.filter(ImageFilter.GaussianBlur(28))
    escuro = Image.new("RGB", (W, H), (8, 5, 3))
    return Image.composite(escuro, img_rgb, m)
