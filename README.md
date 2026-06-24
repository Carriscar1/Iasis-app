# 💙 IASIS — Guia de Instalação e Execução

Ecossistema IoT para adesão a medicamentos: ESP32 + pulseira RFID + app mobile.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Instalar |
|---|---|---|
| Node.js | 18+ | nodejs.org |
| npm ou yarn | — | (vem com Node) |
| Expo CLI | — | `npm i -g expo-cli` |
| Arduino IDE | 2.x | arduino.cc |
| Conta Firebase | — | firebase.google.com |
| Conta HiveMQ Cloud | — | hivemq.com/cloud (grátis) |

---

## 1. Clonar / abrir o projeto

```bash
# Se ainda não está na pasta do projeto:
cd iasis
```

---

## 2. Instalar dependências do app

```bash
npm install
```

---

## 3. Configurar Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um projeto chamado `iasis`
3. Vá em **Authentication → Sign-in method** → ative **Email/Senha**
4. Vá em **Firestore Database** → crie em modo de produção
5. Vá em **Configurações do projeto → Seus apps** → adicione um app **Web**
6. Copie as credenciais e cole em `src/services/firebase.ts`:

```ts
const firebaseConfig = {
  apiKey:            'SUA_API_KEY',
  authDomain:        'seu-projeto.firebaseapp.com',
  projectId:         'seu-projeto',
  storageBucket:     'seu-projeto.appspot.com',
  messagingSenderId: 'SEU_SENDER_ID',
  appId:             'SEU_APP_ID',
};
```

7. Aplique as regras do Firestore:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
# copie o conteúdo de firestore.rules para o arquivo gerado
firebase deploy --only firestore:rules
```

---

## 4. Configurar Broker MQTT (HiveMQ Cloud)

1. Crie uma conta em [hivemq.com/cloud](https://www.hivemq.com/cloud)
2. Crie um cluster gratuito
3. Em **Access Management**, crie um usuário:
   - Username: `iasis_app`
   - Password: `sua_senha` (anote)
   - Crie outro: `iasis_esp32` / `sua_senha_esp32`
4. Copie a URL do broker (formato: `xxxxx.hivemq.cloud`)
5. Edite `src/services/mqtt.ts`:

```ts
const BROKER_URL    = 'wss://xxxxx.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'iasis_app';
const MQTT_PASSWORD = 'sua_senha';
```

---

## 5. Rodar o app

```bash
# Com Expo Go (mais fácil para TCC):
npx expo start

# Ou direto no dispositivo:
npx expo start --tunnel   # usa ngrok para conexão externa
```

Escaneie o QR code com o **Expo Go** no celular (iOS ou Android).

> Para build nativo (APK/IPA final):
> ```bash
> npx eas build --platform android
> npx eas build --platform ios
> ```

---

## 6. Configurar e gravar firmware ESP32

### Instalar bibliotecas no Arduino IDE

Vá em **Sketch → Include Library → Manage Libraries** e instale:

| Biblioteca | Autor |
|---|---|
| PubSubClient | Nick O'Leary |
| DHT sensor library | Adafruit |
| MFRC522 | GithubCommunity |
| ArduinoJson | Benoit Blanchon |

### Configurar o firmware

Abra `firmware/esp32/iasis_dispenser.ino` e edite:

```cpp
const char* WIFI_SSID     = "NOME_DA_SUA_REDE";
const char* WIFI_PASSWORD = "SENHA_DO_WIFI";
const char* MQTT_BROKER   = "xxxxx.hivemq.cloud";
const char* MQTT_USER     = "iasis_esp32";
const char* MQTT_PASS     = "sua_senha_esp32";
const char* DISPENSER_ID  = "01";
```

### Gravar no ESP32

1. Selecione a placa: **Tools → Board → ESP32 Dev Module**
2. Selecione a porta COM correta
3. Clique em **Upload**
4. Abra o **Serial Monitor** (115200 baud) para ver os logs

---

## 7. Diagrama de pinos ESP32

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

## 8. Estrutura de pastas

```
iasis/
├── app/                    # Expo Router (rotas)
│   ├── _layout.tsx         # Root layout
│   ├── index.tsx           # Redirect inicial
│   ├── auth/               # Telas de autenticação
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── tabs/               # Navegação por abas
│       ├── _layout.tsx
│       ├── home.tsx
│       ├── schedule.tsx
│       ├── device.tsx
│       ├── history.tsx
│       └── profile.tsx
│
├── src/
│   ├── screens/            # Telas (lógica + UI)
│   │   ├── HomeScreen.tsx
│   │   ├── ScheduleScreen.tsx
│   │   ├── DeviceScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── ProfileScreen.tsx
│   │
│   ├── components/
│   │   ├── ui/index.tsx    # Card, Button, Pill, MetricCard...
│   │   └── DoseItem.tsx    # Componente de dose
│   │
│   ├── services/
│   │   ├── firebase.ts     # Auth + Firestore
│   │   ├── mqtt.ts         # Comunicação ESP32
│   │   └── notifications.ts # Push + agendamento
│   │
│   ├── store/index.ts      # Zustand (estado global)
│   ├── hooks/
│   │   ├── useAuth.ts      # Auth lifecycle
│   │   ├── useMqtt.ts      # MQTT + store sync
│   │   └── useDoses.ts     # Doses em tempo real
│   │
│   ├── types/index.ts      # TypeScript types
│   ├── theme/index.ts      # Cores, fontes, espaçamentos
│   └── navigation/
│       └── TabsLayout.tsx
│
├── firmware/
│   └── esp32/
│       └── iasis_dispenser.ino  # Firmware completo
│
├── firestore.rules         # Regras de segurança
├── app.json                # Config Expo
├── package.json
└── tsconfig.json
```

---

## 9. Fluxo de funcionamento

```
1. Horário de dose chega
        ↓
2. Firebase Cloud Function dispara notificação push → celular
        ↓
3. App recebe → publica MQTT: VIBRATE_ON → ESP32
        ↓
4. Pulseira vibra continuamente
        ↓
5. Paciente aproxima pulseira do leitor RC522
        ↓
6. ESP32 lê tag RFID → publica em iasis/dispenser/01/rfid
        ↓
7. App recebe → publica MQTT: DISPENSE slot:N doseId:XXX
        ↓
8. Motor NEMA 17 gira → libera dose do compartimento
        ↓
9. ESP32 publica DISPENSE_ACK → app confirma no Firebase
        ↓
10. Vibração cessa → status da dose muda para "taken"
        ↓
11. Notificação de confirmação chega no celular
```

---

## Dicas para o TCC

- Use **Expo Go** para demos ao vivo na feira (sem precisar de build nativo)
- O **Serial Monitor** do Arduino IDE mostra todos os logs do ESP32 em tempo real
- O broker HiveMQ tem um painel web onde você vê as mensagens trafegando
- Para simular o dispenser sem o hardware: use o painel HiveMQ para publicar mensagens manualmente nos tópicos

---

*IASIS — Sua saúde em dia 💙*
