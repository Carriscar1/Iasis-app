-- Execute isso no SQL Editor do Supabase para atualizar o banco

-- Adiciona role 'independent' e coluna caregiver_id na tabela profiles
alter table public.profiles 
  drop constraint if exists profiles_role_check;

alter table public.profiles 
  add constraint profiles_role_check 
  check (role in ('patient', 'caregiver', 'independent'));

alter table public.profiles 
  add column if not exists caregiver_id uuid references public.profiles(id) on delete set null;

create index if not exists profiles_caregiver_id_idx on public.profiles(caregiver_id);
