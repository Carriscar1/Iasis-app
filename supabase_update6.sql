-- ═══════════════════════════════════════════════
--  IASIS — Atualização 6
--  O cuidador pode confirmar uma dose em nome do paciente.
--
--  A RLS de `doses` só dá leitura ao cuidador (doses_caregiver_read), então
--  a confirmação passa por esta função com privilégio, que valida o vínculo
--  antes de escrever. Fica registrada como validated_by = 'caregiver'.
-- ═══════════════════════════════════════════════

drop function if exists public.caregiver_mark_dose_taken(uuid);
create function public.caregiver_mark_dose_taken(p_dose uuid)
returns table (id uuid, status text, taken_at timestamptz, delay_minutes int)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner     uuid;
  v_scheduled timestamptz;
  v_status    text;
  v_delay     int;
  v_new       text;
begin
  select d.user_id, d.scheduled_at, d.status
    into v_owner, v_scheduled, v_status
  from public.doses d where d.id = p_dose;

  if v_owner is null then
    raise exception 'dose_not_found';
  end if;

  -- Só o cuidador vinculado a esse paciente pode confirmar.
  if not exists (
    select 1 from public.profiles p
    where p.id = v_owner and p.caregiver_id = auth.uid()
  ) then
    raise exception 'not_allowed';
  end if;

  if v_status in ('taken','late') then
    raise exception 'already_taken';
  end if;

  v_delay := greatest(0, round(extract(epoch from (now() - v_scheduled)) / 60)::int);
  v_new   := case when v_delay > 30 then 'late' else 'taken' end;

  return query
  update public.doses d
     set status        = v_new,
         taken_at      = now(),
         validated_by  = 'caregiver',
         delay_minutes = v_delay
   where d.id = p_dose
  returning d.id, d.status, d.taken_at, d.delay_minutes;
end;
$fn$;
grant execute on function public.caregiver_mark_dose_taken(uuid) to authenticated;
