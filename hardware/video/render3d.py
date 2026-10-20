"""
Renderizador 3D por software para os vídeos do IASIS: perspectiva, z-buffer
compilado com numba, iluminação de estúdio, contornos e antisserrilhado.
Não precisa de GPU.
"""
from __future__ import annotations

import math
import subprocess
from dataclasses import dataclass, field

import numpy as np
from numba import njit
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ─── Paleta IASIS ────────────────────────────────────────────────────────────
def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


FUNDO_TOPO = hexrgb("#0b1628")
FUNDO_BASE = hexrgb("#1b3150")
APAGADO = hexrgb("#33435c")
CONTRALUZ = np.array([0.5, 0.7, 1.0], np.float32)
BRILHO_FUNDO = np.array([0.35, 0.55, 0.9], np.float32)


def tema(topo, base, apagado, contraluz, brilho):
    """Troca as cores de fundo e de luz (ex.: tema quente para o vídeo v2)."""
    global FUNDO_TOPO, FUNDO_BASE, APAGADO, CONTRALUZ, BRILHO_FUNDO
    FUNDO_TOPO, FUNDO_BASE, APAGADO = hexrgb(topo), hexrgb(base), hexrgb(apagado)
    CONTRALUZ, BRILHO_FUNDO = np.asarray(contraluz, np.float32), np.asarray(brilho, np.float32)
    _FUNDOS.clear()


# ─── Rasterização ────────────────────────────────────────────────────────────
@njit(cache=True)
def _raster(sx, sy, sz, cor, pid, img, zb, idb):
    H, W = zb.shape
    for t in range(sx.shape[0]):
        x0, x1, x2 = sx[t, 0], sx[t, 1], sx[t, 2]
        y0, y1, y2 = sy[t, 0], sy[t, 1], sy[t, 2]
        area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
        if abs(area) < 1e-9:
            continue
        xmin = max(int(math.floor(min(x0, min(x1, x2)))), 0)
        xmax = min(int(math.ceil(max(x0, max(x1, x2)))), W - 1)
        ymin = max(int(math.floor(min(y0, min(y1, y2)))), 0)
        ymax = min(int(math.ceil(max(y0, max(y1, y2)))), H - 1)
        if xmin > xmax or ymin > ymax:
            continue
        iz0, iz1, iz2 = 1.0 / sz[t, 0], 1.0 / sz[t, 1], 1.0 / sz[t, 2]
        for py in range(ymin, ymax + 1):
            cy = py + 0.5
            for px in range(xmin, xmax + 1):
                cx = px + 0.5
                w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area
                if w0 < 0:
                    continue
                w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area
                if w1 < 0:
                    continue
                w2 = 1.0 - w0 - w1
                if w2 < 0:
                    continue
                z = 1.0 / (w0 * iz0 + w1 * iz1 + w2 * iz2)
                if z < zb[py, px]:
                    zb[py, px] = z
                    img[py, px, 0] = cor[t, 0]
                    img[py, px, 1] = cor[t, 1]
                    img[py, px, 2] = cor[t, 2]
                    idb[py, px] = pid[t]


# ─── Cena ────────────────────────────────────────────────────────────────────
@dataclass
class Item:
    tri: np.ndarray            # (F, 3, 3) mundo
    nrm: np.ndarray            # (F, 3)
    cor: np.ndarray            # (3,)
    pid: int
    visivel: bool = True
    T: np.ndarray | None = None   # transformação 4x4 do quadro
    cor_quadro: np.ndarray | None = None


def item(malha, cor, pid, cor_topo=None):
    """Item de cena. Com `cor_topo`, a peça ganha degradê vertical (cor embaixo → cor_topo em cima)."""
    tri = np.asarray(malha.triangles, np.float32)
    base = hexrgb(cor) if isinstance(cor, str) else np.asarray(cor, np.float32)
    if cor_topo is not None:
        topo = hexrgb(cor_topo) if isinstance(cor_topo, str) else np.asarray(cor_topo, np.float32)
        z = tri[:, :, 2].mean(1)
        k = ((z - z.min()) / max(float(z.max() - z.min()), 1e-6))[:, None]
        base = (base[None, :] * (1 - k) + topo[None, :] * k).astype(np.float32)
    return Item(tri, np.asarray(malha.face_normals, np.float32), base, pid)


def orbita(alvo, azimute, elevacao, distancia):
    """Posição da câmera. Azimute 0 = olhando a frente do dispensador (câmera em −Y)."""
    a, e = math.radians(azimute), math.radians(elevacao)
    return np.array(alvo, float) + distancia * np.array([math.sin(a) * math.cos(e),
                                                         -math.cos(a) * math.cos(e), math.sin(e)])


def _fundo(H, W):
    t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    fundo = FUNDO_TOPO[None, None, :] * (1 - t) + FUNDO_BASE[None, None, :] * t
    fundo = np.repeat(fundo, W, axis=1)
    # brilho suave no centro
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W * 0.5) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
    fundo += (0.10 * np.clip(1 - r * 1.8, 0, 1))[..., None] * BRILHO_FUNDO
    return fundo


_FUNDOS = {}


def fundo(H, W):
    if (H, W) not in _FUNDOS:
        _FUNDOS[(H, W)] = _fundo(H, W)
    return _FUNDOS[(H, W)]


def renderizar(itens, olho, alvo, fov=32.0, W=1920, H=1080, ss=2, cobertura=False):
    """Devolve a imagem (H, W, 3) float32 em 0..1 (e, se pedido, a cobertura 0..1 por pixel)."""
    HW, WW = H * ss, W * ss
    olho = np.asarray(olho, np.float32)
    f = np.asarray(alvo, np.float32) - olho
    f /= np.linalg.norm(f)
    cima = np.array([0, 0, 1], np.float32)
    if abs(f @ cima) > 0.98:
        cima = np.array([0, 1, 0], np.float32)
    r = np.cross(f, cima); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    focal = (HW / 2) / math.tan(math.radians(fov) / 2)
    # luzes presas à câmera: principal (cima-esquerda), preenchimento e contraluz
    L1 = -0.55 * r + 0.65 * u - 0.5 * f; L1 /= np.linalg.norm(L1)
    L2 = 0.7 * r + 0.1 * u - 0.7 * f; L2 /= np.linalg.norm(L2)
    L3 = 0.2 * r + 0.8 * u + 0.6 * f; L3 /= np.linalg.norm(L3)

    SX, SY, SZ, CO, PI = [], [], [], [], []
    for it in itens:
        if not it.visivel:
            continue
        tri, nrm = it.tri, it.nrm
        if it.T is not None:
            R, t = it.T[:3, :3].astype(np.float32), it.T[:3, 3].astype(np.float32)
            tri = tri @ R.T + t
            nrm = nrm @ R.T
        rel = tri - olho
        vz = rel @ f
        de_frente = ((olho - tri.mean(1)) * nrm).sum(1) > 0     # descarta faces de costas
        ok = de_frente & (vz.min(1) > 5.0)
        if not ok.any():
            continue
        rel, vz, n = rel[ok], vz[ok], nrm[ok]
        vx, vy = rel @ r, rel @ u
        SX.append(WW / 2 + focal * vx / vz)
        SY.append(HW / 2 - focal * vy / vz)
        SZ.append(vz)
        base = it.cor_quadro if it.cor_quadro is not None else it.cor
        base = base[ok] if base.ndim == 2 else base[None, :]
        d1 = np.clip(n @ L1, 0, 1); d2 = np.clip(n @ L2, 0, 1); d3 = np.clip(n @ L3, 0, 1)
        meio = L1 - f; meio /= np.linalg.norm(meio)
        brilho = np.clip(n @ meio, 0, 1) ** 24
        luz = 0.30 + 0.62 * d1 + 0.22 * d2
        cor = base * luz[:, None] + 0.18 * brilho[:, None] + 0.10 * d3[:, None] * CONTRALUZ
        CO.append(np.clip(cor, 0, 1).astype(np.float32))
        PI.append(np.full(len(vz), it.pid, np.int32))

    img = fundo(HW, WW).copy()
    zb = np.full((HW, WW), np.inf, np.float32)
    idb = np.full((HW, WW), -1, np.int32)
    if SX:
        _raster(np.concatenate(SX).astype(np.float32), np.concatenate(SY).astype(np.float32),
                np.concatenate(SZ).astype(np.float32), np.concatenate(CO), np.concatenate(PI), img, zb, idb)
    # contornos: troca de peça ou salto de profundidade
    borda = np.zeros((HW, WW), bool)
    borda[:, 1:] |= idb[:, 1:] != idb[:, :-1]
    borda[1:, :] |= idb[1:, :] != idb[:-1, :]
    zf = np.where(np.isfinite(zb), zb, 1e6)
    salto = 0.012 * np.minimum(zf[:, 1:], zf[:, :-1])
    borda[:, 1:] |= np.abs(zf[:, 1:] - zf[:, :-1]) > salto
    salto = 0.012 * np.minimum(zf[1:, :], zf[:-1, :])
    borda[1:, :] |= np.abs(zf[1:, :] - zf[:-1, :]) > salto
    borda &= np.isfinite(zb) | np.roll(np.isfinite(zb), 1, 0) | np.roll(np.isfinite(zb), 1, 1)
    img[borda] *= 0.45
    final = img.reshape(H, ss, W, ss, 3).mean(axis=(1, 3))
    if cobertura:
        return final, np.isfinite(zb).reshape(H, ss, W, ss).mean(axis=(1, 3)).astype(np.float32)
    return final


def projetar(ponto, olho, alvo, fov=32.0, W=1920, H=1080):
    """Posição (x, y) em pixels de um ponto 3D na tela, ou None se estiver atrás da câmera."""
    olho = np.asarray(olho, float)
    f = np.asarray(alvo, float) - olho; f /= np.linalg.norm(f)
    cima = np.array([0, 0, 1.0]) if abs(f[2]) < 0.98 else np.array([0, 1.0, 0])
    r = np.cross(f, cima); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    v = np.asarray(ponto, float) - olho
    z = v @ f
    if z <= 1:
        return None
    focal = (H / 2) / math.tan(math.radians(fov) / 2)
    return (W / 2 + focal * (v @ r) / z, H / 2 - focal * (v @ u) / z)


# ─── Texto e marca ───────────────────────────────────────────────────────────
def _fonte(tamanho, negrito=True):
    from matplotlib import font_manager
    caminho = font_manager.findfont(font_manager.FontProperties(family="DejaVu Sans",
                                                                weight="bold" if negrito else "normal"))
    return ImageFont.truetype(caminho, tamanho)


FONTES = {}


def fonte(tamanho, negrito=True):
    k = (tamanho, negrito)
    if k not in FONTES:
        FONTES[k] = _fonte(tamanho, negrito)
    return FONTES[k]


def _coracao_pontos(escala, cx, cy):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".claude/skills/iasis-cad/scripts"))
    import iasis_cad as cad
    pts = cad._caminho_svg(cad.LOGO_CORACAO)
    ecg = cad._caminho_svg(cad.LOGO_ECG, passos=2)
    f = lambda p: (cx + (p[0] - 60) * escala, cy + (p[1] - 58.5) * escala)
    return [f(p) for p in pts], [f(p) for p in ecg]


def marca(draw, x, y, tam=1.0, alfa=255):
    coracao, ecg = _coracao_pontos(0.38 * tam, x + 22 * tam, y + 22 * tam)
    draw.polygon(coracao, fill=(91, 147, 207, alfa))
    draw.line(ecg, fill=(16, 29, 51, alfa), width=max(2, int(3 * tam)), joint="curve")
    draw.text((x + 52 * tam, y + 4 * tam), "IASIS", font=fonte(int(30 * tam)), fill=(235, 242, 250, alfa))


def legenda(img_u8, titulo, subtitulo="", alfa=1.0, posicao="baixo"):
    """Desenha a legenda (terço inferior) com transparência `alfa` (0..1)."""
    if alfa <= 0.01:
        return img_u8
    base = Image.fromarray(img_u8).convert("RGBA")
    camada = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    ft, fs = fonte(46), fonte(28, False)
    lt = d.textlength(titulo, font=ft)
    ls = d.textlength(subtitulo, font=fs) if subtitulo else 0
    w = int(max(lt, ls) + 80)
    h = 120 if subtitulo else 82
    x0 = 90
    y0 = base.size[1] - h - 90 if posicao == "baixo" else 90
    a = int(255 * alfa)
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=18, fill=(10, 20, 38, int(200 * alfa)))
    d.rounded_rectangle([x0, y0, x0 + 8, y0 + h], radius=4, fill=(91, 147, 207, a))
    d.text((x0 + 36, y0 + 16), titulo, font=ft, fill=(240, 246, 252, a))
    if subtitulo:
        d.text((x0 + 38, y0 + 72), subtitulo, font=fs, fill=(175, 208, 238, a))
    return np.asarray(Image.alpha_composite(base, camada).convert("RGB"))


def com_marca(img_u8):
    base = Image.fromarray(img_u8).convert("RGBA")
    camada = Image.new("RGBA", base.size, (0, 0, 0, 0))
    marca(ImageDraw.Draw(camada), 60, 48, 1.0, 230)
    return np.asarray(Image.alpha_composite(base, camada).convert("RGB"))


def texto_central(img_u8, titulo, subtitulo="", alfa=1.0, y=None):
    if alfa <= 0.01:
        return img_u8
    base = Image.fromarray(img_u8).convert("RGBA")
    camada = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    W, H = base.size
    ft, fs = fonte(84), fonte(36, False)
    a = int(255 * alfa)
    y = y if y is not None else H * 0.77
    d.text(((W - d.textlength(titulo, font=ft)) / 2, y), titulo, font=ft, fill=(240, 246, 252, a))
    if subtitulo:
        d.text(((W - d.textlength(subtitulo, font=fs)) / 2, y + 104), subtitulo, font=fs, fill=(175, 208, 238, a))
    return np.asarray(Image.alpha_composite(base, camada).convert("RGB"))


# ─── Vídeo ───────────────────────────────────────────────────────────────────
class Gravador:
    """Envia quadros RGB para o ffmpeg (H.264, yuv420p, toca em qualquer TV/monitor)."""

    def __init__(self, caminho, W=1920, H=1080, fps=30):
        self.p = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
             "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium",
             "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(caminho)],
            stdin=subprocess.PIPE)

    def quadro(self, img_u8):
        self.p.stdin.write(np.ascontiguousarray(img_u8).tobytes())

    def fechar(self):
        self.p.stdin.close()
        self.p.wait()


def para_u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


def suave(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def janela(t, a, b, rampa=0.5):
    """1 entre a e b, com subida/descida suave de `rampa` segundos."""
    if t < a or t > b:
        return 0.0
    return min(suave((t - a) / rampa), suave((b - t) / rampa))
