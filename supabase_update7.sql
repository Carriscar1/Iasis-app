-- ═══════════════════════════════════════════════
--  IASIS — Migração 7
--  Foto de perfil + base compartilhada de códigos de barras
--
--  Execute no SQL Editor do Supabase DEPOIS de supabase_update6.sql.
--  Rodar duas vezes é seguro: tudo é idempotente.
-- ═══════════════════════════════════════════════

-- ── 1. Foto de perfil ─────────────────────────
-- Guardada como data URI (JPEG 256×256, ~20 KB). Fica na própria linha do
-- perfil para chegar junto com o resto dos dados, sem uma segunda ida à rede.
alter table public.profiles
  add column if not exists avatar_url text;

-- Trava de tamanho no banco. Sem isso, um cliente com bug poderia gravar uma
-- imagem gigante e deixar lenta toda consulta que traz o perfil.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_size'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_size
      check (avatar_url is null or length(avatar_url) <= 200000);
  end if;
end $$;


-- ── 2. Códigos de barras dos medicamentos ─────
-- Base compartilhada: o primeiro usuário que lê uma caixa nova ensina o app,
-- e a partir daí o código já vem reconhecido para todo mundo.
create table if not exists public.medication_barcodes (
  code          text primary key,
  name          text not null,
  dosage        text,
  form          text default 'comprimido',
  confirmations int  not null default 1,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.medication_barcodes enable row level security;

-- Catálogo colaborativo: qualquer usuário autenticado consulta.
drop policy if exists barcodes_read on public.medication_barcodes;
create policy barcodes_read on public.medication_barcodes
  for select to authenticated
  using (true);

-- A escrita NÃO é liberada direto: passa pela função abaixo, que valida o
-- formato do código e impede que uma leitura ruim sobrescreva o que já existe.
revoke insert, update, delete on public.medication_barcodes from authenticated;


-- ── 3. Ensinar / confirmar um código ──────────
create or replace function public.learn_medication_barcode(
  p_code   text,
  p_name   text,
  p_dosage text,
  p_form   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  -- Só dígitos, 8 ou 13 posições. O dígito verificador já foi conferido no
  -- app; aqui garantimos o formato mesmo se a chamada vier de outro lugar.
  if p_code !~ '^\d{8}$' and p_code !~ '^\d{13}$' then
    raise exception 'invalid_barcode';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'invalid_name';
  end if;

  insert into public.medication_barcodes (code, name, dosage, form, created_by)
  values (p_code, trim(p_name), nullif(trim(p_dosage), ''),
          coalesce(nullif(trim(p_form), ''), 'comprimido'), v_user)
  on conflict (code) do update
    -- O nome de quem cadastrou primeiro prevalece: quem chega depois apenas
    -- confirma. Assim uma digitação errada não apaga o dado bom de ninguém.
    set confirmations = public.medication_barcodes.confirmations + 1,
        updated_at    = now();
end;
$$;

grant execute on function public.learn_medication_barcode(text, text, text, text)
  to authenticated;


-- ── 4. Conferência ────────────────────────────
-- Deve listar avatar_url em profiles e a tabela medication_barcodes com RLS.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'avatar_url')                    as tem_avatar,
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name = 'medication_barcodes')            as tem_barcodes,
  (select count(*) from pg_policies
     where schemaname = 'public'
       and tablename = 'medication_barcodes')             as policies_barcodes;
