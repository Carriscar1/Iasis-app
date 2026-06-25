-- ═══════════════════════════════════════════════
--  IASIS — Setup do banco Supabase
--  Execute isso no SQL Editor do painel Supabase
-- ═══════════════════════════════════════════════

-- 1. Tabela de perfis de usuário
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  role       text not null default 'patient' check (role in ('patient', 'caregiver')),
  rfid_tag   text,
  created_at timestamptz default now()
);

-- 2. Tabela de medicamentos
create table if not exists public.medications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  dosage       text not null,
  form         text default 'comprimido',
  compartment  int  default 1,
  instructions text,
  color        text,
  created_at   timestamptz default now()
);

-- 3. Tabela de doses
create table if not exists public.doses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  medication_id  uuid references public.medications(id) on delete set null,
  scheduled_at   timestamptz not null,
  status         text not null default 'pending'
                   check (status in ('pending','upcoming','due','taken','late','missed')),
  taken_at       timestamptz,
  validated_by   text check (validated_by in ('rfid','manual','caregiver')),
  delay_minutes  int default 0,
  notes          text,
  created_at     timestamptz default now()
);

-- 4. Tabela do dispenser
create table if not exists public.dispensers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'IASIS-01',
  mqtt_topic  text not null,
  online      boolean default false,
  last_seen   timestamptz,
  firmware    text,
  humidity    numeric(5,2) default 0,
  temperature numeric(5,2) default 0,
  rfid_last   text,
  rfid_at     timestamptz,
  created_at  timestamptz default now()
);

-- ── Row Level Security (RLS) ──────────────────
alter table public.profiles    enable row level security;
alter table public.medications enable row level security;
alter table public.doses       enable row level security;
alter table public.dispensers  enable row level security;

-- Policies: cada usuário acessa só os próprios dados
create policy "profiles_own"    on public.profiles    for all using (auth.uid() = id);
create policy "medications_own" on public.medications for all using (auth.uid() = user_id);
create policy "doses_own"       on public.doses       for all using (auth.uid() = user_id);
create policy "dispensers_own"  on public.dispensers  for all using (auth.uid() = user_id);
