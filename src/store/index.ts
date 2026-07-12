import { create } from 'zustand';
import { UserProfile } from '../services/auth';

export interface MqttLog {
  id:        string;
  ts:        string;
  direction: 'in' | 'out';
  payload:   string;
}

// Etapas do fluxo de segurança fechado (alerta → RFID → dispensa → confirmado)
export type FlowStep = 'idle' | 'alerting' | 'validating' | 'dispensing' | 'done';

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
  wristbandVibrating:    boolean;
  setWristbandVibrating: (v: boolean) => void;
  lastRfid:         { tag: string; valid: boolean; at: string } | null;
  setLastRfid:      (r: { tag: string; valid: boolean; at: string } | null) => void;
  firmware:         string;
  setFirmware:      (v: string) => void;

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
  wristbandVibrating:    false,
  setWristbandVibrating: (wristbandVibrating) => set({ wristbandVibrating }),
  lastRfid:         null,
  setLastRfid:      (lastRfid) => set({ lastRfid }),
  firmware:         '—',
  setFirmware:      (firmware) => set({ firmware }),

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
