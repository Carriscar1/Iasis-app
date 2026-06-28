-- ═══════════════════════════════════════════════
--  IASIS — Atualização 2
--  Execute no SQL Editor do Supabase.
--  1) Permite buscar cuidador por e-mail durante o cadastro (anônimo)
--  2) Dá ao cuidador acesso de leitura aos pacientes vinculados
-- ═══════════════════════════════════════════════

-- ── 1. RPC: buscar cuidador por e-mail ──────────
-- Durante o cadastro o paciente ainda é anônimo, e a RLS de `profiles` só
-- deixa cada um ler o próprio perfil. Esta função SECURITY DEFINER roda com
-- privilégios elevados e só expõe id + nome de quem é cuidador.
drop function if exists public.find_caregiver_by_email(text);

create function public.find_caregiver_by_email(p_email text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name
  from public.profiles p
  where lower(p.email) = lower(trim(p_email))
    and p.role = 'caregiver'
  limit 1;
$$;

grant execute on function public.find_caregiver_by_email(text) to anon, authenticated;

-- ── 2. Cuidador lê os perfis dos pacientes vinculados ──
drop policy if exists profiles_caregiver_read on public.profiles;
create policy profiles_caregiver_read on public.profiles
  for select
  using (caregiver_id = auth.uid());

-- ── 3. Cuidador lê medicamentos/doses dos pacientes vinculados ──
drop policy if exists medications_caregiver_read on public.medications;
create policy medications_caregiver_read on public.medications
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = medications.user_id
        and p.caregiver_id = auth.uid()
    )
  );

drop policy if exists doses_caregiver_read on public.doses;
create policy doses_caregiver_read on public.doses
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = doses.user_id
        and p.caregiver_id = auth.uid()
    )
  );

-- (Opcional, para o cuidador também marcar doses como tomadas no futuro:)
-- drop policy if exists doses_caregiver_update on public.doses;
-- create policy doses_caregiver_update on public.doses
--   for update using (
--     exists (select 1 from public.profiles p
--             where p.id = doses.user_id and p.caregiver_id = auth.uid())
--   );
