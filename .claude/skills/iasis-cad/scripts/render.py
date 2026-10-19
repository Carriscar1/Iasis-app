"""
Renderizador por software (z-buffer, projeção ortográfica) para conferir peças.
Não precisa de GPU nem de janela.

Uso pela linha de comando:
    python render.py saida.png peca1.stl [peca2.stl ...] [--vistas frente,tras,iso,topo]
"""
from __future__ import annotations

import argparse
import sys

import numpy as np
import trimesh

CORES = ["#7fa7d9", "#e0a96d", "#9fd39a", "#d98fb5", "#c9c9c9", "#e6d36f"]

# nome: (azimute, elevação) em graus. Azimute 0 = câmera em −Y (olhando a frente).
VISTAS = {
    "frente":   (0, 0),
    "tras":     (180, 0),
    "esquerda": (-90, 0),
    "direita":  (90, 0),
    "topo":     (0, 90),
    "baixo":    (0, -90),
    "iso":      (-35, 25),
    "iso_tras": (145, 25),
}


def _camera(az, el):
    az, el = np.radians(az), np.radians(el)
    # vetor da cena para a câmera
    para_camera = np.array([np.sin(az) * np.cos(el), -np.cos(az) * np.cos(el), np.sin(el)])
    cima = np.array([0.0, 0.0, 1.0])
    if abs(para_camera @ cima) > 0.99:
        cima = np.array([0.0, 1.0 if el > 0 else -1.0, 0.0])
    direita = np.cross(cima, para_camera); direita /= np.linalg.norm(direita)
    cima = np.cross(para_camera, direita)
    return direita, cima, para_camera


def renderizar_vista(malhas, cores, az, el, tamanho=600, limites=None):
    direita, cima, para_camera = _camera(az, el)
    todos = np.vstack([m.vertices for m in malhas])
    if limites is None:
        lo, hi = todos.min(0), todos.max(0)
    else:
        lo, hi = limites
    cantos = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
    pu, pv = cantos @ direita, cantos @ cima
    escala = 0.92 * tamanho / max(pu.max() - pu.min(), pv.max() - pv.min())
    cu, cv = (pu.max() + pu.min()) / 2, (pv.max() + pv.min()) / 2

    img = np.ones((tamanho, tamanho, 3))
    zbuf = np.full((tamanho, tamanho), -np.inf)
    luz = 0.55 * para_camera + 0.35 * cima - 0.25 * direita
    luz /= np.linalg.norm(luz)

    for m, cor in zip(malhas, cores):
        base = np.array([int(cor[i:i + 2], 16) / 255 for i in (1, 3, 5)])
        tri = m.triangles
        normais = m.face_normals
        visiveis = normais @ para_camera > 1e-6           # descarta faces de costas
        tri, normais = tri[visiveis], normais[visiveis]
        sombra = 0.30 + 0.70 * np.clip(normais @ luz, 0, 1)
        X = (tri @ direita - cu) * escala + tamanho / 2
        Y = tamanho / 2 - (tri @ cima - cv) * escala
        Z = tri @ para_camera
        for k in range(len(tri)):
            xs, ys, zs = X[k], Y[k], Z[k]
            x0, x1 = int(max(np.floor(xs.min()), 0)), int(min(np.ceil(xs.max()), tamanho - 1))
            y0, y1 = int(max(np.floor(ys.min()), 0)), int(min(np.ceil(ys.max()), tamanho - 1))
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(d) < 1e-12:
                continue
            a = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
            b = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
            c = 1 - a - b
            dentro = (a >= -1e-6) & (b >= -1e-6) & (c >= -1e-6)
            if not dentro.any():
                continue
            prof = a * zs[0] + b * zs[1] + c * zs[2]
            sub = zbuf[y0:y1 + 1, x0:x1 + 1]
            ganha = dentro & (prof > sub)
            sub[ganha] = prof[ganha]
            img[y0:y1 + 1, x0:x1 + 1][ganha] = base * sombra[k]

    # contorno onde a profundidade salta (silhuetas e degraus)
    z = np.where(np.isfinite(zbuf), zbuf, zbuf[np.isfinite(zbuf)].min() - 1e3 if np.isfinite(zbuf).any() else 0)
    salto = np.zeros_like(z, dtype=bool)
    lim = 1.0  # mm
    salto[:, 1:] |= np.abs(np.diff(z, axis=1)) > lim
    salto[1:, :] |= np.abs(np.diff(z, axis=0)) > lim
    img[salto] = img[salto] * 0.35
    return img


def renderizar(malhas, saida, vistas=("iso", "frente", "tras", "topo"), cores=None,
               titulos=None, tamanho=600, titulo_geral=None):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if isinstance(malhas, trimesh.Trimesh):
        malhas = [malhas]
    cores = cores or CORES
    todos = np.vstack([m.vertices for m in malhas])
    limites = (todos.min(0), todos.max(0))
    fig, eixos = plt.subplots(1, len(vistas), figsize=(4 * len(vistas), 4.3))
    eixos = np.atleast_1d(eixos)
    for ax, v in zip(eixos, vistas):
        az, el = VISTAS[v] if isinstance(v, str) else v
        ax.imshow(renderizar_vista(malhas, cores, az, el, tamanho, limites))
        ax.set_title(titulos[vistas.index(v)] if titulos else str(v), fontsize=10)
        ax.axis("off")
    if titulo_geral:
        fig.suptitle(titulo_geral, fontsize=12)
    plt.tight_layout()
    plt.savefig(saida, dpi=100)
    plt.close(fig)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("saida")
    p.add_argument("stls", nargs="+")
    p.add_argument("--vistas", default="iso,frente,tras,topo")
    a = p.parse_args()
    ms = [trimesh.load(s, force="mesh") for s in a.stls]
    renderizar(ms, a.saida, vistas=a.vistas.split(","))
    print(a.saida, file=sys.stderr)
