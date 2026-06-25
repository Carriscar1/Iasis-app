# 💙 IASIS — Guia Completo
## Aplicativo mobile + Dispenser IoT para TCC

---

## O QUE É O IASIS

O IASIS é um ecossistema completo de saúde composto por:

- **Aplicativo mobile** (React Native / Expo) para iOS e Android
- **Dispenser físico** automatizado controlado por ESP32
- **Pulseira RFID** que valida a identidade do paciente
- **Banco de dados na nuvem** (Supabase / PostgreSQL)
- **Comunicação em tempo real** via protocolo MQTT

O fluxo completo funciona assim:
```
Horário chega → App notifica → Pulseira vibra → Paciente aproxima
pulseira do dispenser → RFID valida → Motor libera dose → App confirma
```

---

## TECNOLOGIAS UTILIZADAS

| Tecnologia | Para que serve | Por que foi escolhida |
|---|---|---|
| **React Native + Expo** | App mobile iOS e Android | Um código só para as duas plataformas, mais fácil de manter |
| **Expo Router** | Navegação entre telas | Sistema de rotas moderno por pastas, igual Next.js |
| **Supabase** | Banco de dados + Autenticação | PostgreSQL real, painel visual, gratuito, open source |
| **MQTT (HiveMQ)** | Comunicação com ESP32 | Protocolo leve e em tempo real para IoT |
| **Zustand** | Estado global do app | Simples, leve, sem boilerplate |
| **TypeScript** | Tipagem do código | Evita erros, facilita manutenção |
| **ESP32** | Microcontrolador do dispenser | Wi-Fi integrado, barato, robusto |

---

## ESTRUTURA DE PASTAS

```
iasis/
│
├── app/                        ← Rotas (Expo Router)
│   ├── _layout.tsx             ← Layout raiz: SafeArea + GestureHandler
│   ├── index.tsx               ← Redireciona para login
│   ├── (auth)/                 ← Grupo de rotas de autenticação
│   │   ├── _layout.tsx         ← Layout sem header
│   │   ├── login.tsx           ← Tela de login
│   │   └── register.tsx        ← Tela de cadastro
│   └── (tabs)/                 ← Grupo de abas principais
│       ├── _layout.tsx         ← Barra de abas inferior
│       ├── home.tsx            ← Tela início
│       ├── schedule.tsx        ← Agenda de doses
│       ├── device.tsx          ← Controle do dispenser
│       ├── history.tsx         ← Histórico de adesão
│       └── profile.tsx         ← Perfil do usuário
│
├── src/
│   ├── screens/                ← Lógica e visual de cada tela
│   │   ├── HomeScreen.tsx      ← Dashboard com atalhos e status
│   │   ├── ScheduleScreen.tsx  ← Lista de doses do dia com modal
│   │   ├── DeviceScreen.tsx    ← Painel do ESP32 + log MQTT
│   │   ├── HistoryScreen.tsx   ← Gráfico + linha do tempo
│   │   ├── LoginScreen.tsx     ← Formulário de login
│   │   ├── RegisterScreen.tsx  ← Formulário de cadastro
│   │   └── ProfileScreen.tsx   ← Dados da conta + logout
│   │
│   ├── services/               ← Conexões externas
│   │   ├── supabase.ts         ← Cliente Supabase (configurar aqui)
│   │   ├── auth.ts             ← Login, cadastro, sessão, perfil
│   │   ├── mqtt.ts             ← Comunicação com ESP32
│   │   └── notifications.ts    ← Notificações push
│   │
│   ├── hooks/                  ← Lógica reutilizável
│   │   ├── useAuth.ts          ← Gerencia sessão e redireciona
│   │   └── useMqtt.ts          ← Conecta MQTT e sincroniza store
│   │
│   ├── store/
│   │   └── index.ts            ← Estado global (Zustand)
│   │
│   ├── theme/
│   │   └── index.ts            ← Cores, fontes, espaçamentos
│   │
│   └── types/
│       └── index.ts            ← Tipos TypeScript do projeto
│
├── firmware/
│   └── esp32/
│       └── iasis_dispenser.ino ← Código completo para o ESP32
│
├── supabase_setup.sql          ← SQL para criar o banco de dados
├── package.json                ← Dependências do projeto
├── app.json                    ← Configuração do Expo
├── babel.config.js             ← Configuração do compilador
└── tsconfig.json               ← Configuração do TypeScript
```

---

## PASSO 1 — CONFIGURAR O SUPABASE (banco de dados)

### 1.1 Criar conta e projeto

1. Acesse **https://supabase.com** e clique em **Start for free**
2. Crie uma conta com Google ou e-mail
3. Clique em **New Project**
4. Preencha:
   - **Name:** `iasis`
   - **Database Password:** crie uma senha forte e **anote**
   - **Region:** South America (São Paulo)
5. Clique em **Create new project** e aguarde ~2 minutos

### 1.2 Criar as tabelas

1. No painel do Supabase, clique em **SQL Editor** no menu lateral
2. Clique em **New query**
3. Cole TODO o conteúdo do arquivo `supabase_setup.sql`
4. Clique em **Run** (ou Ctrl+Enter)
5. Deve aparecer "Success. No rows returned"

Isso cria 4 tabelas:
- **profiles** — dados dos usuários (nome, e-mail, tipo de conta)
- **medications** — medicamentos cadastrados
- **doses** — agenda de doses com horários e status
- **dispensers** — dados do dispositivo ESP32

### 1.3 Desabilitar confirmação de e-mail (para testes)

Por padrão o Supabase exige confirmar e-mail. Para o TCC, desabilite:

1. Vá em **Authentication** → **Providers** → **Email**
2. Desmarque **Confirm email**
3. Clique em **Save**

Agora o cadastro loga automaticamente sem precisar confirmar e-mail.

### 1.4 Pegar as credenciais

1. Vá em **Settings** (ícone de engrenagem) → **API**
2. Copie:
   - **Project URL** (ex: `https://abcxyz.supabase.co`)
   - **anon public** key (chave longa que começa com `eyJ...`)

### 1.5 Colar no projeto

Abra o arquivo `src/services/supabase.ts` e substitua:

```typescript
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA-CHAVE-ANON-AQUI';
```

---

## PASSO 2 — CONFIGURAR O BROKER MQTT (ESP32)

O MQTT é o protocolo que conecta o app ao ESP32 em tempo real.

### 2.1 Criar conta HiveMQ Cloud (gratuito)

1. Acesse **https://www.hivemq.com/cloud**
2. Clique em **Get Started Free**
3. Crie uma conta
4. Crie um novo cluster (plano **Serverless Free**)
5. Aguarde o cluster ficar ativo (~1 minuto)

### 2.2 Criar usuários MQTT

1. No painel do cluster, vá em **Access Management**
2. Clique em **Add new credentials**
3. Crie dois usuários:
   - Username: `iasis_app` / Password: `SuaSenhaApp123`
   - Username: `iasis_esp32` / Password: `SuaSenhaEsp123`

### 2.3 Pegar a URL do broker

Na tela do cluster você verá algo como:
`abc123.s1.eu.hivemq.cloud`

### 2.4 Colar no projeto

Abra `src/services/mqtt.ts` e substitua:

```typescript
const BROKER_URL    = 'wss://abc123.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'iasis_app';
const MQTT_PASSWORD = 'SuaSenhaApp123';
```

---

## PASSO 3 — RODAR O APP

### 3.1 Instalar o Node.js

Se não tiver instalado: **https://nodejs.org** → baixe a versão LTS

### 3.2 Instalar dependências

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

Aguarde terminar (pode demorar 2-3 minutos).

### 3.3 Instalar o Expo Go no celular

- **Android:** Google Play → buscar "Expo Go"
- **iPhone:** App Store → buscar "Expo Go"

### 3.4 Iniciar o app

```bash
npx expo start
```

Vai aparecer um QR code no terminal.

- **Android:** Abra o Expo Go e escaneie o QR
- **iPhone:** Abra a câmera nativa e escaneie o QR

O app vai carregar no celular em segundos.

### 3.5 Criar sua conta

1. Na tela de login, toque em **Criar conta**
2. Preencha nome, e-mail e senha
3. Escolha se é **Paciente** ou **Cuidador**
4. Toque em **Criar conta**
5. Você será redirecionado para o login
6. Entre com o e-mail e senha criados

Para verificar que funcionou: no Supabase, vá em **Table Editor** → **profiles** e você verá seu usuário cadastrado.

---

## PASSO 4 — CONFIGURAR O FIRMWARE ESP32

### 4.1 Instalar o Arduino IDE

Baixe em **https://www.arduino.cc/en/software** (versão 2.x)

### 4.2 Adicionar suporte ao ESP32

1. Vá em **File** → **Preferences**
2. Em "Additional boards manager URLs" cole:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Vá em **Tools** → **Board** → **Boards Manager**
4. Busque "esp32" e instale **esp32 by Espressif Systems**

### 4.3 Instalar bibliotecas

Vá em **Sketch** → **Include Library** → **Manage Libraries** e instale:

| Biblioteca | Autor |
|---|---|
| PubSubClient | Nick O'Leary |
| DHT sensor library | Adafruit |
| MFRC522 | GithubCommunity |
| ArduinoJson | Benoit Blanchon |

### 4.4 Configurar o firmware

Abra `firmware/esp32/iasis_dispenser.ino` e edite estas linhas:

```cpp
const char* WIFI_SSID     = "NOME_DA_SUA_REDE";      // sua rede Wi-Fi
const char* WIFI_PASSWORD = "SENHA_DO_WIFI";           // senha do Wi-Fi
const char* MQTT_BROKER   = "abc123.hivemq.cloud";    // URL do broker
const char* MQTT_USER     = "iasis_esp32";             // usuário MQTT
const char* MQTT_PASS     = "SuaSenhaEsp123";          // senha MQTT
const char* DISPENSER_ID  = "01";                      // ID do dispenser
```

### 4.5 Gravar no ESP32

1. Conecte o ESP32 no computador via USB
2. No Arduino IDE, selecione **Tools** → **Board** → **ESP32 Dev Module**
3. Selecione **Tools** → **Port** → a porta COM que apareceu
4. Clique em **Upload** (seta para direita)
5. Aguarde "Done uploading"
6. Abra **Tools** → **Serial Monitor** (115200 baud)
7. Você verá os logs de conexão

### 4.6 Diagrama de pinos

```
ESP32 GPIO    Componente         Função
──────────    ──────────         ───────
GPIO  4    →  DHT22 (DATA)      Temperatura e umidade
GPIO  5    →  RC522 (SS)        Leitor RFID
GPIO 18    →  RC522 (SCK)       Clock SPI
GPIO 19    →  RC522 (MISO)      Dados SPI entrada
GPIO 23    →  RC522 (MOSI)      Dados SPI saída
GPIO 22    →  RC522 (RST)       Reset do leitor
GPIO 14    →  A4988 (STEP)      Passo do motor
GPIO 27    →  A4988 (DIR)       Direção do motor
GPIO 26    →  A4988 (EN)        Habilita motor
GPIO 32    →  Motor vibratório  Pulseira (via transistor)
GPIO  2    →  LED onboard       Indicador de status
3.3V       →  DHT22 + RC522     Alimentação dos sensores
GND        →  Todos os GNDs     Terra comum
```

---

## COMO TESTAR SEM O HARDWARE

Você pode testar o app completamente sem o ESP32:

1. **Login e cadastro:** funcionam direto, só precisam do Supabase
2. **Telas de agenda e histórico:** usam dados de exemplo (mock)
3. **Tela do dispenser:** mostra "Offline" mas não quebra
4. **Log MQTT:** você pode simular mensagens pelo painel HiveMQ

No painel HiveMQ, vá em **Web Client** e publique manualmente:
- Tópico: `iasis/dispenser/01/status`
- Payload: `{"type":"STATUS","online":true,"humidity":48,"temperature":23,"firmware":"2.1.0","uptime":120}`

O app receberá em tempo real.

---

## TELAS DO APP E O QUE CADA UMA FAZ

### 🏠 Início (Home)
- Mostra saudação com nome do usuário
- Indica se o dispenser está online ou offline
- Mostra umidade e temperatura dos sensores
- Atalhos rápidos para todas as telas
- Atualiza ao puxar para baixo (pull-to-refresh)

### 📅 Agenda
- Lista todas as doses do dia com horário
- Status visual: Tomada (verde), Em breve (azul), Aguarda (cinza), Perdida (vermelho)
- Toque em qualquer dose para ver detalhes
- Modal com informações de validação (RFID ou manual)

### 📡 Dispenser
- Status de conexão MQTT em tempo real
- Leitura ao vivo dos sensores DHT22 (umidade e temperatura)
- Controle da vibração da pulseira (liga/desliga)
- Botão para dispensar dose de teste
- Log MQTT mostrando todas as mensagens em tempo real

### 📊 Histórico
- Percentual de adesão no período selecionado (7 dias / 30 dias / 3 meses)
- Gráfico de barras com adesão por dia da semana
- Resumo: doses no horário, atrasadas, perdidas
- Linha do tempo com cada dose e validação RFID
- Botão para exportar relatório PDF

### 👤 Perfil
- Dados da conta (nome, e-mail, tipo)
- Status do dispenser
- RFID da pulseira registrada
- Botão de logout com confirmação

---

## FLUXO DE SEGURANÇA FECHADO

Este é o grande diferencial do IASIS:

```
1. App agenda a dose para as 14:00
        ↓
2. Às 13:50, notificação push chega no celular: "Dose em 10 min"
        ↓
3. Às 14:00, app publica via MQTT → ESP32: VIBRATE_ON
        ↓
4. Pulseira começa a vibrar — não para até o paciente agir
        ↓
5. Paciente aproxima a pulseira do leitor RC522 no dispenser
        ↓
6. ESP32 lê a tag RFID e publica: {"type":"RFID_READ","tag":"A3F291","valid":true}
        ↓
7. App recebe → publica: CMD DISPENSE slot:1 doseId:xxx
        ↓
8. Motor NEMA 17 gira e libera a dose do compartimento 1
        ↓
9. ESP32 publica: {"type":"DISPENSE_ACK","slot":1,"success":true}
        ↓
10. App confirma no Supabase: dose.status = "taken"
        ↓
11. Vibração cessa. Notificação: "✅ Medicamento dispensado!"
```

A vibração só para com a aproximação física — impossível ignorar.

---

## BANCO DE DADOS — ESTRUTURA DETALHADA

### Tabela: profiles
Guarda os dados de cada usuário cadastrado.

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | ID único (igual ao ID do Auth) |
| name | text | Nome completo |
| email | text | E-mail de login |
| role | text | 'patient' ou 'caregiver' |
| rfid_tag | text | ID da tag da pulseira RFID |
| created_at | timestamp | Data de criação |

### Tabela: medications
Medicamentos de cada paciente.

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | ID único |
| user_id | UUID | Referência ao usuário |
| name | text | Nome do medicamento |
| dosage | text | Dosagem (ex: "50mg") |
| compartment | int | Slot físico no dispenser (1-8) |
| instructions | text | Instruções de uso |

### Tabela: doses
Cada dose agendada e seu histórico.

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | ID único |
| user_id | UUID | Referência ao usuário |
| medication_id | UUID | Referência ao medicamento |
| scheduled_at | timestamp | Horário programado |
| status | text | pending/taken/late/missed |
| taken_at | timestamp | Quando foi tomada de fato |
| validated_by | text | 'rfid' ou 'manual' |
| delay_minutes | int | Minutos de atraso |

### Tabela: dispensers
Dados do dispositivo físico.

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | ID único |
| user_id | UUID | Referência ao usuário |
| name | text | Nome (ex: "IASIS-01") |
| mqtt_topic | text | Tópico MQTT |
| online | boolean | Se está conectado |
| humidity | numeric | Última leitura DHT22 |
| temperature | numeric | Última leitura DHT22 |

---

## SEGURANÇA (Row Level Security)

O Supabase usa RLS — cada usuário só acessa os próprios dados.
Isso é configurado automaticamente pelo `supabase_setup.sql`.

Exemplo: o usuário João jamais consegue ver os dados da Maria,
mesmo que tente acessar diretamente pela API.

---

## COMANDOS ÚTEIS

```bash
# Iniciar o projeto
npx expo start

# Iniciar e abrir no Android
npx expo start --android

# Iniciar e abrir no iOS
npx expo start --ios

# Se der erro de cache
npx expo start --clear

# Instalar dependências novamente
npm install

# Ver versão do Expo
npx expo --version
```

---

## PROBLEMAS COMUNS E SOLUÇÕES

| Erro | Solução |
|---|---|
| "Cannot find module" | Rode `npm install` novamente |
| "Unmatched route" | Verifique se as pastas são `(auth)` e `(tabs)` com parênteses |
| Login não funciona | Verifique URL e chave no `supabase.ts` |
| "Email not confirmed" | Desabilite confirmação de e-mail no Supabase (Passo 1.3) |
| App travado na splash | Rode `npx expo start --clear` |
| ESP32 não conecta WiFi | Verifique SSID e senha no `.ino` |
| ESP32 não conecta MQTT | Verifique URL do broker e credenciais |

---

*IASIS — Sua saúde em dia 💙 · TCC 2025*
