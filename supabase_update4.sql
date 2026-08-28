-- ═══════════════════════════════════════════════
--  IASIS — Atualização 4
--  Alerta automático para o cuidador quando o paciente perde uma dose.
--
--  A detecção é feita por GATILHO no banco: qualquer caminho que marque
--  a dose como 'missed' (app do paciente, app do cuidador ou a RPC de
--  sincronização) dispara o alerta. Não depende do paciente abrir o app.
-- ═══════════════════════════════════════════════

-- ── 1. Caixa de alertas ─────────────────────────
create table if not exists public.alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade, -- quem recebe
  patient_id uuid references public.profiles(id) on delete cascade,          -- sobre quem é
  dose_id    uuid references public.doses(id) on delete cascade,
  type       text not null default 'dose_missed'
               check (type in ('dose_missed','dose_taken','dispenser_offline','info')),
  title      text not null,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists alerts_user_unread_idx
  on public.alerts (user_id, read, created_at desc);

-- Um alerta por dose/tipo: evita repetir se a dose oscilar de status.
create unique index if not exists alerts_dose_type_key
  on public.alerts (dose_id, type) where dose_id is not null;

alter table public.alerts enable row level security;

drop policy if exists alerts_read on public.alerts;
create policy alerts_read on public.alerts
  for select using (auth.uid() = user_id);

drop policy if exists alerts_mark_read on public.alerts;
create policy alerts_mark_read on public.alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts
  for delete using (auth.uid() = user_id);

-- ── 2. Gatilho: dose vira 'missed' → alerta ─────
create or replace function public.notify_missed_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_caregiver uuid;
  v_patient   text;
  v_med       text;
  v_hora      text;
begin
  -- Só quando ENTRA no estado 'missed'.
  if new.status <> 'missed' or old.status is not distinct from 'missed' then
    return new;
  end if;

  select p.caregiver_id, p.name into v_caregiver, v_patient
  from public.profiles p where p.id = new.user_id;

  if v_caregiver is null then
    return new;   -- paciente sem cuidador vinculado
  end if;

  select m.name || ' ' || m.dosage into v_med
  from public.medications m where m.id = new.medication_id;

  v_hora := to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI');

  insert into public.alerts (user_id, patient_id, dose_id, type, title, body)
  values (
    v_caregiver,
    new.user_id,
    new.id,
    'dose_missed',
    'Dose perdida',
    coalesce(v_patient, 'O paciente') || ' não tomou ' ||
      coalesce(v_med, 'o medicamento') || ' das ' || v_hora || '.'
  )
  -- O índice é parcial: o predicado precisa entrar na inferência do ON CONFLICT.
  on conflict (dose_id, type) where dose_id is not null do nothing;

  return new;
end;
$fn$;

drop trigger if exists doses_missed_alert on public.doses;
create trigger doses_missed_alert
  after update of status on public.doses
  for each row execute function public.notify_missed_dose();

-- ── 3. Sincronizar doses vencidas ───────────────
-- O cuidador não pode escrever nas doses do paciente (RLS). Esta função
-- roda com privilégio e cobre: eu mesmo + os pacientes vinculados a mim.
-- Ao marcar 'missed', o gatilho acima cria o alerta.
drop function if exists public.sync_overdue_doses();
create function public.sync_overdue_doses()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int;
begin
  update public.doses d
     set status = 'missed'
   where d.status = 'pending'
     and d.scheduled_at < now() - interval '60 minutes'
     and (
       d.user_id = auth.uid()
       or exists (
         select 1 from public.profiles p
         where p.id = d.user_id and p.caregiver_id = auth.uid()
       )
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;
grant execute on function public.sync_overdue_doses() to authenticated;
