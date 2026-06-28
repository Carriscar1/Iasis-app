import { supabase } from './supabase';

export interface UserProfile {
  id:            string;
  name:          string;
  email:         string;
  role:          'patient' | 'caregiver' | 'independent';
  rfid_tag?:     string;
  caregiver_id?: string;
  created_at:    string;
}

export const signUp = async (
  email: string,
  password: string,
  name: string,
  role: UserProfile['role'] = 'independent',
  caregiver_id?: string
): Promise<{ user: UserProfile | null; error: string | null; needsConfirmation?: boolean }> => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password,
      options: { data: { name, role } },
    });

    if (authError) {
      console.error('ERRO SUPABASE AUTH:', authError);
      return { user: null, error: authError.message };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { user: null, error: 'Não foi possível criar o usuário.' };
    }

    // Tenta inserir perfil — o trigger já faz isso, mas garante
    const profile = {
      id:    userId,
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      role,
      ...(caregiver_id ? { caregiver_id } : {}),
    };

    await supabase.from('profiles').upsert(profile, { onConflict: 'id' });

    return {
      user: { ...profile, created_at: new Date().toISOString() },
      error: null,
      needsConfirmation: !authData.session,
    };
  } catch (err: any) {
    console.error('ERRO INESPERADO:', err);
    return { user: null, error: err?.message ?? 'Erro inesperado.' };
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<{ user: UserProfile | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.error('ERRO LOGIN:', error.message);
      return { user: null, error: translateError(error) };
    }

    if (!data.user) {
      return { user: null, error: 'Usuário não encontrado.' };
    }

    // Busca perfil — se não existir, cria na hora
    let profile = await getProfile(data.user.id);

    if (!profile) {
      const newProfile = {
        id:    data.user.id,
        name:  data.user.user_metadata?.name ?? email.split('@')[0],
        email: data.user.email ?? email,
        role:  (data.user.user_metadata?.role ?? 'independent') as UserProfile['role'],
      };
      await supabase.from('profiles').upsert(newProfile, { onConflict: 'id' });
      profile = { ...newProfile, created_at: new Date().toISOString() };
    }

    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: err?.message ?? 'Erro inesperado.' };
  }
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export const getProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // usa maybeSingle em vez de single — não dá erro se não achar

    if (error) {
      console.error('ERRO PERFIL:', error.message);
      return null;
    }

    return data as UserProfile | null;
  } catch (err) {
    return null;
  }
};

export const findCaregiverByEmail = async (
  email: string
): Promise<{ id: string; name: string } | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('email', email.trim().toLowerCase())
    .eq('role', 'caregiver')
    .maybeSingle();

  if (error || !data) return null;
  return data;
};

const translateError = (err: any): string => {
  const msg: string = err?.message ?? '';
  if (msg.includes('Invalid login credentials'))   return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))          return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered'))      return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('Unable to validate email'))     return 'E-mail inválido.';
  if (msg.includes('Network request failed'))       return 'Sem conexão. Verifique sua internet.';
  return `Erro: ${msg}`;
};