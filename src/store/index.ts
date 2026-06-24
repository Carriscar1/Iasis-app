// ─────────────────────────────────────────────
//  IASIS — Zustand Store Global
// ─────────────────────────────────────────────
import { create } from 'zustand';
import {
  User,
  Dose,
  Dispenser,
  Alert,
  MqttStatusPayload,
  MqttRfidPayload,
} from '../types';

// ─── Auth slice ───────────────────────────────
interface AuthSlice {
  user:        User | null;
  isLoading:   boolean;
  isLoggedIn:  boolean;
  setUser:     (user: User | null) => void;
  setLoading:  (v: boolean) => void;
}

// ─── Doses slice ──────────────────────────────
interface DosesSlice {
  todayDoses:     Dose[];
  nextDose:       Dose | null;
  setTodayDoses:  (doses: Dose[]) => void;
}

// ─── Dispenser slice ──────────────────────────
interface DispenserSlice {
  dispenser:        Dispenser | null;
  mqttConnected:    boolean;
  mqttLog:          MqttLogEntry[];
  lastRfidRead:     MqttRfidPayload | null;
  setDispenser:     (d: Dispenser | null) => void;
  setMqttConnected: (v: boolean) => void;
  updateSensors:    (status: MqttStatusPayload) => void;
  setRfidRead:      (payload: MqttRfidPayload) => void;
  addMqttLog:       (entry: Omit<MqttLogEntry, 'id' | 'ts'>) => void;
}

export interface MqttLogEntry {
  id:        string;
  ts:        string;
  direction: 'in' | 'out';
  topic:     string;
  payload:   string;
}

// ─── Alerts slice ─────────────────────────────
interface AlertsSlice {
  alerts:      Alert[];
  unreadCount: number;
  setAlerts:   (alerts: Alert[]) => void;
  addAlert:    (alert: Alert) => void;
  markRead:    (id: string) => void;
}

// ─── UI slice ─────────────────────────────────
interface UISlice {
  activeTab:    string;
  setActiveTab: (tab: string) => void;
}

// ─── Store combinado ──────────────────────────
type IasisStore = AuthSlice & DosesSlice & DispenserSlice & AlertsSlice & UISlice;

export const useStore = create<IasisStore>((set, get) => ({
  // ── Auth ────────────────────────────────────
  user:       null,
  isLoading:  true,
  isLoggedIn: false,
  setUser: (user) => set({ user, isLoggedIn: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),

  // ── Doses ───────────────────────────────────
  todayDoses:    [],
  nextDose:      null,
  setTodayDoses: (doses) => {
    const now = new Date();
    const next = doses.find(d => {
      const t = new Date(d.scheduledAt);
      return t > now && (d.status === 'pending' || d.status === 'upcoming');
    }) ?? null;
    set({ todayDoses: doses, nextDose: next });
  },

  // ── Dispenser ───────────────────────────────
  dispenser:     null,
  mqttConnected: false,
  mqttLog:       [],
  lastRfidRead:  null,

  setDispenser:     (dispenser) => set({ dispenser }),
  setMqttConnected: (mqttConnected) => set({ mqttConnected }),

  updateSensors: (status) =>
    set(state => {
      if (!state.dispenser) return state;
      return {
        dispenser: {
          ...state.dispenser,
          online:   status.online,
          firmware: status.firmware,
          lastSeen: new Date().toISOString(),
          sensors: {
            ...state.dispenser.sensors,
            humidity:    status.humidity,
            temperature: status.temperature,
          },
        },
      };
    }),

  setRfidRead: (payload) => set({ lastRfidRead: payload }),

  addMqttLog: (entry) =>
    set(state => {
      const newEntry: MqttLogEntry = {
        id:  Date.now().toString(),
        ts:  new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        ...entry,
      };
      // mantém apenas 100 entradas
      const log = [newEntry, ...state.mqttLog].slice(0, 100);
      return { mqttLog: log };
    }),

  // ── Alerts ──────────────────────────────────
  alerts:      [],
  unreadCount: 0,
  setAlerts: (alerts) =>
    set({ alerts, unreadCount: alerts.filter(a => !a.read).length }),
  addAlert: (alert) =>
    set(state => ({
      alerts:      [alert, ...state.alerts],
      unreadCount: state.unreadCount + (alert.read ? 0 : 1),
    })),
  markRead: (id) =>
    set(state => ({
      alerts: state.alerts.map(a =>
        a.id === id ? { ...a, read: true } : a
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  // ── UI ──────────────────────────────────────
  activeTab:    'home',
  setActiveTab: (activeTab) => set({ activeTab }),
}));

// ─── Selectors convenientes ───────────────────
export const selectUser       = (s: IasisStore) => s.user;
export const selectTodayDoses = (s: IasisStore) => s.todayDoses;
export const selectNextDose   = (s: IasisStore) => s.nextDose;
export const selectDispenser  = (s: IasisStore) => s.dispenser;
export const selectMqttLog    = (s: IasisStore) => s.mqttLog;
export const selectUnread     = (s: IasisStore) => s.unreadCount;
