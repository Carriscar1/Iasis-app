-- ═══════════════════════════════════════════════
--  IASIS — Atualização 3
--  Execute no SQL Editor do Supabase.
--  1) Telefone no perfil (usado pelo WhatsApp)
--  2) Chat entre paciente e cuidador
--  3) Campos de pareamento do dispenser (MQTT real)
-- ═══════════════════════════════════════════════

-- ── 1. Telefone no perfil ───────────────────────
-- Guardado em formato livre; o app normaliza para o link do WhatsApp.
alter table public.profiles
  add column if not exists phone text;

-- ── 2. Mensagens (chat paciente ↔ cuidador) ─────
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(trim(body)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists messages_pair_idx
  on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_unread_idx
  on public.messages (recipient_id, read_at);

alter table public.messages enable row level security;

-- Só existe vínculo se um for cuidador do outro (em qualquer direção).
create or replace function public.is_linked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where (p.id = auth.uid()  and p.caregiver_id = p_other)
       or (p.id = p_other     and p.caregiver_id = auth.uid())
  );
$$;
grant execute on function public.is_linked_with(uuid) to authenticated;

-- Ler: mensagens em que eu sou remetente ou destinatário.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Enviar: só como eu mesmo, e só para quem tem vínculo comigo.
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages
  for insert
  with check (auth.uid() = sender_id and public.is_linked_with(recipient_id));

-- Marcar como lida: só o destinatário.
drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages
  for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ── 2b. Contatos do chat ────────────────────────
-- A RLS de `profiles` só deixa o cuidador ler o paciente. Para o chat, o
-- paciente também precisa ver nome/telefone do seu cuidador — esta função
-- expõe apenas isso, e apenas de quem tem vínculo comigo.
drop function if exists public.list_chat_contacts();
create function public.list_chat_contacts()
returns table (id uuid, name text, phone text, role text)
language sql
security definer
set search_path = public
as $$
  -- meu cuidador
  select p.id, p.name, p.phone, p.role
  from public.profiles me
  join public.profiles p on p.id = me.caregiver_id
  where me.id = auth.uid()
  union
  -- meus pacientes
  select p.id, p.name, p.phone, p.role
  from public.profiles p
  where p.caregiver_id = auth.uid();
$$;
grant execute on function public.list_chat_contacts() to authenticated;

-- ── 3. Pareamento do dispenser (MQTT real) ──────
-- device_id é o identificador usado nos tópicos: iasis/dispenser/<device_id>/...
alter table public.dispensers
  add column if not exists device_id text;

create unique index if not exists dispensers_device_id_key
  on public.dispensers (device_id) where device_id is not null;

-- Cuidador enxerga o dispenser dos pacientes vinculados.
drop policy if exists dispensers_caregiver_read on public.dispensers;
create policy dispensers_caregiver_read on public.dispensers
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = dispensers.user_id
        and p.caregiver_id = auth.uid()
    )
  );
