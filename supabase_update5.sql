-- ═══════════════════════════════════════════════
--  IASIS — Atualização 5
--  Controle de estoque de medicamentos.
--
--  Cada medicamento guarda quantas unidades restam. Ao validar uma dose,
--  um GATILHO desconta do estoque e, se ficar abaixo do limite, cria um
--  alerta ("está acabando") para o paciente e para o cuidador vinculado.
-- ═══════════════════════════════════════════════

-- ── 1. Campos de estoque ────────────────────────
alter table public.medications
  add column if not exists stock integer,                      -- null = não controla
  add column if not exists stock_threshold integer not null default 5,
  add column if not exists units_per_dose  integer not null default 1;

alter table public.medications
  drop constraint if exists medications_stock_nonneg;
alter table public.medications
  add constraint medications_stock_nonneg
  check (stock is null or stock >= 0);

alter table public.medications
  drop constraint if exists medications_units_positive;
alter table public.medications
  add constraint medications_units_positive
  check (units_per_dose between 1 and 20);

-- ── 2. Novo tipo de alerta ──────────────────────
alter table public.alerts drop constraint if exists alerts_type_check;
alter table public.alerts
  add constraint alerts_type_check
  check (type in ('dose_missed','dose_taken','dispenser_offline','low_stock','info'));

alter table public.alerts
  add column if not exists medication_id uuid references public.medications(id) on delete cascade;

-- Um alerta de estoque por medicamento por vez (atualizado quando muda).
create unique index if not exists alerts_low_stock_key
  on public.alerts (user_id, medication_id)
  where type = 'low_stock';

-- ── 3. Gatilho: dose tomada → desconta estoque ──
create or replace function public.consume_stock_on_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stock     integer;
  v_threshold integer;
  v_units     integer;
  v_name      text;
  v_dosage    text;
  v_owner     uuid;
  v_caregiver uuid;
  v_patient   text;
begin
  -- Só quando a dose ENTRA em tomada (no horário ou com atraso).
  if new.status not in ('taken','late')
     or old.status in ('taken','late')
     or new.medication_id is null then
    return new;
  end if;

  select m.stock, m.stock_threshold, m.units_per_dose, m.name, m.dosage, m.user_id
    into v_stock, v_threshold, v_units, v_name, v_dosage, v_owner
  from public.medications m
  where m.id = new.medication_id
  for update;

  if v_stock is null then
    return new;   -- este medicamento não controla estoque
  end if;

  v_stock := greatest(0, v_stock - coalesce(v_units, 1));

  update public.medications set stock = v_stock where id = new.medication_id;

  -- Acabando? Avisa o dono e o cuidador vinculado.
  if v_stock <= coalesce(v_threshold, 5) then
    select p.name, p.caregiver_id into v_patient, v_caregiver
    from public.profiles p where p.id = v_owner;

    insert into public.alerts (user_id, patient_id, medication_id, type, title, body)
    values (
      v_owner, v_owner, new.medication_id, 'low_stock',
      case when v_stock = 0 then 'Medicamento acabou' else 'Medicamento acabando' end,
      v_name || ' ' || v_dosage || ': ' ||
        case when v_stock = 0 then 'estoque zerado.' else v_stock || ' unidades restantes.' end
    )
    on conflict (user_id, medication_id) where type = 'low_stock' do update
      set body = excluded.body, title = excluded.title, read = false, created_at = now();

    if v_caregiver is not null then
      insert into public.alerts (user_id, patient_id, medication_id, type, title, body)
      values (
        v_caregiver, v_owner, new.medication_id, 'low_stock',
        case when v_stock = 0 then 'Medicamento acabou' else 'Medicamento acabando' end,
        coalesce(v_patient, 'O paciente') || ' — ' || v_name || ' ' || v_dosage || ': ' ||
          case when v_stock = 0 then 'estoque zerado.' else v_stock || ' unidades restantes.' end
      )
      on conflict (user_id, medication_id) where type = 'low_stock' do update
        set body = excluded.body, title = excluded.title, read = false, created_at = now();
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists doses_consume_stock on public.doses;
create trigger doses_consume_stock
  after update of status on public.doses
  for each row execute function public.consume_stock_on_dose();

-- ── 4. Repor estoque ────────────────────────────
-- Soma unidades e limpa o alerta de "acabando" do medicamento.
drop function if exists public.restock_medication(uuid, integer);
create function public.restock_medication(p_medication uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stock integer;
  v_owner uuid;
begin
  select user_id into v_owner from public.medications where id = p_medication;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not_allowed';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 10000 then
    raise exception 'invalid_amount';
  end if;

  update public.medications
     set stock = coalesce(stock, 0) + p_amount
   where id = p_medication
  returning stock into v_stock;

  -- Reposto acima do limite: o aviso não faz mais sentido.
  delete from public.alerts
   where medication_id = p_medication
     and type = 'low_stock'
     and v_stock > (select stock_threshold from public.medications where id = p_medication);

  return v_stock;
end;
$fn$;
grant execute on function public.restock_medication(uuid, integer) to authenticated;
