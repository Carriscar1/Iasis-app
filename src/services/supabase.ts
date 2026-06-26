import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Novo formato de chaves do Supabase (2024+)
// Project URL: Settings → API Keys → copie a URL do projeto
// Publishable key: Settings → API Keys → Publishable key (sb_publishable_...)
const SUPABASE_URL      = 'https://qoqlsymvmmmsfsfscpmg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YoOQNEwgWkYOPMXUIi0Rrg_6RJvGBHS';

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
