"""
IASIS — clipes 3D para o vídeo do stand (1920×1080, 30 fps).

    python hardware/video/gerar_video.py [clipe ...]

Usa as peças de hardware/cad/dispenser.py. Cada clipe sai em duas versões:
  saida/com_legenda/NN_nome.mp4   (pronto para o monitor)
  saida/sem_legenda/NN_nome.mp4   (para editar no Motion ou outro editor)
e, no fim, saida/IASIS_video_stand.mp4 com todos em sequência.
"""
from __future__ import annotations

import math
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import trimesh

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(RAIZ / "hardware/cad"))
sys.path.insert(0, str(RAIZ / ".claude/skills/iasis-cad/scripts"))
import render3d as r  # noqa: E402

FPS = 30
SAIDA = AQUI / "saida"

CORES = dict(
    tras="#d9e2ee", frente="#eef3f9", tampa="#c4d9f0",
    prateleira="#afd0ee", disco="#5b93cf", paleta="#ff6b6b", suporte_servo="#9aa5b1",
    calha="#7fd1ae", painel="#4a5d78", motor="#2b2f36", servo="#3b6fb6",
    lcd="#1f3b2f", rc522="#2e6fd0", coracao="#5b93cf", ecg="#101d33", nome="#2b4a75",
    comprimido="#ff5a5f", pulseira="#5b93cf",
)
FOCO = "#ffb547"   # cor de destaque da peça em foco


# ═══════════════════════════════════════════════════════════════════════════
#  Peças
# ═══════════════════════════════════════════════════════════════════════════
def pecas():
    """Malhas do dispensador (gera com dispenser.py e guarda em cache)."""
    import pickle
    cache = AQUI / ".cache_pecas.pkl"
    if cache.exists():
        return pickle.loads(cache.read_bytes())
    import dispenser
    import iasis_cad as cad
    P = dispenser.PARAMETROS
    p, fant, _ = dispenser.construir()
    m = {k: p[k] for k in ("tras", "frente", "tampa", "prateleira", "disco", "paleta",
                           "suporte_servo", "calha", "painel_esq", "painel_dir")}
    m.update({k: fant[k] for k in ("motor", "servo", "lcd", "rc522")})
    # logo pintada: as mesmas formas do relevo, um fio à frente da face
    coracao, ecg = cad.logo_2d(P["logo_largura"])
    centro = (100, P["logo_centro_z"])
    rel = cad.relevo_na_face_frontal(coracao, -0.05, P["logo_relevo"], centro)
    sul = cad.relevo_na_face_frontal(ecg, -(P["logo_relevo"] - P["ecg_profundidade"]) - 0.05,
                                     P["ecg_profundidade"] + 0.5, centro)
    m["coracao"] = cad.subtrair(rel, sul)
    m["ecg"] = cad.relevo_na_face_frontal(ecg, -(P["logo_relevo"] - P["ecg_profundidade"]) - 0.06, 0.02, centro)
    m["nome"] = cad.relevo_na_face_frontal(cad.texto_2d(P["texto"], P["texto_altura"]), -0.05,
                                           P["texto_relevo"], (100, P["texto_centro_z"]))
    # frente cortada (para ver o mecanismo por dentro)
    m["frente_corte"] = cad.recortar(p["frente"], -1, 118, -60, 101, -1, 290)
    m["coracao_corte"] = cad.recortar(m["coracao"], -1, 118, -60, 101, -1, 290)
    m["ecg_corte"] = cad.recortar(m["ecg"], -1, 118, -60, 101, -1, 290)
    m["nome_corte"] = cad.recortar(m["nome"], -1, 118, -60, 101, -1, 290)
    # comprimido (cápsula deitada) e pulseira
    cap = trimesh.creation.capsule(height=11, radius=3.6, count=[24, 24])
    cap.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    m["comprimido"] = cap
    pul = trimesh.creation.torus(major_radius=32, minor_radius=6, major_sections=64, minor_sections=24)
    pul.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    m["pulseira"] = pul
    m = {k: trimesh.Trimesh(v.vertices, v.faces) for k, v in m.items()}
    cache.write_bytes(pickle.dumps(m))
    return m


def cena(nomes, M):
    """Itens do renderizador para as peças pedidas, com a cor padrão."""
    itens = {}
    for i, n in enumerate(nomes):
        base = n.replace("_corte", "")
        cor = CORES.get(base, CORES.get(base.split("_")[0], "#cccccc"))
        itens[n] = r.item(M[n], cor, i)
    return itens


def destacar(itens, foco, peso):
    """Peça(s) em foco ganham a cor de destaque; o resto escurece. peso 0..1."""
    for n, it in itens.items():
        if n in foco:
            it.cor_quadro = (1 - peso) * it.cor + peso * r.hexrgb(FOCO)
        else:
            it.cor_quadro = (1 - 0.75 * peso) * it.cor + 0.75 * peso * r.APAGADO


def mover(dx, dy, dz):
    T = np.eye(4); T[:3, 3] = (dx, dy, dz)
    return T


def girar_z(graus, cx, cy):
    return trimesh.transformations.rotation_matrix(math.radians(graus), [0, 0, 1], [cx, cy, 0])


def lerp(a, b, t):
    return np.asarray(a, float) + (np.asarray(b, float) - np.asarray(a, float)) * t


# ═══════════════════════════════════════════════════════════════════════════
#  Clipes
# ═══════════════════════════════════════════════════════════════════════════
CASCA = ["tras", "frente", "tampa", "coracao", "ecg", "nome"]


def clipe_apresentacao(t, M, ctx):
    it = ctx.setdefault("itens", cena(CASCA, M))
    az = -30 + 360 * suave_lin(t / 15)
    olho = r.orbita((100, 75, 140), az, 16 + 6 * math.sin(t / 15 * 2 * math.pi), 840)
    img = r.renderizar(it.values(), olho, (100, 75, 138))
    leg = [("IASIS", "Dispensador inteligente de medicamentos", 1.0, 14.0)]
    return img, leg, None


def clipe_explodida(t, M, ctx):
    nomes = CASCA + ["prateleira", "disco", "paleta", "suporte_servo", "calha",
                     "painel_esq", "painel_dir", "motor", "servo", "lcd", "rc522"]
    it = ctx.setdefault("itens", cena(nomes, M))
    e = r.suave((t - 2) / 4) - r.suave((t - 10) / 4)
    desloc = dict(tampa=(0, 0, 170), frente=(0, -150, 0), coracao=(0, -150, 0), ecg=(0, -150, 0),
                  nome=(0, -150, 0), lcd=(0, -150, 0), rc522=(0, -150, 0), tras=(0, 110, 0),
                  prateleira=(0, 0, 40), motor=(0, 0, 25), servo=(0, 0, 25), suporte_servo=(0, 0, 25),
                  paleta=(0, 0, 40), disco=(0, 0, 95), calha=(0, -70, -10),
                  painel_esq=(-70, 0, 0), painel_dir=(70, 0, 0))
    for n, x in it.items():
        x.T = mover(*(np.array(desloc.get(n, (0, 0, 0))) * e))
    az = -38 + 25 * (t / 15)
    olho = r.orbita((100, 60, 150), az, 22, 1050)
    img = r.renderizar(it.values(), olho, (100, 60, 145))
    leg = [("Vista explodida", "11 peças impressas em 3D + motor, servo, leitor RFID e tela", 1.0, 14.0)]
    return img, leg, None


INTERIOR = ["tras", "prateleira", "disco", "paleta", "suporte_servo", "calha",
            "painel_esq", "painel_dir", "motor", "servo"]
POR_DENTRO_DA_FRENTE = ["frente", "lcd", "rc522", "prateleira", "disco", "painel_esq", "painel_dir"]

SEGMENTOS = [
    # (cena, foco, alvo, azimute, elevação, distância, título, subtítulo)
    ("interior", ["disco"], (100, 95, 132), -25, 42, 360,
     "Disco com 8 compartimentos", "Cada compartimento guarda a dose de um horário"),
    ("interior", ["motor"], (100, 95, 100), -32, -12, 330,
     "Motor de passo NEMA 17", "Gira o disco 45° por compartimento, com precisão"),
    ("interior", ["paleta", "servo", "suporte_servo"], (118, 50, 112), 24, -14, 250,
     "Trava com servo", "Só abre depois que a pulseira é validada"),
    ("interior", ["calha"], (100, 40, 48), -42, 14, 300,
     "Calha até a bandeja", "Leva a dose até a janela de retirada"),
    ("frente", ["rc522"], (100, 6, 170), 180, 8, 260,
     "Leitor RFID atrás do coração", "A pulseira é validada ao encostar na logo"),
    ("frente", ["lcd"], (100, 6, 257), 180, 4, 250,
     "Tela LCD", "Mostra o horário e o status da dose"),
]


def clipe_pecas(t, M, ctx):
    if "interior" not in ctx:
        ctx["interior"] = cena(INTERIOR, M)
        ctx["frente"] = cena(POR_DENTRO_DA_FRENTE, M)
    k = min(int(t // 10), len(SEGMENTOS) - 1)
    tl = t - 10 * k
    seg = SEGMENTOS[k]
    ant = SEGMENTOS[k - 1] if k > 0 and SEGMENTOS[k - 1][0] == seg[0] else None
    mov = r.suave(tl / 2.2)
    if ant is None:   # primeira câmera da cena: chega de longe
        alvo = lerp(seg[2], seg[2], 1)
        dist = seg[5] * (1.5 - 0.5 * mov)
        az, el = seg[3] - 25 * (1 - mov), seg[4]
    else:
        alvo = lerp(ant[2], seg[2], mov)
        dist = ant[5] + (seg[5] - ant[5]) * mov
        az, el = ant[3] + (seg[3] - ant[3]) * mov, ant[4] + (seg[4] - ant[4]) * mov
    az += 6 * math.sin(tl / 10 * math.pi)            # leve deriva durante a pausa
    itens = ctx[seg[0]]
    destacar(itens, seg[1], r.suave((tl - 0.6) / 1.4))
    img = r.renderizar(itens.values(), r.orbita(alvo, az, el, dist), alvo)
    leg = [(seg[6], seg[7], 10 * k + 1.2, 10 * k + 9.6)]
    # troca de cena (interior → frente): passagem pelo fundo
    escurece = 0.0
    if k == 4 and tl < 0.5:
        escurece = 1 - tl / 0.5
    if k == 3 and tl > 9.5:
        escurece = (tl - 9.5) / 0.5
    return img, leg, escurece


def clipe_funcionamento(t, M, ctx):
    nomes = ["tras", "frente_corte", "coracao_corte", "ecg_corte", "nome_corte", "prateleira", "disco",
             "paleta", "suporte_servo", "calha", "motor", "servo", "lcd", "rc522", "comprimido", "pulseira"]
    it = ctx.setdefault("itens", cena(nomes, M))
    cx, cy = 100.0, 95.0
    eixo = (124.7, 50.0)
    # 0–3 s: hora do remédio (LCD acende)
    it["lcd"].cor_quadro = r.hexrgb("#7CFFB2") if 0.6 < t < 20 and int(t * 2) % 2 == 0 and t < 6 else None
    # 3–6 s: pulseira chega ao coração
    pz = r.suave((t - 3.0) / 1.6) - r.suave((t - 5.6) / 1.0)
    it["pulseira"].T = mover(100, -170 + 152 * pz, 170)
    it["pulseira"].visivel = 2.8 < t < 6.8
    it["rc522"].cor_quadro = r.hexrgb("#7CFFB2") if 4.6 < t < 6.2 else None
    # 6–10 s: disco gira 45° (compartimento 2 vem para a saída)
    giro = 45 * r.suave((t - 6.3) / 3.0)
    it["disco"].T = girar_z(giro, cx, cy)
    # 10–13 s: trava abre; 17–19,5 s: fecha
    ang = 90 * (r.suave((t - 10.2) / 1.8) - r.suave((t - 17.5) / 1.8))
    it["paleta"].T = girar_z(ang, *eixo)
    # comprimido: no compartimento 2, gira com o disco, cai, desce a calha, para na bandeja
    a0 = math.radians(-135 + giro)
    pos_disco = (cx + 45 * math.cos(a0), cy + 45 * math.sin(a0), 128.0)
    caminho = [(11.6, pos_disco), (12.6, (100, 50, 47)), (14.6, (100, 8, 11)), (15.6, (100, -24, 9.5))]
    if t <= caminho[0][0]:
        pos = pos_disco
    else:
        pos = caminho[-1][1]
        for (ta, pa), (tb, pb) in zip(caminho, caminho[1:]):
            if ta <= t <= tb:
                s = (t - ta) / (tb - ta)
                s = s * s if tb == 12.6 else r.suave(s)     # queda acelera; rampa suaviza
                pos = lerp(pa, pb, s)
                break
    it["comprimido"].T = mover(*pos)
    # câmera: de frente-direita, aproxima do mecanismo e acompanha a descida
    alvo = lerp((112, 40, 130), (108, 20, 70), r.suave((t - 11.5) / 3.5))
    if t < 6.5:
        alvo = lerp((95, -20, 175), (112, 40, 130), r.suave((t - 5.0) / 1.5))
    dist = 480 - 60 * r.suave((t - 5.0) / 1.5) - 70 * r.suave((t - 11.0) / 2.5)
    olho = r.orbita(alvo, 38 + 6 * math.sin(t / 20 * math.pi), 22, dist)
    img = r.renderizar(it.values(), olho, alvo)
    leg = [("1. Chegou a hora do remédio", "O dispensador avisa na tela e o app avisa o paciente", 0.4, 3.0),
           ("2. O paciente encosta a pulseira", "O leitor RFID confirma quem está tomando", 3.2, 6.2),
           ("3. O disco gira até a dose", "O motor de passo leva o compartimento certo à saída", 6.4, 10.0),
           ("4. A trava abre", "O servo libera a saída só depois da validação", 10.2, 12.8),
           ("5. A dose chega à bandeja", "Pela calha, direto para a mão do paciente", 13.0, 17.0),
           ("Dose registrada no app", "O cuidador acompanha tudo em tempo real", 17.2, 19.7)]
    return img, leg, None


def clipe_encerramento(t, M, ctx):
    it = ctx.setdefault("itens", cena(CASCA, M))
    az = 18 - 36 * r.suave(t / 10)
    alvo = (100, 75, 60)                              # mira abaixo: o dispensador sobe na tela
    olho = r.orbita(alvo, az, 10, 1080 + 120 * r.suave(t / 10))
    img = r.renderizar(it.values(), olho, alvo)
    return img, [], ("IASIS", "Sua saúde em dia  ·  ODS 3 e ODS 9", 1.2, 9.6)


CLIPES = [
    ("01_apresentacao", 15, clipe_apresentacao),
    ("02_vista_explodida", 15, clipe_explodida),
    ("03_peca_por_peca", 60, clipe_pecas),
    ("04_como_funciona", 20, clipe_funcionamento),
    ("05_encerramento", 10, clipe_encerramento),
]


def suave_lin(x):
    return min(max(x, 0.0), 1.0)


# ═══════════════════════════════════════════════════════════════════════════
#  Gravação
# ═══════════════════════════════════════════════════════════════════════════
PEDACO = 20   # segundos por processo (o clipe de 60 s vira 3 pedaços em paralelo)


def trabalhos(nomes):
    js = []
    for nome in nomes:
        dur = next(d for n, d, _ in CLIPES if n == nome)
        k = 0
        for a in range(0, dur, PEDACO):
            js.append((nome, k, a, min(dur, a + PEDACO)))
            k += 1
    return sorted(js, key=lambda j: -(j[3] - j[2]))


def gravar(job):
    nome, k, a, b = job
    dur, func = next((d, f) for n, d, f in CLIPES if n == nome)
    M = pecas()
    partes = SAIDA / "partes"
    partes.mkdir(parents=True, exist_ok=True)
    g_com = r.Gravador(partes / f"{nome}_{k}_com.mp4")
    g_sem = r.Gravador(partes / f"{nome}_{k}_sem.mp4")
    ctx = {}
    n = int(dur * FPS)
    fundo = r.fundo(1080, 1920)
    for i in range(int(a * FPS), int(b * FPS)):
        t = i / FPS
        img, legendas, extra = func(t, M, ctx)
        # entra e sai pelo fundo (0,4 s), para os clipes emendarem sem corte seco
        f = min(1.0, t / 0.4, (dur - t) / 0.4)
        escurece = extra if isinstance(extra, float) else 0.0
        f = min(f, 1 - escurece) if escurece else f
        img = fundo * (1 - f) + img * f
        u = r.para_u8(img)
        g_sem.quadro(u)
        u = r.com_marca(u)
        for (tit, sub, a, b) in legendas:
            u = r.legenda(u, tit, sub, r.janela(t, a, b, 0.4))
        if isinstance(extra, tuple):
            tit, sub, a, b = extra
            u = r.texto_central(u, tit, sub, r.janela(t, a, b, 0.6))
        g_com.quadro(u)
        if i % 90 == 0:
            print(f"{nome}[{k}]: {i}/{n}", flush=True)
    g_com.fechar(); g_sem.fechar()
    return job


def concatenar(arquivos, destino):
    lista = destino.with_suffix(".txt")
    lista.write_text("".join(f"file '{f.resolve()}'\n" for f in arquivos))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(destino)], check=True)
    lista.unlink()


def montar_clipes(nomes):
    for versao, pasta in (("com", "com_legenda"), ("sem", "sem_legenda")):
        (SAIDA / pasta).mkdir(parents=True, exist_ok=True)
        for nome in nomes:
            partes = sorted((SAIDA / "partes").glob(f"{nome}_*_{versao}.mp4"),
                            key=lambda f: int(f.stem.split("_")[-2]))
            concatenar(partes, SAIDA / pasta / f"{nome}.mp4")


def juntar():
    lista = SAIDA / "lista.txt"
    lista.write_text("".join(f"file 'com_legenda/{n}.mp4'\n" for n, _, _ in CLIPES))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(SAIDA / "IASIS_video_stand.mp4")], check=True)
    lista.unlink()


if __name__ == "__main__":
    pedidos = sys.argv[1:] or [n for n, _, _ in CLIPES]
    pecas()   # gera o cache antes de dividir o trabalho
    js = trabalhos(pedidos)
    with Pool(min(4, len(js))) as pool:
        for feito in pool.imap_unordered(gravar, js):
            print("pronto:", feito, flush=True)
    montar_clipes(pedidos)
    if not sys.argv[1:]:
        juntar()
        print("vídeo completo:", SAIDA / "IASIS_video_stand.mp4")
