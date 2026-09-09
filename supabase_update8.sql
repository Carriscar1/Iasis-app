-- ═══════════════════════════════════════════════
--  IASIS — Migração 8
--  Vários cuidadores por paciente
--
--  Até aqui o vínculo era um campo só (profiles.caregiver_id), o que
--  permitia exatamente um cuidador. Na vida real quem cuida de um idoso
--  costuma ser mais de uma pessoa: filho, filha, cônjuge, enfermeira. Esta
--  migração troca o campo por uma tabela de vínculos.
--
--  A coluna antiga NÃO é removida: ela continua sendo preenchida pelo
--  cadastro atual e é lida como reserva nas funções abaixo, para o app
--  antigo instalado em algum aparelho não parar de funcionar de um dia
--  para o outro.
--
--  Execute no SQL Editor DEPOIS de supabase_update7.sql. É idempotente.
-- ═══════════════════════════════════════════════

-- ── 1. Tabela de vínculos ─────────────────────
create table if not exists public.care_links (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  relation     text,                       -- "filha", "esposo", "enfermeira"…
  created_at   timestamptz default now(),
  -- Unicidade simples (sem predicado) para o ON CONFLICT inferir direto.
  constraint care_links_unique unique (patient_id, caregiver_id),
  -- Ninguém cuida de si mesmo: isso criaria laço nas consultas de vínculo.
  constraint care_links_not_self check (patient_id <> caregiver_id)
);

create index if not exists care_links_patient_idx   on public.care_links (patient_id);
create index if not exists care_links_caregiver_idx on public.care_links (caregiver_id);

alter table public.care_links enable row level security;

-- Enxerga o vínculo quem está nele — de qualquer um dos dois lados.
drop policy if exists care_links_read on public.care_links;
create policy care_links_read on public.care_links
  for select to authenticated
  using (auth.uid() = patient_id or auth.uid() = caregiver_id);

-- A criação passa pela RPC add_care_link (valida quem é quem).
-- Desfazer o vínculo, porém, qualquer um dos dois lados pode.
drop policy if exists care_links_delete on public.care_links;
create policy care_links_delete on public.care_links
  for delete to authenticated
  using (auth.uid() = patient_id or auth.uid() = caregiver_id);


-- ── 2. Trazer os vínculos que já existiam ─────
insert into public.care_links (patient_id, caregiver_id)
select p.id, p.caregiver_id
from public.profiles p
where p.caregiver_id is not null
  and p.caregiver_id <> p.id
on conflict (patient_id, caregiver_id) do nothing;


-- ── 3. Um alerta POR cuidador ─────────────────
-- O índice antigo era único por (dose_id, type). Com vários cuidadores isso
-- passaria a ser um bug silencioso: o primeiro alerta gravado bloquearia os
-- demais e só um cuidador ficaria sabendo da dose perdida. O destinatário
-- precisa entrar na chave.
drop index if exists public.alerts_dose_type_key;
create unique index if not exists alerts_user_dose_type_key
  on public.alerts (user_id, dose_id, type)
  where dose_id is not null;


-- ── 4. Quem está vinculado a quem ─────────────
-- Fonte única de verdade para todas as políticas e funções abaixo.
create or replace function public.is_linked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.care_links l
    where (l.patient_id = auth.uid()  and l.caregiver_id = p_other)
       or (l.caregiver_id = auth.uid() and l.patient_id = p_other)
  )
  -- Reserva: contas que ainda só têm o vínculo antigo.
  or exists (
    select 1 from public.profiles p
    where (p.id = auth.uid()  and p.caregiver_id = p_other)
       or (p.id = p_other     and p.caregiver_id = auth.uid())
  );
$$;
grant execute on function public.is_linked_with(uuid) to authenticated;

/** Sou cuidador deste paciente? Usada nas policies de leitura. */
create or replace function public.is_caregiver_of(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.care_links l
    where l.patient_id = p_patient and l.caregiver_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = p_patient and p.caregiver_id = auth.uid()
  );
$$;
grant execute on function public.is_caregiver_of(uuid) to authenticated;


-- ── 5. Policies de leitura do cuidador ────────
drop policy if exists profiles_caregiver_read on public.profiles;
create policy profiles_caregiver_read on public.profiles
  for select using (public.is_caregiver_of(id));

drop policy if exists medications_caregiver_read on public.medications;
create policy medications_caregiver_read on public.medications
  for select using (public.is_caregiver_of(user_id));

drop policy if exists doses_caregiver_read on public.doses;
create policy doses_caregiver_read on public.doses
  for select using (public.is_caregiver_of(user_id));

drop policy if exists dispensers_caregiver_read on public.dispensers;
create policy dispensers_caregiver_read on public.dispensers
  for select using (public.is_caregiver_of(user_id));


-- ── 6. Contatos do chat ───────────────────────
drop function if exists public.list_chat_contacts();
create function public.list_chat_contacts()
returns table (id uuid, name text, phone text, role text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  -- meus cuidadores
  select p.id, p.name, p.phone, p.role, p.avatar_url
  from public.care_links l
  join public.profiles p on p.id = l.caregiver_id
  where l.patient_id = auth.uid()
  union
  -- meus pacientes
  select p.id, p.name, p.phone, p.role, p.avatar_url
  from public.care_links l
  join public.profiles p on p.id = l.patient_id
  where l.caregiver_id = auth.uid()
  union
  -- reserva: vínculo antigo, nos dois sentidos
  select p.id, p.name, p.phone, p.role, p.avatar_url
  from public.profiles me
  join public.profiles p on p.id = me.caregiver_id
  where me.id = auth.uid()
  union
  select p.id, p.name, p.phone, p.role, p.avatar_url
  from public.profiles p
  where p.caregiver_id = auth.uid();
$$;
grant execute on function public.list_chat_contacts() to authenticated;


-- ── 7. Dose perdida avisa TODOS os cuidadores ──
create or replace function public.notify_missed_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_patient text;
  v_med     text;
  v_hora    text;
  v_cg      uuid;
begin
  if new.status <> 'missed' or old.status is not distinct from 'missed' then
    return new;
  end if;

  select p.name into v_patient from public.profiles p where p.id = new.user_id;

  select m.name || ' ' || m.dosage into v_med
  from public.medications m where m.id = new.medication_id;

  v_hora := to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI');

  -- Um alerta para cada cuidador da equipe. O distinct evita duplicar quando
  -- a pessoa aparece tanto no vínculo novo quanto no campo antigo.
  for v_cg in
    select distinct c from (
      select l.caregiver_id as c from public.care_links l where l.patient_id = new.user_id
      union
      select p.caregiver_id  from public.profiles p
       where p.id = new.user_id and p.caregiver_id is not null
    ) t
  loop
    insert into public.alerts (user_id, patient_id, dose_id, type, title, body)
    values (
      v_cg,
      new.user_id,
      new.id,
      'dose_missed',
      'Dose perdida',
      coalesce(v_patient, 'O paciente') || ' não tomou ' ||
        coalesce(v_med, 'o medicamento') || ' das ' || v_hora || '.'
    )
    -- Índice parcial: o predicado entra na inferência do ON CONFLICT.
    on conflict (user_id, dose_id, type) where dose_id is not null do nothing;
  end loop;

  return new;
end;
$fn$;

drop trigger if exists doses_missed_alert on public.doses;
create trigger doses_missed_alert
  after update of status on public.doses
  for each row execute function public.notify_missed_dose();


-- ── 8. Estoque baixo avisa TODOS os cuidadores ─
create or replace function public.consume_stock_on_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stock     int;
  v_threshold int;
  v_units     int;
  v_name      text;
  v_dosage    text;
  v_owner     uuid := new.user_id;
  v_patient   text;
  v_cg        uuid;
  v_title     text;
  v_tail      text;
begin
  if new.status <> 'taken' or old.status is not distinct from 'taken' then
    return new;
  end if;
  if new.medication_id is null then
    return new;
  end if;

  select m.stock, m.stock_threshold, m.units_per_dose, m.name, m.dosage
    into v_stock, v_threshold, v_units, v_name, v_dosage
  from public.medications m
  where m.id = new.medication_id
  for update;

  -- Estoque não controlado neste remédio: nada a fazer.
  if v_stock is null then
    return new;
  end if;

  v_stock := greatest(0, v_stock - coalesce(v_units, 1));

  update public.medications
     set stock = v_stock
   where id = new.medication_id;

  if v_stock > coalesce(v_threshold, 5) then
    return new;
  end if;

  select p.name into v_patient from public.profiles p where p.id = v_owner;

  v_title := case when v_stock = 0 then 'Medicamento acabou' else 'Medicamento acabando' end;
  v_tail  := case when v_stock = 0 then 'estoque zerado.'
                  else v_stock || ' unidades restantes.' end;

  -- Para o próprio paciente
  insert into public.alerts (user_id, patient_id, medication_id, type, title, body)
  values (v_owner, v_owner, new.medication_id, 'low_stock', v_title,
          v_name || ' ' || v_dosage || ': ' || v_tail)
  on conflict (user_id, medication_id) where type = 'low_stock' do update
    set body = excluded.body, title = excluded.title, read = false, created_at = now();

  -- Para cada cuidador
  for v_cg in
    select distinct c from (
      select l.caregiver_id as c from public.care_links l where l.patient_id = v_owner
      union
      select p.caregiver_id  from public.profiles p
       where p.id = v_owner and p.caregiver_id is not null
    ) t
  loop
    insert into public.alerts (user_id, patient_id, medication_id, type, title, body)
    values (v_cg, v_owner, new.medication_id, 'low_stock', v_title,
            coalesce(v_patient, 'O paciente') || ' — ' ||
            v_name || ' ' || v_dosage || ': ' || v_tail)
    on conflict (user_id, medication_id) where type = 'low_stock' do update
      set body = excluded.body, title = excluded.title, read = false, created_at = now();
  end loop;

  return new;
end;
$fn$;

drop trigger if exists doses_consume_stock on public.doses;
create trigger doses_consume_stock
  after update of status on public.doses
  for each row execute function public.consume_stock_on_dose();


-- ── 9. Sincronizar doses vencidas ─────────────
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
     and (d.user_id = auth.uid() or public.is_caregiver_of(d.user_id));
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;
grant execute on function public.sync_overdue_doses() to authenticated;


-- ── 10. Cuidador confirma dose ────────────────
-- Mesma função da migração 6, agora aceitando qualquer cuidador da equipe.
drop function if exists public.caregiver_mark_dose_taken(uuid);
create function public.caregiver_mark_dose_taken(p_dose uuid)
returns table (id uuid, status text, taken_at timestamptz, delay_minutes int)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner  uuid;
  v_sched  timestamptz;
  v_status text;
begin
  select d.user_id, d.scheduled_at, d.status
    into v_owner, v_sched, v_status
  from public.doses d where d.id = p_dose;

  if v_owner is null then
    raise exception 'dose_not_found';
  end if;

  if not public.is_caregiver_of(v_owner) then
    raise exception 'not_allowed';
  end if;

  if v_status = 'taken' then
    raise exception 'already_taken';
  end if;

  return query
  update public.doses d
     set status        = 'taken',
         taken_at      = now(),
         validated_by  = 'caregiver',
         delay_minutes = greatest(0, extract(epoch from (now() - v_sched))::int / 60)
   where d.id = p_dose
  returning d.id, d.status, d.taken_at, d.delay_minutes;
end;
$fn$;
grant execute on function public.caregiver_mark_dose_taken(uuid) to authenticated;


-- ── 11. Achar alguém pelo telefone ────────────
-- O app deixa escolher um cuidador na agenda do celular. O contato traz o
-- telefone; esta função diz se esse telefone já é uma conta IASIS, sem
-- expor a tabela de perfis inteira.
--
-- A comparação é feita só com os dígitos, e pelos 8 últimos: o mesmo número
-- aparece salvo como "(11) 98888-7777", "+5511988887777" ou "11988887777".
drop function if exists public.find_profile_by_phone(text);
create function public.find_profile_by_phone(p_phone text)
returns table (id uuid, name text, role text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.role, p.avatar_url
  from public.profiles p
  where p.id <> auth.uid()
    and length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 8
    and right(regexp_replace(p.phone, '\D', '', 'g'), 8)
      = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8)
  limit 5;
$$;
grant execute on function public.find_profile_by_phone(text) to authenticated;


-- ── 12. Montar e desfazer a equipe ────────────
/**
 * Cria o vínculo. Chamada pelo paciente (adicionando quem cuida dele) ou
 * pelo cuidador (adicionando um paciente) — o parâmetro diz o papel do OUTRO.
 */
drop function if exists public.add_care_link(uuid, text, text);
create function public.add_care_link(
  p_other    uuid,
  p_as       text default 'caregiver',   -- 'caregiver' | 'patient'
  p_relation text default null
)
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
  if p_other = v_me then
    raise exception 'cannot_link_self';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'profile_not_found';
  end if;

  if p_as = 'caregiver' then
    insert into public.care_links (patient_id, caregiver_id, relation)
    values (v_me, p_other, nullif(trim(p_relation), ''))
    on conflict (patient_id, caregiver_id) do nothing;
  elsif p_as = 'patient' then
    insert into public.care_links (patient_id, caregiver_id, relation)
    values (p_other, v_me, nullif(trim(p_relation), ''))
    on conflict (patient_id, caregiver_id) do nothing;
  else
    raise exception 'invalid_role';
  end if;
end;
$fn$;
grant execute on function public.add_care_link(uuid, text, text) to authenticated;

/** A equipe de cuidado vista de dentro: quem cuida de mim e de quem eu cuido. */
drop function if exists public.list_care_team();
create function public.list_care_team()
returns table (
  link_id   uuid,
  person_id uuid,
  name      text,
  phone     text,
  role      text,
  avatar_url text,
  relation  text,
  side      text,          -- 'caregiver' = cuida de mim; 'patient' = eu cuido
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select l.id, p.id, p.name, p.phone, p.role, p.avatar_url, l.relation,
         'caregiver'::text, l.created_at
  from public.care_links l
  join public.profiles p on p.id = l.caregiver_id
  where l.patient_id = auth.uid()
  union all
  select l.id, p.id, p.name, p.phone, p.role, p.avatar_url, l.relation,
         'patient'::text, l.created_at
  from public.care_links l
  join public.profiles p on p.id = l.patient_id
  where l.caregiver_id = auth.uid()
  order by created_at;
$$;
grant execute on function public.list_care_team() to authenticated;


-- ── 13. Conferência ───────────────────────────
select
  (select count(*) from public.care_links)                          as vinculos,
  (select count(*) from pg_indexes
     where schemaname = 'public'
       and indexname  = 'alerts_user_dose_type_key')                as indice_novo,
  (select count(*) from pg_indexes
     where schemaname = 'public'
       and indexname  = 'alerts_dose_type_key')                     as indice_antigo_removido_deve_ser_0,
  (select count(*) from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('is_caregiver_of','add_care_link',
                       'list_care_team','find_profile_by_phone'))   as funcoes_novas;
