import { create } from 'zustand';
import { UserProfile } from '../services/auth';
import type { MedForm } from '../types';

export interface MqttLog {
  id:        string;
  ts:        string;
  direction: 'in' | 'out';
  payload:   string;
}

// Etapas do fluxo de segurança fechado (alerta → RFID → dispensa → confirmado)
export type FlowStep = 'idle' | 'alerting' | 'validating' | 'dispensing' | 'done';

// Remédio lido pelo código de barras, entregue à tela de cadastro.
export interface ScannedMedication {
  name:   string;
  dosage: string;
  form:   MedForm;
}

export interface DoseFlow {
  step:     FlowStep;
  doseId?:  string;
  medName?: string;
}

interface AppStore {
  // Auth
  user:        UserProfile | null;
  isLoading:   boolean;
  isLoggedIn:  boolean;
  setUser:     (user: UserProfile | null) => void;
  setLoading:  (v: boolean) => void;
  logout:      () => void;

  // Dispositivo (dispenser + pulseira)
  mqttConnected:    boolean;
  setMqttConnected: (v: boolean) => void;
  deviceMode:       'mqtt' | 'demo';
  setDeviceMode:    (m: 'mqtt' | 'demo') => void;
  // Incrementado ao salvar/apagar credenciais MQTT: faz o useDevice reconectar.
  deviceConfigVersion: number;
  bumpDeviceConfig:    () => void;
  wristbandVibrating:    boolean;
  setWristbandVibrating: (v: boolean) => void;
  lastRfid:         { tag: string; valid: boolean; at: string } | null;
  setLastRfid:      (r: { tag: string; valid: boolean; at: string } | null) => void;
  firmware:         string;
  setFirmware:      (v: string) => void;

  // Acessibilidade: "modo fácil" (fontes e botões maiores)
  largeText:    boolean;
  setLargeText: (v: boolean) => void;

  // Alertas e mensagens recebidos (badges de não lidos)
  unreadAlerts:    number;
  setUnreadAlerts: (n: number) => void;
  unreadMessages:    number;
  setUnreadMessages: (n: number) => void;

  // Remédio vindo do leitor de código de barras (consumido uma única vez
  // pela tela de cadastro e limpo em seguida).
  scannedMedication:    ScannedMedication | null;
  setScannedMedication: (m: ScannedMedication | null) => void;

  // Fluxo de segurança fechado (demonstração/execução ao vivo)
  doseFlow:    DoseFlow;
  setDoseFlow: (f: DoseFlow) => void;

  // Log de mensagens (MQTT real ou simulador)
  mqttLog:          MqttLog[];
  addMqttLog:       (entry: Omit<MqttLog, 'id' | 'ts'>) => void;
  clearMqttLog:     () => void;

  // Sensores
  humidity:    number;
  temperature: number;
  setSensors:  (h: number, t: number) => void;
}

let logSeq = 0;

export const useStore = create<AppStore>((set) => ({
  user:       null,
  isLoading:  true,
  isLoggedIn: false,
  setUser:    (user) => set({ user, isLoggedIn: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout:     () => set({ user: null, isLoggedIn: false, isLoading: false }),

  mqttConnected:    false,
  setMqttConnected: (mqttConnected) => set({ mqttConnected }),
  deviceMode:       'demo',
  setDeviceMode:    (deviceMode) => set({ deviceMode }),
  deviceConfigVersion: 0,
  bumpDeviceConfig: () => set((s) => ({ deviceConfigVersion: s.deviceConfigVersion + 1 })),
  wristbandVibrating:    false,
  setWristbandVibrating: (wristbandVibrating) => set({ wristbandVibrating }),
  lastRfid:         null,
  setLastRfid:      (lastRfid) => set({ lastRfid }),
  firmware:         '—',
  setFirmware:      (firmware) => set({ firmware }),

  largeText:    false,
  setLargeText: (largeText) => set({ largeText }),

  unreadAlerts:    0,
  setUnreadAlerts: (unreadAlerts) => set({ unreadAlerts }),
  unreadMessages:    0,
  setUnreadMessages: (unreadMessages) => set({ unreadMessages }),

  scannedMedication:    null,
  setScannedMedication: (scannedMedication) => set({ scannedMedication }),

  doseFlow:    { step: 'idle' },
  setDoseFlow: (doseFlow) => set({ doseFlow }),

  mqttLog:          [],
  addMqttLog: (entry) =>
    set((s) => ({
      mqttLog: [
        { id: `${Date.now()}-${logSeq++}`, ts: new Date().toLocaleTimeString('pt-BR'), ...entry },
        ...s.mqttLog,
      ].slice(0, 80),
    })),
  clearMqttLog: () => set({ mqttLog: [] }),

  humidity:    0,
  temperature: 0,
  setSensors:  (humidity, temperature) => set({ humidity, temperature }),
}));
