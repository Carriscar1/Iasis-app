// ─────────────────────────────────────────────
//  IASIS — Tipos globais do sistema
// ─────────────────────────────────────────────

// ── Usuário ───────────────────────────────────
export interface User {
  uid:        string;
  name:       string;
  email:      string;
  role:       'patient' | 'caregiver';
  rfidTag?:   string;           // tag da pulseira física
  linkedTo?:  string[];         // pacientes vinculados (cuidador)
  createdAt:  string;
}

// ── Medicamento ───────────────────────────────
export interface Medication {
  id:           string;
  userId:       string;
  name:         string;
  dosage:       string;         // ex: "50mg"
  form:         MedForm;
  compartment:  number;         // slot físico no dispenser (1-8)
  instructions?: string;        // ex: "Tomar com água"
  color?:       string;         // cor visual no app
}

export type MedForm = 'comprimido' | 'cápsula' | 'líquido' | 'outro';

// ── Dose agendada ──────────────────────────────
export interface Dose {
  id:           string;
  medicationId: string;
  medication?:  Medication;     // populated on fetch
  userId:       string;
  scheduledAt:  string;         // ISO date string
  status:       DoseStatus;
  takenAt?:     string;         // quando foi de fato validada
  validatedBy?:  'rfid' | 'manual' | 'caregiver';
  dispensedBy?: 'motor' | 'manual';
  delayMinutes?: number;        // minutos de atraso
  notes?:       string;
}

export type DoseStatus =
  | 'pending'       // aguardando horário
  | 'upcoming'      // próxima (< 60 min)
  | 'due'           // no horário, aguardando RFID
  | 'taken'         // tomada e validada
  | 'late'          // tomada com atraso
  | 'missed';       // não tomada

// ── Dispenser ─────────────────────────────────
export interface Dispenser {
  id:           string;
  userId:       string;
  name:         string;         // ex: "IASIS-01"
  mqttTopic:    string;         // ex: "iasis/dispenser/01"
  online:       boolean;
  lastSeen?:    string;
  firmware?:    string;
  sensors: {
    humidity:     number;       // DHT22 %
    temperature:  number;       // DHT22 °C
    batteryLevel?: number;
  };
  rfid: {
    lastRead?:    string;       // último tag lido
    lastReadAt?:  string;
  };
  compartments:  CompartmentStatus[];
}

export interface CompartmentStatus {
  slot:     number;           // 1-8
  empty:    boolean;
  doseCount?: number;
  medication?: string;        // nome
}

// ── Pulseira ──────────────────────────────────
export interface Wristband {
  id:           string;
  userId:       string;
  rfidTag:      string;
  isVibrating:  boolean;
  battery?:     number;
  lastSync?:    string;
}

// ── Alertas / Notificações ────────────────────
export interface Alert {
  id:       string;
  userId:   string;
  type:     AlertType;
  title:    string;
  body:     string;
  doseId?:  string;
  read:     boolean;
  createdAt: string;
}

export type AlertType =
  | 'dose_due'
  | 'dose_missed'
  | 'dose_taken'
  | 'dispenser_offline'
  | 'low_medication'
  | 'humidity_alert'
  | 'rfid_invalid';

// ── MQTT Payloads do ESP32 ────────────────────
export interface MqttStatusPayload {
  type:        'STATUS';
  online:      boolean;
  humidity:    number;
  temperature: number;
  firmware:    string;
  uptime:      number;         // segundos
}

export interface MqttRfidPayload {
  type:    'RFID_READ';
  tag:     string;
  valid:   boolean;
  doseId?: string;
}

export interface MqttDispensePayload {
  type:        'DISPENSE_ACK';
  slot:        number;
  doseId:      string;
  success:     boolean;
  errorCode?:  string;
}

export interface MqttVibratePayload {
  type:    'VIBRATE';
  active:  boolean;
  pattern?: 'sos' | 'gentle' | 'urgent';
}

export interface MqttCommandPayload {
  type:    'CMD';
  command: 'DISPENSE' | 'VIBRATE_ON' | 'VIBRATE_OFF' | 'RESTART' | 'STATUS_REQ';
  slot?:   number;
  doseId?: string;
}

export type MqttPayload =
  | MqttStatusPayload
  | MqttRfidPayload
  | MqttDispensePayload
  | MqttVibratePayload;

// ── Estatísticas ──────────────────────────────
export interface AdherenceStats {
  period:        'week' | 'month' | '3months';
  totalDoses:    number;
  takenOnTime:   number;
  takenLate:     number;
  missed:        number;
  percentage:    number;
  dailyData:     DailyAdherence[];
}

export interface DailyAdherence {
  date:    string;
  total:   number;
  taken:   number;
  missed:  number;
}

// ── Navegação ─────────────────────────────────
export type RootStackParamList = {
  '(auth)':     undefined;
  '(tabs)':     undefined;
};

export type AuthStackParamList = {
  Login:    undefined;
  Register: undefined;
};

export type TabParamList = {
  Home:     undefined;
  Schedule: undefined;
  Device:   undefined;
  History:  undefined;
  Profile:  undefined;
};
