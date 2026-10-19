"""
iasis_cad — modelagem 3D por malha para as peças do dispensador IASIS.

Tudo em MILÍMETROS, no referencial de montagem do dispensador:
    X = largura  (0 → 200, da esquerda para a direita de quem olha a frente)
    Y = profundidade (0 = face da frente, 200 = face de trás; a bandeja vai para Y < 0)
    Z = altura   (0 = mesa, 280 = topo do corpo, 300 = topo da tampa)

As peças originais (pasta hardware/cad/originais) vieram do CAD em CENTÍMETROS e
de cabeça para baixo; `carregar_original` desfaz isso. Booleanas usam o motor
manifold3d, que é robusto com malhas de STL.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import trimesh
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

# ─── Referencial ─────────────────────────────────────────────────────────────
# Cada original foi exportado com o topo em z pequeno (o teto fica em z 0..2) e
# a frente para +y. A rotação de 180° em X (x, y, z) → (x, −y, −z) é própria
# (não espelha a peça) e põe Z para cima e a frente para −Y.
ORIGINAIS = {
    # nome: (arquivo, deslocamento em y do original na montagem, em cm)
    "tras":   ("peca1_parte_de_tras.stl", 0.0),
    "frente": ("peca2_parte_da_frente.stl", 10.0),
    "tampa":  ("peca_do_teto.stl", 0.0),
}


def carregar_original(pasta: str | Path, nome: str) -> trimesh.Trimesh:
    """Lê um STL original (cm, invertido) e devolve em mm no referencial de montagem."""
    arquivo, dy = ORIGINAIS[nome]
    m = trimesh.load(Path(pasta) / arquivo, force="mesh")
    m.apply_translation([0, dy, 0])
    # (x, y, z)cm → (10x, 10(20 − y), 10(30 − z))mm
    T = np.array([[10, 0, 0, 0],
                  [0, -10, 0, 200],
                  [0, 0, -10, 300],
                  [0, 0, 0, 1]], dtype=float)
    m.apply_transform(T)
    assert m.volume > 0, "transformação inverteu a malha"
    return m


# ─── Primitivas ──────────────────────────────────────────────────────────────
def caixa(x0, x1, y0, y1, z0, z1) -> trimesh.Trimesh:
    b = trimesh.creation.box(extents=[x1 - x0, y1 - y0, z1 - z0])
    b.apply_translation([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])
    return b


def cilindro(raio, p0, p1, secoes=64) -> trimesh.Trimesh:
    """Cilindro entre os pontos p0 e p1."""
    return trimesh.creation.cylinder(radius=raio, segment=[p0, p1], sections=secoes)


def extrudar(poligono, z0, z1) -> trimesh.Trimesh:
    """Extruda um polígono (shapely, no plano XY) de z0 até z1."""
    partes = list(poligono.geoms) if isinstance(poligono, MultiPolygon) else [poligono]
    malhas = []
    for p in partes:
        if p.is_empty or p.area < 1e-6:
            continue
        m = trimesh.creation.extrude_polygon(p, height=z1 - z0)
        m.apply_translation([0, 0, z0])
        malhas.append(m)
    return unir(malhas)


def extrudar_no_plano(poligono, plano: str, a0, a1) -> trimesh.Trimesh:
    """Extruda um polígono desenhado em outro plano.

    plano="XZ": o polígono usa (x, z) e a extrusão vai em Y de a0 até a1.
    plano="YZ": o polígono usa (y, z) e a extrusão vai em X de a0 até a1.
    """
    m = extrudar(poligono, a0, a1)  # desenho em (u, v), extrusão em w
    if plano == "XZ":   # (u, v, w) → (u, w, v)
        T = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], float)
    elif plano == "YZ":  # (u, v, w) → (w, u, v)
        T = np.array([[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]], float)
    else:
        raise ValueError(plano)
    m.apply_transform(T)
    if m.volume < 0:  # as duas trocas de eixo espelham: corrige o sentido das faces
        m.invert()
    return m


# ─── Booleanas ───────────────────────────────────────────────────────────────
def _validas(malhas):
    return [m for m in malhas if m is not None and len(m.faces)]


def unir(malhas) -> trimesh.Trimesh:
    malhas = _validas(malhas)
    if not malhas:
        return trimesh.Trimesh()
    if len(malhas) == 1:
        return malhas[0]
    return trimesh.boolean.union(malhas, engine="manifold")


def subtrair(base, cortes) -> trimesh.Trimesh:
    cortes = _validas(cortes if isinstance(cortes, (list, tuple)) else [cortes])
    if not cortes:
        return base
    return trimesh.boolean.difference([base, *cortes], engine="manifold")


def intersectar(a, b) -> trimesh.Trimesh:
    return trimesh.boolean.intersection([a, b], engine="manifold")


# ─── Cortes 2D ───────────────────────────────────────────────────────────────
def secao(malha, eixo: str, valor: float):
    """Seção plana da malha como (Multi)Polygon shapely nas outras duas coordenadas.

    eixo="z" → polígono em (x, y); eixo="y" → (x, z); eixo="x" → (y, z).
    Um plano que coincide com uma face (ex.: a face da junta) dá seção vazia;
    nesse caso o corte é refeito 0,02 mm para cada lado.
    """
    r = _secao(malha, eixo, valor)
    for d in (-0.02, 0.02):
        if not r.is_empty:
            break
        r = _secao(malha, eixo, valor + d)
    return r


def _secao(malha, eixo, valor):
    i = "xyz".index(eixo)
    n = np.zeros(3); n[i] = 1
    o = np.zeros(3); o[i] = valor
    s = malha.section(plane_origin=o, plane_normal=n)
    if s is None:
        return Polygon()
    outros = [k for k in range(3) if k != i]
    aneis = []
    for e in s.entities:
        pts = s.vertices[e.points][:, outros]
        if len(pts) >= 3:
            aneis.append(Polygon(pts).buffer(0))
    # preenchimento par-ímpar: anel dentro de anel vira furo
    regiao = Polygon()
    for a in sorted(aneis, key=lambda p: -p.area):
        regiao = regiao.symmetric_difference(a)
    return regiao.buffer(0)


# ─── Arredondamento ──────────────────────────────────────────────────────────
def arredondar_canto_vertical(malha, canto_xy, sentido_xy, raio, z0, z1,
                              parede=None, parede_z=None) -> trimesh.Trimesh:
    """Arredonda uma aresta vertical (paralela a Z) de uma peça.

    canto_xy:   (x, y) do canto vivo.
    sentido_xy: (sx, sy) com ±1 apontando do canto para DENTRO da peça.
    raio:       raio do arredondamento.
    z0, z1:     faixa de altura onde cortar.
    parede:     espessura da casca. Se a peça for oca, passe a espessura para
                refazer a parede curva (senão o corte abre um buraco no canto).
    parede_z:   (z0, z1) da parede refeita; padrão = faixa do corte.
    """
    cx, cy = canto_xy
    sx, sy = sentido_xy
    centro = (cx + sx * raio, cy + sy * raio)
    quadrado = box(min(cx, cx + sx * raio), min(cy, cy + sy * raio),
                   max(cx, cx + sx * raio), max(cy, cy + sy * raio))
    disco = Point(centro).buffer(raio, resolution=48)
    # o corte passa um pouco para fora para não deixar película
    folga = box(min(cx - sx, cx + sx * raio), min(cy - sy, cy + sy * raio),
                max(cx - sx, cx + sx * raio), max(cy - sy, cy + sy * raio))
    corte = folga.difference(disco)
    resultado = subtrair(malha, extrudar(corte, z0 - 0.01, z1 + 0.01))
    if parede:
        anel = disco.difference(Point(centro).buffer(raio - parede, resolution=48))
        faixa = anel.intersection(quadrado)
        pz0, pz1 = parede_z or (z0, z1)
        resultado = unir([resultado, extrudar(faixa, pz0, pz1)])
    return resultado


def arredondar_aresta(malha, plano: str, canto_uv, sentido_uv, raio, a0, a1) -> trimesh.Trimesh:
    """Arredonda uma aresta maciça paralela a X (plano "YZ") ou a Y (plano "XZ")."""
    cu, cv = canto_uv
    su, sv = sentido_uv
    centro = (cu + su * raio, cv + sv * raio)
    folga = box(min(cu - su, cu + su * raio), min(cv - sv, cv + sv * raio),
                max(cu - su, cu + su * raio), max(cv - sv, cv + sv * raio))
    corte = folga.difference(Point(centro).buffer(raio, resolution=48))
    return subtrair(malha, extrudar_no_plano(corte, plano, a0 - 0.01, a1 + 0.01))


# ─── Encaixes ────────────────────────────────────────────────────────────────
def faixa_interna(regiao, recuo, largura):
    """Faixa de `largura` a `recuo` mm para dentro da borda de uma região 2D.

    Em parede fina (até recuo*2 + largura), vira uma tira no meio da parede.
    """
    return regiao.buffer(-recuo, join_style=2).difference(
        regiao.buffer(-(recuo + largura), join_style=2)).buffer(0)


def macho_femea(regiao_junta, recuo, largura, comprimento, folga):
    """Perfis 2D (macho, fêmea) de um encaixe macho-fêmea numa face de junta.

    A fêmea é a faixa do macho alargada pela folga dos dois lados.
    """
    macho = faixa_interna(regiao_junta, recuo, largura)
    femea = faixa_interna(regiao_junta, recuo - folga, largura + 2 * folga)
    return macho, femea


def boca(corpo, z0, z1, contorno, niveis=12):
    """Abertura livre de uma peça oca entre as alturas z0 e z1.

    É a interseção das aberturas medidas em vários níveis: uma aba que entra
    por ela não encosta em parede nenhuma, mesmo onde a parede é curva.
    `contorno` é um retângulo shapely maior que a peça (na vista de cima).
    """
    livre = None
    for z in np.linspace(z0, z1, niveis):
        a = contorno.difference(secao(corpo, "z", float(z)))
        livre = a if livre is None else livre.intersection(a)
    partes = [g for g in getattr(livre, "geoms", [livre]) if g.geom_type == "Polygon"]
    # a boca é a maior região que não encosta na borda do contorno
    cx0, cy0, cx1, cy1 = contorno.bounds
    internas = [g for g in partes if g.bounds[0] > cx0 + 1e-6 and g.bounds[1] > cy0 + 1e-6
                and g.bounds[2] < cx1 - 1e-6 and g.bounds[3] < cy1 - 1e-6]
    return max(internas or partes, key=lambda g: g.area)


# ─── Logo e texto ────────────────────────────────────────────────────────────
# Mesmos desenhos de src/components/Logo.tsx (viewBox 0 0 120 116, y para baixo).
LOGO_CORACAO = ("M60 102C26 76 12 57 12 39 12 25 23 15 35 15 45 15 54 21 60 31 "
                "66 21 75 15 85 15 97 15 108 25 108 39 108 57 94 76 60 102Z")
LOGO_ECG = "M27 60H49l5-11 7 24 8-31 6 18h13"
LOGO_ECG_TRACO = 4.5


def _caminho_svg(d: str, passos=24):
    from svgelements import Path as SvgPath, Move, Close
    caminho = SvgPath(d)
    pontos = []
    for seg in caminho:
        if isinstance(seg, Move):
            pontos.append((seg.end.x, seg.end.y))
            continue
        if isinstance(seg, Close):
            continue
        for t in np.linspace(0, 1, passos)[1:]:
            p = seg.point(t)
            pontos.append((p.x, p.y))
    return pontos


def logo_2d(largura_mm: float):
    """(coração, traço do ECG) como polígonos shapely em mm, centrados em (0, 0), y para cima."""
    s = largura_mm / 96.0  # o coração ocupa x 12..108 no viewBox
    coracao = Polygon(_caminho_svg(LOGO_CORACAO)).buffer(0)
    ecg = LineString(_caminho_svg(LOGO_ECG, passos=2)).buffer(
        LOGO_ECG_TRACO / 2, cap_style=1, join_style=1)
    def ajustar(g):
        g = affinity.translate(g, -60, -58.5)    # centro do coração
        return affinity.scale(g, s, -s, origin=(0, 0))  # y do SVG aponta para baixo
    return ajustar(coracao), ajustar(ecg)


def texto_2d(texto: str, altura_mm: float, negrito=True):
    """Texto como polígono shapely em mm, centrado em (0, 0)."""
    from matplotlib.font_manager import FontProperties
    from matplotlib.textpath import TextPath
    fonte = FontProperties(family="DejaVu Sans", weight="bold" if negrito else "normal")
    caminho = TextPath((0, 0), texto, size=altura_mm, prop=fonte)
    regiao = Polygon()
    for anel in caminho.to_polygons():
        if len(anel) >= 3:
            regiao = regiao.symmetric_difference(Polygon(anel).buffer(0))
    regiao = regiao.buffer(0)
    x0, y0, x1, y1 = regiao.bounds
    return affinity.translate(regiao, -(x0 + x1) / 2, -(y0 + y1) / 2)


def relevo_na_face_frontal(poligono_xz, y_face, altura, centro_xz) -> trimesh.Trimesh:
    """Relevo saindo da face da frente (que olha para −Y): ocupa y_face−altura até y_face+0,5.

    O 0,5 mm extra entra na parede para a união ficar sólida.
    """
    p = affinity.translate(poligono_xz, *centro_xz)
    return extrudar_no_plano(p, "XZ", y_face - altura, y_face + 0.5)


# ─── Verificação ─────────────────────────────────────────────────────────────
def relatorio(nome, m: trimesh.Trimesh) -> str:
    lo, hi = m.bounds
    return (f"{nome}: estanque={m.is_watertight} volume={m.volume / 1000:.0f} cm³ "
            f"corpos={m.body_count} faces={len(m.faces)} "
            f"caixa=({lo[0]:.1f},{lo[1]:.1f},{lo[2]:.1f})→({hi[0]:.1f},{hi[1]:.1f},{hi[2]:.1f}) mm")


def interferencia(a, b) -> float:
    """Volume (mm³) em que duas peças se sobrepõem. Numa montagem certa, ~0."""
    i = intersectar(a, b)
    return float(i.volume) if len(i.faces) else 0.0


def espessura_ao_longo(malha, origem, direcao) -> float | None:
    """Distância que um raio percorre dentro da peça a partir de `origem` (na superfície)."""
    d = np.asarray(direcao, float); d /= np.linalg.norm(d)
    o = np.asarray(origem, float) - d * 0.01
    pts, _, _ = malha.ray.intersects_location([o], [d])
    if len(pts) < 2:
        return None
    dist = np.sort(np.linalg.norm(pts - o, axis=1))
    return float(dist[1] - dist[0])


def salvar_stl(m: trimesh.Trimesh, caminho):
    Path(caminho).parent.mkdir(parents=True, exist_ok=True)
    m.export(caminho)
