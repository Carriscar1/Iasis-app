// ─────────────────────────────────────────────
//  IASIS — Emergência
//
//  Um toque avisa toda a equipe de cuidado, com a localização e a precisão
//  dela. A tela também mostra o estado do GPS antes do aperto, para a
//  pessoa saber o que vai ser enviado.
// ─────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Switch, Platform, useWindowDimensions, Alert as RNAlert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { Radius, Shadows, useTheme, type ThemeColors } from '../theme';
import { useStore } from '../store';
import { useElderlyMode } from '../hooks/useElderly';
import Avatar from '../components/Avatar';
import {
  getCurrentFix, getLastKnownFix, classifyAccuracy, accuracyLabel, prettyCoords, type Fix,
} from '../services/location';
import { motionSupported, IMPACT_THRESHOLD_G } from '../services/motion';
import { raiseEmergency, alertByWhatsApp } from '../services/emergency';
import { listCareTeam, type CareMember } from '../services/careTeam';
import { savePreferences } from '../services/preferences';
import { callPerson, callEmergencyService, ensureCallPermission, EMERGENCY_NUMBERS } from '../services/call';

/** Cor do indicador de precisão do GPS — depende do tema ativo. */
const accuracyColor = (C: ThemeColors) => ({
  high:    { bg: C.greenLight, fg: C.greenText, dot: C.green },
  medium:  { bg: C.amberLight, fg: C.amberText, dot: C.amber },
  low:     { bg: C.redLight,   fg: C.redText,   dot: C.red   },
  unknown: { bg: C.borderSoft, fg: C.textSecondary, dot: C.textMuted },
}) as const;

export default function EmergencyScreen() {
  const { C, styles } = useTheme(makeStyles);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isElderly = useElderlyMode();
  const maxW = width >= 768 ? 600 : undefined;
  const fs = isElderly ? 16.5 : 15;

  const user = useStore((s) => s.user);
  const fallEnabled = useStore((s) => s.fallDetection);
  const setFallEnabled = useStore((s) => s.setFallDetection);
  const simulateFall = useStore((s) => s.simulateFall);

  const [permission] = Location.useForegroundPermissions();

  const [fix, setFix]           = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [sending, setSending]   = useState(false);
  const [sentTo, setSentTo]     = useState<number | null>(null);
  const [team, setTeam]         = useState<CareMember[]>([]);
  const [hasSensor, setSensor]  = useState<boolean | null>(null);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => { motionSupported().then(setSensor); }, []);

  /** Busca a posição. Chamada ao abrir e no botão "atualizar". */
  const locate = useCallback(async () => {
    setLocating(true);
    setLocError(null);

    const { fix: got, error } = await getCurrentFix(permission);
    if (!mounted.current) return;

    if (error) setLocError(error);
    setFix(got);
    setLocating(false);
  }, [permission]);

  useFocusEffect(
    useCallback(() => {
      locate();
      // Permissão de telefone já ao abrir: no socorro a ligação sai direto.
      void ensureCallPermission();
      listCareTeam().then(({ data }) => {
        if (mounted.current) setTeam(data.filter((m) => m.side === 'caregiver'));
      });
    }, [locate]),
  );

  const send = async () => {
    if (sending) return;

    setSending(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    // Vibração longa: confirma o toque sem a pessoa precisar olhar a tela.
    Vibration.vibrate(600);

    // Primeiro a ligação para o primeiro cuidador com telefone — na hora,
    // sem esperar GPS nem servidor. O aviso no app vai logo em seguida.
    const first = team.find((m) => m.phone);
    if (first) void callPerson(first.name, first.phone);

    // Sem posição ainda: usa a última que o aparelho conhece (instantânea).
    // Esperar o GPS aqui segurava o pedido de socorro por vários segundos.
    const current = fix ?? (await getLastKnownFix());

    const { notified, error } = await raiseEmergency(current, 'emergency');
    if (!mounted.current) return;

    setSending(false);

    if (error) {
      RNAlert.alert(
        'Não consegui avisar pelo aplicativo',
        'Sua internet pode estar fora. Use o WhatsApp na lista abaixo para falar ' +
          'direto com quem cuida de você.',
      );
      return;
    }

    setSentTo(notified);

    if (notified === 0) {
      RNAlert.alert(
        'Você ainda não tem cuidadores',
        'Adicione alguém na Equipe de cuidado para que o pedido de socorro chegue a essa pessoa.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Adicionar', onPress: () => router.push('/care-team') },
        ],
      );
    }
  };

  const toggleFall = async (value: boolean) => {
    setFallEnabled(value);
    await savePreferences({ fallDetection: value });
  };

  const acc = fix ? fix.accuracy : 'unknown';
  const tone = accuracyColor(C)[acc];
  const { label, hint } = accuracyLabel(acc);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Emergência</Text>
          <Text style={styles.subtitle}>Avisa todos os seus cuidadores</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isLandscape && styles.scrollLandscape,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        {/* ── Botão de socorro ── */}
        <View style={[styles.sosWrap, isLandscape && { flex: 1 }]}>
          <TouchableOpacity
            style={[styles.sos, sending && { opacity: 0.75 }]}
            onPress={send}
            disabled={sending}
            activeOpacity={0.85}
            accessibilityLabel="Pedir socorro agora"
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <>
                <Ionicons name="alert-circle" size={46} color="#fff" />
                <Text style={styles.sosText}>PEDIR SOCORRO</Text>
              </>
            )}
          </TouchableOpacity>

          {sentTo !== null && sentTo > 0 ? (
            <View style={styles.sentBox}>
              <Ionicons name="checkmark-circle" size={19} color={C.greenText} />
              <Text style={[styles.sentText, { fontSize: fs - 1 }]}>
                {sentTo === 1
                  ? '1 cuidador foi avisado'
                  : `${sentTo} cuidadores foram avisados`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={isLandscape ? { flex: 1, gap: 12 } : { gap: 12 }}>
          {/* ── RF02: indicador de precisão do GPS ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { fontSize: fs }]}>Sua localização</Text>
              <TouchableOpacity onPress={locate} disabled={locating} style={styles.refresh}>
                {locating
                  ? <ActivityIndicator size="small" color={C.navy} />
                  : <Ionicons name="refresh" size={17} color={C.navy} />}
              </TouchableOpacity>
            </View>

            <View style={[styles.accuracyRow, { backgroundColor: tone.bg }]}>
              <View style={[styles.dot, { backgroundColor: tone.dot }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.accuracyLabel, { color: tone.fg, fontSize: fs - 0.5 }]}>
                  {label}
                  {fix?.accuracyMeters != null
                    ? ` · ${Math.round(fix.accuracyMeters)} m`
                    : ''}
                </Text>
                <Text style={[styles.accuracyHint, { fontSize: fs - 2.5 }]}>{hint}</Text>
              </View>
            </View>

            {fix ? (
              <Text style={[styles.coords, { fontSize: fs - 2.5 }]}>
                {prettyCoords(fix)}
              </Text>
            ) : null}

            {locError ? (
              <View style={styles.warn}>
                <Ionicons name="warning-outline" size={16} color={C.amberText} />
                <Text style={[styles.warnText, { fontSize: fs - 2 }]}>{locError}</Text>
              </View>
            ) : null}

            <Text style={[styles.note, { fontSize: fs - 3 }]}>
              O socorro é enviado mesmo sem localização — o aviso é o que
              importa, a coordenada é um extra.
            </Text>
          </View>

          {/* ── Detecção de queda ── */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name="body-outline" size={21} color={C.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { fontSize: fs }]}>Detecção de queda</Text>
                <Text style={[styles.cardDesc, { fontSize: fs - 2.5 }]}>
                  {hasSensor === false
                    ? 'Este aparelho não tem acelerômetro.'
                    : `Impacto acima de ${IMPACT_THRESHOLD_G.toFixed(1)} g dispara um aviso; ` +
                      'você tem 30 segundos para cancelar antes de avisar a família.'}
                </Text>
              </View>
              <Switch
                value={fallEnabled && hasSensor !== false}
                onValueChange={toggleFall}
                disabled={hasSensor === false}
                trackColor={{ false: C.border, true: C.blueLight }}
                thumbColor={fallEnabled ? C.navy : C.surface}
              />
            </View>
            {/* Ensaia o aviso sem precisar derrubar o celular (e funciona no computador). */}
            <TouchableOpacity style={styles.testBtn} onPress={simulateFall} activeOpacity={0.85}>
              <Ionicons name="play-circle-outline" size={18} color={C.navy} />
              <Text style={[styles.testText, { fontSize: fs - 1.5 }]}>Testar aviso de queda</Text>
            </TouchableOpacity>
          </View>

          {/* ── SAMU e Bombeiros ── */}
          <View style={styles.sosRow}>
            {EMERGENCY_NUMBERS.map((e) => (
              <TouchableOpacity
                key={e.number}
                style={styles.sosNum}
                onPress={() => callEmergencyService(e.label, e.number)}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={18} color={C.redText} />
                <Text style={[styles.sosNumText, { fontSize: fs }]}>{e.label} {e.number}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Ligar direto ── */}
          {team.length > 0 && !team.some((m) => m.phone) ? (
            <View style={styles.warn}>
              <Ionicons name="warning-outline" size={16} color={C.amberText} />
              <Text style={[styles.warnText, { fontSize: fs - 2 }]}>
                Nenhum cuidador tem telefone cadastrado, então a ligação automática não
                consegue sair. Peça para cadastrarem em Perfil → Meu telefone.
              </Text>
            </View>
          ) : null}

          {team.length > 0 ? (
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { fontSize: fs, marginBottom: 4 }]}>
                Falar agora
              </Text>
              <Text style={[styles.cardDesc, { fontSize: fs - 2.5, marginBottom: 10 }]}>
                Ligue direto, ou mande sua localização pelo WhatsApp se a internet falhar.
              </Text>

              {team.map((m) => (
                <TouchableOpacity
                  key={m.linkId}
                  style={styles.contact}
                  onPress={() =>
                    m.phone
                      ? alertByWhatsApp(m.phone, user?.name ?? 'O paciente', fix)
                      : RNAlert.alert('Sem telefone', `${m.name} não tem telefone cadastrado.`)
                  }
                  activeOpacity={0.75}
                >
                  <Avatar name={m.name} uri={m.avatarUrl} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactName, { fontSize: fs - 0.5 }]}>{m.name}</Text>
                    <Text style={[styles.contactMeta, { fontSize: fs - 3 }]}>
                      {m.relation ?? 'Cuidador'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => callPerson(m.name, m.phone)}
                    style={styles.callIcon}
                    hitSlop={8}
                    accessibilityLabel={`Ligar para ${m.name}`}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                  </TouchableOpacity>
                  <Ionicons name="logo-whatsapp" size={21} color={C.greenText} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.emptyCard}
              onPress={() => router.push('/care-team')}
              activeOpacity={0.85}
            >
              <Ionicons name="people-outline" size={26} color={C.amberText} />
              <Text style={[styles.emptyText, { fontSize: fs - 1 }]}>
                Você ainda não tem cuidadores. Sem eles, o pedido de socorro não
                chega a ninguém. Toque para montar sua equipe.
              </Text>
            </TouchableOpacity>
          )}

          {Platform.OS === 'web' ? (
            <Text style={[styles.note, { fontSize: fs - 3, textAlign: 'center' }]}>
              No navegador a localização é menos precisa e não há detecção de
              queda. Use o celular para contar com os dois.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.navyBg, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: '#fff', fontWeight: '800', fontSize: 20 },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },

  scroll:          { padding: 16, paddingBottom: 40, gap: 16 },
  scrollLandscape: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },

  sosWrap: { alignItems: 'center', gap: 12 },
  sos: {
    width: '100%', minHeight: 132, borderRadius: Radius.xl,
    backgroundColor: C.red, alignItems: 'center', justifyContent: 'center',
    gap: 8, ...Shadows.lg,
  },
  sosText: {
    color: '#fff', fontWeight: '900', fontSize: 21, letterSpacing: 1,
  },
  sentBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.greenLight, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full,
  },
  sentText: { color: C.greenText, fontWeight: '700' },

  card: {
    backgroundColor: C.surface, borderRadius: Radius.lg,
    padding: 15, gap: 9, ...Shadows.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontWeight: '800', color: C.textPrimary },
  cardDesc:  { color: C.textSecondary, lineHeight: 19, marginTop: 2 },

  refresh: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  accuracyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: Radius.md, padding: 12,
  },
  dot: { width: 13, height: 13, borderRadius: 7 },
  accuracyLabel: { fontWeight: '800' },
  accuracyHint:  { color: C.textSecondary, marginTop: 2 },

  coords: {
    color: C.textMuted, fontVariant: ['tabular-nums'], letterSpacing: 0.3,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: C.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  warn: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: C.amberLight, borderRadius: Radius.sm, padding: 10,
  },
  warnText: { flex: 1, color: C.amberText, lineHeight: 18 },

  note: { color: C.textMuted, lineHeight: 17 },

  contact: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: C.borderSoft,
  },
  contactName: { fontWeight: '700', color: C.textPrimary },
  contactMeta: { color: C.textSecondary, marginTop: 1 },

  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.amberLight, borderRadius: Radius.lg, padding: 15,
  },
  emptyText: { flex: 1, color: C.amberText, lineHeight: 19 },
  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, borderWidth: 1.5, borderColor: C.border, borderRadius: Radius.md, paddingVertical: 11,
  },
  testText: { color: C.navy, fontWeight: '700' },
  callIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  sosRow: { flexDirection: 'row', gap: 10 },
  sosNum: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.redLight, borderRadius: Radius.md, paddingVertical: 14,
  },
  sosNumText: { color: C.redText, fontWeight: '800' },
});
