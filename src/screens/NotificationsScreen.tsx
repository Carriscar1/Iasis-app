import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';
import { requestPermission, sendLocalNotification } from '../services/notifications';

type Status = 'unknown' | 'granted' | 'denied' | 'unsupported';

export default function NotificationsScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const isElderly = useStore((s) => s.user?.role) === 'patient';
  const maxW = isDesktop ? 680 : isTablet ? 560 : undefined;
  const fs   = (isDesktop ? 15 : 14) + (isElderly ? 3 : 0);

  const isWeb = Platform.OS === 'web';
  const [status, setStatus]   = useState<Status>(isWeb ? 'unsupported' : 'unknown');
  const [loading, setLoading] = useState(false);

  // Preferências locais (visuais) de quais lembretes o usuário quer receber.
  const [doseReminder, setDoseReminder] = useState(true);
  const [missedAlert,  setMissedAlert]  = useState(true);
  const [caregiverPing, setCaregiverPing] = useState(useStore.getState().user?.role === 'patient');

  useEffect(() => {
    setCaregiverPing(useStore.getState().user?.role === 'patient');
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const result = await requestPermission();
    setLoading(false);
    setStatus(result === 'granted' ? 'granted' : isWeb ? 'unsupported' : 'denied');
  };

  const handleTest = async () => {
    await sendLocalNotification('💊 Hora do remédio', 'Este é um lembrete de teste do IASIS.');
  };

  const banner = {
    granted:     { bg: Colors.greenLight, color: Colors.greenText, icon: 'checkmark-circle', text: 'Lembretes ativados. Você será avisado no horário de cada dose.' },
    denied:      { bg: Colors.redLight,   color: Colors.redText,   icon: 'close-circle',     text: 'Permissão negada. Ative as notificações nas configurações do aparelho.' },
    unsupported: { bg: Colors.amberLight, color: Colors.amberText, icon: 'information-circle', text: 'No computador os lembretes não tocam. Use o aplicativo no celular para receber os avisos no horário de cada dose.' },
    unknown:     { bg: Colors.borderSoft, color: Colors.textSecondary, icon: 'notifications-outline', text: 'Toque em "Ativar lembretes" para receber um aviso no horário de cada dose.' },
  }[status];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Notificações</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, alignItems: maxW ? 'center' : undefined }}>
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16, paddingTop: 20 }}>

          {/* Status atual */}
          <View style={[styles.banner, { backgroundColor: banner.bg }]}>
            <Ionicons name={banner.icon as any} size={isElderly ? 26 : 22} color={banner.color} />
            <Text style={[styles.bannerText, { color: banner.color, fontSize: fs - 1 }]}>{banner.text}</Text>
          </View>

          {status !== 'granted' && !isWeb && (
            <TouchableOpacity style={styles.enableBtn} onPress={handleEnable} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Ionicons name="notifications" size={20} color="#fff" />
                    <Text style={[styles.enableText, { fontSize: fs }]}>Ativar lembretes</Text>
                  </>
                )}
            </TouchableOpacity>
          )}

          {/* Preferências */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>O que você quer receber</Text>
          <View style={styles.card}>
            <PrefRow
              icon="alarm" label="Lembrete de dose"
              desc="Aviso no horário exato de cada remédio"
              value={doseReminder} onChange={setDoseReminder} fs={fs} isElderly={isElderly}
            />
            <View style={styles.divider} />
            <PrefRow
              icon="warning" label="Alerta de dose perdida"
              desc="Aviso se um remédio não for tomado"
              value={missedAlert} onChange={setMissedAlert} fs={fs} isElderly={isElderly}
            />
            <View style={styles.divider} />
            <PrefRow
              icon="people" label="Avisar meu cuidador"
              desc="Seu cuidador é notificado sobre as doses"
              value={caregiverPing} onChange={setCaregiverPing} fs={fs} isElderly={isElderly}
            />
          </View>

          {status === 'granted' && (
            <TouchableOpacity style={styles.testBtn} onPress={handleTest} activeOpacity={0.85}>
              <Ionicons name="paper-plane-outline" size={18} color={Colors.navy} />
              <Text style={[styles.testText, { fontSize: fs - 1 }]}>Enviar notificação de teste</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.note, { fontSize: fs - 3 }]}>
            As preferências controlam quais avisos aparecem. O envio depende da permissão do aparelho.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrefRow({
  icon, label, desc, value, onChange, fs, isElderly,
}: { icon: string; label: string; desc: string; value: boolean; onChange: (v: boolean) => void; fs: number; isElderly: boolean }) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefIcon}>
        <Ionicons name={icon as any} size={isElderly ? 22 : 18} color={Colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.prefLabel, { fontSize: fs }]}>{label}</Text>
        <Text style={[styles.prefDesc, { fontSize: fs - 2 }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.green }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header:    { backgroundColor: Colors.navy, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  backBtn:   { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  title:     { fontWeight: '700', color: '#fff' },
  banner:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.md, padding: 16, marginBottom: 16 },
  bannerText:{ flex: 1, lineHeight: 20 },
  enableBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 15, marginBottom: 8 },
  enableText:{ color: '#fff', fontWeight: '700' },
  section:   { fontWeight: '700', color: Colors.textSecondary, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  prefRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  prefIcon:  { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  prefLabel: { fontWeight: '600', color: Colors.textPrimary },
  prefDesc:  { color: Colors.textSecondary, marginTop: 2 },
  divider:   { height: 0.5, backgroundColor: Colors.border, marginLeft: 14 },
  testBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.navy, borderRadius: 12, paddingVertical: 13, marginTop: 16 },
  testText:  { color: Colors.navy, fontWeight: '700' },
  note:      { color: Colors.textMuted, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
