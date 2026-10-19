# 💙 IASIS — Guia de Instalação e Execução

Ecossistema IoT para adesão a medicamentos: dispenser ESP32 + pulseira RFID vibratória + app mobile.

**Fluxo de segurança fechado:** o alerta na pulseira só cessa quando o paciente valida a identidade por RFID fisicamente no dispenser — e aí o motor libera a dose exata.

---

## ✨ Novidades da versão 3.0

Esta versão traz o app para dentro dos recursos do próprio aparelho — câmera,
agenda, GPS e acelerômetro — sempre com um caminho alternativo quando o
recurso não existe ou não foi liberado.

- **Foto de perfil** — pela câmera ou pela galeria, reduzida a 256×256 no
  próprio aparelho. Sem foto, o avatar mostra as iniciais numa cor estável
  derivada do nome (*Perfil → toque no avatar*)
- **Cadastro de remédio por código de barras** — aponte a câmera para a caixa e
  o cadastro se preenche. Código novo vira um cadastro rápido que fica salvo
  numa base compartilhada, então a próxima leitura da mesma caixa já vem
  reconhecida (*Agenda → Ler código de barras da caixa*)
- **Equipe de cuidado** — vários cuidadores por paciente, escolhidos direto na
  agenda do celular. Todos recebem os mesmos avisos (*Perfil → Equipe de cuidado*)
- **Emergência** — botão de socorro que avisa toda a equipe com a localização
  **e a precisão dela**: 🟢 alta (< 10 m) · 🟡 média (10–30 m) · 🔴 baixa (> 30 m)
- **Detecção de queda** — impacto acima de **2,0 g** abre uma contagem de 30
  segundos; sem resposta, a família é avisada (*Emergência → Detecção de queda*)
- **Histórico sem internet** — a última versão carregada fica salva no aparelho
  e aparece com a data de quando foi tirada
- **Exportar doses em planilha (CSV)** — abre no Excel para filtrar, somar
  atrasos e cruzar dados (*Histórico → Exportar doses em planilha*)
- **Tema claro e escuro** — ou seguindo o aparelho; a troca vale na hora
  (*Perfil → Aparência*). Todos os pares de cor do tema escuro foram
  conferidos por contraste antes de entrar
- **Gira com o aparelho** — retrato e paisagem, com área segura nas laterais
  para o conteúdo não passar por baixo do notch

> ⚠️ Requer rodar **`supabase_update7.sql`**, **`supabase_update8.sql`** e
> **`supabase_update9.sql`**.

### Como cada recurso se comporta quando falta algo

O app nunca quebra por falta de hardware ou permissão — cada caso tem uma saída:

| Situação | O que acontece |
|---|---|
| Permissão negada | Explica por que o recurso é usado e oferece pedir de novo |
| "Não perguntar novamente" | O sistema para de exibir o diálogo, então o app mostra o **caminho exato** nas configurações e abre a tela certa |
| GPS desligado | Avisa e sugere ligar; o pedido de socorro sai mesmo assim, sem coordenada |
| Sem acelerômetro | A detecção de queda aparece desativada e explicada |
| Sem câmera / no navegador | Oferece o cadastro pelo formulário normal |
| Sem agenda (navegador) | Oferece adicionar o cuidador pelo e-mail |
| Sem internet | Histórico mostra a cópia local com a data |

---

## ✨ Novidades da versão 2.4

- **Home com seção “precisa de atenção”** — avisos não lidos e remédios acabando
  aparecem no topo, com atalho direto para resolver
- **Relatório exportável com gráficos** — anel de adesão em SVG, adesão por horário
  e a observação do horário menos seguido; fundo branco fixo para imprimir bem
- **Renovar tratamento** — botão em *Meus remédios* estende o tratamento por
  7/14/30 dias reaproveitando os horários já usados, sem duplicar doses
- **Comparação com o período anterior** — “sua adesão melhorou: 72% → 86%”

*(Não exige novas migrações no banco.)*

---

## ✨ Novidades da versão 2.3

- **Controle de estoque** — cadastre quantas unidades tem de cada remédio; o banco
  desconta sozinho a cada dose validada, estima quantos dias ainda dura e avisa
  paciente **e** cuidador quando está acabando (tela *Estoque*)
- **Modo fácil (acessibilidade)** — letras e botões maiores em todo o app, com prévia
  ao vivo. Contas de paciente já vêm com ele ligado (*Perfil → Acessibilidade*)
- **Cuidador confirma dose** — na tela *Meus pacientes*, o botão “Dei” registra a dose
  que o cuidador administrou (fica gravada como `validated_by = 'caregiver'`)
- **Badge de mensagens não lidas** no menu de Conversas

> ⚠️ Requer rodar **`supabase_update5.sql`** (estoque) e **`supabase_update6.sql`**
> (confirmação pelo cuidador).

---

## ✨ Novidades da versão 2.2

- **Alerta automático de dose perdida** — quando uma dose não é tomada, o cuidador
  vinculado recebe um aviso na hora (tela *Alertas*, badge no sino e notificação).
  A detecção roda por **gatilho no banco**, então funciona mesmo que o paciente
  nunca abra o aplicativo — o app do cuidador dispara a verificação.

> ⚠️ Requer rodar **`supabase_update4.sql`** (tabela de alertas + gatilho).

---

## ✨ Novidades da versão 2.1

- **Relatórios com gráficos** — anel de adesão, barras por dia, adesão por horário e por dia da semana, com o insight de qual horário é mais esquecido (Histórico → *Gráficos*)
- **Chat com o cuidador** — conversa dentro do app (tempo real) **ou** direto pelo **WhatsApp**, usando o telefone do perfil
- **Telefone no perfil** — cadastrado no registro ou depois em *Perfil → Meu telefone*
- **Configurar o dispenser pelo app** — a tela *Configurar dispenser* recebe as credenciais do broker MQTT, **testa a conexão** e liga o hardware real sem precisar editar código
- **Firmware corrigido** — o ESP32 agora publica o estado da pulseira em `.../vibrate` e recebe o padrão de vibração (`gentle`/`urgent`/`sos`)

> ⚠️ Estas novidades exigem rodar **`supabase_update3.sql`** no SQL Editor do Supabase
> (telefone, chat e pareamento do dispenser).

---

## ✨ Novidades da versão 2.0

- **Tratamentos recorrentes** — vários horários por dia + duração (hoje / 7 / 14 / 30 dias); o app gera todas as doses de uma vez e agenda os lembretes
- **Agenda com navegação por dia** — veja doses passadas e futuras deslizando a faixa de datas
- **Meus remédios** — edite e exclua medicamentos (doses futuras são limpas, histórico preservado)
- **Modo demonstração do dispenser** — um simulador fiel do ESP32 (sensores, RFID, motor) roda dentro do app quando o broker MQTT não está configurado. **Dá para demonstrar o fluxo fechado inteiro na feira sem o hardware!**
- **Validação por RFID de verdade** — leitura da tag → dose validada (`validated_by = 'rfid'`) → comando DISPENSE → vibração cessa → app confirma
- **Streak de adesão** 🔥 na Home + **exportar relatório** (PDF na web, compartilhar no celular)
- **Lembrete de atraso** — se a dose não for tomada em 10 min, um segundo aviso é disparado
- Correções: sessão persistente no celular, vínculo de cuidador no cadastro (RPC), doses perdidas agora são gravadas no banco

---

## Pré-requisitos

| Ferramenta | Versão mínima | Instalar |
|---|---|---|
| Node.js | 18+ | nodejs.org |
| npm | — | (vem com Node) |
| Conta Supabase | — | supabase.com (grátis) |
| Arduino IDE *(só p/ hardware)* | 2.x | arduino.cc |
| Conta HiveMQ Cloud *(só p/ hardware)* | — | hivemq.com/cloud (grátis) |

---

## 1. Instalar dependências

```bash
npm install
```

## 2. Configurar Supabase (banco + login)

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No **SQL Editor**, execute na ordem:
   - `supabase_setup.sql` (tabelas + RLS)
   - `supabase_update.sql` (papel "independente" + vínculo de cuidador)
   - `supabase_update2.sql` (RPC de busca de cuidador + policies de leitura)
   - `supabase_update3.sql` (telefone no perfil, chat paciente↔cuidador, pareamento do dispenser)
   - `supabase_update4.sql` (alerta automático de dose perdida para o cuidador)
   - `supabase_update5.sql` (controle de estoque + aviso de "acabando")
   - `supabase_update6.sql` (cuidador confirma dose do paciente)
   - `supabase_update7.sql` (foto de perfil + base de códigos de barras)
   - `supabase_update8.sql` (vários cuidadores por paciente)
   - `supabase_update9.sql` (emergência: socorro e detecção de queda)
3. Copie a **URL** e a **anon key** (Settings → API) para:
   - `src/services/supabase.ts`
   - `app.json` (campo `extra`)
4. Em **Authentication → Email Templates**, use `email_templates/confirm_signup.html`

## 3. Rodar o app

```bash
# Navegador (mais rápido para desenvolver):
npx expo start --web

# Celular com Expo Go (demo na feira):
npx expo start          # escaneie o QR code
npx expo start --tunnel # se o celular não estiver na mesma rede
```

> 🎬 **Demonstração sem hardware:** o app já abre em **modo demonstração** — a aba *Dispenser* tem o fluxo de segurança fechado completo (alerta → vibração → RFID → dispensa) com um simulador do ESP32. Se não houver dose no horário, o botão **"Criar dose de teste para agora"** prepara tudo com um toque.

## 4. Conectar o dispenser físico (opcional)

1. Crie um cluster grátis no [HiveMQ Cloud](https://www.hivemq.com/cloud) e dois usuários (`iasis_app` e `iasis_esp32`)

2. **No app**, abra a aba **Dispenser** e toque no selo *Demonstração* (canto superior direito)
   → tela **Configurar dispenser**. Preencha:

   | Campo | Exemplo |
   |---|---|
   | Endereço do broker | `wss://SEU_CLUSTER.hivemq.cloud:8884/mqtt` |
   | Usuário | `iasis_app` |
   | Senha | a senha desse usuário |
   | ID do dispenser | `01` |

   Toque em **Testar conexão** e depois em **Salvar e conectar**. O app troca o simulador
   pelo hardware real na hora — **sem editar código nem recompilar**. As credenciais ficam
   salvas no aparelho; para voltar ao simulador, use *Apagar e voltar ao modo demonstração*.

   > Alternativa para quem prefere deixar fixo no código: preencha `MQTT_CONFIG`
   > em `src/config/app.ts` (a tela do app tem prioridade sobre esse valor).

3. Configure e grave o firmware (`firmware/esp32/iasis_dispenser.ino`) — use o **mesmo
   `DISPENSER_ID`** que você digitou no app:

```cpp
const char* WIFI_SSID     = "NOME_DA_SUA_REDE";
const char* WIFI_PASSWORD = "SENHA_DO_WIFI";
const char* MQTT_BROKER   = "SEU_CLUSTER.hivemq.cloud";
const char* MQTT_USER     = "iasis_esp32";
const char* MQTT_PASS     = "sua_senha_esp32";
```

Bibliotecas (Arduino Library Manager): **PubSubClient**, **DHT sensor library** (Adafruit), **MFRC522**, **ArduinoJson**.

Com o broker configurado, o app troca o simulador pelo hardware real automaticamente — mesma interface, mesmas telas.

## 5. Diagrama de pinos ESP32

```
ESP32          →  Componente
──────────────────────────────
GPIO  4        →  DHT22 (DATA)
GPIO  5        →  RC522 (SS/SDA)
GPIO 18        →  RC522 (SCK)
GPIO 19        →  RC522 (MISO)
GPIO 23        →  RC522 (MOSI)
GPIO 22        →  RC522 (RST)
GPIO 14        →  A4988 (STEP)
GPIO 27        →  A4988 (DIR)
GPIO 26        →  A4988 (EN)
GPIO 32        →  Motor vibratório (via transistor NPN)
GPIO  2        →  LED onboard (status)
3.3V           →  DHT22 (VCC), RC522 (VCC)
GND            →  Todos os GNDs
```

---

## Estrutura de pastas

```
iasis/
├── app/                        # Expo Router (rotas)
│   ├── _layout.tsx             # Root layout + listener de sessão
│   ├── index.tsx               # Restaura sessão / redireciona
│   ├── (auth)/                 # Login e cadastro
│   └── (tabs)/                 # Home, Agenda, Dispenser, Histórico, Perfil
│
├── src/
│   ├── screens/                # Telas (lógica + UI)
│   ├── components/             # AlarmTimePicker, DateStrip, ConfirmAction, ui/
│   ├── services/
│   │   ├── supabase.ts         # Cliente (sessão persistente em todas plataformas)
│   │   ├── auth.ts             # Login, cadastro, vínculo de cuidador
│   │   ├── data.ts             # CRUD: medicamentos, doses, adesão, streak
│   │   ├── device.ts           # Canal unificado: MQTT real OU simulador
│   │   ├── dispenserSim.ts     # Simulador fiel do ESP32 (modo demo)
│   │   ├── mqtt.ts             # Comunicação com o ESP32 real
│   │   ├── notifications.ts    # Lembretes locais + aviso de atraso
│   │   ├── permissions.ts      # Permissão negada vs. negada definitivamente
│   │   ├── avatar.ts           # Foto de perfil (câmera/galeria)
│   │   ├── barcode.ts          # Código de barras da caixa do remédio
│   │   ├── contacts.ts         # Agenda paginada com busca nativa
│   │   ├── careTeam.ts         # Vários cuidadores por paciente
│   │   ├── location.ts         # GPS + classificação da precisão
│   │   ├── motion.ts           # Acelerômetro (detecção de queda, 2,0 g)
│   │   ├── emergency.ts        # Pedido de socorro para toda a equipe
│   │   ├── offline.ts          # Cópia local do histórico
│   │   ├── export.ts           # Doses em CSV
│   │   └── report.ts           # Relatório de adesão exportável
│   ├── hooks/useDevice.ts      # Fluxo de segurança fechado (global)
│   ├── store/index.ts          # Zustand (usuário, dispositivo, fluxo)
│   ├── theme/
│   │   ├── index.ts            # useTheme(makeStyles) + escalas
│   │   └── palette.ts          # Paletas clara e escura
│   ├── config/app.ts           # Versão, MQTT_CONFIG, modo demo
│   ├── data/medications.ts     # Catálogo de remédios comuns no Brasil
│   ├── types/index.ts          # Tipos globais
│
├── firmware/esp32/iasis_dispenser.ino
├── supabase_setup.sql          # + supabase_update.sql … update9.sql
├── email_templates/
└── app.json
```

---

## Fluxo de segurança fechado

```
1. Horário da dose chega
        ↓
2. Alerta disparado → CMD VIBRATE_ON → pulseira vibra continuamente
        ↓
3. Paciente aproxima a pulseira do leitor RC522 no dispenser
        ↓
4. ESP32 lê a tag → publica RFID_READ em iasis/dispenser/01/rfid
        ↓
5. App valida: dose marcada como tomada (validated_by = 'rfid')
        ↓
6. App publica CMD DISPENSE slot:N → motor NEMA 17 libera a dose
        ↓
7. ESP32 responde DISPENSE_ACK → CMD VIBRATE_OFF → vibração cessa
        ↓
8. App confirma: notificação "✅ Dose liberada" + histórico atualizado
```

*(No modo demonstração, os passos 3–7 são executados pelo simulador — visíveis no log da aba Dispenser.)*

---

## Dicas para a feira

- A aba **Dispenser** foi feita para a demo: mostre as 4 etapas acendendo em tempo real
- Sem dose agendada? Use **"Criar dose de teste para agora"** e rode o ciclo na hora
- O **log do simulador** (embaixo da tela) mostra as mensagens MQTT como no hardware real — ótimo para explicar a arquitetura à banca
- No Histórico, o botão **Exportar relatório** gera um PDF apresentável com a adesão
- Com o ESP32 montado, basta preencher `MQTT_CONFIG` — as telas são as mesmas

---

*IASIS — Sua saúde em dia 💙 · TCC 2026*
