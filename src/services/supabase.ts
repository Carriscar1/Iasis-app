// ─────────────────────────────────────────────
//  IASIS — Supabase Client
//
//  ⚠️  CONFIGURAÇÃO NECESSÁRIA:
//  1. Acesse https://supabase.com e crie um projeto
//  2. Vá em Settings → API
//  3. Copie "Project URL" e "anon public" key
//  4. Cole abaixo nos campos SUPABASE_URL e SUPABASE_ANON_KEY
// ─────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://qoqlsymvmmmsfsfscpmg.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_YoOQNEwgWkYOPMXUIi0Rrg_6RJvGBHS';

// Adapter de storage seguro para mobile (guarda a sessão criptografada)
const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});
