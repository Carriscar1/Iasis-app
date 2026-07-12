# 💙 IASIS — Guia de Instalação e Execução

Ecossistema IoT para adesão a medicamentos: dispenser ESP32 + pulseira RFID vibratória + app mobile.

**Fluxo de segurança fechado:** o alerta na pulseira só cessa quando o paciente valida a identidade por RFID fisicamente no dispenser — e aí o motor libera a dose exata.

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
2. Edite `src/config/app.ts`:

```ts
export const MQTT_CONFIG = {
  brokerUrl: 'wss://SEU_CLUSTER.hivemq.cloud:8884/mqtt',
  username:  'iasis_app',
  password:  'sua_senha',
  dispenserId: '01',
};
```

3. Configure e grave o firmware (`firmware/esp32/iasis_dispenser.ino`):

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
│   │   └── report.ts           # Relatório de adesão exportável
│   ├── hooks/useDevice.ts      # Fluxo de segurança fechado (global)
│   ├── store/index.ts          # Zustand (usuário, dispositivo, fluxo)
│   ├── config/app.ts           # Versão, MQTT_CONFIG, modo demo
│   ├── data/medications.ts     # Catálogo de remédios comuns no Brasil
│   ├── types/index.ts          # Tipos globais
│   └── theme/index.ts          # Cores, fontes, espaçamentos
│
├── firmware/esp32/iasis_dispenser.ino
├── supabase_setup.sql          # + supabase_update.sql / update2.sql
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
