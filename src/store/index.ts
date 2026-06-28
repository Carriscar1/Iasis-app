import { create } from 'zustand';
import { UserProfile } from '../services/auth';

export interface MqttLog {
  id:        string;
  ts:        string;
  direction: 'in' | 'out';
  payload:   string;
}

interface AppStore {
  // Auth
  user:        UserProfile | null;
  isLoading:   boolean;
  isLoggedIn:  boolean;
  setUser:     (user: UserProfile | null) => void;
  setLoading:  (v: boolean) => void;
  logout:      () => void;

  // MQTT
  mqttConnected:    boolean;
  setMqttConnected: (v: boolean) => void;
  mqttLog:          MqttLog[];
  addMqttLog:       (entry: Omit<MqttLog, 'id' | 'ts'>) => void;
  clearMqttLog:     () => void;

  // Sensores
  humidity:    number;
  temperature: number;
  setSensors:  (h: number, t: number) => void;
}

export const useStore = create<AppStore>((set) => ({
  user:       null,
  isLoading:  true,
  isLoggedIn: false,
  setUser:    (user) => set({ user, isLoggedIn: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout:     () => set({ user: null, isLoggedIn: false, isLoading: false }),

  mqttConnected:    false,
  setMqttConnected: (mqttConnected) => set({ mqttConnected }),
  mqttLog:          [],
  addMqttLog: (entry) =>
    set((s) => ({
      mqttLog: [
        { id: Date.now().toString(), ts: new Date().toLocaleTimeString('pt-BR'), ...entry },
        ...s.mqttLog,
      ].slice(0, 80),
    })),
  clearMqttLog: () => set({ mqttLog: [] }),

  humidity:    0,
  temperature: 0,
  setSensors:  (humidity, temperature) => set({ humidity, temperature }),
}));
