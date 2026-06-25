// ─────────────────────────────────────────────
//  IASIS — Auth Service (Supabase)
//  Login, cadastro, sessão, perfil
// ─────────────────────────────────────────────
import { supabase } from './supabase';

// ── Tipos ─────────────────────────────────────
export interface UserProfile {
  id:         string;
  name:       string;
  email:      string;
  role:       'patient' | 'caregiver';
  rfid_tag?:  string;
  created_at: string;
}

// ── Cadastro ──────────────────────────────────
export const signUp = async (
  email: string,
  password: string,
  name: string,
  role: 'patient' | 'caregiver' = 'patient'
): Promise<{ user: UserProfile | null; error: string | null }> => {
  try {
    // 1. Cria o usuário no Auth do Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password,
      options: {
        data: { name, role },   // metadata inicial
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Usuário não criado');

    // 2. Cria o perfil na tabela "profiles"
    const profile: Omit<UserProfile, 'created_at'> = {
      id:    authData.user.id,
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      role,
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profile);

    if (profileError) throw profileError;

    return { user: { ...profile, created_at: new Date().toISOString() }, error: null };
  } catch (err: any) {
    console.error('[Auth] signUp error:', err);
    return { user: null, error: translateError(err) };
  }
};

// ── Login ─────────────────────────────────────
export const signIn = async (
  email: string,
  password: string
): Promise<{ user: UserProfile | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Usuário não encontrado');

    const profile = await getProfile(data.user.id);
    return { user: profile, error: null };
  } catch (err: any) {
    console.error('[Auth] signIn error:', err);
    return { user: null, error: translateError(err) };
  }
};

// ── Logout ────────────────────────────────────
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[Auth] signOut error:', error);
};

// ── Sessão atual ──────────────────────────────
export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

// ── Perfil do usuário ─────────────────────────
export const getProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] getProfile error:', error);
    return null;
  }
  return data as UserProfile;
};

// ── Listener de mudança de auth ───────────────
export const onAuthStateChange = (
  callback: (user: UserProfile | null) => void
) => {
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const profile = await getProfile(session.user.id);
      callback(profile);
    } else {
      callback(null);
    }
  });
  return data.subscription.unsubscribe;
};

// ── Tradutor de erros Supabase → PT-BR ────────
const translateError = (err: any): string => {
  const msg: string = err?.message ?? '';
  if (msg.includes('Invalid login credentials'))   return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))          return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered'))      return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('Unable to validate email'))     return 'E-mail inválido.';
  if (msg.includes('Network request failed'))       return 'Sem conexão. Verifique sua internet.';
  return 'Ocorreu um erro. Tente novamente.';
};
