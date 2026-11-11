"""
IASIS — diagrama de fiação (ESP32 no meio, cada componente com os seus fios).

    python hardware/video/diagrama_fiacao.py

Pinos conferidos com firmware/testes/etapa6_trava (branch firmware/v2.2-hardware)
e com a energia descrita em firmware/testes/README.md. Saída:
hardware/video/saida_manual/diagrama_fiacao.png (1920 x 1080).

`desenhar(grupos)` desenha só os grupos pedidos; o vídeo de montagem usa isso
para acender um componente de cada vez.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI / "saida_manual"
W, H = 1920, 1080
FONTES = Path("/usr/share/fonts/opentype/inter")
FUNDO, TINTA, CINZA = (247, 241, 232), (40, 28, 20), (120, 100, 85)
ENERGIA = {"5V": (214, 64, 52), "3V3": (230, 140, 30), "12V": (150, 30, 120), "GND": (40, 40, 40)}


def fonte(tam, peso="SemiBold"):
    try:
        return ImageFont.truetype(str(FONTES / f"InterDisplay-{peso}.otf"), tam)
    except OSError:
        return ImageFont.load_default()


# componente: (caixa x0, y0, x1, y1, cor, título, [(rótulo do pino, destino)])
# destino "GPIO n" vira fio até o ESP32; "5V"/"3V3"/"12V"/"GND" vira etiqueta de energia;
# outro texto vira observação.
COMPONENTES = {
    "rc522": ((60, 120, 470, 430), (52, 104, 170), "Leitor RC522 (pulseira)", [
        ("SDA", "GPIO 5"), ("SCK", "GPIO 18"), ("MOSI", "GPIO 23"), ("MISO", "GPIO 19"),
        ("RST", "GPIO 22"), ("3.3V", "3V3"), ("GND", "GND"), ("IRQ", "solto")]),
    "lcd": ((60, 480, 470, 1010), (47, 120, 80), "Tela LCD 16x2", [
        ("RS (4)", "GPIO 13"), ("E (6)", "GPIO 15"), ("D4 (11)", "GPIO 14"), ("D5 (12)", "GPIO 25"),
        ("D6 (13)", "GPIO 33"), ("D7 (14)", "GPIO 32"), ("VSS (1)", "GND"), ("VDD (2)", "5V"),
        ("V0 (3)", "potenciômetro (meio)"), ("RW (5)", "GND"), ("A (15)", "220 Ω → 5V"), ("K (16)", "GND")]),
    "a4988": ((1450, 90, 1860, 520), (120, 72, 160), "A4988 + motor NEMA 17", [
        ("STEP", "GPIO 26"), ("DIR", "GPIO 27"), ("EN", "GPIO 21"), ("VDD", "3V3"), ("GND (lógica)", "GND"),
        ("VMOT", "12V"), ("GND (motor)", "GND"), ("SLEEP ↔ RESET", "um fio entre os dois"),
        ("MS1, MS2, MS3", "soltos"), ("1A/1B · 2A/2B", "bobinas do motor")]),
    "servo": ((1450, 560, 1860, 790), (200, 110, 40), "Servo SG90 (trava)", [
        ("laranja (sinal)", "GPIO 17"), ("vermelho", "5V"), ("marrom", "GND"),
        ("capacitor", "470–1000 µF: + no 5V, listra no GND")]),
    "vibra": ((1450, 820, 1860, 1010), (170, 60, 90), "Módulo de vibração", [
        ("IN / SIG", "GPIO 4"), ("VCC", "5V"), ("GND", "GND")]),
}
ESP = (760, 140, 1160, 860)
# ordem dos pinos em cada lado do ESP32 (ficam na altura dos fios, sem cruzar)
LADO_ESQ = ["GPIO 5", "GPIO 18", "GPIO 23", "GPIO 19", "GPIO 22", "GPIO 13", "GPIO 15", "GPIO 14", "GPIO 25",
            "GPIO 33", "GPIO 32"]
LADO_DIR = ["GPIO 26", "GPIO 27", "GPIO 21", "GPIO 17", "GPIO 4"]
# onde cada fio dobra na vertical: escolhido para nenhum fio passar por cima de outro
DOBRA = {"GPIO 5": 720, "GPIO 18": 690, "GPIO 23": 660, "GPIO 19": 630, "GPIO 22": 600,
         "GPIO 13": 500, "GPIO 15": 530, "GPIO 14": 560, "GPIO 25": 590, "GPIO 33": 650, "GPIO 32": 620,
         "GPIO 26": 1250, "GPIO 27": 1290, "GPIO 21": 1330, "GPIO 17": 1410, "GPIO 4": 1370}


def _pino_esp(g):
    if g in LADO_ESQ:
        k = LADO_ESQ.index(g)
        return ESP[0], ESP[1] + 70 + k * 58
    k = LADO_DIR.index(g)
    return ESP[2], ESP[1] + 90 + k * 80


def desenhar(grupos=("rc522", "lcd", "a4988", "servo", "vibra", "energia"), destaque=None, titulo=True):
    img = Image.new("RGB", (W, H), FUNDO)
    d = ImageDraw.Draw(img)
    if titulo:
        d.text((W / 2, 34), "IASIS · Fiação", font=fonte(40, "Black"), fill=TINTA, anchor="mm")
    # ESP32
    d.rounded_rectangle(ESP, radius=22, fill=(30, 36, 48), outline=(10, 10, 10), width=3)
    d.text(((ESP[0] + ESP[2]) / 2, ESP[1] + 30), "ESP32", font=fonte(40, "Black"), fill="white", anchor="mm")
    d.text(((ESP[0] + ESP[2]) / 2, ESP[1] + 64), "DevKit", font=fonte(22, "Medium"), fill=(190, 200, 215),
           anchor="mm")
    usados = set()
    for nome in grupos:
        if nome in COMPONENTES:
            usados |= {dst for _, dst in COMPONENTES[nome][3] if dst.startswith("GPIO")}
    for g in LADO_ESQ + LADO_DIR:
        x, y = _pino_esp(g)
        ativo = g in usados
        cor = (255, 214, 120) if ativo else (90, 100, 115)
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=cor)
        dx, ancora = (20, "lm") if g in LADO_ESQ else (-20, "rm")
        d.text((x + dx, y), g, font=fonte(24, "Bold"), fill=cor, anchor=ancora)
    # pinos de energia do ESP32 embaixo
    for k, (rot, cor) in enumerate((("VIN", ENERGIA["5V"]), ("GND", ENERGIA["GND"]), ("3V3", ENERGIA["3V3"]))):
        x = ESP[0] + 80 + k * 120
        d.rounded_rectangle([x - 46, ESP[3] - 52, x + 46, ESP[3] - 16], radius=8, fill=cor)
        d.text((x, ESP[3] - 34), rot, font=fonte(22, "Bold"), fill="white", anchor="mm")

    for nome in grupos:
        if nome == "energia" or nome not in COMPONENTES:
            continue
        (x0, y0, x1, y1), cor, tit, pinos = COMPONENTES[nome]
        largura = 7 if destaque == nome else 4
        d.rounded_rectangle((x0, y0, x1, y1), radius=18, fill="white", outline=cor, width=largura)
        d.text((x0 + 20, y0 + 16), tit, font=fonte(27, "Bold"), fill=cor)
        lado_esq = x1 < ESP[0]
        passo = (y1 - y0 - 70) / max(len(pinos), 1)
        for k, (rot, dst) in enumerate(pinos):
            y = y0 + 66 + k * passo + passo / 2 - 4
            px = x1 - 16 if lado_esq else x0 + 16
            if lado_esq:
                d.text((x0 + 22, y), rot, font=fonte(22, "Medium"), fill=TINTA, anchor="lm")
            else:
                d.text((x1 - 22, y), rot, font=fonte(22, "Medium"), fill=TINTA, anchor="rm")
            if dst.startswith("GPIO"):
                ex, ey = _pino_esp(dst)
                meio = DOBRA[dst]
                d.line([(px, y), (meio, y), (meio, ey), (ex, ey)], fill=cor, width=largura)
                d.ellipse([px - 6, y - 6, px + 6, y + 6], fill=cor)
            elif dst in ENERGIA or dst.endswith("→ 5V"):
                chave = "5V" if dst.endswith("5V") else dst
                tx = x1 - 150 if lado_esq else x0 + 150
                d.rounded_rectangle([tx - 70 if not dst.endswith("→ 5V") else tx - 100, y - 15,
                                     tx + 70 if not dst.endswith("→ 5V") else tx + 100, y + 15],
                                    radius=8, fill=ENERGIA[chave])
                d.text((tx, y), dst, font=fonte(19, "Bold"), fill="white", anchor="mm")
            else:
                d.text((x0 + 200, y) if lado_esq else (x0 + 22, y), dst, font=fonte(19, "Medium"), fill=CINZA,
                       anchor="lm")
    if "energia" in grupos:
        cx = (ESP[0] + ESP[2]) / 2
        caixa = (560, 900, 1360, 1060)
        largura = 7 if destaque == "energia" else 4
        d.rounded_rectangle(caixa, radius=18, fill="white", outline=ENERGIA["12V"], width=largura)
        d.text((caixa[0] + 20, caixa[1] + 12), "Energia", font=fonte(27, "Bold"), fill=ENERGIA["12V"])
        linhas = [
            ("Fonte 12 V 2 A → P4 → dois ramais:", TINTA),
            ("  A → LM2596 IN+/IN−  → OUT 5,3 V → trilho 5V (LCD, servo, vibração)", ENERGIA["5V"]),
            ("  B → A4988 VMOT/GND (+ capacitor 100 µF, listra no GND)", ENERGIA["12V"]),
            ("  5V → diodo 1N5819 (listra no VIN) → VIN · todos os GND juntos", TINTA),
        ]
        for k, (t, c) in enumerate(linhas):
            d.text((caixa[0] + 22, caixa[1] + 52 + k * 25), t, font=fonte(19, "Medium"), fill=c)
        d.line([(cx - 60, ESP[3]), (cx - 60, caixa[1])], fill=ENERGIA["5V"], width=5)
        d.line([(cx + 60, ESP[3]), (cx + 60, caixa[1])], fill=ENERGIA["GND"], width=5)
    return img


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = SAIDA / "diagrama_fiacao.png"
    desenhar().save(destino)
    print(destino)
