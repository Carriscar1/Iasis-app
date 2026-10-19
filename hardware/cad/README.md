# Modelos 3D do dispensador

| Pasta | O que tem |
|---|---|
| `originais/` | STL exportados do CAD da equipe (em **cm**, de cabeça para baixo). Não editar. |
| `dispenser.py` | Gera as peças finais a partir dos originais. Todas as medidas ajustáveis estão em `PARAMETROS`. |
| `saida/` | STL prontos para o fatiador (em **mm**, de pé) e prévias em `saida/previas/`. |

## Gerar de novo

```bash
source .claude/skills/iasis-cad/scripts/setup.sh
$IASIS_CAD_PY hardware/cad/dispenser.py
```

O script mostra se cada peça está fechada (estanque) e se as peças se
sobrepõem na montagem. O normal é 0 mm³.

## O que a versão atual muda nos originais

- **Frente arredondada:** cantos verticais da frente com raio de 30 mm, cantos da
  tampa e da bandeja combinando, e aresta de cima da tampa suavizada.
- **Logo** do coração com ECG em relevo na frente, com "IASIS" embaixo.
- **Entrada de energia:** furo de 12 mm no centro da parede de trás.
- **Encaixe macho-fêmea** entre a parte de trás e a da frente, com 0,2 mm de
  folga por lado.
- **Aba na tampa** que entra na boca do corpo, com 0,25 mm de folga.

Antes de imprimir, leia `.claude/skills/iasis-cad/references/impressao-fdm.md`.
O ponto principal: cada metade tem **28 cm de altura**.
