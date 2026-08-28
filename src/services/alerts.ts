// ─────────────────────────────────────────────
//  IASIS — Alertas para o cuidador
//
//  Quando uma dose vira 'missed', um GATILHO no banco cria o alerta para o
//  cuidador vinculado (supabase_update4.sql). Aqui o app apenas lê, escuta
//  em tempo real e marca como lido.
// ─────────────────────────────────────────────
import { supabase } from './supabase';

export type AlertType = 'dose_missed' | 'dose_taken' | 'dispenser_offline' | 'info';

export interface AppAlert {
  id:        string;
  userId:    string;
  patientId: string | null;
  doseId:    string | null;
  type:      AlertType;
  title:     string;
  body:      string;
  read:      boolean;
  createdAt: string;
}

const mapRow = (r: any): AppAlert => ({
  id:        r.id,
  userId:    r.user_id,
  patientId: r.patient_id ?? null,
  doseId:    r.dose_id ?? null,
  type:      r.type,
  title:     r.title,
  body:      r.body,
  read:      r.read,
  createdAt: r.created_at,
});

// ── Listar alertas recebidos ──────────────────
export const listAlerts = async (
  userId: string,
  limit = 100
): Promise<{ data: AppAlert[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapRow), error: null };
};

// ── Quantos não lidos ─────────────────────────
export const countUnreadAlerts = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return error ? 0 : (count ?? 0);
};

// ── Marcar como lido ──────────────────────────
export const markAlertRead = async (alertId: string): Promise<void> => {
  await supabase.from('alerts').update({ read: true }).eq('id', alertId);
};

export const markAllAlertsRead = async (userId: string): Promise<void> => {
  await supabase.from('alerts').update({ read: true }).eq('user_id', userId).eq('read', false);
};

// ── Apagar ────────────────────────────────────
export const deleteAlert = async (alertId: string): Promise<void> => {
  await supabase.from('alerts').delete().eq('id', alertId);
};

// ── Tempo real: novos alertas para mim ────────
// Devolve uma função para cancelar a inscrição.
export const subscribeToAlerts = (
  userId: string,
  onAlert: (a: AppAlert) => void
): (() => void) => {
  const channel = supabase
    .channel(`alerts:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${userId}` },
      (payload) => onAlert(mapRow(payload.new))
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

// ── Sincronizar doses vencidas ────────────────
// Marca como 'missed' as doses pendentes vencidas há mais de 60 min —
// minhas e as dos pacientes vinculados a mim. É isso que dispara o alerta.
// Retorna quantas doses foram marcadas.
export const syncOverdueDoses = async (): Promise<{ count: number; error: string | null }> => {
  const { data, error } = await supabase.rpc('sync_overdue_doses');
  if (error) return { count: 0, error: error.message };
  return { count: typeof data === 'number' ? data : 0, error: null };
};
