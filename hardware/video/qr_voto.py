"""
Cartão com QR code de votação do IASIS, nas cores do vídeo.

    python hardware/video/qr_voto.py        # salva saida_loop/qr_voto.png e confere a leitura

O QR usa correção de erro alta (H) para caber o coração da logo no meio, e os
módulos ficam escuros sobre fundo claro (contraste que qualquer câmera lê).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
import qrcode
from PIL import Image, ImageDraw

import render3d as r
import estilo as e

URL_VOTO = "https://www.bentovote.com.br/projetos/dc5c3660-1a8b-4f6d-a5d8-2acf295e530c"
ESCURO = (42, 29, 21)          # marrom-café dos módulos
OLHO = e.MARINHO               # cantos do QR em azul-marinho
RAIO_OLHO = 0.5


def _qr_img(url, lado):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0)
    q.add_data(url)
    q.make(fit=True)
    m = np.array(q.get_matrix(), bool)
    n = m.shape[0]
    S = 4                                   # desenha em 4× e reduz (bordas lisas)
    px = lado * S / n
    img = Image.new("RGBA", (lado * S, lado * S), e.CREME + (255,))
    d = ImageDraw.Draw(img)

    def olho_em(i, j):
        return any(a <= i < a + 7 and b <= j < b + 7 for a, b in ((0, 0), (0, n - 7), (n - 7, 0)))

    for i in range(n):
        for j in range(n):
            if m[i, j] and not olho_em(i, j):
                x, y = j * px, i * px
                d.rounded_rectangle([x + px * 0.06, y + px * 0.06, x + px * 0.94, y + px * 0.94],
                                    radius=px * 0.38, fill=ESCURO + (255,))
    for a, b in ((0, 0), (0, n - 7), (n - 7, 0)):  # olhos arredondados
        x, y = b * px, a * px
        # cantos só levemente arredondados: o leitor acha o QR por esses quadrados
        d.rounded_rectangle([x, y, x + 7 * px, y + 7 * px], radius=px * RAIO_OLHO, fill=OLHO + (255,))
        d.rounded_rectangle([x + px, y + px, x + 6 * px, y + 6 * px], radius=px * RAIO_OLHO * 0.6,
                            fill=e.CREME + (255,))
        d.rounded_rectangle([x + 2 * px, y + 2 * px, x + 5 * px, y + 5 * px], radius=px * RAIO_OLHO * 0.5,
                            fill=OLHO + (255,))
    # coração da logo no meio (cobre ~5 % dos módulos; a correção H aguenta 30 %)
    c = lado * S / 2
    k = lado * S * 0.0021
    raio = lado * S * 0.13
    d.ellipse([c - raio, c - raio, c + raio, c + raio], fill=e.CREME + (255,))
    pts = [(c + (p[0] - 60) * k, c + (p[1] - 58.5) * k) for p in e.CORACAO_SVG]
    d.polygon(pts, fill=e.AZUL + (255,))
    d.line([(c + (p[0] - 60) * k, c + (p[1] - 58.5) * k) for p in e.ECG_SVG],
           fill=e.MARINHO + (255,), width=int(max(2, 4.5 * k)), joint="curve")
    return img.resize((lado, lado), Image.LANCZOS)


@lru_cache(maxsize=4)
def cartao(url=URL_VOTO, lado_qr=232):
    """Cartão bege arredondado: título, QR e instrução. Devolve RGBA."""
    # tudo proporcional ao QR: em volta dele fica sempre a margem lisa de 4 módulos que o leitor precisa
    u = lado_qr / 232
    pad, topo, base = round(24 * u), round(76 * u), round(50 * u)
    W, H = lado_qr + 2 * pad, lado_qr + topo + base + pad
    S = 2
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, W * S - 1, H * S - 1], radius=26 * u * S, fill=e.CREME + (250,),
                        outline=e.CARAMELO + (255,), width=round(3 * u * S))
    f1, f2 = r.fonte(round(30 * u * S)), r.fonte(round(19 * u * S), False)
    t = "Vote no IASIS!"
    d.text(((W * S - d.textlength(t, font=f1)) / 2, 14 * u * S), t, font=f1, fill=e.CAFE + (255,))
    t = "Aponte a câmera do celular"
    d.text(((W * S - d.textlength(t, font=f2)) / 2, (topo + lado_qr + 16 * u) * S), t, font=f2,
           fill=(110, 80, 55, 255))
    img = img.resize((W, H), Image.LANCZOS)
    img.alpha_composite(_qr_img(url, lado_qr), (pad, topo))
    # sombra suave por trás
    from PIL import ImageFilter
    sombra = Image.new("RGBA", (W + 40, H + 40), (0, 0, 0, 0))
    sombra.paste((0, 0, 0, 110), (20, 26, 20 + W, 26 + H), img.getchannel("A"))
    sombra = sombra.filter(ImageFilter.GaussianBlur(10))
    sombra.alpha_composite(img, (20, 20))
    return sombra


def ler(img_rgb):
    """Lê o QR de uma imagem (para conferir que funciona). Devolve o texto ou ''."""
    import cv2
    arr = np.asarray(img_rgb.convert("RGB"))[:, :, ::-1]
    txt, _, _ = cv2.QRCodeDetector().detectAndDecode(arr)
    return txt


if __name__ == "__main__":
    saida = Path(__file__).resolve().parent / "saida_loop"
    saida.mkdir(exist_ok=True)
    c = cartao()
    fundo = Image.new("RGBA", c.size, (58, 42, 32, 255))
    fundo.alpha_composite(c)
    fundo.convert("RGB").save(saida / "qr_voto.png")
    grande = cartao(lado_qr=900)
    branco = Image.new("RGBA", grande.size, (255, 255, 255, 255))
    branco.alpha_composite(grande)
    branco.convert("RGB").save(saida / "qr_voto_impressao.png")
    lido = ler(fundo)
    print("tamanho:", c.size, "| leitura:", lido)
    assert lido == URL_VOTO, "QR não leu o link certo"
