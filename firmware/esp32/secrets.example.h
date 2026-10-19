// ─────────────────────────────────────────────
//  IASIS — credenciais do dispenser (MODELO)
//
//  1. Copie este arquivo para "secrets.h" na mesma pasta
//  2. Preencha com os dados reais
//  O secrets.h está no .gitignore: senha nunca vai para o GitHub
//  (o repositório é público).
// ─────────────────────────────────────────────
#pragma once

#define WIFI_SSID      "SUA_REDE_WIFI"
#define WIFI_PASSWORD  "SUA_SENHA_WIFI"

#define MQTT_BROKER    "SEU_BROKER.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883            // 8883 = TLS (HiveMQ Cloud) | 1883 = Mosquitto local
#define MQTT_USE_TLS   1               // 0 só para broker local na mesma rede
#define MQTT_USER      "iasis_esp32"
#define MQTT_PASS      "SUA_SENHA_MQTT"

#define DISPENSER_ID   "01"            // precisa bater com o ID cadastrado no app

// Tag da pulseira usada até o app mandar outra via SET_TAG
// (depois disso a tag fica salva na flash e sobrevive a reinícios)
#define DEFAULT_TAG    "A3F2910C"
