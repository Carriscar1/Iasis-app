import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';
import { FOOTER_LABEL } from '../config/app';
import { listDosesForDay, computeLiveStatus } from '../services/data';
import type { Dose } from '../types';
import type { UserProfile } from '../services/auth';

type Shortcut = { icon: string; label: string; sub: string; route: string; bg: string; ic: string };

const SC = {
  agenda:    { icon: 'calendar',      label: 'Agenda',     sub: 'Seus horários',        route: '/(tabs)/schedule', bg: '#E6F1FB', ic: '#185FA5' },
  dispenser: { icon: 'cube',          label: 'Aparelho',   sub: 'Organizador de doses', route: '/(tabs)/device',   bg: '#E1F5EE', ic: '#0F6E56' },
  historico: { icon: 'bar-chart',     label: 'Histórico',  sub: 'Como você vem indo',   route: '/(tabs)/history',  bg: '#FAEEDA', ic: '#854F0B' },
  perfil:    { icon: 'person',        label: 'Perfil',     sub: 'Sua conta',            route: '/(tabs)/profile',  bg: '#F1F5F9', ic: '#64748B' },
  pacientes: { icon: 'people',        label: 'Pacientes',  sub: 'Quem você cuida',      route: '/patients',        bg: '#EDE9FE', ic: '#6D44C9' },
} satisfies Record<string, Shortcut>;

// Atalhos exibidos variam conforme o perfil do usuário.
const shortcutsForRole = (role?: UserProfile['role']): Shortcut[] => {
  if (role === 'caregiver')  return [SC.pacientes, SC.agenda, SC.historico, SC.perfil];
  // Paciente (idoso): foco na agenda e no histórico, sem o aparelho.
  if (role === 'patient')    return [SC.agenda, SC.historico, SC.perfil];
  return [SC.agenda, SC.dispenser, SC.historico, SC.perfil]; // independente
};

const roleSubtitle = (role?: UserProfile['role']): string => {
  if (role === 'caregiver') return 'Acompanhe quem você cuida';
  if (role === 'patient')   return 'Vamos cuidar da sua saúde hoje';
  return 'Sua saúde em dia';
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const user = useStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [doses, setDoses] = useState<Dose[]>([]);

  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const isElderly = user?.role === 'patient';
  const fs        = (isDesktop ? 15 : isTablet ? 14 : 13) + (isElderly ? 3 : 0);
  const maxW      = isDesktop ? 960 : isTablet ? 720 : undefined;

  const shortcuts = shortcutsForRole(user?.role);

  // Grid: paciente vê cartões maiores (1 coluna no celular) para facilitar o toque.
  const cols     = isElderly ? (isTablet ? 3 : 1) : isDesktop ? 4 : isTablet ? 4 : 2;
  const gap      = 12;
  const padding  = 16;
  const cardW    = (Math.min(width, maxW ?? width) - padding * 2 - gap * (cols - 1)) / cols;

  // Cuidador acompanha pela tela de pacientes; aqui carregamos as doses do
  // próprio usuário (paciente / independente).
  const showsDoses = user?.role !== 'caregiver';

  const loadDoses = useCallback(async () => {
    if (!user || user.role === 'caregiver') { setDoses([]); return; }
    const { data } = await listDosesForDay(user.id);
    setDoses(data.map((d) => ({ ...d, status: computeLiveStatus(d) })));
  }, [user]);

  useFocusEffect(useCallback(() => { loadDoses(); }, [loadDoses]));

  const total   = doses.length;
  const taken   = doses.filter((d) => d.status === 'taken' || d.status === 'late').length;
  const missed  = doses.filter((d) => d.status === 'missed').length;
  const pending = total - taken - missed;
  const pct     = total ? Math.round((taken / total) * 100) : 0;

  // Próxima dose pendente (não tomada e não perdida), a mais cedo do dia.
  const nextDose = doses
    .filter((d) => d.status === 'due' || d.status === 'upcoming' || d.status === 'pending')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDoses().finally(() => setTimeout(() => setRefreshing(false), 600));
  }, [loadDoses]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const headlineStatus = !showsDoses
    ? 'Acompanhe quem você cuida'
    : total === 0
      ? 'Nenhum remédio para hoje'
      : taken >= total
        ? '✅ Tudo certo por hoje!'
        : `💊 ${taken} de ${total} tomado(s) hoje`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Header amigável (sem termos técnicos) */}
      <LinearGradient colors={['#1C2B4B', '#2E4A7A']} style={styles.header}>
        <View style={[styles.headerInner, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : {}]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { fontSize: fs - 1 }]}>{greeting()},</Text>
            <Text style={[styles.userName, { fontSize: (isDesktop ? 26 : isTablet ? 24 : 22) + (isElderly ? 4 : 0) }]}>
              {user?.name?.split(' ')[0] ?? 'Usuário'} 👋
            </Text>
            <Text style={[styles.roleSubtitle, { fontSize: fs - 2 }]}>{roleSubtitle(user?.role)}</Text>
          </View>
          <TouchableOpacity style={[styles.avatar, { width: isTablet ? 46 : 40, height: isTablet ? 46 : 40, borderRadius: isTablet ? 23 : 20 }]}
            onPress={() => router.push('/(tabs)/profile')}>
            <Text style={{ fontSize: isTablet ? 18 : 16, fontWeight: '700', color: '#fff' }}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.statusPill, maxW ? { alignSelf: 'flex-start' } : {}]}>
          <Text style={[styles.statusPillText, { fontSize: fs - 2 }]}>{headlineStatus}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.navy} />}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: padding }}>

          {/* Banner do cuidador */}
          {user?.role === 'caregiver' && (
            <TouchableOpacity style={styles.caregiverBanner} onPress={() => router.push('/patients')} activeOpacity={0.85}>
              <View style={styles.caregiverIcon}>
                <Ionicons name="people" size={isTablet ? 26 : 22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.caregiverTitle, { fontSize: fs }]}>Meus pacientes</Text>
                <Text style={[styles.caregiverSub, { fontSize: fs - 3 }]}>Veja os remédios de quem você cuida</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,.7)" />
            </TouchableOpacity>
          )}

          {/* Próximo remédio — foco principal */}
          {showsDoses && (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Próximo remédio</Text>
              {nextDose ? (
                <TouchableOpacity
                  style={[styles.nextCard, nextDose.status === 'due' && styles.nextCardDue]}
                  onPress={() => router.push('/(tabs)/schedule')}
                  activeOpacity={0.85}
                >
                  <View style={[styles.nextIcon, { backgroundColor: nextDose.status === 'due' ? '#FFFFFF' : Colors.greenLight }]}>
                    <Ionicons name={nextDose.status === 'due' ? 'alarm' : 'time'} size={isElderly ? 36 : 28} color={nextDose.status === 'due' ? Colors.amberText : Colors.greenText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nextStatus, { fontSize: fs - 1 }, nextDose.status === 'due' && { color: '#fff' }]}>
                      {nextDose.status === 'due' ? 'Está na hora de tomar!' : nextDose.status === 'upcoming' ? 'Daqui a pouco' : 'Mais tarde'}
                    </Text>
                    <Text style={[styles.nextName, { fontSize: isElderly ? 26 : 20 }, nextDose.status === 'due' && { color: '#fff' }]} numberOfLines={1}>
                      {nextDose.medication ? `${nextDose.medication.name} ${nextDose.medication.dosage}` : 'Medicamento'}
                    </Text>
                    <Text style={[styles.nextTime, { fontSize: isElderly ? 19 : 15 }, nextDose.status === 'due' && { color: 'rgba(255,255,255,.85)' }]}>
                      🕐 {fmtTime(nextDose.scheduledAt)}{nextDose.medication?.instructions ? ` · ${nextDose.medication.instructions}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={nextDose.status === 'due' ? 'rgba(255,255,255,.8)' : Colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.nextEmpty} onPress={() => router.push('/(tabs)/schedule')} activeOpacity={0.85}>
                  <Ionicons name={total > 0 ? 'checkmark-circle' : 'add-circle'} size={isElderly ? 38 : 30} color={total > 0 ? Colors.greenText : Colors.navy} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nextEmptyTitle, { fontSize: isElderly ? 21 : 16 }]}>
                      {total > 0 ? 'Tudo certo por hoje!' : 'Nenhum remédio para hoje'}
                    </Text>
                    <Text style={[styles.nextEmptySub, { fontSize: fs - 2 }]}>
                      {total > 0 ? `${taken} dose(s) já tomada(s). Bom trabalho!` : 'Toque para adicionar um medicamento.'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Resumo de hoje */}
          {showsDoses && total > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Resumo de hoje</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  {[
                    { val: taken,   label: 'Tomados',   color: Colors.greenText },
                    { val: pending, label: 'A tomar',   color: '#185FA5' },
                    { val: missed,  label: 'Perdidos',  color: Colors.redText },
                  ].map((s, i) => (
                    <React.Fragment key={s.label}>
                      {i > 0 && <View style={styles.summaryDivider} />}
                      <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNum, { color: s.color, fontSize: isElderly ? 30 : 26 }]}>{s.val}</Text>
                        <Text style={[styles.summaryLabel, { fontSize: fs - 2 }]}>{s.label}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={[styles.progressText, { fontSize: fs - 2 }]}>{pct}% das doses de hoje concluídas</Text>
              </View>
            </View>
          )}

          {/* Atalhos */}
          <Text style={[styles.sectionTitle, { fontSize: fs - 2, marginTop: 24 }]}>Acesso rápido</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {shortcuts.map(item => (
              <TouchableOpacity
                key={item.label}
                style={[styles.gridCard, { width: cardW }]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.gridIcon, { backgroundColor: item.bg, width: isTablet ? 52 : 44, height: isTablet ? 52 : 44, borderRadius: isTablet ? 16 : 13 }]}>
                  <Ionicons name={item.icon as any} size={isTablet ? 26 : 22} color={item.ic} />
                </View>
                <Text style={[styles.gridLabel, { fontSize: fs }]}>{item.label}</Text>
                <Text style={[styles.gridSub, { fontSize: fs - 3 }]}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dica do dia */}
          <View style={styles.tipCard}>
            <Ionicons name="heart" size={isElderly ? 22 : 18} color={Colors.redText} />
            <Text style={[styles.tipText, { fontSize: fs - 1 }]}>
              {isElderly
                ? 'Tome seus remédios sempre no mesmo horário. Se tiver dúvida, chame seu cuidador.'
                : 'Manter o horário certo dos remédios faz toda a diferença no tratamento.'}
            </Text>
          </View>

          <Text style={[styles.version, { fontSize: fs - 3 }]}>{FOOTER_LABEL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:      { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting:    { color: 'rgba(255,255,255,.65)', fontWeight: '500' },
  userName:    { fontWeight: '700', color: '#fff', marginTop: 2 },
  roleSubtitle:{ color: 'rgba(255,255,255,.55)', marginTop: 3 },
  avatar:      { backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  statusPill:  { backgroundColor: 'rgba(255,255,255,.14)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start' },
  statusPillText: { color: '#fff', fontWeight: '600' },
  sectionTitle:{ fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.greenLight, ...Shadows.md },
  nextCardDue: { backgroundColor: Colors.amberText, borderColor: Colors.amberText },
  nextIcon:    { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nextStatus:  { color: Colors.greenText, fontWeight: '700' },
  nextName:    { fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  nextTime:    { color: Colors.textSecondary, marginTop: 4 },
  nextEmpty:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 18, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  nextEmptyTitle: { fontWeight: '700', color: Colors.textPrimary },
  nextEmptySub:   { color: Colors.textSecondary, marginTop: 3 },
  summaryCard:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  summaryRow:     { flexDirection: 'row' },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryNum:     { fontWeight: '800' },
  summaryLabel:   { color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 0.5, backgroundColor: Colors.border },
  progressTrack:  { height: 8, borderRadius: 4, backgroundColor: Colors.borderSoft, marginTop: 16, overflow: 'hidden' },
  progressFill:   { height: 8, borderRadius: 4, backgroundColor: Colors.green },
  progressText:   { color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  caregiverBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1C2B4B', borderRadius: Radius.md, padding: 14, marginTop: 20, ...Shadows.md },
  caregiverIcon:   { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' },
  caregiverTitle:  { fontWeight: '700', color: '#fff' },
  caregiverSub:    { color: 'rgba(255,255,255,.65)', marginTop: 2 },
  gridCard:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  gridIcon:    { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gridLabel:   { fontWeight: '700', color: Colors.textPrimary },
  gridSub:     { color: Colors.textSecondary, marginTop: 3 },
  tipCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.redLight, borderRadius: Radius.md, padding: 16, marginTop: 22 },
  tipText:     { flex: 1, color: Colors.textPrimary, lineHeight: 20 },
  version:     { textAlign: 'center', color: Colors.textMuted, marginTop: 22 },
});
