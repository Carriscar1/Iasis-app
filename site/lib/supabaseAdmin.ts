// ─────────────────────────────────────────────
//  IASIS — Loja · cliente Supabase com SERVICE ROLE
//  Usado SOMENTE no servidor (rotas de API). A service role key
//  ignora o RLS, então nunca pode ser exposta ao navegador.
// ─────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local',
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
