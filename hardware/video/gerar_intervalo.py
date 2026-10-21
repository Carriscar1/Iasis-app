"""
IASIS — tela de intervalo "Voltamos em breve", em loop, com o Iasinho acenando.

    python hardware/video/gerar_intervalo.py

Tudo tem período que divide LOOP (14,4 s): o último quadro emenda no primeiro.
Saídas em hardware/video/saida_loop/:
  IASIS_voltamos_em_breve.mp4        um ciclo (para o player repetir)
  IASIS_voltamos_em_breve_10min.mp4  o mesmo ciclo repetido por ~10 min (TV sem repetição)
"""
from __future__ import annotations

import math
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import render3d as r                      # noqa: E402
import estilo as e                        # noqa: E402
import mascote3d as m3                    # noqa: E402

W, H, FPS = 1920, 1080, 30
LOOP = 14.4          # múltiplo dos períodos do mascote (2,4 · 3,6 · 1,6 · 1,2 · 0,8 s)
SAIDA = AQUI / "saida_loop"
FONTES = Path("/usr/share/fonts/opentype/inter")
MARROM = (110, 80, 55)


@lru_cache(maxsize=None)
def fonte(peso, tam):
    try:
        return ImageFont.truetype(str(FONTES / f"InterDisplay-{peso}.otf"), tam)
    except OSError:
        return r.fonte(tam, peso != "Medium")


def onda(t, periodo, fase=0.0):
    return math.sin(2 * math.pi * t / periodo + fase)


# ─── Fundo ───────────────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def _degrade():
    y = np.linspace(0, 1, H)[:, None, None]
    c1, c2 = np.array(e.CREME, float), np.array(e.BEGE, float)
    img = c1 * (1 - y) + c2 * y
    return Image.fromarray(np.broadcast_to(img, (H, W, 3)).astype(np.uint8)).convert("RGBA")


@lru_cache(maxsize=None)
def _bolha(raio, cor, alfa):
    m = int(raio * 1.3)
    img = Image.new("RGBA", (2 * (raio + m), 2 * (raio + m)), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse([m, m, m + 2 * raio, m + 2 * raio], fill=cor + (alfa,))
    return img.filter(ImageFilter.GaussianBlur(raio * 0.35))


# (centro x, centro y, raio da órbita, raio da bolha, cor, alfa, voltas por ciclo, fase)
BOLHAS = [(260, 180, 60, 230, e.AZUL_CLARO, 120, 1, 0.0), (1650, 140, 70, 190, e.CARAMELO, 55, 1, 2.0),
          (1500, 900, 80, 260, e.AZUL_CLARO, 90, -1, 1.0), (380, 960, 50, 200, e.CARAMELO, 50, 1, 4.0),
          (980, 560, 90, 300, (255, 255, 255), 70, -1, 3.0)]


def _coracao(d, cx, cy, k, cor):
    d.polygon([(cx + (p[0] - 60) * k, cy + (p[1] - 58.5) * k) for p in e.CORACAO_SVG], fill=cor)


def fundo(t):
    img = _degrade().copy()
    for cx, cy, ro, rb, cor, a, voltas, fase in BOLHAS:
        ang = 2 * math.pi * voltas * t / LOOP + fase
        b = _bolha(rb, cor, a)
        img.alpha_composite(b, (int(cx + ro * math.cos(ang) - b.width / 2), int(cy + ro * math.sin(ang) - b.height / 2)))
    # coraçõezinhos subindo devagar (cada um sobe um número inteiro de vezes por ciclo)
    camada = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    rng = np.random.default_rng(3)
    for i in range(14):
        x0, fase, k, vezes = rng.uniform(60, W - 60), rng.uniform(0, 1), rng.uniform(0.12, 0.26), rng.integers(1, 3)
        p = (fase + vezes * t / LOOP) % 1.0
        y = H + 60 - p * (H + 160)
        x = x0 + 24 * onda(t, LOOP / vezes, i)
        a = int(110 * min(1.0, p / 0.15, (1 - p) / 0.25))
        _coracao(d, x, y, k, e.AZUL + (a,))
    img.alpha_composite(camada)
    return img


# ─── Textos ──────────────────────────────────────────────────────────────────
X_TEXTO = 930       # início do bloco de texto (o mascote ocupa a esquerda)


def palavra_ondulante(d, texto, x, y, f, cor, t, atraso=0.0):
    """Cada letra sobe e desce um pouco, em onda da esquerda para a direita."""
    for i, ch in enumerate(texto):
        dy = -9 * max(0.0, onda(t, 2.4, -0.42 * i - atraso))
        d.text((x + d.textlength(texto[:i], font=f), y + dy), ch, font=f, fill=cor)
    return x + d.textlength(texto, font=f)


def relogio(d, cx, cy, raio, t):
    d.ellipse([cx - raio, cy - raio, cx + raio, cy + raio], outline=e.CREME, width=5)
    for ang, comp, larg in ((2 * math.pi * t / 7.2, 0.72, 5), (2 * math.pi * t / LOOP, 0.5, 6)):
        d.line([(cx, cy), (cx + comp * raio * math.sin(ang), cy - comp * raio * math.cos(ang))],
               fill=e.CREME, width=larg)
    d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=e.CREME)


def textos(camada, t):
    d = ImageDraw.Draw(camada)
    # selo "Intervalo" com relógio girando
    fs = fonte("ExtraBold", 40)
    rot = "INTERVALO"
    lw = d.textlength(rot, font=fs)
    x0, y0, h = X_TEXTO, 236, 76
    d.rounded_rectangle([x0, y0, x0 + lw + 124, y0 + h], radius=h / 2, fill=e.CAFE)
    relogio(d, x0 + 46, y0 + h / 2, 22, t)
    d.text((x0 + 88, y0 + 15), rot, font=fs, fill=e.CREME)

    fg = fonte("Black", 164)
    palavra_ondulante(d, "Voltamos", X_TEXTO - 8, 360, fg, e.CAFE, t)
    fim = palavra_ondulante(d, "em breve", X_TEXTO - 8, 552, fg, e.AZUL, t, atraso=1.2)
    # reticências pulando uma de cada vez
    for i in range(3):
        s = max(0.0, onda(t, 1.2, -1.0 * i))
        rr = 15 + 3 * s
        cx, cy = fim + 30 + 48 * i, 552 + 140 - 26 * s
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=e.AZUL)

    fm = fonte("Medium", 46)
    d.text((X_TEXTO, 800), "Estamos no intervalo.", font=fm, fill=MARROM)
    d.text((X_TEXTO, 860), "Já já a gente continua!", font=fm, fill=MARROM)

    # logo no canto
    k, cx, cy = 0.42, W - 214, H - 74
    _coracao(d, cx, cy, k, e.AZUL)
    d.line([(cx + (p[0] - 60) * k, cy + (p[1] - 58.5) * k) for p in e.ECG_SVG], fill=e.MARINHO, width=4)
    d.text((cx + 34, cy - 26), "IASIS", font=fonte("Black", 44), fill=e.CAFE)


# ─── Mascote ─────────────────────────────────────────────────────────────────
MASC_C = (480, 520)


def iasinho(img, t):
    m = m3.mascote(t, False, None, "feliz", escala=1.75)
    sobe = 22 * onda(t, 2.4, math.pi / 2)            # flutua no mesmo ritmo do balanço
    # sombra no "chão" que encolhe quando ele sobe
    chao = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    k = 1 - 0.18 * (sobe + 22) / 44
    sw, sh = 300 * k, 46 * k
    ImageDraw.Draw(chao).ellipse([MASC_C[0] - sw / 2, 905 - sh / 2, MASC_C[0] + sw / 2, 905 + sh / 2],
                                 fill=(70, 45, 25, int(70 * k)))
    img.alpha_composite(chao.filter(ImageFilter.GaussianBlur(14)))
    img.alpha_composite(m, (int(MASC_C[0] - m.width / 2), int(MASC_C[1] - m.height / 2 - sobe)))


def quadro(t):
    img = fundo(t)
    iasinho(img, t)
    camada = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    textos(camada, t)
    img.alpha_composite(camada)
    return np.asarray(img.convert("RGB"))


# ─── Gravação ────────────────────────────────────────────────────────────────
PEDACO = 2.4


def gravar(k):
    partes = SAIDA / "partes_intervalo"
    partes.mkdir(parents=True, exist_ok=True)
    destino = partes / f"{k:02d}.mp4"
    if destino.exists():
        return k
    temp = destino.with_suffix(".tmp.mp4")
    g = r.Gravador(temp)
    for i in range(int(round(k * PEDACO * FPS)), int(round((k + 1) * PEDACO * FPS))):
        g.quadro(quadro(i / FPS))
    g.fechar()
    temp.rename(destino)
    return k


def montar():
    arqs = sorted(f for f in (SAIDA / "partes_intervalo").glob("*.mp4") if ".tmp" not in f.name)
    lista = SAIDA / "lista_intervalo.txt"
    lista.write_text("".join(f"file '{f.resolve()}'\n" for f in arqs))
    um = SAIDA / "IASIS_voltamos_em_breve.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(um)], check=True)
    lista.unlink()
    voltas = int(600 // LOOP) + 1
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", str(voltas - 1), "-i", str(um),
                    "-c", "copy", "-movflags", "+faststart", str(SAIDA / "IASIS_voltamos_em_breve_10min.mp4")],
                   check=True)
    return um


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 1 and sys.argv[1] == "--previa":
        for s in (0.0, 1.0, 3.3):
            Image.fromarray(quadro(s)).save(SAIDA / f"previa_intervalo_{s:.1f}.png")
        sys.exit()
    m3.mascote(0.0)                       # monta as malhas uma vez antes de dividir o trabalho
    with Pool(4) as pool:
        for k in pool.imap_unordered(gravar, range(int(round(LOOP / PEDACO)))):
            print("pronto:", k, flush=True)
    print("vídeo:", montar(), flush=True)
