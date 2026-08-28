import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, useWindowDimensions, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import {
  listAlerts, markAlertRead, markAllAlertsRead, deleteAlert,
  syncOverdueDoses, type AppAlert,
} from '../services/alerts';

const ICON: Record<AppAlert['type'], { name: any; bg: string; fg: string }> = {
  dose_missed:       { name: 'alert-circle',    bg: Colors.redLight,   fg: Colors.redText },
  dose_taken:        { name: 'checkmark-circle', bg: Colors.greenLight, fg: Colors.greenText },
  dispenser_offline: { name: 'cloud-offline',   bg: Colors.amberLight, fg: Colors.amberText },
  info:              { name: 'information-circle', bg: Colors.borderSoft, fg: Colors.textSecondary },
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1)  return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `há ${h}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function AlertsScreen() {
  const { width } = useWindowDimensions();
  const maxW = width >= 1024 ? 720 : width >= 768 ? 640 : undefined;

  const user            = useStore((s) => s.user);
  const setUnreadAlerts = useStore((s) => s.setUnreadAlerts);

  const [items, setItems]   = useState<AppAlert[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    // Antes de listar, detecta doses vencidas — é isso que gera novos alertas.
    await syncOverdueDoses();
    const { data, error } = await listAlerts(user.id);
    if (error) RNAlert.alert('Erro', error);
    setItems(data);
    setUnreadAlerts(data.filter((a) => !a.read).length);
    setLoading(false);
    setRefreshing(false);
  }, [user, setUnreadAlerts]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const handleOpen = async (a: AppAlert) => {
    if (!a.read) {
      await markAlertRead(a.id);
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, read: true } : x)));
      setUnreadAlerts(Math.max(0, items.filter((x) => !x.read).length - 1));
    }
    // Alerta de dose leva para o acompanhamento do paciente.
    if (a.type === 'dose_missed' && user?.role === 'caregiver') router.push('/patients');
  };

  const handleMarkAll = async () => {
    if (!user) return;
    await markAllAlertsRead(user.id);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadAlerts(0);
  };

  const handleDelete = (a: AppAlert) => {
    RNAlert.alert('Apagar alerta', 'Remover este alerta da lista?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive',
        onPress: async () => {
          await deleteAlert(a.id);
          setItems((prev) => prev.filter((x) => x.id !== a.id));
          if (!a.read) setUnreadAlerts(Math.max(0, items.filter((x) => !x.read).length - 1));
        },
      },
    ]);
  };

  const unread = items.filter((a) => !a.read).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Alertas</Text>
          <Text style={styles.subtitle}>
            {unread > 0 ? `${unread} não ${unread === 1 ? 'lido' : 'lidos'}` : 'Tudo em dia'}
          </Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={handleMarkAll} style={styles.markAllBtn} activeOpacity={0.8}>
            <Text style={styles.markAllText}>Marcar lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={Colors.navy} style={{ marginTop: 50 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={50} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum alerta por aqui</Text>
            <Text style={styles.emptyText}>
              {user?.role === 'caregiver'
                ? 'Quando um paciente vinculado perder uma dose, o aviso aparece aqui automaticamente.'
                : 'Avisos importantes sobre o seu tratamento aparecem aqui.'}
            </Text>
          </View>
        ) : (
          items.map((a) => {
            const ic = ICON[a.type] ?? ICON.info;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.card, !a.read && styles.cardUnread]}
                onPress={() => handleOpen(a)}
                onLongPress={() => handleDelete(a)}
                activeOpacity={0.8}
              >
                <View style={[styles.icon, { backgroundColor: ic.bg }]}>
                  <Ionicons name={ic.name} size={22} color={ic.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{a.title}</Text>
                    {!a.read && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.cardBody}>{a.body}</Text>
                  <Text style={styles.cardWhen}>{fmtWhen(a.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {items.length > 0 && (
          <Text style={styles.hint}>Toque para abrir · segure para apagar</Text>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.navy, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: '#fff', fontWeight: '800', fontSize: 20 },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  markAllBtn: {
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 8,
  },
  markAllText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },

  scroll: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', gap: 13, alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 15, ...Shadows.sm,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: Colors.red },
  icon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red },
  cardBody:  { fontSize: 14.5, color: Colors.textSecondary, marginTop: 3, lineHeight: 20 },
  cardWhen:  { fontSize: 12, color: Colors.textMuted, marginTop: 6 },

  empty:      { alignItems: 'center', paddingVertical: 60, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyText:  { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  hint:       { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
});
