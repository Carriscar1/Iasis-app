// ─────────────────────────────────────────────
//  IASIS — Chat entre paciente e cuidador
//  Mensagens no Supabase (tabela `messages`, RLS por vínculo) +
//  atalho para conversar pelo WhatsApp usando o telefone do perfil.
// ─────────────────────────────────────────────
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

export interface Message {
  id:          string;
  senderId:    string;
  recipientId: string;
  body:        string;
  createdAt:   string;
  readAt?:     string | null;
}

const mapRow = (r: any): Message => ({
  id:          r.id,
  senderId:    r.sender_id,
  recipientId: r.recipient_id,
  body:        r.body,
  createdAt:   r.created_at,
  readAt:      r.read_at,
});

// ── Contatos disponíveis para conversar ───────
// Paciente vê o cuidador; cuidador vê seus pacientes.
export interface ChatContact {
  id:    string;
  name:  string;
  phone: string | null;
  role:  'patient' | 'caregiver' | 'independent';
}

export const listChatContacts = async (): Promise<{
  data: ChatContact[];
  error: string | null;
}> => {
  const { data, error } = await supabase.rpc('list_chat_contacts');
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r: any) => ({
      id: r.id, name: r.name, phone: r.phone ?? null, role: r.role,
    })),
    error: null,
  };
};

// ── Histórico da conversa entre duas pessoas ──
export const listMessages = async (
  userId: string,
  otherId: string,
  limit = 200
): Promise<{ data: Message[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    // Só o par (nos dois sentidos). A RLS já restringe ao que é meu.
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapRow), error: null };
};

// ── Enviar mensagem ───────────────────────────
export const sendMessage = async (
  senderId: string,
  recipientId: string,
  body: string
): Promise<{ data: Message | null; error: string | null }> => {
  const text = body.trim();
  if (!text) return { data: null, error: 'Mensagem vazia.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body: text })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapRow(data), error: null };
};

// ── Marcar como lidas as mensagens recebidas ──
export const markConversationRead = async (
  userId: string,
  otherId: string
): Promise<void> => {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .eq('sender_id', otherId)
    .is('read_at', null);
};

// ── Quantas mensagens não lidas eu tenho ──────
export const countUnread = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);
  return error ? 0 : (count ?? 0);
};

// ── Tempo real: novas mensagens da conversa ───
// Devolve uma função para cancelar a inscrição.
export const subscribeToMessages = (
  userId: string,
  otherId: string,
  onMessage: (m: Message) => void
): (() => void) => {
  const channel = supabase
    .channel(`chat:${[userId, otherId].sort().join(':')}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        const m = mapRow(payload.new);
        if (m.senderId === otherId) onMessage(m);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

// ─────────────────────────────────────────────
//  WhatsApp
// ─────────────────────────────────────────────

// Normaliza para o formato internacional usado pelo wa.me (só dígitos).
// Aceita "(11) 99999-8888", "11999998888", "+55 11 99999-8888".
export const normalizePhone = (raw: string): string | null => {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Brasil: 10 (fixo) ou 11 (celular) dígitos → prefixa 55.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

// Máscara amigável enquanto o usuário digita: (11) 99999-8888
export const formatPhoneInput = (raw: string): string => {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : '';
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

// Abre a conversa no WhatsApp. Retorna false se o telefone for inválido
// ou se não houver WhatsApp disponível no dispositivo.
export const openWhatsApp = async (
  phone: string,
  message?: string
): Promise<{ ok: boolean; error?: string }> => {
  const number = normalizePhone(phone);
  if (!number) return { ok: false, error: 'Telefone inválido ou não cadastrado.' };

  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  const url  = `https://wa.me/${number}${text}`;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank');
      return { ok: true };
    }
    const can = await Linking.canOpenURL(url);
    if (!can) return { ok: false, error: 'Não foi possível abrir o WhatsApp neste aparelho.' };
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Não foi possível abrir o WhatsApp.' };
  }
};
