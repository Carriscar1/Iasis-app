// ─────────────────────────────────────────────
//  HomeScreen — Dashboard principal do IASIS
// ─────────────────────────────────────────────
import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, differenceInMinutes } from 'date-fns';


import { useStore } from '../store';
import { useDoses } from '../hooks/useDoses';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Card, Pill, MetricCard, SectionHeader } from '../components/ui';
import { DoseItem } from '../components/DoseItem';
import { computeAdherence } from '../services/firebase';

export default function HomeScreen() {
  const router  = useRouter();
  const { user, todayDoses, nextDose, dispenser, mqttConnected } = useStore();
  const { todayDoses: _ } = useDoses(); // inicia subscription

  const taken  = todayDoses.filter(d => d.status === 'taken' || d.status === 'late').length;
  const missed = todayDoses.filter(d => d.status === 'missed').length;
  const adherence = computeAdherence(todayDoses);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const nextDoseMinutes = nextDose
    ? differenceInMinutes(new Date(nextDose.scheduledAt), new Date())
    : null;

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{user?.name ?? 'Usuário'} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Status dispenser */}
        <View style={styles.statusRow}>
          <View style={styles.statusDot}>
            <View style={[
              styles.dot,
              { backgroundColor: mqttConnected ? '#5DCAA5' : Colors.amberText }
            ]} />
            <Text style={styles.statusText}>
              {mqttConnected
                ? `${dispenser?.name ?? 'Dispenser'} online`
                : 'Dispenser offline'}
            </Text>
          </View>
          {dispenser && (
            <Text style={styles.sensorText}>
              {dispenser.sensors.humidity}% · {dispenser.sensors.temperature}°C
            </Text>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.navy} />}
      >
        {/* Próxima dose */}
        {nextDose && nextDoseMinutes !== null && nextDoseMinutes >= 0 && (
          <TouchableOpacity
            style={styles.nextDoseBanner}
            onPress={() => router.push('/(tabs)/schedule')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#1C2B4B', '#2E5288']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextDoseGradient}
            >
              <View>
                <Text style={styles.nextDoseTitle}>
                  ⏰ {nextDoseMinutes <= 0 ? 'Dose agora!' : `Próxima dose em ${nextDoseMinutes} min`}
                </Text>
                <Text style={styles.nextDoseSub}>
                  {nextDose.medication?.name} {nextDose.medication?.dosage}
                  {' · '}
                  {format(new Date(nextDose.scheduledAt), 'HH:mm')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,.6)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Métricas */}
        <View style={styles.metrics}>
          <MetricCard
            label="Adesão"
            value={`${adherence}%`}
            sub="Hoje"
            color={adherence >= 80 ? Colors.greenText : Colors.redText}
            icon={<Ionicons name="stats-chart" size={14} color={Colors.textSecondary} />}
            style={styles.metricItem}
          />
          <MetricCard
            label="Doses hoje"
            value={`${taken}/${todayDoses.length}`}
            sub="Tomadas"
            icon={<Ionicons name="medical" size={14} color={Colors.textSecondary} />}
            style={styles.metricItem}
          />
          <MetricCard
            label="Umidade"
            value={dispenser ? `${dispenser.sensors.humidity}%` : '--'}
            sub={dispenser?.sensors.humidity
              ? dispenser.sensors.humidity <= 60 ? '✓ Ideal' : '⚠ Alta'
              : 'Offline'}
            color="#185FA5"
            icon={<Ionicons name="water" size={14} color={Colors.textSecondary} />}
            style={styles.metricItem}
          />
          <MetricCard
            label="Perdidas"
            value={missed}
            sub="Este dia"
            color={missed > 0 ? Colors.redText : Colors.greenText}
            icon={<Ionicons name="alert-circle" size={14} color={Colors.textSecondary} />}
            style={styles.metricItem}
          />
        </View>

        {/* Doses de hoje */}
        <SectionHeader
          title="Doses de hoje"
          action="Ver agenda"
          onAction={() => router.push('/(tabs)/schedule')}
        />

        {todayDoses.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>Nenhuma dose agendada para hoje.</Text>
          </Card>
        ) : (
          todayDoses.map(dose => (
            <DoseItem
              key={dose.id}
              dose={dose}
              onPress={() => router.push('/(tabs)/schedule')}
            />
          ))
        )}

        {/* Atalho dispenser */}
        <SectionHeader title="Dispenser" />
        <TouchableOpacity
          style={styles.deviceCard}
          onPress={() => router.push('/(tabs)/device')}
          activeOpacity={0.85}
        >
          <Card style={styles.deviceCardInner}>
            <View style={styles.deviceRow}>
              <View style={[styles.deviceIcon, { backgroundColor: Colors.greenLight }]}>
                <Ionicons name="hardware-chip" size={22} color={Colors.greenText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{dispenser?.name ?? 'IASIS-01'}</Text>
                <Text style={styles.deviceSub}>ESP32 · MQTT · DHT22</Text>
              </View>
              <Pill
                label={mqttConnected ? 'Online' : 'Offline'}
                variant={mqttConnected ? 'success' : 'error'}
                dot
              />
            </View>
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  headerTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   Spacing.sm,
  },
  greeting:  { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.65)', fontWeight: '500' },
  userName:  { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.white, marginTop: 2 },
  avatar: {
    width:        40,
    height:       40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems:   'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.white },
  statusRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusDot:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,.75)', fontWeight: '500' },
  sensorText: { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,.55)' },

  content:    { paddingBottom: 32 },

  nextDoseBanner:   { marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.xs, borderRadius: Radius.md, overflow: 'hidden', ...Shadows.md },
  nextDoseGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderRadius: Radius.md },
  nextDoseTitle:    { fontSize: Fonts.sizes.base, fontWeight: '600', color: Colors.white, marginBottom: 4 },
  nextDoseSub:      { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.7)' },

  metrics:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.xs },
  metricItem: { width: '47.5%' },

  emptyText: { textAlign: 'center', color: Colors.textSecondary, fontSize: Fonts.sizes.sm },

  deviceCard:      { marginBottom: Spacing.xs },
  deviceCardInner: { marginBottom: 0 },
  deviceRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  deviceIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  deviceName: { fontSize: Fonts.sizes.base, fontWeight: '600', color: Colors.textPrimary },
  deviceSub:  { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
});
