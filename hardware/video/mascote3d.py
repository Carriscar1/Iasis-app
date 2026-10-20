"""
Iasinho em 3D: um coração azul fofinho com asinhas, olhos brilhantes,
bochechas, bracinhos, pezinhos e o ECG da logo na barriga.

    mascote(t, falando=False, aponta=None, humor="feliz", escala=1.0) -> PIL RGBA

Mesma assinatura do mascote 2D de estilo.py, então dá para trocar um pelo outro.
As malhas fixas são geradas uma vez (marching cubes de um coração implícito) e
cada quadro só move as partes animadas: asas, braços, boca, olhos e pernas.
"""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np
import trimesh
from PIL import Image, ImageFilter
from skimage.measure import marching_cubes

import render3d as r

U = 100.0          # o renderizador corta tudo a menos de 5 unidades da câmera: trabalhamos ×100

COR = dict(
    corpo=("#3a7bd0", "#a8d4ff"), ecg="#13223d", olho="#ffffff", pupila="#13223d", brilho="#ffffff",
    bochecha="#ff9db2", boca="#7a1f35", lingua="#ff7a90", traco="#13223d", braco="#3a7bd0",
    mao="#ffffff", sapato=("#a86c36", "#d39a5e"), asa=("#cfe3f6", "#ffffff"),
)


# ─── Geometria básica ───────────────────────────────────────────────────────
def _campo(x, y, z):
    """Coração implícito (≤ 0 dentro). y é a profundidade; 1.6 deixa ele gordinho."""
    a = x * x + 1.6 * y * y + z * z - 1
    return a ** 3 - x * x * z ** 3 - 0.08 * y * y * z ** 3


def frente(x, z):
    """y da superfície da frente (lado da câmera, y negativo) no ponto (x, z)."""
    ys = np.linspace(-1.0, 0.0, 400)
    v = _campo(x, ys, z)
    i = int(np.argmax(v <= 0))
    if v[i] > 0:
        return 0.0
    a, b = ys[max(i - 1, 0)], ys[i]
    for _ in range(30):
        m = (a + b) / 2
        a, b = (m, b) if _campo(x, m, z) > 0 else (a, m)
    return float(b)


def _bola(c, raios, sub=3):
    m = trimesh.creation.icosphere(subdivisions=sub)
    m.apply_scale(raios)
    m.apply_translation(c)
    return m


def _tubo(pontos, raio, lados=14):
    """Cadeia de cilindros com bolinhas nas juntas: cantos sempre redondos."""
    pts = [np.asarray(p, float) for p in pontos]
    partes = [_bola(p, raio, 2) for p in pts]
    for a, b in zip(pts, pts[1:]):
        if np.linalg.norm(b - a) > 1e-6:
            partes.append(trimesh.creation.cylinder(raio, segment=[a, b], sections=lados))
    return trimesh.util.concatenate(partes)


def _na_frente(x, z, afasta=0.0):
    return (x, frente(x, z) - afasta, z)


def _arco(x0, x1, zc, curva, n=11, afasta=0.0):
    """Arco desenhado na frente do corpo; curva > 0 = sorriso (meio mais baixo)."""
    pts = []
    for i in range(n):
        s = i / (n - 1)
        x = x0 + (x1 - x0) * s
        z = zc - curva * (1 - (2 * s - 1) ** 2)
        pts.append(_na_frente(x, z, afasta))
    return pts


@lru_cache(maxsize=1)
def _malhas():
    n = 150
    xs = np.linspace(-1.35, 1.35, n)
    ys = np.linspace(-0.95, 0.95, n)
    zs = np.linspace(-1.15, 1.45, n)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij")
    v, f, _, _ = marching_cubes(_campo(X, Y, Z), 0.0,
                                spacing=(xs[1] - xs[0], ys[1] - ys[0], zs[1] - zs[0]))
    v += (xs[0], ys[0], zs[0])
    corpo = trimesh.Trimesh(v, f, process=True)
    trimesh.smoothing.filter_taubin(corpo, iterations=40)
    if corpo.volume < 0:
        corpo.invert()

    M = {"corpo": corpo}
    # ECG da logo na barriga
    ecg = [(-0.42, -0.40), (-0.16, -0.40), (-0.09, -0.27), (0.0, -0.58), (0.08, -0.33),
           (0.13, -0.40), (0.42, -0.40)]
    M["ecg"] = _tubo([_na_frente(x, z, 0.012) for x, z in ecg], 0.032)
    # olhos abertos: branco, pupila e brilho (a pupila anda um pouco para onde ele olha)
    olhos, pupilas, brilhos, fechados = [], [], [], []
    for lado in (-1, 1):
        x, z = 0.33 * lado, 0.22
        y = frente(x, z)
        olhos.append(_bola((x, y + 0.035, z), (0.165, 0.07, 0.2)))
        pupilas.append(_bola((x, y - 0.03, z - 0.02), (0.1, 0.03, 0.12)))
        brilhos.append(_bola((x - 0.04, y - 0.06, z + 0.05), (0.035, 0.012, 0.04), 2))
        fechados.append(_tubo(_arco(x - 0.14, x + 0.14, z - 0.03, -0.07, 9, 0.01), 0.026))
    M["olhos"], M["pupilas"], M["brilhos"] = map(trimesh.util.concatenate, (olhos, pupilas, brilhos))
    M["olhos_fechados"] = trimesh.util.concatenate(fechados)
    # bochechas
    M["bochechas"] = trimesh.util.concatenate(
        [_bola(_na_frente(0.6 * l, -0.02, -0.02), (0.12, 0.035, 0.075)) for l in (-1, 1)])
    # bocas
    M["boca_sorriso"] = _tubo(_arco(-0.17, 0.17, -0.06, 0.09, afasta=0.01), 0.03)
    M["boca_triste"] = _tubo(_arco(-0.14, 0.14, -0.13, -0.06, afasta=0.01), 0.028)
    yb = frente(0.0, -0.1)
    M["boca_aberta"] = _bola((0, yb + 0.005, -0.1), (0.14, 0.045, 0.1))
    M["lingua"] = _bola((0, yb - 0.03, -0.14), (0.07, 0.02, 0.035))
    M["boca_o"] = _bola((0, yb + 0.005, -0.1), (0.065, 0.045, 0.075))
    # sobrancelhas
    M["sobr_preocupado"] = trimesh.util.concatenate(
        [_tubo([_na_frente(0.33 * l - 0.12 * l, 0.5, 0.0), _na_frente(0.33 * l + 0.1 * l, 0.43, 0.0)], 0.026)
         for l in (-1, 1)])
    M["sobr_surpreso"] = trimesh.util.concatenate(
        [_tubo(_arco(0.33 * l - 0.12, 0.33 * l + 0.12, 0.55, -0.05, 7, 0.0), 0.024) for l in (-1, 1)])
    # pernas e sapatinhos
    pernas, sapatos = [], []
    for l in (-1, 1):
        pernas.append(_tubo([(0.2 * l, -0.05, -0.7), (0.26 * l, -0.08, -0.98)], 0.06))
        sapatos.append(_bola((0.28 * l, -0.16, -1.04), (0.15, 0.2, 0.09)))
    M["pernas"], M["sapatos"] = trimesh.util.concatenate(pernas), trimesh.util.concatenate(sapatos)
    # asa: três penas, raiz na origem, apontando para +x (a esquerda é espelhada)
    penas = []
    for c, raio, ang in [((0.56, 0, 0.14), (0.58, 0.06, 0.2), 22),
                         ((0.46, 0, -0.09), (0.47, 0.06, 0.17), 2),
                         ((0.35, 0, -0.28), (0.35, 0.06, 0.13), -18)]:
        p = _bola((0, 0, 0), raio)
        p.apply_transform(trimesh.transformations.rotation_matrix(math.radians(ang), [0, -1, 0]))
        p.apply_translation(c)
        penas.append(p)
    asa = trimesh.util.concatenate(penas)
    M["asa_dir"] = asa
    esq = asa.copy()
    esq.apply_transform(np.diag([-1.0, 1, 1, 1]))
    esq.invert()
    M["asa_esq"] = esq
    for m in M.values():
        m.apply_scale(U)
    return M


def _rot(eixo, graus, centro=(0, 0, 0)):
    return trimesh.transformations.rotation_matrix(math.radians(graus), eixo, np.asarray(centro) * U)


def _braco(lado, ang, t, apontando):
    """Bracinho com cotovelo e mão; ang em graus no plano da tela (0 = direita, 90 = cima)."""
    ombro = np.array([0.9 * lado, -0.12, -0.08])
    a = math.radians(ang)
    d = np.array([math.cos(a), 0, math.sin(a)])
    comp = 0.62 if apontando else 0.5
    curva = np.array([-d[2], 0, d[0]]) * (0.06 if apontando else 0.1) * lado
    cotovelo = ombro + d * comp * 0.5 + curva + np.array([0, -0.05, 0])
    mao = ombro + d * comp + np.array([0, -0.08, 0])
    braco = _tubo([ombro, cotovelo, mao], 0.068)
    partes = [_bola(mao, 0.135)]
    if apontando:
        partes.append(_tubo([mao + d * 0.08, mao + d * 0.22], 0.05))
    mao_m = trimesh.util.concatenate(partes)
    braco.apply_scale(U)
    mao_m.apply_scale(U)
    return braco, mao_m


# ─── Quadro ─────────────────────────────────────────────────────────────────
def mascote(t, falando=False, aponta=None, humor="feliz", escala=1.0):
    M = _malhas()
    itens = []
    pid = [0]

    def add(nome_ou_malha, cor, T=None):
        malha = M[nome_ou_malha] if isinstance(nome_ou_malha, str) else nome_ou_malha
        c1, c2 = cor if isinstance(cor, tuple) else (cor, None)
        it = r.item(malha, c1, pid[0], c2)
        it.T = T
        pid[0] += 1
        itens.append(it)

    # postura geral: balanço, leve giro para o lado em que aponta e "respiração"
    giro = 0.0
    if aponta is not None:
        giro = 14 * math.cos(math.radians(aponta))
    balanco = 5 * math.sin(t * 2 * math.pi / 2.3)
    resp = 1 + 0.025 * math.sin(t * 2 * math.pi / 1.6)
    G = _rot([0, 0, 1], giro) @ _rot([0, 1, 0], balanco) @ np.diag([1 / math.sqrt(resp), 1, resp, 1])

    bate = math.sin(t * 2 * math.pi * 3.0)
    for lado, nome in ((1, "asa_dir"), (-1, "asa_esq")):
        raiz = trimesh.transformations.translation_matrix(np.array([0.62 * lado, 0.38, 0.5]) * U)
        add(nome, COR["asa"], G @ raiz @ _rot([0, 1, 0], -lado * (28 + 24 * bate)) @ _rot([0, 0, 1], -lado * 22))
    add("corpo", COR["corpo"], G)
    add("ecg", COR["ecg"], G)
    add("bochechas", COR["bochecha"], G)

    piscando = (t % 3.7) < 0.14
    if piscando:
        add("olhos_fechados", COR["traco"], G)
    else:
        esc = 1.12 if humor == "surpreso" else 1.0
        S = np.diag([esc, 1, esc, 1])
        olhar = np.zeros(3)
        if aponta is not None:
            a = math.radians(aponta)
            olhar = np.array([math.cos(a) * 0.045, 0, math.sin(a) * 0.05]) * U
        add("olhos", COR["olho"], G @ S)
        add("pupilas", COR["pupila"], G @ trimesh.transformations.translation_matrix(olhar) @ S)
        add("brilhos", COR["brilho"], G @ trimesh.transformations.translation_matrix(olhar) @ S)

    if falando:
        abre = 0.45 + 0.55 * abs(math.sin(t * 2 * math.pi * 3.1))
        c = np.array([0, frente(0, -0.1), -0.06]) * U
        Sb = trimesh.transformations.translation_matrix(c) @ np.diag([1, 1, abre, 1]) \
            @ trimesh.transformations.translation_matrix(-c)
        add("boca_aberta", COR["boca"], G @ Sb)
        add("lingua", COR["lingua"], G @ Sb)
    elif humor == "surpreso":
        add("boca_o", COR["boca"], G)
    elif humor == "preocupado":
        add("boca_triste", COR["traco"], G)
    else:
        add("boca_sorriso", COR["traco"], G)
    if humor == "preocupado":
        add("sobr_preocupado", COR["traco"], G)
    elif humor == "surpreso":
        add("sobr_surpreso", COR["traco"], G)

    # braços: aponta com o do lado do alvo; o outro acena ou descansa
    lado_aponta = None
    if aponta is not None:
        lado_aponta = 1 if math.cos(math.radians(aponta)) >= 0 else -1
    for lado in (-1, 1):
        if lado == lado_aponta:
            ang, apont = aponta, True
        elif lado_aponta is not None:
            ang, apont = (-55 if lado == 1 else 235), False
        else:
            onda = math.sin(t * 2 * math.pi * 1.3 + lado)
            ang = 40 + 28 * onda if lado == 1 else 215 + 8 * onda
            apont = False
        braco, mao = _braco(lado, ang, t, apont)
        add(braco, COR["braco"], G)
        add(mao, COR["mao"], G)

    # pezinhos balançando
    for nome in ("pernas", "sapatos"):
        P = _rot([1, 0, 0], 8 * math.sin(t * 2 * math.pi / 1.1), (0, 0, -0.7))
        add(nome, COR["sapato"] if nome == "sapatos" else COR["braco"], G @ P)

    # câmera fixa de frente, um pouco de cima
    L = int(380 * escala)
    ss = 3
    alvo = np.array([0, 0, 0.1]) * U
    olho = r.orbita(alvo, 0, 8, 6.6 * U)
    img, cob = r.renderizar(itens, olho, alvo, W=L, H=L, ss=ss, cobertura=True)
    fundo = r.fundo(L * ss, L * ss).reshape(L, ss, L, ss, 3).mean(axis=(1, 3))
    c = np.clip(cob, 1e-3, 1)[..., None]
    rgb = np.clip((img - (1 - c) * fundo) / c, 0, 1)
    rgba = np.dstack([r.para_u8(rgb), (cob * 255).astype(np.uint8)])
    fig = Image.fromarray(rgba, "RGBA")
    # sombra suave deslocada
    sombra = Image.new("RGBA", fig.size, (0, 0, 0, 0))
    sombra.putalpha(fig.getchannel("A").point(lambda a: int(a * 0.3)).filter(ImageFilter.GaussianBlur(9)))
    base = Image.new("RGBA", fig.size, (0, 0, 0, 0))
    base.paste(sombra, (5, 12), sombra)
    return Image.alpha_composite(base, fig)
