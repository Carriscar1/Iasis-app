// ─────────────────────────────────────────────
//  IASIS — Equipe de cuidado
//
//  Quem cuida de um idoso raramente é uma pessoa só: costumam ser o filho,
//  a filha e às vezes uma enfermeira. Aqui o paciente monta essa equipe —
//  e todos passam a receber os mesmos avisos de dose perdida e de estoque
//  acabando.
// ─────────────────────────────────────────────
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Alert as RNAlert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radius, Shadows } from '../theme';
import { useElderlyMode } from '../hooks/useElderly';
import Avatar from '../components/Avatar';
import {
  listCareTeam, removeCareLink, addCareLink, type CareMember,
} from '../services/careTeam';
import { contactsSupported } from '../services/contacts';
import { findCaregiverByEmail } from '../services/auth';
import { openWhatsApp } from '../services/chat';

export default function CareTeamScreen() {
  const { width } = useWindowDimensions();
  const isElderly = useElderlyMode();
  const maxW = width >= 1024 ? 700 : width >= 768 ? 580 : undefined;
  const fs   = isElderly ? 16 : 14.5;

  const [team, setTeam]         = useState<CareMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Adicionar por e-mail (caminho alternativo ao da agenda)
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail]         = useState('');
  const [adding, setAdding]       = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await listCareTeam();
    if (err) setError('Não consegui carregar a equipe agora.');
    else { setTeam(data); setError(null); }
    setLoading(false);
    setRefresh(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const caregivers = team.filter((m) => m.side === 'caregiver');
  const patients   = team.filter((m) => m.side === 'patient');

  const addByEmail = async () => {
    const value = email.trim().toLowerCase();
    if (!value) { setError('Digite o e-mail da pessoa.'); return; }

    setAdding(true);
    setError(null);

    const found = await findCaregiverByEmail(value);

    if (!found) {
      setAdding(false);
      setError('Nenhuma conta IASIS com esse e-mail. Confira ou peça para a pessoa se cadastrar.');
      return;
    }

    const { error: linkErr } = await addCareLink(found.id, 'caregiver');
    setAdding(false);

    if (linkErr) { setError(linkErr); return; }

    setEmail('');
    setEmailOpen(false);
    load();
  };

  const confirmRemove = (member: CareMember) => {
    const isCaregiver = member.side === 'caregiver';

    RNAlert.alert(
      'Desfazer vínculo',
      isCaregiver
        ? `${member.name} deixa de acompanhar suas doses e não recebe mais os seus avisos. Confirma?`
        : `Você deixa de acompanhar ${member.name}. Confirma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desfazer',
          style: 'destructive',
          onPress: async () => {
            const { error: err } = await removeCareLink(member.linkId);
            if (err) { setError('Não consegui desfazer o vínculo agora.'); return; }
            load();
          },
        },
      ],
    );
  };

  const renderMember = (member: CareMember) => (
    <View key={member.linkId} style={styles.member}>
      <Avatar name={member.name} uri={member.avatarUrl} size={46} />

      <View style={{ flex: 1 }}>
        <Text style={[styles.memberName, { fontSize: fs + 1 }]} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={[styles.memberMeta, { fontSize: fs - 2 }]} numberOfLines={1}>
          {member.relation
            ? member.relation
            : member.side === 'caregiver' ? 'Cuidador' : 'Paciente'}
          {member.phone ? ` · ${member.phone}` : ''}
        </Text>
      </View>

      {member.phone ? (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => openWhatsApp(member.phone!)}
          accessibilityLabel={`Falar com ${member.name} no WhatsApp`}
        >
          <Ionicons name="logo-whatsapp" size={19} color={Colors.greenText} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => router.push('/chat')}
        accessibilityLabel={`Conversar com ${member.name}`}
      >
        <Ionicons name="chatbubble-outline" size={18} color={Colors.navy} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => confirmRemove(member)}
        accessibilityLabel={`Desfazer vínculo com ${member.name}`}
      >
        <Ionicons name="close" size={19} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Equipe de cuidado</Text>
          <Text style={styles.subtitle}>Quem acompanha e quem é acompanhado</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefresh(true); load(); }}
            tintColor={Colors.navy}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.navy} />
          </View>
        ) : (
          <>
            {/* ── Meus cuidadores ── */}
            <Text style={[styles.sectionTitle, { fontSize: fs + 1 }]}>
              Meus cuidadores
            </Text>

            {caregivers.length > 0 ? (
              <View style={styles.card}>{caregivers.map(renderMember)}</View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={30} color={Colors.textMuted} />
                <Text style={[styles.emptyText, { fontSize: fs - 1 }]}>
                  Você ainda não tem cuidadores. Sem ninguém na equipe, os avisos
                  de dose perdida ficam só com você.
                </Text>
              </View>
            )}

            {/* ── Adicionar ── */}
            {contactsSupported() ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push('/contact-picker')}
                activeOpacity={0.85}
              >
                <View style={styles.addIcon}>
                  <Ionicons name="person-add" size={19} color={Colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addTitle, { fontSize: fs }]}>
                    Escolher da agenda
                  </Text>
                  <Text style={[styles.addDesc, { fontSize: fs - 2.5 }]}>
                    Sem digitar número errado
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setEmailOpen((v) => !v)}
              activeOpacity={0.85}
            >
              <View style={styles.addIcon}>
                <Ionicons name="mail-outline" size={19} color={Colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addTitle, { fontSize: fs }]}>
                  Adicionar pelo e-mail
                </Text>
                <Text style={[styles.addDesc, { fontSize: fs - 2.5 }]}>
                  Se a pessoa não está na sua agenda
                </Text>
              </View>
              <Ionicons
                name={emailOpen ? 'chevron-up' : 'chevron-forward'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>

            {emailOpen ? (
              <View style={styles.emailBox}>
                <TextInput
                  style={[styles.input, { fontSize: fs }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.emailBtn, adding && { opacity: 0.6 }]}
                  onPress={addByEmail}
                  disabled={adding}
                >
                  {adding
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Ionicons name="add" size={20} color="#fff" />}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ── Meus pacientes (visão do cuidador) ── */}
            {patients.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { fontSize: fs + 1, marginTop: 22 }]}>
                  Pacientes que eu acompanho
                </Text>
                <View style={styles.card}>{patients.map(renderMember)}</View>
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={[styles.footnote, { fontSize: fs - 2.5 }]}>
              Todos os cuidadores da equipe recebem os mesmos avisos: dose perdida,
              estoque acabando e emergência.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

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

  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  center: { paddingVertical: 60, alignItems: 'center' },

  sectionTitle: {
    fontWeight: '800', color: Colors.textPrimary, marginBottom: 2, marginTop: 4,
  },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    overflow: 'hidden', ...Shadows.sm,
  },
  member: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  memberName: { fontWeight: '700', color: Colors.textPrimary },
  memberMeta: { color: Colors.textSecondary, marginTop: 2 },

  iconBtn: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 20,
    alignItems: 'center', gap: 9, ...Shadows.sm,
  },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 14, marginTop: 4, ...Shadows.sm,
  },
  addIcon: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: Colors.blueLight + '3A',
    alignItems: 'center', justifyContent: 'center',
  },
  addTitle: { fontWeight: '700', color: Colors.textPrimary },
  addDesc:  { color: Colors.textSecondary, marginTop: 2 },

  emailBox: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  emailBtn: {
    width: 46, height: 46, borderRadius: Radius.md, backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },

  error: {
    fontSize: 13.5, color: Colors.redText, backgroundColor: Colors.redLight,
    padding: 11, borderRadius: Radius.sm, marginTop: 8,
  },
  footnote: {
    color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 14,
  },
});
