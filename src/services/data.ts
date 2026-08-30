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
  stock:          r.stock ?? null,
  stockThreshold: r.stock_threshold ?? 5,
  unitsPerDose:   r.units_per_dose ?? 1,
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
  stock?:          number | null;   // null/undefined = não controla estoque
  stockThreshold?: number;
  unitsPerDose?:   number;
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
      stock:           input.stock ?? null,
      stock_threshold: input.stockThreshold ?? 5,
      units_per_dose:  input.unitsPerDose ?? 1,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: rowToMedication(data), error: null };
};

export const updateMedication = async (
  id: string,
  patch: Partial<NewMedication>
): Promise<{ data: Medication | null; error: string | null }> => {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined)         row.name         = patch.name.trim();
  if (patch.dosage !== undefined)       row.dosage       = patch.dosage.trim();
  if (patch.form !== undefined)         row.form         = patch.form;
  if (patch.compartment !== undefined)  row.compartment  = patch.compartment;
  if (patch.instructions !== undefined) row.instructions = patch.instructions?.trim() || null;
  if (patch.color !== undefined)        row.color        = patch.color ?? null;
  if (patch.stock !== undefined)          row.stock           = patch.stock;
  if (patch.stockThreshold !== undefined) row.stock_threshold = patch.stockThreshold;
  if (patch.unitsPerDose !== undefined)   row.units_per_dose  = patch.unitsPerDose;

  const { data, error } = await supabase
    .from('medications')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: rowToMedication(data), error: null };
};

// ── Renovar tratamento ────────────────────────
// Descobre os horários que o tratamento já usava (pelas doses existentes) e
// gera novas doses para os próximos N dias, começando no dia seguinte à
// última dose agendada. Não duplica: pula horários que já existem.
export interface RenewResult {
  created:   number;
  times:     string[];   // ex: ['08:00', '20:00']
  startsAt:  string | null;
}

export const renewTreatment = async (
  userId: string,
  medicationId: string,
  days: number
): Promise<{ data: RenewResult; error: string | null }> => {
  const empty: RenewResult = { created: 0, times: [], startsAt: null };

  // Últimas doses desse medicamento para inferir os horários e o fim atual.
  const { data: rows, error } = await supabase
    .from('doses')
    .select('scheduled_at')
    .eq('user_id', userId)
    .eq('medication_id', medicationId)
    .order('scheduled_at', { ascending: false })
    .limit(60);

  if (error) return { data: empty, error: error.message };
  if (!rows || rows.length === 0) {
    return { data: empty, error: 'Este remédio ainda não tem horários. Crie um tratamento primeiro.' };
  }

  // Horários distintos (hh:mm), na ordem do dia.
  const timeSet = new Set<string>();
  for (const r of rows) {
    const d = new Date(r.scheduled_at);
    timeSet.add(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }
  const times = Array.from(timeSet).sort();

  // Recomeça no dia seguinte à última dose (ou amanhã, se já passou).
  const last = new Date(rows[0].scheduled_at);
  const start = new Date(Math.max(last.getTime(), Date.now()));
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const existing = new Set(rows.map((r) => new Date(r.scheduled_at).toISOString()));
  const list: string[] = [];
  for (let day = 0; day < days; day++) {
    for (const t of times) {
      const [hh, mm] = t.split(':').map(Number);
      const when = new Date(start);
      when.setDate(start.getDate() + day);
      when.setHours(hh, mm, 0, 0);
      const iso = when.toISOString();
      if (!existing.has(iso)) list.push(iso);
    }
  }

  if (list.length === 0) return { data: { created: 0, times, startsAt: null }, error: null };

  const { error: insErr } = await createDosesBulk(userId, medicationId, list);
  if (insErr) return { data: empty, error: insErr };

  return {
    data: { created: list.length, times, startsAt: list[0] },
    error: null,
  };
};

// ── Estoque ───────────────────────────────────
// Repõe unidades e limpa o aviso de "acabando" (RPC verifica o dono).
export const restockMedication = async (
  medicationId: string,
  amount: number
): Promise<{ stock: number | null; error: string | null }> => {
  const { data, error } = await supabase.rpc('restock_medication', {
    p_medication: medicationId,
    p_amount: amount,
  });
  if (error) return { stock: null, error: error.message };
  return { stock: typeof data === 'number' ? data : null, error: null };
};

// Quantos dias o estoque ainda cobre, dado quantas doses são tomadas por dia.
// Retorna null quando não há controle de estoque ou nenhuma dose agendada.
export const estimateDaysLeft = (
  med: Medication,
  dosesPerDay: number
): number | null => {
  if (med.stock == null || dosesPerDay <= 0) return null;
  const perDay = dosesPerDay * (med.unitsPerDose ?? 1);
  return Math.floor(med.stock / perDay);
};

// Quantas doses por dia estão agendadas para cada medicamento (média dos
// próximos 7 dias) — usado para estimar a duração do estoque.
export const getDosesPerDay = async (
  userId: string
): Promise<{ data: Record<string, number>; error: string | null }> => {
  const from = new Date();
  const to   = new Date(); to.setDate(to.getDate() + 7);
  const { data, error } = await supabase
    .from('doses')
    .select('medication_id, scheduled_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString());

  if (error) return { data: {}, error: error.message };

  const days = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const id = r.medication_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const day = new Date(r.scheduled_at).toISOString().slice(0, 10);
    if (!days.has(id)) days.set(id, new Set());
    days.get(id)!.add(day);
  }

  const out: Record<string, number> = {};
  counts.forEach((total, id) => {
    const nDays = days.get(id)?.size ?? 1;
    out[id] = total / Math.max(1, nDays);
  });
  return { data: out, error: null };
};

// Exclui o medicamento limpando antes as doses FUTURAS ainda não tomadas.
// O histórico (doses já tomadas/perdidas) é preservado.
export const deleteMedication = async (
  id: string
): Promise<{ error: string | null }> => {
  await supabase
    .from('doses')
    .delete()
    .eq('medication_id', id)
    .eq('status', 'pending')
    .gte('scheduled_at', new Date().toISOString());
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

// Cria várias doses de uma vez (tratamento recorrente: N dias × M horários).
// Retorna as doses criadas em ordem cronológica.
export const createDosesBulk = async (
  userId: string,
  medicationId: string,
  scheduledAtList: string[], // ISO strings
  notes?: string
): Promise<{ data: Dose[]; error: string | null }> => {
  if (scheduledAtList.length === 0) return { data: [], error: null };
  const rows = scheduledAtList.map((iso) => ({
    user_id:       userId,
    medication_id: medicationId,
    scheduled_at:  iso,
    status:        'pending',
    notes:         notes?.trim() || null,
  }));
  const { data, error } = await supabase
    .from('doses')
    .insert(rows)
    .select('*, medications(*)');
  if (error) return { data: [], error: error.message };
  const doses = (data ?? []).map(rowToDose)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return { data: doses, error: null };
};

// Marca como 'missed' as doses pendentes vencidas há mais de 60 min.
// Usa a RPC `sync_overdue_doses` (SECURITY DEFINER) para cobrir também os
// pacientes vinculados — o cuidador não tem permissão de escrita direta nas
// doses deles. Ao marcar, o gatilho do banco cria o alerta para o cuidador.
export const syncOverdueDoses = async (
  _userId?: string
): Promise<{ error: string | null }> => {
  const { error } = await supabase.rpc('sync_overdue_doses');
  return { error: error?.message ?? null };
};

// Dose "da vez" para validação por RFID: a mais antiga entre as que estão
// no horário (janela de -60min a +15min). É ela que o dispenser libera.
export const findDoseAwaitingValidation = async (
  userId: string
): Promise<{ data: Dose | null; error: string | null }> => {
  const from = new Date(Date.now() - 60 * 60000).toISOString();
  const to   = new Date(Date.now() + 15 * 60000).toISOString();
  const { data, error } = await supabase
    .from('doses')
    .select('*, medications(*)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data ? rowToDose(data) : null, error: null };
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

// O cuidador confirma uma dose em nome do paciente. Passa por RPC porque a
// RLS de `doses` só dá leitura ao cuidador; a função valida o vínculo antes
// de gravar e registra validated_by = 'caregiver'.
export const caregiverMarkDoseTaken = async (
  doseId: string
): Promise<{ error: string | null }> => {
  const { error } = await supabase.rpc('caregiver_mark_dose_taken', { p_dose: doseId });
  if (!error) return { error: null };
  const msg = error.message ?? '';
  if (msg.includes('already_taken'))  return { error: 'Esta dose já foi confirmada.' };
  if (msg.includes('not_allowed'))    return { error: 'Você não é o cuidador deste paciente.' };
  if (msg.includes('dose_not_found')) return { error: 'Dose não encontrada.' };
  return { error: msg };
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

// Sequência de dias seguidos com 100% das doses tomadas (para a Home).
// Dias sem nenhuma dose não quebram nem contam. Hoje, se ainda estiver em
// andamento (sem perdidas), não quebra a sequência — só ainda não soma.
// ── Insights de adesão (para os gráficos de relatório) ─────────
// Complementa getAdherence com dois recortes que revelam padrões:
//   · byHour    — em quais horários a pessoa mais falha
//   · byWeekday — em quais dias da semana a adesão cai
export interface AdherenceInsights {
  byHour:    { hour: number; total: number; taken: number }[];
  byWeekday: { weekday: number; total: number; taken: number }[];
  worstHour: { hour: number; rate: number } | null;
  bestHour:  { hour: number; rate: number } | null;
}

export const getAdherenceInsights = async (
  userId: string,
  days = 30
): Promise<{ data: AdherenceInsights; error: string | null }> => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const { data, error } = await supabase
    .from('doses')
    .select('scheduled_at, status')
    .eq('user_id', userId)
    .gte('scheduled_at', start.toISOString());

  const empty: AdherenceInsights = { byHour: [], byWeekday: [], worstHour: null, bestHour: null };
  if (error) return { data: empty, error: error.message };

  const hours    = new Map<number, { total: number; taken: number }>();
  const weekdays = new Map<number, { total: number; taken: number }>();
  for (let d = 0; d < 7; d++) weekdays.set(d, { total: 0, taken: 0 });

  for (const r of data ?? []) {
    // Só conta doses cujo horário já passou (pendentes futuras distorceriam).
    if (r.status !== 'taken' && r.status !== 'late' && r.status !== 'missed') continue;
    const dt      = new Date(r.scheduled_at);
    const isTaken = r.status === 'taken' || r.status === 'late';

    const h = dt.getHours();
    const hb = hours.get(h) ?? { total: 0, taken: 0 };
    hb.total++; if (isTaken) hb.taken++;
    hours.set(h, hb);

    const w = dt.getDay();
    const wb = weekdays.get(w)!;
    wb.total++; if (isTaken) wb.taken++;
  }

  const byHour = Array.from(hours.entries())
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => a.hour - b.hour);

  // Considera só horários com amostra mínima, para não eleger um outlier.
  const ranked = byHour
    .filter((h) => h.total >= 2)
    .map((h) => ({ hour: h.hour, rate: Math.round((h.taken / h.total) * 100) }))
    .sort((a, b) => a.rate - b.rate);

  return {
    data: {
      byHour,
      byWeekday: Array.from(weekdays.entries()).map(([weekday, v]) => ({ weekday, ...v })),
      worstHour: ranked.length ? ranked[0] : null,
      bestHour:  ranked.length ? ranked[ranked.length - 1] : null,
    },
    error: null,
  };
};

export const computeStreak = (byDay: AdherenceSummary['byDay']): number => {
  let streak = 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  for (let i = byDay.length - 1; i >= 0; i--) {
    const d = byDay[i];
    if (d.total === 0) continue;               // dia vazio: neutro
    if (d.taken === d.total) { streak++; continue; }
    if (d.date === todayKey && d.missed === 0) continue; // hoje em andamento
    break;
  }
  return streak;
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
