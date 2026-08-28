// ─────────────────────────────────────────────
//  IASIS — Loja · cliente Supabase (chave pública anon)
//  Toda a escrita passa por RPCs SECURITY DEFINER protegidas:
//  create_order (anon) e confirm_payment_and_issue_code (exige o
//  WEBHOOK_SECRET, que só o servidor conhece). Não usamos service role.
// ─────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabase() {
  if (!url || !anon) {
    throw new Error(
      'Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Segredo compartilhado que autoriza a emissão de código (server-only).
export function webhookSecret(): string {
  const s = process.env.WEBHOOK_SECRET;
  if (!s) throw new Error('WEBHOOK_SECRET não configurado.');
  return s;
}
