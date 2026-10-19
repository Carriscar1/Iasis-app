// ─────────────────────────────────────────────
//  IASIS — credenciais dos testes (MODELO)
//  1. Copie este arquivo para "secrets.h" NA MESMA PASTA do .ino
//  2. Preencha com os dados reais
//  O secrets.h esta no .gitignore: senha nunca vai para o GitHub.
//  Nunca cole essas senhas em chat, slide ou documento.
// ─────────────────────────────────────────────
#pragma once

#define WIFI_SSID      "SUA_REDE_WIFI"        // rede 2,4 GHz (o ESP32 nao enxerga 5 GHz)
#define WIFI_PASSWORD  "SUA_SENHA_WIFI"

// Endereco do cluster no HiveMQ Cloud, SEM "mqtts://" e SEM a porta
#define MQTT_HOST      "xxxxxxxx.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883                   // MQTT com TLS
#define MQTT_USER      "iasis_esp32"
#define MQTT_PASS      "SUA_SENHA_MQTT"

#define DISPENSER_ID   "01"                   // igual ao da tela "Configurar dispensador" do app

// UID da pulseira, anotado no teste 1
#define TAG_AUTORIZADA "A3F2910C"
