-- ═══════════════════════════════════════════════
--  IASIS — Migração 13
--  Tempo real para alertas e mensagens
--
--  Execute no SQL Editor DEPOIS de supabase_update12.sql. É idempotente.
--
--  O app do cuidador escuta novos alertas (queda, socorro, dose perdida) e
--  mensagens pelo Realtime do Supabase. Mas o Realtime só transmite as
--  tabelas que estão na publicação supabase_realtime — e nenhuma migração
--  colocava alerts e messages lá. Resultado: o aviso de queda era gravado,
--  mas o celular do cuidador nunca ficava sabendo na hora.
-- ═══════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
  ) then
    alter publication supabase_realtime add table public.alerts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;


-- ── Conferência ──────────────────────────────
-- Esperado: alerts e messages na lista.
select tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
 order by tablename;
