-- ═══════════════════════════════════════════════
--  IASIS — Migração 12
--  Achar o cuidador pelo e-mail mesmo se ele escolheu "Uso independente"
--
--  Execute no SQL Editor DEPOIS de supabase_update11.sql. É idempotente.
--
--  No cadastro do paciente, o cuidador é buscado pelo e-mail. A busca só
--  aceitava contas do tipo "cuidador", e quem se cadastrou como "uso
--  independente" (cuida dos próprios remédios e também de alguém) dava
--  "cuidador não encontrado".
-- ═══════════════════════════════════════════════

create or replace function public.find_caregiver_by_email(p_email text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name
    from public.profiles p
   where lower(p.email) = lower(trim(p_email))
     and p.role in ('caregiver', 'independent')
   limit 1;
$$;

grant execute on function public.find_caregiver_by_email(text) to anon, authenticated;

notify pgrst, 'reload schema';
