// ─────────────────────────────────────────────
//  IASIS — Store Global (Zustand)
// ─────────────────────────────────────────────
import { create } from 'zustand';
import { UserProfile } from '../services/auth';

interface AppStore {
  // Auth
  user:        UserProfile | null;
  isLoading:   boolean;
  isLoggedIn:  boolean;
  setUser:     (user: UserProfile | null) => void;
  setLoading:  (v: boolean) => void;

  // MQTT / Dispenser
  mqttConnected:    boolean;
  setMqttConnected: (v: boolean) => void;
  mqttLog:          MqttLog[];
  addMqttLog:       (entry: Omit<MqttLog, 'id' | 'ts'>) => void;

  // Sensores
  humidity:    number;
  temperature: number;
  setSensors:  (h: number, t: number) => void;
}

export interface MqttLog {
  id:        string;
  ts:        string;
  direction: 'in' | 'out';
  payload:   string;
}

export const useStore = create<AppStore>((set) => ({
  // Auth
  user:       null,
  isLoading:  true,
  isLoggedIn: false,
  setUser:    (user) => set({ user, isLoggedIn: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),

  // MQTT
  mqttConnected:    false,
  setMqttConnected: (mqttConnected) => set({ mqttConnected }),
  mqttLog:          [],
  addMqttLog: (entry) =>
    set((state) => ({
      mqttLog: [
        { id: Date.now().toString(), ts: new Date().toLocaleTimeString('pt-BR'), ...entry },
        ...state.mqttLog,
      ].slice(0, 80),
    })),

  // Sensores
  humidity:    0,
  temperature: 0,
  setSensors:  (humidity, temperature) => set({ humidity, temperature }),
}));
