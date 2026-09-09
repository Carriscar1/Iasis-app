-- ═══════════════════════════════════════════════
--  IASIS — Migração 9
--  Emergência: pedido de socorro e detecção de queda
--
--  Execute no SQL Editor DEPOIS de supabase_update8.sql. É idempotente.
-- ═══════════════════════════════════════════════

-- ── 1. Localização no alerta ──────────────────
alter table public.alerts add column if not exists latitude        double precision;
alter table public.alerts add column if not exists longitude       double precision;
alter table public.alerts add column if not exists accuracy_meters double precision;

-- ── 2. Novos tipos de alerta ──────────────────
-- 'emergency' = o paciente pediu socorro · 'fall' = o aparelho detectou queda
alter table public.alerts drop constraint if exists alerts_type_check;
alter table public.alerts
  add constraint alerts_type_check
  check (type in ('dose_missed','dose_taken','dispenser_offline',
                  'low_stock','emergency','fall','info'));

-- Emergência é sempre urgente: índice para a tela abrir já mostrando as
-- não lidas mais recentes sem varrer a tabela toda.
create index if not exists alerts_urgent_idx
  on public.alerts (user_id, created_at desc)
  where type in ('emergency','fall') and read = false;


-- ── 3. Acionar a emergência ───────────────────
/**
 * Cria um alerta de emergência para TODOS os cuidadores da equipe.
 *
 * Roda como SECURITY DEFINER porque o paciente não tem permissão de escrita
 * na caixa de alertas de outra pessoa — e nesse momento é exatamente isso
 * que precisa acontecer.
 *
 * Diferente dos outros alertas, aqui NÃO há deduplicação: se a pessoa
 * apertar o botão três vezes, os três avisos chegam. Um pedido de socorro
 * repetido é sinal, não ruído.
 */
drop function if exists public.raise_emergency(double precision, double precision, double precision, text);
create function public.raise_emergency(
  p_lat      double precision default null,
  p_lon      double precision default null,
  p_accuracy double precision default null,
  p_kind     text default 'emergency'      -- 'emergency' | 'fall'
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me      uuid := auth.uid();
  v_name    text;
  v_cg      uuid;
  v_count   int := 0;
  v_title   text;
  v_body    text;
  v_where   text;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if p_kind not in ('emergency', 'fall') then
    raise exception 'invalid_kind';
  end if;

  select name into v_name from public.profiles where id = v_me;

  -- A precisão entra no texto: quem vai socorrer precisa saber se o ponto
  -- aponta a casa ou o bairro antes de sair.
  v_where := case
    when p_lat is null then ' A localização não estava disponível.'
    when p_accuracy is null then ' Localização enviada.'
    else ' Localização com precisão de ' || round(p_accuracy::numeric) || ' m.'
  end;

  if p_kind = 'fall' then
    v_title := 'Possível queda detectada';
    v_body  := coalesce(v_name, 'O paciente') ||
               ' pode ter sofrido uma queda e não respondeu ao aviso do aplicativo.' ||
               v_where;
  else
    v_title := 'Pedido de socorro';
    v_body  := coalesce(v_name, 'O paciente') ||
               ' acionou a emergência pelo IASIS.' || v_where;
  end if;

  for v_cg in
    select distinct c from (
      select l.caregiver_id as c from public.care_links l where l.patient_id = v_me
      union
      select p.caregiver_id  from public.profiles p
       where p.id = v_me and p.caregiver_id is not null
    ) t
  loop
    insert into public.alerts
      (user_id, patient_id, type, title, body, latitude, longitude, accuracy_meters)
    values
      (v_cg, v_me, p_kind, v_title, v_body, p_lat, p_lon, p_accuracy);
    v_count := v_count + 1;
  end loop;

  return v_count;   -- quantos cuidadores foram avisados
end;
$fn$;

grant execute on function
  public.raise_emergency(double precision, double precision, double precision, text)
  to authenticated;


-- ── 4. Conferência ────────────────────────────
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'alerts'
       and column_name in ('latitude','longitude','accuracy_meters'))  as colunas_local,
  (select count(*) from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname = 'raise_emergency')                                as tem_rpc,
  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'alerts_urgent_idx')  as tem_indice;
