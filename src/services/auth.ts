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
      return { user: null, error: `Erro auth: ${authError.message}` };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { user: null, error: 'Não foi possível criar o usuário.' };
    }

    const profile = {
      id:    userId,
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      role,
      ...(caregiver_id ? { caregiver_id } : {}),
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profile);

    if (profileError) {
      console.error('ERRO PROFILE:', profileError);
      if (!profileError.message.includes('duplicate')) {
        return { user: null, error: `Erro perfil: ${profileError.message}` };
      }
    }

    const needsConfirmation = !authData.session;

    return {
      user: { ...profile, created_at: new Date().toISOString() },
      error: null,
      needsConfirmation,
    };
  } catch (err: any) {
    console.error('ERRO INESPERADO:', err);
    return { user: null, error: `Erro inesperado: ${err?.message ?? JSON.stringify(err)}` };
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<{ user: UserProfile | null; error: string | null; needsConfirmation?: boolean }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      console.error('ERRO LOGIN:', error.message);
      // Sinaliza especificamente o caso de e-mail não confirmado para a tela
      // poder oferecer o botão de reenviar a verificação.
      const needsConfirmation = /email not confirmed|not confirmed/i.test(error.message);
      return { user: null, error: translateError(error), needsConfirmation };
    }
    if (!data.user) return { user: null, error: 'Usuário não encontrado.' };
    const profile = await getProfile(data.user.id);
    return { user: profile, error: null };
  } catch (err: any) {
    return { user: null, error: `Erro: ${err?.message}` };
  }
};

// Reenvia o e-mail de confirmação de cadastro.
export const resendConfirmation = async (
  email: string
): Promise<{ error: string | null }> => {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) {
    if (/already confirmed|already been confirmed/i.test(error.message)) {
      return { error: 'Este e-mail já foi confirmado. Tente entrar normalmente.' };
    }
    if (/rate limit|too many|seconds/i.test(error.message)) {
      return { error: 'Aguarde alguns segundos antes de reenviar.' };
    }
    return { error: error.message };
  }
  return { error: null };
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export const getProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('ERRO PERFIL:', error.message);
    return null;
  }
  return data as UserProfile;
};

// Busca um cuidador pelo e-mail. Usa a função RPC `find_caregiver_by_email`
// (SECURITY DEFINER) porque, durante o cadastro, o usuário ainda é anônimo e
// a RLS de `profiles` só permite ler o próprio perfil — uma consulta direta
// retornaria vazio. Ver supabase_update2.sql.
export const findCaregiverByEmail = async (
  email: string
): Promise<{ id: string; name: string } | null> => {
  const { data, error } = await supabase.rpc('find_caregiver_by_email', {
    p_email: email.trim().toLowerCase(),
  });
  if (error) {
    console.error('ERRO RPC find_caregiver_by_email:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { id: row.id, name: row.name };
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