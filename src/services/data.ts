import { supabase } from './supabase';
import type { Medication, Dose, DoseStatus, MedForm } from '../types';

// ─────────────────────────────────────────────
//  IASIS — Camada de dados (CRUD real no Supabase)
//  Mapeia colunas snake_case do banco <-> tipos camelCase do app.
// ─────────────────────────────────────────────

// ── Mapeadores ────────────────────────────────
const rowToMedication = (r: any): Medication => ({
  id:           r.id,
  userId:       r.user_id,
  name:         r.name,
  dosage:       r.dosage,
  form:         (r.form ?? 'comprimido') as MedForm,
  compartment:  r.compartment ?? 1,
  instructions: r.instructions ?? undefined,
  color:        r.color ?? undefined,
});

const rowToDose = (r: any): Dose => ({
  id:           r.id,
  medicationId: r.medication_id,
  medication:   r.medications ? rowToMedication(r.medications) : undefined,
  userId:       r.user_id,
  scheduledAt:  r.scheduled_at,
  status:       r.status as DoseStatus,
  takenAt:      r.taken_at ?? undefined,
  validatedBy:  r.validated_by ?? undefined,
  delayMinutes: r.delay_minutes ?? 0,
  notes:        r.notes ?? undefined,
});

// ── Medicamentos ──────────────────────────────
export interface NewMedication {
  name:          string;
  dosage:        string;
  form?:         MedForm;
  compartment?:  number;
  instructions?: string;
  color?:        string;
}

export const listMedications = async (
  userId: string
): Promise<{ data: Medication[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(rowToMedication), error: null };
};

export const createMedication = async (
  userId: string,
  input: NewMedication
): Promise<{ data: Medication | null; error: string | null }> => {
  const { data, error } = await supabase
    .from('medications')
    .insert({
      user_id:      userId,
      name:         input.name.trim(),
      dosage:       input.dosage.trim(),
      form:         input.form ?? 'comprimido',
      compartment:  input.compartment ?? 1,
      instructions: input.instructions?.trim() || null,
      color:        input.color ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: rowToMedication(data), error: null };
};

export const deleteMedication = async (
  id: string
): Promise<{ error: string | null }> => {
  const { error } = await supabase.from('medications').delete().eq('id', id);
  return { error: error?.message ?? null };
};

// ── Doses ─────────────────────────────────────
export interface NewDose {
  medicationId: string;
  scheduledAt:  string; // ISO
  notes?:       string;
}

export const createDose = async (
  userId: string,
  input: NewDose
): Promise<{ data: Dose | null; error: string | null }> => {
  const { data, error } = await supabase
    .from('doses')
    .insert({
      user_id:       userId,
      medication_id: input.medicationId,
      scheduled_at:  input.scheduledAt,
      status:        'pending',
      notes:         input.notes?.trim() || null,
    })
    .select('*, medications(*)')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: rowToDose(data), error: null };
};

// Lista doses de um dia (00:00 a 23:59 local) com o medicamento embutido.
export const listDosesForDay = async (
  userId: string,
  day: Date = new Date()
): Promise<{ data: Dose[]; error: string | null }> => {
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end   = new Date(day); end.setHours(23, 59, 59, 999);
  const { data, error } = await supabase
    .from('doses')
    .select('*, medications(*)')
    .eq('user_id', userId)
    .gte('scheduled_at', start.toISOString())
    .lte('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(rowToDose), error: null };
};

export const markDoseTaken = async (
  id: string,
  validatedBy: 'rfid' | 'manual' | 'caregiver' = 'manual',
  scheduledAt?: string
): Promise<{ data: Dose | null; error: string | null }> => {
  const now = new Date();
  let status: DoseStatus = 'taken';
  let delay = 0;
  if (scheduledAt) {
    delay = Math.round((now.getTime() - new Date(scheduledAt).getTime()) / 60000);
    if (delay > 30) status = 'late';
    if (delay < 0) delay = 0;
  }
  const { data, error } = await supabase
    .from('doses')
    .update({
      status,
      taken_at:      now.toISOString(),
      validated_by:  validatedBy,
      delay_minutes: delay,
    })
    .eq('id', id)
    .select('*, medications(*)')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: rowToDose(data), error: null };
};

export const deleteDose = async (id: string): Promise<{ error: string | null }> => {
  const { error } = await supabase.from('doses').delete().eq('id', id);
  return { error: error?.message ?? null };
};

// Marca como perdidas as doses vencidas (passou >60min e ainda pendentes).
export const computeLiveStatus = (dose: Dose): DoseStatus => {
  if (dose.status === 'taken' || dose.status === 'late' || dose.status === 'missed') {
    return dose.status;
  }
  const diffMin = (new Date(dose.scheduledAt).getTime() - Date.now()) / 60000;
  if (diffMin < -60) return 'missed';
  if (diffMin <= 0)  return 'due';
  if (diffMin <= 60) return 'upcoming';
  return 'pending';
};

// Doses recentes (linha do tempo do histórico), mais novas primeiro.
export const listRecentDoses = async (
  userId: string,
  limit = 30
): Promise<{ data: Dose[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('doses')
    .select('*, medications(*)')
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(rowToDose), error: null };
};

// ── Aderência (para o histórico/relatório) ────
export interface AdherenceSummary {
  total:      number;
  taken:      number;   // tomadas (no horário + atraso)
  late:       number;
  missed:     number;
  percentage: number;
  byDay:      { date: string; total: number; taken: number; missed: number }[];
}

export const getAdherence = async (
  userId: string,
  days = 7
): Promise<{ data: AdherenceSummary; error: string | null }> => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const { data, error } = await supabase
    .from('doses')
    .select('scheduled_at, status')
    .eq('user_id', userId)
    .gte('scheduled_at', start.toISOString())
    .order('scheduled_at', { ascending: true });

  const empty: AdherenceSummary = { total: 0, taken: 0, late: 0, missed: 0, percentage: 0, byDay: [] };
  if (error) return { data: empty, error: error.message };

  const rows = data ?? [];
  const byDayMap = new Map<string, { total: number; taken: number; missed: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    byDayMap.set(d.toISOString().slice(0, 10), { total: 0, taken: 0, missed: 0 });
  }

  let taken = 0, late = 0, missed = 0;
  for (const r of rows) {
    const key = new Date(r.scheduled_at).toISOString().slice(0, 10);
    const bucket = byDayMap.get(key);
    const isTaken = r.status === 'taken' || r.status === 'late';
    const isMissed = r.status === 'missed';
    if (r.status === 'late') late++;
    if (isTaken) taken++;
    if (isMissed) missed++;
    if (bucket) {
      bucket.total++;
      if (isTaken) bucket.taken++;
      if (isMissed) bucket.missed++;
    }
  }

  const total = rows.length;
  return {
    data: {
      total,
      taken,
      late,
      missed,
      percentage: total ? Math.round((taken / total) * 100) : 0,
      byDay: Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v })),
    },
    error: null,
  };
};

// ── Cuidador: pacientes vinculados ────────────
// Depende das policies de supabase_update2.sql (profiles_caregiver_read,
// medications_caregiver_read, doses_caregiver_read). Sem elas, retorna vazio.
export interface PatientProfile {
  id:       string;
  name:     string;
  email:    string;
  rfidTag?: string;
}

export const listPatients = async (
  caregiverId: string
): Promise<{ data: PatientProfile[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, rfid_tag')
    .eq('caregiver_id', caregiverId)
    .order('name', { ascending: true });
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r: any) => ({
      id: r.id, name: r.name, email: r.email, rfidTag: r.rfid_tag ?? undefined,
    })),
    error: null,
  };
};

export interface PatientOverview {
  patient:   PatientProfile;
  today:     Dose[];               // doses de hoje com status "ao vivo"
  adherence: AdherenceSummary;     // últimos 7 dias
}

// Carrega, para cada paciente vinculado, as doses de hoje e a adesão de 7 dias.
export const getPatientsOverview = async (
  caregiverId: string
): Promise<{ data: PatientOverview[]; error: string | null }> => {
  const { data: patients, error } = await listPatients(caregiverId);
  if (error) return { data: [], error };

  const result = await Promise.all(
    patients.map(async (p) => {
      const [todayRes, adhRes] = await Promise.all([
        listDosesForDay(p.id),
        getAdherence(p.id, 7),
      ]);
      return {
        patient:   p,
        today:     todayRes.data.map((d) => ({ ...d, status: computeLiveStatus(d) })),
        adherence: adhRes.data,
      };
    })
  );
  return { data: result, error: null };
};
