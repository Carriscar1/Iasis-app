-- ═══════════════════════════════════════════════
--  IASIS — Migração 11
--  Cuidador do cadastro vira equipe de cuidado (e contato de emergência)
--
--  Execute no SQL Editor DEPOIS de supabase_update10.sql. É idempotente.
--
--  O paciente se cadastra informando o e-mail do cuidador, e isso grava
--  profiles.caregiver_id. Mas as ligações e avisos de emergência do app
--  vêm da equipe de cuidado (care_links, via list_care_team) — e a
--  migração 8 só copiou os vínculos que já existiam naquele dia. Paciente
--  novo ficava sem ninguém para ligar. Este gatilho cria o vínculo sempre
--  que caregiver_id é preenchido ou trocado.
-- ═══════════════════════════════════════════════

drop function if exists public.sync_caregiver_link() cascade;
create function public.sync_caregiver_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.caregiver_id is not null and new.caregiver_id <> new.id then
    insert into public.care_links (patient_id, caregiver_id)
    values (new.id, new.caregiver_id)
    on conflict (patient_id, caregiver_id) do nothing;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_sync_caregiver_link on public.profiles;
create trigger profiles_sync_caregiver_link
  after insert or update of caregiver_id on public.profiles
  for each row execute function public.sync_caregiver_link();

-- Quem se cadastrou depois da migração 8 e ficou sem vínculo.
insert into public.care_links (patient_id, caregiver_id)
select p.id, p.caregiver_id
  from public.profiles p
 where p.caregiver_id is not null
   and p.caregiver_id <> p.id
on conflict (patient_id, caregiver_id) do nothing;

-- Atualiza a lista de funções da API (delete_my_account e afins).
notify pgrst, 'reload schema';


-- ── Conferência ──────────────────────────────
select
  (select count(*) from pg_trigger where tgname = 'profiles_sync_caregiver_link') as tem_gatilho,
  (select count(*) from public.profiles p
     where p.caregiver_id is not null and p.caregiver_id <> p.id
       and not exists (select 1 from public.care_links l
                        where l.patient_id = p.id and l.caregiver_id = p.caregiver_id)) as sem_vinculo_deve_ser_0;
