-- ═══════════════════════════════════════════════
--  IASIS — Migração 10
--  Excluir a própria conta pelo aplicativo
--
--  Execute no SQL Editor DEPOIS de supabase_update9.sql. É idempotente.
--
--  Apagar o usuário em auth.users leva tudo junto: profiles tem
--  "on delete cascade" para auth.users, e remédios, doses, alertas,
--  mensagens e vínculos de cuidado têm cascade para profiles. Pacientes
--  que tinham esta pessoa como cuidador ficam com caregiver_id nulo
--  (on delete set null) — a conta deles continua.
-- ═══════════════════════════════════════════════

drop function if exists public.delete_my_account();
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  -- Código de ativação da loja usado por esta conta: solta o vínculo para o
  -- código não impedir a exclusão (a tabela vem do site, e pode não existir).
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'access_codes' and column_name = 'redeemed_by'
  ) then
    execute 'update public.access_codes set redeemed_by = null where redeemed_by = $1' using v_me;
  end if;

  delete from auth.users where id = v_me;
end;
$fn$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;


-- ── Conferência ──────────────────────────────
select count(*) as tem_rpc
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'delete_my_account';
