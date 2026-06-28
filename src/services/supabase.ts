import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://qoqlsymvmmmsfsfscpmg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvcWxzeW12bW1tc2ZzZnNjcG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNjg2NzcsImV4cCI6MjA5Nzk0NDY3N30.rzRMUUXXtXG5AWFsX61reOIU1oY-IjmJVvrZCgfTnjk';

const isWeb = Platform.OS === 'web';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: isWeb,
    storage: isWeb && typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  },
});