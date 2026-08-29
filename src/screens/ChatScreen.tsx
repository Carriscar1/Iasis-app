import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions,
  Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import {
  listChatContacts, listMessages, sendMessage, markConversationRead,
  subscribeToMessages, openWhatsApp, countUnread,
  type ChatContact, type Message,
} from '../services/chat';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d);  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
};

export default function ChatScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const maxW      = width >= 1024 ? 720 : isTablet ? 640 : undefined;

  const user = useStore((s) => s.user);
  const setUnreadMessages = useStore((s) => s.setUnreadMessages);

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [active, setActive]     = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Carrega os contatos vinculados (cuidador ou pacientes).
  const loadContacts = useCallback(async () => {
    const { data, error } = await listChatContacts();
    if (error) RNAlert.alert('Erro', error);
    setContacts(data);
    // Com um único contato, já abre a conversa direto.
    setActive((cur) => cur ?? (data.length === 1 ? data[0] : null));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadContacts(); }, [loadContacts]));

  // Carrega o histórico e escuta novas mensagens em tempo real.
  useEffect(() => {
    if (!user || !active) { setMessages([]); return; }
    let alive = true;

    (async () => {
      const { data } = await listMessages(user.id, active.id);
      if (!alive) return;
      setMessages(data);
      // Lidas: atualiza o badge com o que sobrou de outras conversas.
      await markConversationRead(user.id, active.id);
      if (alive) setUnreadMessages(await countUnread(user.id));
    })();

    const unsubscribe = subscribeToMessages(user.id, active.id, async (m) => {
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
      await markConversationRead(user.id, active.id);
      if (alive) setUnreadMessages(await countUnread(user.id));
    });

    return () => { alive = false; unsubscribe(); };
  }, [user, active, setUnreadMessages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !user || !active || sending) return;

    setSending(true);
    setDraft('');
    const { data, error } = await sendMessage(user.id, active.id, text);
    setSending(false);

    if (error) {
      setDraft(text); // devolve o texto para não perder o que foi digitado
      RNAlert.alert('Não foi possível enviar', error);
      return;
    }
    if (data) setMessages((prev) => [...prev, data]);
  };

  const handleWhatsApp = async () => {
    if (!active?.phone) {
      RNAlert.alert(
        'Sem telefone cadastrado',
        `${active?.name ?? 'Esta pessoa'} ainda não cadastrou um telefone. Peça para adicionar em Perfil → Editar telefone.`
      );
      return;
    }
    const res = await openWhatsApp(
      active.phone,
      `Olá, ${active.name}! Falo pelo app IASIS.`
    );
    if (!res.ok && res.error) RNAlert.alert('WhatsApp', res.error);
  };

  // ── Sem vínculo ──────────────────────────────
  if (!loading && contacts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
        <Header title="Conversas" onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={54} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Nenhum contato vinculado</Text>
          <Text style={styles.emptyText}>
            O chat conecta o paciente ao seu cuidador. Vincule uma conta de paciente a um
            cuidador para conversar por aqui.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Lista de contatos (cuidador com vários pacientes) ──
  if (!active) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
        <Header title="Conversas" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={[styles.listPad, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}>
          {loading ? (
            <ActivityIndicator color={Colors.navy} style={{ marginTop: 40 }} />
          ) : (
            contacts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.contactRow}
                onPress={() => setActive(c)}
                activeOpacity={0.8}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactRole}>
                    {c.role === 'caregiver' ? 'Cuidador' : 'Paciente'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Conversa ─────────────────────────────────
  let lastDay = '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Cabeçalho da conversa */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (contacts.length > 1 ? setActive(null) : router.back())}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={[styles.avatar, styles.avatarSm]}>
          <Text style={[styles.avatarText, { fontSize: 15 }]}>
            {active.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{active.name}</Text>
          <Text style={styles.headerRole}>
            {active.role === 'caregiver' ? 'Cuidador' : 'Paciente'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleWhatsApp}
          style={styles.waBtn}
          activeOpacity={0.85}
          accessibilityLabel="Conversar pelo WhatsApp"
        >
          <Ionicons name="logo-whatsapp" size={18} color="#fff" />
          <Text style={styles.waText}>WhatsApp</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.msgPad, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 50, gap: 8 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                Nenhuma mensagem ainda. Diga um oi para {active.name.split(' ')[0]}!
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user?.id;
              const day  = fmtDay(m.createdAt);
              const showDay = day !== lastDay;
              lastDay = day;

              return (
                <View key={m.id}>
                  {showDay && (
                    <View style={styles.dayPill}>
                      <Text style={styles.dayText}>{day}</Text>
                    </View>
                  )}
                  <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{m.body}</Text>
                      <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.7)' }]}>
                        {fmtTime(m.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Caixa de envio */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escreva uma mensagem…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.45 }]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            activeOpacity={0.85}
            accessibilityLabel="Enviar mensagem"
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={19} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={[styles.headerName, { fontSize: 20 }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.navy, paddingHorizontal: 14, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerRole: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },

  waBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#25D366', borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 8,
  },
  waText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },

  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.blueLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSm:   { width: 36, height: 36, borderRadius: 18 },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.navy },

  listPad: { padding: 16, gap: 10 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 14, ...Shadows.sm,
  },
  contactName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  contactRole: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  msgPad: { padding: 16, paddingBottom: 8, gap: 4 },
  dayPill: { alignSelf: 'center', backgroundColor: Colors.borderSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginVertical: 12 },
  dayText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleMine:   { backgroundColor: Colors.navy, borderBottomRightRadius: 5 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderBottomLeftRadius: 5, ...Shadows.sm },
  bubbleText:   { fontSize: 15.5, color: Colors.textPrimary, lineHeight: 21 },
  bubbleTime:   { fontSize: 10.5, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, maxHeight: 110, minHeight: 44,
    backgroundColor: Colors.bg, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15.5, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyText:  { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
});
