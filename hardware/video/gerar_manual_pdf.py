"""
IASIS — manual de montagem em PDF (A4), com as imagens de cada passo e a fiação.

    python hardware/video/gerar_montagem.py --quadros   # imagens dos passos
    python hardware/video/diagrama_fiacao.py            # diagrama
    python hardware/video/gerar_manual_pdf.py

Saída: hardware/video/saida_manual/IASIS_manual_de_montagem.pdf
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI / "saida_manual"
PASSOS = SAIDA / "passos"
FONTES = Path("/usr/share/fonts/opentype/inter")
PW, PH, MARGEM = 1240, 1754, 80            # A4 a 150 dpi
FUNDO, CAFE, MARROM, AZUL = (255, 255, 255), (40, 28, 20), (110, 80, 55), (52, 104, 170)
VERMELHO = (190, 50, 40)


def fonte(tam, peso="Medium"):
    return ImageFont.truetype(str(FONTES / f"InterDisplay-{peso}.otf"), tam)


class Pagina:
    def __init__(self, numero):
        self.img = Image.new("RGB", (PW, PH), FUNDO)
        self.d = ImageDraw.Draw(self.img)
        self.y = MARGEM
        self.d.text((PW - MARGEM, PH - 50), f"IASIS · Manual de montagem · {numero}", font=fonte(20),
                    fill=MARROM, anchor="rm")

    def titulo(self, texto, tam=48):
        self.d.text((MARGEM, self.y), texto, font=fonte(tam, "Black"), fill=CAFE)
        self.y += tam + 22
        self.d.line([(MARGEM, self.y), (PW - MARGEM, self.y)], fill=AZUL, width=4)
        self.y += 26

    def subtitulo(self, texto):
        self.y += 8
        self.d.text((MARGEM, self.y), texto, font=fonte(32, "Bold"), fill=AZUL)
        self.y += 48

    def paragrafo(self, texto, tam=25, cor=CAFE, recuo=0, peso="Medium", depois=10):
        f = fonte(tam, peso)
        largura = PW - 2 * MARGEM - recuo
        for bloco in texto.split("\n"):
            linha = ""
            for palavra in bloco.split():
                teste = (linha + " " + palavra).strip()
                if self.d.textlength(teste, font=f) > largura and linha:
                    self.d.text((MARGEM + recuo, self.y), linha, font=f, fill=cor)
                    self.y += int(tam * 1.38)
                    linha = palavra
                else:
                    linha = teste
            self.d.text((MARGEM + recuo, self.y), linha, font=f, fill=cor)
            self.y += int(tam * 1.38)
        self.y += depois

    def itens(self, lista, tam=25):
        for item in lista:
            self.d.ellipse([MARGEM + 6, self.y + 11, MARGEM + 16, self.y + 21], fill=AZUL)
            self.paragrafo(item, tam, recuo=34, depois=4)
        self.y += 6

    def tabela(self, linhas, larguras, tam=22):
        f, fb = fonte(tam), fonte(tam, "Bold")
        x0 = MARGEM
        for k, linha in enumerate(linhas):
            altura = int(tam * 1.9)
            if k == 0:
                self.d.rectangle([x0, self.y, PW - MARGEM, self.y + altura], fill=(232, 238, 248))
            elif k % 2 == 0:
                self.d.rectangle([x0, self.y, PW - MARGEM, self.y + altura], fill=(248, 245, 240))
            x = x0 + 12
            for cel, w in zip(linha, larguras):
                self.d.text((x, self.y + altura / 2), str(cel), font=fb if k == 0 else f, fill=CAFE, anchor="lm")
                x += w
            self.y += altura
        self.y += 18

    def imagem(self, caminho, largura=PW - 2 * MARGEM, corte=None):
        im = Image.open(caminho).convert("RGB")
        if corte:
            im = im.crop(corte)
        h = int(im.height * largura / im.width)
        im = im.resize((largura, h), Image.LANCZOS)
        self.img.paste(im, (MARGEM + (PW - 2 * MARGEM - largura) // 2, self.y))
        self.d.rectangle([MARGEM, self.y, MARGEM + largura, self.y + h], outline=(220, 210, 195), width=2)
        self.y += h + 20

    def aviso(self, texto):
        f = fonte(24, "SemiBold")
        linhas, linha = [], ""
        for palavra in texto.split():
            teste = (linha + " " + palavra).strip()
            if self.d.textlength(teste, font=f) > PW - 2 * MARGEM - 60 and linha:
                linhas.append(linha)
                linha = palavra
            else:
                linha = teste
        linhas.append(linha)
        h = 30 + 34 * len(linhas)
        self.d.rounded_rectangle([MARGEM, self.y, PW - MARGEM, self.y + h], radius=14, fill=(253, 240, 236),
                                 outline=VERMELHO, width=3)
        for k, l in enumerate(linhas):
            self.d.text((MARGEM + 30, self.y + 15 + 34 * k), l, font=f, fill=VERMELHO)
        self.y += h + 20


# (imagem do passo, título, instruções)
PASSOS_TEXTO = [
    (2, "Passo 1 · Corpo", [
        "Encaixe a corpo_frente_cima em cima da corpo_frente_baixo e a corpo_tras_cima em cima da "
        "corpo_tras_baixo (macho-fêmea), com um fio de cola.",
        "Depois junte a frente com a parte de trás, também com cola. O fio da fonte vai passar pelo furo "
        "redondo de trás.",
        "Todo o resto entra pela abertura de cima. Nas imagens a parte de trás aparece escondida só "
        "para dar para ver o interior.",
        "A bandeja (onde o remédio chega) faz parte da corpo_frente_baixo."]),
    (3, "Passo 2 · Calha", [
        "Desça a calha pela abertura de cima uns 2 cm afastada da parede da frente, até o fundo.",
        "Empurre para a frente até a lingueta passar pela janela de baixo e deitar na bandeja. "
        "A calha fica centrada na janela.",
        "Só então cole os pés no fundo (cola quente ou fita dupla face). Ela entra ANTES da prateleira."]),
    (4, "Passo 3 · Motor na prateleira", [
        "Vire a prateleira de cabeça para baixo.",
        "Encaixe o NEMA 17 por baixo, com o eixo passando pelo furo do meio.",
        "Prenda com 4 parafusos M3 x 8 de cabeça CHATA, colocados por cima da prateleira. "
        "Cabeça redonda raspa no disco."]),
    (5, "Passo 4 · Suporte do servo", [
        "Com a prateleira de cabeça para baixo, encaixe o gabarito: o pino redondo entra no furo grande "
        "da saída e a bordinha encosta na frente da prateleira.",
        "Coloque o suporte do servo com as abas de cima dentro dos recortes do gabarito e cole.",
        "Espere secar e tire o gabarito. Opcional: fure com broca de 3 mm pelos 2 furinhos das abas e "
        "prenda com 2 parafusos M3 x 10 por cima (ficam fora do disco)."]),
    (6, "Passo 5 · Servo e paleta (a trava)", [
        "Deslize o SG90 no suporte por trás (o suporte é aberto atrás), com o eixo para cima. "
        "Parafuse as 2 abas com os parafusos do servo.",
        "Grave o firmware (página de firmware) e ligue a placa: o servo vai para a posição FECHADA.",
        "Só então encaixe o braço do servo e prenda a paleta embaixo dele, TAMPANDO o furo da saída. "
        "O parafuso do eixo entra no rebaixo redondo; os 2 furinhos servem para amarrar ou colar o braço.",
        "Teste com 'a' e 'f' no Monitor Serial: aberta, a paleta vai para a DIREITA e o furo fica livre."]),
    (7, "Passo 6 · Prateleira no corpo", [
        "Desça a prateleira montada (motor, suporte, servo e paleta) pela abertura de cima até assentar "
        "no degrau das paredes.",
        "Os fios do motor e do servo sobem pelos 2 rasgos retangulares das laterais da prateleira."]),
    (8, "Passo 7 · Disco", [
        "Encaixe o disco no eixo do motor (furo em D). Ele apoia no motor e fica 0,8 mm acima da prateleira.",
        "Gire até o CORAÇÃO gravado ficar em cima da saída e a marca da borda na seta da prateleira. "
        "Essa é a posição de descanso: nada cai antes da hora."]),
    (9, "Passo 8 · Leitor e tela", [
        "RC522: desce por cima nos 2 trilhos colados atrás do coração da logo.",
        "LCD 16x2: encosta na janela de cima por dentro e prende nos 4 pinos com parafusos M3 x 6."]),
    (10, "Passo 9 · Painéis de eletrônica", [
        "Prenda ESP32, A4988 e LM2596 nos painéis com abraçadeiras finas pelos furinhos da grade.",
        "Painel com o ESP32 na parede da esquerda; painel com A4988 e LM2596 na da direita.",
        "Cada painel vai nos 4 pinos da parede com parafusos M3 x 8."]),
]


def main():
    pags = []
    # capa
    p = Pagina(1)
    p.y = 260
    p.d.text((PW / 2, p.y), "Manual de montagem", font=fonte(84, "Black"), fill=CAFE, anchor="mm")
    p.d.text((PW / 2, p.y + 90), "IASIS · dispensador inteligente de medicamentos", font=fonte(34), fill=MARROM,
             anchor="mm")
    p.y += 170
    p.imagem(PASSOS / "passo_18.png", corte=(300, 130, 1620, 960))
    p.paragrafo("Este manual mostra onde vai cada peça, cada parafuso e cada fio, na ordem de montagem. "
                "O vídeo IASIS_manual_de_montagem.mp4 mostra os mesmos passos em movimento.", 26)
    p.aviso("Tudo aqui foi conferido no computador (peças sem colisão, firmware compilando). Nada foi "
            "montado ainda: monte com calma e teste cada parte antes da apresentação.")
    pags.append(p)

    # materiais
    p = Pagina(2)
    p.titulo("Lista de materiais")
    p.subtitulo("Peças impressas")
    p.tabela([("Peça", "Qtd", "Peça", "Qtd"),
              ("corpo_frente_baixo", 1, "prateleira", 1), ("corpo_frente_cima", 1, "disco", 1),
              ("corpo_tras_baixo", 1, "calha (v4)", 1), ("corpo_tras_cima", 1, "paleta (trava)", 1),
              ("tampa", 1, "suporte do servo", 1), ("portinha", 1, "gabarito da trava", 1),
              ("painel de eletrônica", 2, "", "")], [430, 120, 430, 100])
    p.subtitulo("Eletrônica")
    p.itens(["ESP32 DevKit", "Leitor RFID RC522 + pulseira/tag 13,56 MHz",
             "LCD 16x2 + potenciômetro (contraste) + resistor 220 Ω",
             "Motor de passo NEMA 17 + driver A4988 + capacitor 100 µF (25 V ou mais)",
             "Servo SG90 + capacitor 470 a 1000 µF (10 V ou mais)", "Módulo de vibração",
             "Regulador LM2596 + fonte 12 V 2 A com plugue P4 + diodo 1N5819",
             "Jumpers e protoboard (ou fios soldados)"], 24)
    p.subtitulo("Parafusos e outros")
    p.tabela([("Parafuso", "Qtd", "Onde"),
              ("M3 x 12 cabeça chata", 4, "tampa"), ("M3 x 8 cabeça chata", 4, "motor (TEM que ser chata)"),
              ("M3 x 6", 4, "LCD"), ("M3 x 8", 8, "painéis (4 em cada)"),
              ("M3 x 10 (opcional)", 2, "reforço do suporte do servo")], [380, 100, 600])
    p.itens(["Abraçadeiras de nylon finas (placas nos painéis)", "Cola instantânea ou epóxi (suporte do servo, "
             "corpo)", "Cola quente ou fita dupla face (pés da calha)"], 24)
    pags.append(p)

    # passos (2 por página)
    for k in range(0, len(PASSOS_TEXTO), 2):
        p = Pagina(len(pags) + 1)
        if k == 0:
            p.titulo("Montagem passo a passo")
        for idx, tit, instr in PASSOS_TEXTO[k:k + 2]:
            p.subtitulo(tit)
            p.imagem(PASSOS / f"passo_{idx:02d}.png", largura=1000, corte=(0, 120, 1920, 900))
            p.itens(instr, 23)
        pags.append(p)

    # fiação
    p = Pagina(len(pags) + 1)
    p.titulo("Passo 10 · Fiação")
    p.imagem(SAIDA / "diagrama_fiacao.png")
    p.aviso("Fonte FORA da tomada enquanto liga os fios. RC522 só no 3V3 (nunca no 5V). 12 V só no VMOT do "
            "A4988. Todos os GND ligados juntos. Nunca mexa nos fios do motor com a fonte ligada.")
    p.subtitulo("Energia")
    p.itens(["Fonte 12 V 2 A → P4 → dois ramais.",
             "Ramal A → LM2596 IN+/IN−. Regule o OUT em 5,3 V com o multímetro (o diodo derruba ~0,3 V) → "
             "trilho 5V (LCD, servo, vibração).",
             "Trilho 5V → diodo 1N5819 (perna COM listra no VIN) → VIN do ESP32. Assim pode ligar o USB junto.",
             "Ramal B → A4988 VMOT e GND, com o capacitor de 100 µF colado (listra no GND).",
             "3V3 do ESP32 → RC522 e VDD do A4988."], 23)
    pags.append(p)

    p = Pagina(len(pags) + 1)
    p.titulo("Fiação: pino a pino")
    p.subtitulo("Leitor RC522")
    p.tabela([("RC522", "ESP32", "RC522", "ESP32"), ("SDA", "GPIO 5", "RST", "GPIO 22"),
              ("SCK", "GPIO 18", "3.3V", "3V3 (nunca 5V)"), ("MOSI", "GPIO 23", "GND", "GND"),
              ("MISO", "GPIO 19", "IRQ", "solto")], [250, 290, 250, 290])
    p.subtitulo("Tela LCD 16x2")
    p.tabela([("Pino do LCD", "Liga em", "Pino do LCD", "Liga em"), ("1 VSS", "GND", "9-10 D2-D3", "soltos"),
              ("2 VDD", "5V", "11 D4", "GPIO 14"), ("3 V0", "meio do potenciômetro", "12 D5", "GPIO 25"),
              ("4 RS", "GPIO 13", "13 D6", "GPIO 33"), ("5 RW", "GND (obrigatório)", "14 D7", "GPIO 32"),
              ("6 E", "GPIO 15", "15 A", "220 Ω → 5V"), ("7-8 D0-D1", "soltos", "16 K", "GND")],
             [210, 330, 210, 330])
    p.subtitulo("Motor (A4988 + NEMA 17)")
    p.tabela([("A4988", "Liga em", "A4988", "Liga em"), ("STEP", "GPIO 26", "VMOT", "12V (+ capacitor 100 µF)"),
              ("DIR", "GPIO 27", "GND (motor)", "GND"), ("EN", "GPIO 21", "SLEEP", "fio até o RESET"),
              ("VDD", "3V3", "MS1-MS3", "soltos"), ("GND (lógica)", "GND", "1A/1B · 2A/2B", "bobinas do motor")],
             [200, 300, 220, 360])
    p.paragrafo("Antes de ligar o motor: ajuste o VREF do A4988 (R100 → 0,8 V · R068 → 0,54 V · R050 → 0,4 V) "
                "e ache os pares de bobina com o multímetro (1 a 5 Ω entre fios do mesmo par).", 22, MARROM)
    p.subtitulo("Servo da trava e vibração")
    p.tabela([("Fio", "Liga em", "Fio", "Liga em"), ("Servo laranja", "GPIO 17", "Vibração IN", "GPIO 4"),
              ("Servo vermelho", "5V do LM2596", "Vibração VCC", "5V"), ("Servo marrom", "GND", "Vibração GND",
                                                                        "GND")], [250, 290, 250, 290])
    p.paragrafo("Servo: capacitor de 470 a 1000 µF entre o vermelho e o GND, perto do servo, listra no GND. "
                "Nunca ligue o servo no 3V3 do ESP32.", 22, MARROM)
    pags.append(p)

    p = Pagina(len(pags) + 1)
    p.titulo("Passo 11 · Tampa e firmware")
    p.imagem(PASSOS / "passo_17.png", largura=1000, corte=(0, 120, 1920, 900))
    p.itens(["Tampa com 4 parafusos M3 x 12 cabeça chata nos 4 cantos.",
             "A portinha só encaixa no buraco da tampa: é por ela que se abastece o disco, sem tirar parafusos."],
            23)
    p.subtitulo("Firmware (etapa6_trava)")
    p.itens(["Arduino IDE, placa 'ESP32 Dev Module'. Bibliotecas: MFRC522, LiquidCrystal, PubSubClient, "
             "ArduinoJson 7 e ESP32Servo.",
             "Preencha Wi-Fi, HiveMQ, usuário/senha MQTT e o UID da pulseira (TAG_AUTORIZADA), iguais ao Teste 6. "
             "Não envie o arquivo preenchido para o GitHub.",
             "MODO_DEMO 1 = volta inteira (demonstração). MODO_DEMO 0 = uma dose por vez.",
             "Monitor Serial a 115200, 'Nova linha': a = abre, f = fecha, + e - acertam o ângulo fechado. "
             "Se a paleta abrir para a esquerda, troque SENTIDO_TRAVA para -1."], 23)
    p.subtitulo("Antes de ligar, toda vez")
    p.itens(["Fonte fora da tomada. Multímetro em continuidade: 5V–GND, 3V3–GND e 12V–GND sem bipe contínuo.",
             "Ligue e conte 5 segundos: cheiro, fumaça ou peça quente → tira da tomada.",
             "Com tudo ligado: trilho 5V entre 4,8 e 5,2 V; 3V3 entre 3,2 e 3,4 V."], 23)
    pags.append(p)

    destino = SAIDA / "IASIS_manual_de_montagem.pdf"
    pags[0].img.save(destino, save_all=True, append_images=[q.img for q in pags[1:]], resolution=150)
    for k, q in enumerate(pags):
        q.img.save(SAIDA / f"manual_pagina_{k + 1}.png")
    print(destino, len(pags), "páginas")


if __name__ == "__main__":
    main()
