"""
IASIS — trecho "Na prática" do vídeo em loop (72 s), com o app de verdade.

    python hardware/video/gerar_pratica.py

O celular flutua ao lado do dispensador mostrando as gravações do app
(midia_app/, sincronizadas pelo roteiro_loop_app.txt), uma mão com a pulseira
encosta no coração da logo, a frente abre, o disco gira, a trava abre e a dose
cai na bandeja. As mensagens MQTT reais (as mesmas do log do app) voam entre
dispensador, nuvem, celular e banco de dados.

O trecho começa e termina exatamente no quadro 0 do loop 3D (gerar_loop.py),
então loop + prática emendam sem pulo. Saídas em hardware/video/saida_loop/:
  IASIS_pratica.mp4        só o trecho (72 s)
  IASIS_loop_completo.mp4  loop 3D + prática (144 s), para repetir no monitor
"""
from __future__ import annotations

import math
import pickle
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(RAIZ / ".claude/skills/iasis-cad/scripts"))
import render3d as r                      # noqa: E402
import estilo as e                        # noqa: E402
import mascote3d as m3                    # noqa: E402
import qr_voto                            # noqa: E402
import gerar_loop as gl                   # noqa: E402
from gerar_video import pecas, mover, girar_z, lerp   # noqa: E402
from gerar_video_v2 import CORES, suave, volta, _quadro3d   # noqa: E402

W, H, FPS = 1920, 1080, 30
DUR = 72.0
SAIDA = AQUI / "saida_loop"
QUADROS = AQUI / "midia_app" / "quadros"

# ─── Linha do tempo (s dentro do trecho) ────────────────────────────────────
# Telas do app no celular: (início, nome da gravação, duração)
TELAS = [(0.0, "loop_06_inicio", 8.1), (3.0, "loop_06_inicio", 8.1), (11.0, "loop_01_dispensador_fluxo", 16.0),
         (27.0, "loop_03_notificacao", 5.73), (33.0, "loop_04_cuidador", 8.37), (41.4, "loop_05_historico", 8.53),
         (50.0, "loop_02_log_mqtt", 16.1)]
FASES = [  # título no canto
    (3.0, 11.0, "Na prática", "O app mostra a próxima dose"),
    (11.0, 19.0, "Na prática", "Hora do remédio: o app avisa e a pulseira vibra"),
    (19.0, 21.0, "Na prática", "A pulseira encosta no leitor (RFID)"),
    (21.0, 27.0, "Na prática", "O app libera, o disco gira e a dose cai"),
    (27.0, 33.0, "Na prática", "Dose liberada: aviso no celular"),
    (33.0, 41.4, "Na prática", "O cuidador acompanha em tempo real"),
    (41.4, 50.0, "Na prática", "Histórico e adesão atualizados"),
    (50.0, 66.0, "Por dentro da conversa", "As mensagens MQTT entre app e dispensador"),
]
AMARELO, VERDE, AZUL_DB = (250, 199, 117), (93, 202, 165), (168, 204, 232)   # cores do log do app
# (início, fim, de, para, texto, cor) — cada viagem passa pela nuvem MQTT (2 trechos)
PACOTES = []


def _via_nuvem(t0, t1, de, para, texto, cor):
    meio = (t0 + t1) / 2
    PACOTES.append((t0, meio, de, "nuvem", texto, cor))
    PACOTES.append((meio, t1, "nuvem", para, texto, cor))


# ciclo 1 (tempos do roteiro: loop_01 começa em 11 s)
_via_nuvem(15.3, 16.7, "app", "disp", "CMD VIBRATE_ON", AMARELO)
_via_nuvem(19.4, 20.8, "disp", "app", "RFID_READ ✓ AUTORIZADA", VERDE)
_via_nuvem(21.1, 22.3, "app", "disp", "CMD DISPENSE slot:2", AMARELO)
_via_nuvem(21.8, 23.0, "app", "disp", "CMD VIBRATE_OFF", AMARELO)
_via_nuvem(23.2, 24.6, "disp", "app", "DISPENSE_ACK slot:2 OK", VERDE)
PACOTES.append((24.7, 25.5, "app", "db", "dose registrada", AZUL_DB))
PACOTES.append((33.2, 34.0, "db", "app", "cuidador avisado", AZUL_DB))
PACOTES.append((41.5, 42.3, "db", "app", "histórico", AZUL_DB))
# ciclo 2 (log MQTT: loop_02 começa em 50 s; chegadas batem com as linhas do log)
_via_nuvem(53.6, 55.0, "app", "disp", "CMD VIBRATE_ON", AMARELO)
_via_nuvem(58.8, 59.7, "disp", "app", "RFID_READ ✓ AUTORIZADA", VERDE)
_via_nuvem(60.6, 61.8, "app", "disp", "CMD DISPENSE slot:2", AMARELO)
_via_nuvem(61.2, 62.4, "app", "disp", "CMD VIBRATE_OFF", AMARELO)
_via_nuvem(61.8, 62.5, "disp", "app", "DISPENSE_ACK slot:2 OK", VERDE)

# mão com a pulseira: (chega, encosta, sai, some)
MAO = [(16.2, 19.0, 20.3, 21.8), (55.5, 58.7, 60.0, 61.5)]
VIBRA = [(16.7, 19.4), (55.0, 58.8)]          # pulseira vibrando / tela piscando
ABRE = (20.3, 21.2, 26.0, 27.0)                # frente: abre de-até, fecha de-até
GIRO = (22.4, 23.2)                            # disco 45°
TRAVA = (23.2, 23.6, 25.6, 26.0)
# comprimido: (sai do disco, chega na bandeja, some de, some até, só pela calha?)
DOSES = [(23.4, 25.2, 30.0, 30.6, False), (61.9, 62.7, 65.0, 65.6, True)]

# câmera
POSE_LOOP = (np.array([100.0, 90.0, 140.0]), -30.0, 20.0, 900.0)   # = gerar_loop no quadro 0
POSE = (np.array([270.0, 40.0, 140.0]), 32.0, 15.0, 960.0)
POSE_ABERTA = (np.array([245.0, 45.0, 125.0]), 36.0, 20.0, 800.0)

# layout 2D
CEL_C, CEL_H = (1545, 590), 840
NUVEM, BANCO = (1040, 130), (1290, 118)
MASC_OLHA = (360, 320)


# ─── Malhas extras: pedaço que sai da frente e a mão com pulseira ───────────
def malhas():
    cache = AQUI / ".cache_pratica.pkl"
    if cache.exists():
        return pickle.loads(cache.read_bytes())
    import iasis_cad as cad
    M = pecas()
    X = {}
    for n in ("frente", "coracao", "ecg", "nome"):
        X[n + "_resto"] = cad.recortar(M[n], 118, 260, -80, 101, -1, 290)
    # braço ao longo de -x (aponta para a esquerda), punho na origem
    pele = []
    ante = trimesh.creation.cylinder(radius=24, height=900, sections=40)
    ante.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    ante.apply_translation((450, 0, 0))
    pele.append(ante)
    cot = trimesh.creation.icosphere(subdivisions=3, radius=24)
    cot.apply_translation((900, 0, 0))
    pele.append(cot)
    palma = trimesh.creation.icosphere(subdivisions=3, radius=1)
    palma.apply_scale((44, 18, 26))
    palma.apply_translation((-46, 0, 0))
    pele.append(palma)
    for k, dz in enumerate((-15, -5, 5, 15)):           # dedos
        comp = (34, 40, 38, 30)[k]
        dedo = trimesh.creation.capsule(height=comp, radius=7.5, count=[12, 12])
        dedo.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
        dedo.apply_translation((-86 - comp / 2, 4, dz))
        pele.append(dedo)
    pol = trimesh.creation.capsule(height=26, radius=8, count=[12, 12])
    pol.apply_transform(trimesh.transformations.rotation_matrix(math.radians(70), [0, 0, 1]))
    pol.apply_translation((-52, -16, 24))
    pele.append(pol)
    X["braco"] = trimesh.util.concatenate(pele)
    pul = trimesh.creation.torus(major_radius=29, minor_radius=7, major_sections=64, minor_sections=20)
    pul.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    X["pulseira_mao"] = pul
    tag = trimesh.creation.cylinder(radius=11, height=5, sections=32)
    tag.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    tag.apply_translation((0, 34, 0))                   # pastilha da pulseira, virada para +y (para a caixa)
    X["tag"] = tag
    X = {k: trimesh.Trimesh(v.vertices, v.faces) for k, v in X.items()}
    cache.write_bytes(pickle.dumps(X))
    return X


# ─── Telas do app ───────────────────────────────────────────────────────────
@lru_cache(maxsize=64)
def _quadro_app(nome, i):
    pasta = QUADROS / nome
    n = len(list(pasta.glob("*.jpg")))
    i = min(max(i, 0), n - 1)
    return Image.open(pasta / f"{i + 1:05d}.jpg").convert("RGB")


def tela_app(s):
    atual = TELAS[0]
    for tl in TELAS:
        if s >= tl[0]:
            atual = tl
    t0, nome, dur = atual
    a = min(max(s - t0, 0.0), dur) if s >= 3.0 or t0 > 0 else 0.0
    return _quadro_app(nome, int(round(a * FPS)))


def _coefs(dst, src):
    A = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = np.array(src, float).reshape(8)
    return np.linalg.solve(np.array(A, float), b)


@lru_cache(maxsize=1)
def _moldura():
    """Corpo do celular (sem a tela) em 2×, e a máscara da área da tela."""
    S = 2
    h = CEL_H * S
    w = int(h * 0.49)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=int(w * 0.13), fill=(22, 22, 26, 255))
    d.rounded_rectangle([3 * S, 3 * S, w - 4 * S, h - 4 * S], radius=int(w * 0.125),
                        outline=(90, 90, 100, 255), width=2 * S)
    b = int(w * 0.035)
    tela = (b, b, w - b, h - b)
    masc = Image.new("L", (w, h), 0)
    ImageDraw.Draw(masc).rounded_rectangle(tela, radius=int(w * 0.1), fill=255)
    return img, masc, tela


def celular(s, ox, oy, inclina):
    """Celular com a tela do app no instante s, inclinado (efeito 3D). Devolve RGBA e canto."""
    corpo, masc, (x0, y0, x1, y1) = _moldura()
    tela = tela_app(s).resize((x1 - x0, y1 - y0), Image.BILINEAR)
    img = corpo.copy()
    camada = Image.new("RGBA", img.size, (0, 0, 0, 0))
    camada.paste(tela, (x0, y0))
    img.paste(camada, (0, 0), masc)
    # câmera frontal e brilho no vidro
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.ellipse([w / 2 - 9, y0 + 14, w / 2 + 9, y0 + 32], fill=(10, 10, 12, 255))
    brilho = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(brilho).polygon([(x0, y0), (x0 + w * 0.42, y0), (x0, y0 + h * 0.36)],
                                   fill=(255, 255, 255, 18))
    img.alpha_composite(brilho)
    img = img.resize((w // 2, h // 2), Image.LANCZOS)
    w, h = img.size
    # perspectiva: gira um pouco em torno do eixo vertical
    k = inclina
    dst = [(0, h * k * 0.5), (w, 0), (w, h), (0, h * (1 - k * 0.5))]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    img = img.transform((w, h), Image.PERSPECTIVE, _coefs(dst, src), Image.BICUBIC)
    sombra = Image.new("RGBA", (w + 80, h + 80), (0, 0, 0, 0))
    sombra.paste((0, 0, 0, 120), (40, 52, 40 + w, 52 + h), img.getchannel("A"))
    sombra = sombra.filter(ImageFilter.GaussianBlur(18))
    sombra.alpha_composite(img, (40, 40))
    cx, cy = CEL_C
    return sombra, (int(cx + ox - sombra.width / 2), int(cy + oy - sombra.height / 2))


# ─── Ícones e pacotes ───────────────────────────────────────────────────────
def icone_nuvem(camada, alfa):
    if alfa <= 0.01:
        return
    d = ImageDraw.Draw(camada)
    a = int(255 * alfa)
    x, y = NUVEM
    for dx, dy, rr in ((-38, 8, 30), (0, -10, 40), (38, 6, 32), (0, 14, 30)):
        d.ellipse([x + dx - rr, y + dy - rr, x + dx + rr, y + dy + rr], fill=e.CREME + (a,))
    d.rounded_rectangle([x - 68, y + 4, x + 68, y + 44], radius=18, fill=e.CREME + (a,))
    f = r.fonte(20)
    t = "MQTT"
    d.text((x - d.textlength(t, font=f) / 2, y - 2), t, font=f, fill=e.AZUL + (a,))
    f2 = r.fonte(18, False)
    t = "nuvem HiveMQ"
    d.text((x - d.textlength(t, font=f2) / 2, y + 56), t, font=f2, fill=e.BEGE + (a,))


def icone_banco(camada, alfa):
    if alfa <= 0.01:
        return
    d = ImageDraw.Draw(camada)
    a = int(255 * alfa)
    x, y = BANCO
    for k in (2, 1, 0):
        yy = y + k * 16
        d.rectangle([x - 34, yy - 2, x + 34, yy + 16], fill=e.AZUL_CLARO + (a,))
        d.ellipse([x - 34, yy + 8, x + 34, yy + 24], fill=e.AZUL_CLARO + (a,))
        d.ellipse([x - 34, yy - 10, x + 34, yy + 6], fill=(140, 180, 220, a))
    f2 = r.fonte(18, False)
    t = "banco Supabase"
    d.text((x - d.textlength(t, font=f2) / 2, y + 66), t, font=f2, fill=e.BEGE + (a,))


@lru_cache(maxsize=32)
def _sprite_pacote(texto, cor):
    f = r.fonte(22)
    tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    tw = int(tmp.textlength(texto, font=f))
    w, h = tw + 36, 40
    img = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle([20, 20, 20 + w, 20 + h], radius=20, fill=cor + (150,))
    glow = glow.filter(ImageFilter.GaussianBlur(9))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([20, 20, 20 + w, 20 + h], radius=20, fill=(28, 22, 18, 235), outline=cor + (255,), width=3)
    d.text((38, 27), texto, font=f, fill=cor + (255,))
    return img


def desenha_pacotes(camada, s, pontos):
    d = ImageDraw.Draw(camada)
    for t0, t1, de, para, texto, cor in PACOTES:
        if not (t0 - 0.05 <= s <= t1 + 0.25):
            continue
        p0, p1 = np.array(pontos[de], float), np.array(pontos[para], float)
        ctrl = (p0 + p1) / 2 + np.array([0, -90])
        def bez(u):
            return (1 - u) ** 2 * p0 + 2 * (1 - u) * u * ctrl + u ** 2 * p1
        u = suave((s - t0) / max(t1 - t0, 1e-3))
        for k in range(1, 10):                       # rastro
            uk = max(u - k * 0.035, 0)
            q = bez(uk)
            rr = 7 - k * 0.6
            d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=cor + (int(150 * (1 - k / 10)),))
        if s <= t1:
            sp = _sprite_pacote(texto, cor)
            q = bez(u)
            camada.alpha_composite(sp, (int(q[0] - sp.width / 2), int(q[1] - sp.height / 2)))


# ─── Quadro ─────────────────────────────────────────────────────────────────
def _pose(s):
    """Câmera: sai da pose do loop, fica na pose da prática e volta."""
    ida = suave((s - 0.3) / 2.6)
    volta_ = suave((s - 67.0) / 4.5)
    aberta = suave((s - ABRE[0]) / 1.4) - suave((s - (ABRE[2] - 0.2)) / 1.4)
    a = tuple(lerp(np.atleast_1d(x), np.atleast_1d(y), aberta) for x, y in zip(POSE, POSE_ABERTA))
    a = (a[0], float(a[1][0]), float(a[2][0]), float(a[3][0]))
    k = ida * (1 - volta_)
    alvo = lerp(POSE_LOOP[0], a[0], k)
    az, el, dist = (POSE_LOOP[i] + (a[i] - POSE_LOOP[i]) * k for i in (1, 2, 3))
    return r.orbita(alvo, az, el, dist), alvo


def quadro(s, ctx):
    M, X = ctx["M"], ctx["X"]
    if "itens" not in ctx:
        ctx["itens"] = gl.cena(gl.TUDO, M)
        nomes = ["frente_corte", "coracao_corte", "ecg_corte", "nome_corte"]
        base = {n: ctx["itens"][n.replace("_corte", "")] for n in nomes}
        extra = {}
        for n in nomes:
            b = n.replace("_corte", "")
            c1, c2 = CORES[b] if b in CORES else ("#cccccc", None)
            extra[n] = r.item(M[n], c1, base[n].pid, c2)
            extra[b + "_resto"] = r.item(X[b + "_resto"], c1, base[n].pid, c2)
        extra["braco"] = r.item(X["braco"], "#c98f6e", 900, "#e8b896")
        extra["pulseira_mao"] = r.item(X["pulseira_mao"], "#3a7bd0", 901, "#8fc0ee")
        extra["tag"] = r.item(X["tag"], "#f6efe6", 902)
        extra["comprimido"] = r.item(M["comprimido"], "#e8504e", 903)
        ctx["extra"] = extra
    it, ex = ctx["itens"], ctx["extra"]
    for x in list(it.values()) + list(ex.values()):
        x.T, x.cor_quadro, x.visivel = None, None, True

    # frente aberta: troca a frente inteira pela cortada + o pedaço que desliza
    abre = suave((s - ABRE[0]) / (ABRE[1] - ABRE[0])) - suave((s - ABRE[2]) / (ABRE[3] - ABRE[2]))
    aberta = ABRE[0] <= s <= ABRE[3]
    for b in ("frente", "coracao", "ecg", "nome"):
        it[b].visivel = not aberta
        ex[b + "_corte"].visivel = aberta
        ex[b + "_resto"].visivel = aberta
        ex[b + "_resto"].T = mover(620 * abre, 60 * abre, 0)
    # disco, trava, tela
    giro = 45 * suave((s - GIRO[0]) / (GIRO[1] - GIRO[0])) if s < 30 else 0.0
    it["disco"].T = girar_z(giro, 100, 95)
    ang = 90 * (suave((s - TRAVA[0]) / (TRAVA[1] - TRAVA[0])) - suave((s - TRAVA[2]) / (TRAVA[3] - TRAVA[2])))
    it["paleta"].T = girar_z(ang, 124.7, 50)
    vib = next(((a, b) for a, b in VIBRA if a <= s <= b), None)
    if vib and int(s * 4) % 2 == 0:
        it["lcd"].cor_quadro = r.hexrgb("#9dffc6")
    # comprimido
    ex["comprimido"].visivel = False
    for t0, t1, s0, s1, so_calha in DOSES:
        if t0 <= s <= s1:
            ex["comprimido"].visivel = True
            if so_calha:
                caminho = [(t0, (100, 8, 11)), (t1, (100, -24, 9.5))]
            else:
                a0 = math.radians(-135 + 45)
                pd = (100 + 45 * math.cos(a0), 95 + 45 * math.sin(a0), 128.0)
                caminho = [(t0, pd), (t0 + 0.5, (100, 50, 47)), (t0 + 1.3, (100, 8, 11)), (t1, (100, -24, 9.5))]
            pos = caminho[-1][1]
            for (ta, pa), (tb, pb) in zip(caminho, caminho[1:]):
                if ta <= s <= tb:
                    u = (s - ta) / (tb - ta)
                    pos = lerp(pa, pb, u * u if ta == caminho[0][0] and not so_calha else suave(u))
                    break
            esc = 1 - suave((s - s0) / (s1 - s0))
            ex["comprimido"].T = mover(*pos) @ np.diag([esc, esc, esc, 1])
    # mão com a pulseira
    ex["braco"].visivel = ex["pulseira_mao"].visivel = ex["tag"].visivel = False
    punho_px = None
    for chega, encosta, sai, some in MAO:
        if chega <= s <= some:
            u = volta((s - chega) / (encosta - chega)) if s < sai else 1 - suave((s - sai) / (some - sai))
            alvo_p = np.array([102.0, -40.0, 170.0])
            longe = alvo_p + np.array([260.0, -230.0, -40.0])
            p = lerp(longe, alvo_p, u)
            if vib:                                   # pulseira vibrando
                p = p + np.array([0, 1.8 * math.sin(s * 2 * math.pi * 7.5), 0])
            Tm = mover(*p) @ trimesh.transformations.rotation_matrix(math.radians(-12 * (1 - u)), [0, 0, 1])
            for n in ("braco", "pulseira_mao", "tag"):
                ex[n].visivel, ex[n].T = True, Tm
            punho_px = p
    olho, alvo = _pose(s)
    img = _quadro3d(list(it.values()) + list(ex.values()), olho, alvo, sombra=True)

    camada = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    entra = volta((s - 0.6) / 2.0) if s < 66 else 1 - suave((s - 66.0) / 2.2)
    ent_ic = r.janela(s, 2.0, 66.5, 0.8)
    icone_nuvem(camada, ent_ic)
    icone_banco(camada, ent_ic)
    # pontos de ligação (dispensador = topo da caixa, projetado)
    topo = r.projetar((100, 100, 295), olho, alvo) or (700, 300)
    ox = (1 - entra) * 760
    oy = 10 * math.sin(2 * math.pi * s / 3.6)
    cel_pt = (CEL_C[0] + ox - 120, CEL_C[1] - CEL_H / 2 + 40 + oy)
    pontos = {"disp": topo, "nuvem": (NUVEM[0], NUVEM[1] + 20), "app": cel_pt,
              "db": (BANCO[0], BANCO[1] + 30)}
    if ent_ic > 0.05:                                   # ligações tracejadas
        d = ImageDraw.Draw(camada)
        al = int(70 * ent_ic)
        for a_, b_ in (("disp", "nuvem"), ("nuvem", "app"), ("app", "db")):
            p0, p1 = np.array(pontos[a_]), np.array(pontos[b_])
            n = int(np.linalg.norm(p1 - p0) / 18)
            for k in range(0, n, 2):
                q0 = p0 + (p1 - p0) * k / n
                q1 = p0 + (p1 - p0) * (k + 1) / n
                d.line([tuple(q0), tuple(q1)], fill=e.BEGE + (al,), width=3)
    if entra > 0.01:
        cel, pos = celular(s, ox, oy, 0.06 + 0.02 * math.sin(2 * math.pi * s / 7.2))
        camada.alpha_composite(cel, pos)
    desenha_pacotes(camada, s, pontos)

    # título
    fase = next((f for f in FASES if f[0] <= s < f[1]), None)
    al_loop = 1 - suave((s - 0.5) / 1.5) + suave((s - 66.5) / 1.5)
    if fase is None or al_loop > 0.99:
        e.titulo_cena(camada, "Dispensador IASIS", "Projeto completo · impresso em 3D", min(al_loop, 1))
    else:
        e.titulo_cena(camada, fase[2], fase[3], r.janela(s, fase[0], fase[1], 0.35) * (1 - min(al_loop, 1)))
        if al_loop > 0.01:
            e.titulo_cena(camada, "Dispensador IASIS", "Projeto completo · impresso em 3D", min(al_loop, 1))

    # QR (igual ao loop) e mascote: sai do ponto do loop, assiste e volta
    qr = qr_voto.cartao()
    camada.alpha_composite(qr, (8, H - qr.height + 4))
    th = math.pi / 4
    p_loop = np.array([W / 2 + 0.39 * W * math.cos(th), H * 0.5 + 0.31 * H * math.sin(th)])
    k = suave((s - 0.2) / 2.6) * (1 - suave((s - 68.5) / 3.2))
    mx, my = lerp(p_loop, MASC_OLHA, k)
    my += 12 * math.sin(2 * math.pi * (72 + s) / 1.6)
    ativo = [p for p in PACOTES if p[0] <= s <= p[1]]
    if ativo:
        t0, t1, de, para = ativo[0][:4]
        u = suave((s - t0) / (t1 - t0))
        ponto = lerp(pontos[de], pontos[para], u)
    elif punho_px is not None:
        ponto = r.projetar(punho_px, olho, alvo)
    elif entra > 0.5:
        ponto = (CEL_C[0] + ox, CEL_C[1])
    else:
        ponto = topo
    olha = math.degrees(math.atan2(-(ponto[1] - my), ponto[0] - mx)) if ponto is not None else None
    humor = "surpreso" if (23.2 <= s <= 24.4 or 61.8 <= s <= 62.8) else "feliz"
    m = m3.mascote(72 + s, False, None, humor, escala=0.7, olha=olha)
    camada.alpha_composite(m, (int(mx - m.width / 2), int(my - m.height / 2)))
    e.marca(camada)
    base = Image.fromarray(r.para_u8(img)).convert("RGBA")
    return np.asarray(Image.alpha_composite(base, camada).convert("RGB"))


PEDACO = 12


def gravar(job):
    k, a, b = job
    partes = SAIDA / "partes_pratica"
    partes.mkdir(parents=True, exist_ok=True)
    destino = partes / f"{k:02d}.mp4"
    if destino.exists():
        return job
    temp = destino.with_suffix(".tmp.mp4")
    ctx = {"M": pecas(), "X": malhas()}
    g = r.Gravador(temp)
    for i in range(int(round(a * FPS)), int(round(b * FPS))):
        g.quadro(quadro(i / FPS, ctx))
    g.fechar()
    temp.rename(destino)
    return job


def montar():
    arqs = sorted(f for f in (SAIDA / "partes_pratica").glob("*.mp4") if ".tmp" not in f.name)
    lista = SAIDA / "lista_pratica.txt"
    lista.write_text("".join(f"file '{f.resolve()}'\n" for f in arqs))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(SAIDA / "IASIS_pratica.mp4")], check=True)
    lista.write_text(f"file '{(SAIDA / 'IASIS_loop_3D.mp4').resolve()}'\n"
                     f"file '{(SAIDA / 'IASIS_pratica.mp4').resolve()}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(SAIDA / "IASIS_loop_completo.mp4")], check=True)
    lista.unlink()


if __name__ == "__main__":
    pecas()
    malhas()
    js = [(k, k * PEDACO, min(DUR, (k + 1) * PEDACO)) for k in range(int(math.ceil(DUR / PEDACO)))]
    with Pool(4) as pool:
        for feito in pool.imap_unordered(gravar, js):
            print("pronto:", feito, flush=True)
    montar()
    print("vídeo:", SAIDA / "IASIS_loop_completo.mp4", flush=True)
