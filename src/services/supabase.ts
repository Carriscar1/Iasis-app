import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { demoClient, isDemoActive } from './demo';

const SUPABASE_URL = 'https://qoqlsymvmmmsfsfscpmg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvcWxzeW12bW1tc2ZzZnNjcG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNjg2NzcsImV4cCI6MjA5Nzk0NDY3N30.rzRMUUXXtXG5AWFsX61reOIU1oY-IjmJVvrZCgfTnjk';

const isWeb = Platform.OS === 'web';

// Storage da sessão por plataforma:
//  - Web:    localStorage (mantém login entre abas/recargas)
//  - Nativo: AsyncStorage (sem ele a sessão morria ao fechar o app!)
const sessionStorage = isWeb
  ? (typeof window !== 'undefined' ? window.localStorage : undefined)
  : AsyncStorage;

const realClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: isWeb,
    storage: sessionStorage,
  },
  global: {
    // IMPORTANTE: NÃO fixar 'Authorization' aqui. O supabase-js só injeta o
    // token do usuário logado se a requisição ainda não tiver um Authorization
    // (ver fetchWithAuth). Se fixarmos o Bearer da anon key, todo acesso ao
    // banco vira "anônimo" e a RLS (auth.uid() = user_id) bloqueia gravações.
    // Mantemos só o apikey; o Authorization correto (anon quando deslogado,
    // token do usuário quando logado) é gerenciado pela própria lib.
    headers: {
      apikey: SUPABASE_ANON_KEY,
    },
  },
});

// No modo demonstração, quem responde é o banco em memória (demo.ts); fora
// dele, o Supabase de verdade. Os serviços usam `supabase` sem saber qual é.
export const supabase = new Proxy(realClient, {
  get(target, prop) {
    const source: any = isDemoActive() && prop in demoClient ? demoClient : target;
    const value = source[prop];
    return typeof value === 'function' ? value.bind(source) : value;
  },
}) as typeof realClient;
