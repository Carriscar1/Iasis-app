import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform,
  useWindowDimensions, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import { useElderlyMode } from '../hooks/useElderly';
import {
  listMedications, updateMedication, restockMedication,
  getDosesPerDay, estimateDaysLeft,
} from '../services/data';
import type { Medication } from '../types';

// Quantidades comuns de caixa — atalho para repor sem digitar.
const QUICK_AMOUNTS = [10, 20, 30, 60];

export default function StockScreen() {
  const { width } = useWindowDimensions();
  const maxW = width >= 1024 ? 760 : width >= 768 ? 640 : undefined;

  const user      = useStore((s) => s.user);
  const isElderly = useElderlyMode();
  const fs        = isElderly ? 17 : 15;

  const [meds, setMeds]         = useState<Medication[]>([]);
  const [perDay, setPerDay]     = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de edição
  const [editing, setEditing]   = useState<Medication | null>(null);
  const [amount, setAmount]     = useState('');
  const [threshold, setThreshold] = useState('');
  const [units, setUnits]       = useState('');
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const [m, d] = await Promise.all([
      listMedications(user.id),
      getDosesPerDay(user.id),
    ]);
    if (m.error) RNAlert.alert('Erro', m.error);
    setMeds(m.data);
    setPerDay(d.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const openEditor = (med: Medication) => {
    setEditing(med);
    setAmount('');
    setThreshold(String(med.stockThreshold ?? 5));
    setUnits(String(med.unitsPerDose ?? 1));
  };

  // Define o estoque inicial (ou desliga o controle).
  const handleSaveSettings = async (newStock: number | null) => {
    if (!editing) return;
    setSaving(true);
    const { error } = await updateMedication(editing.id, {
      stock: newStock,
      stockThreshold: Math.max(0, parseInt(threshold, 10) || 5),
      unitsPerDose:   Math.min(20, Math.max(1, parseInt(units, 10) || 1)),
    });
    setSaving(false);
    if (error) { RNAlert.alert('Erro ao salvar', error); return; }
    setEditing(null);
    load();
  };

  // Soma unidades ao estoque atual.
  const handleRestock = async (qty: number) => {
    if (!editing || qty <= 0) return;
    setSaving(true);
    const { error } = await restockMedication(editing.id, qty);
    setSaving(false);
    if (error) { RNAlert.alert('Erro ao repor', error); return; }
    setEditing(null);
    load();
  };

  const tracked   = meds.filter((m) => m.stock != null);
  const untracked = meds.filter((m) => m.stock == null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Estoque</Text>
          <Text style={styles.subtitle}>Quanto ainda tem de cada remédio</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={Colors.navy} style={{ marginTop: 50 }} />
        ) : meds.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="flask-outline" size={50} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum medicamento cadastrado</Text>
            <Text style={styles.emptyText}>
              Cadastre um tratamento na Agenda para controlar o estoque por aqui.
            </Text>
          </View>
        ) : (
          <>
            {tracked.length > 0 && (
              <>
                <Text style={styles.section}>Com controle de estoque</Text>
                {tracked.map((m) => {
                  const dpd  = perDay[m.id] ?? 0;
                  const days = estimateDaysLeft(m, dpd);
                  const low  = (m.stock ?? 0) <= (m.stockThreshold ?? 5);
                  const zero = (m.stock ?? 0) === 0;
                  const color = zero ? Colors.redText : low ? Colors.amberText : Colors.greenText;
                  const bg    = zero ? Colors.redLight : low ? Colors.amberLight : Colors.greenLight;

                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.card}
                      onPress={() => openEditor(m)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.pill, { backgroundColor: bg }]}>
                        <Text style={[styles.pillValue, { color }]}>{m.stock}</Text>
                        <Text style={[styles.pillUnit, { color }]}>un.</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.medName, { fontSize: fs + 1 }]}>
                          {m.name} <Text style={styles.medDose}>{m.dosage}</Text>
                        </Text>
                        <Text style={[styles.medInfo, { fontSize: fs - 2 }]}>
                          {days != null && dpd > 0
                            ? days === 0
                              ? 'acaba hoje'
                              : `dura ~${days} ${days === 1 ? 'dia' : 'dias'}`
                            : 'sem doses agendadas'}
                          {' · '}
                          {m.unitsPerDose ?? 1} por dose
                        </Text>
                        {low && (
                          <View style={[styles.warn, { backgroundColor: bg }]}>
                            <Ionicons
                              name={zero ? 'alert-circle' : 'warning'}
                              size={13}
                              color={color}
                            />
                            <Text style={[styles.warnText, { color }]}>
                              {zero ? 'Acabou — reponha' : 'Está acabando'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {untracked.length > 0 && (
              <>
                <Text style={styles.section}>Sem controle</Text>
                {untracked.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.card, { opacity: 0.75 }]}
                    onPress={() => openEditor(m)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.pill, { backgroundColor: Colors.borderSoft }]}>
                      <Ionicons name="add" size={20} color={Colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.medName, { fontSize: fs + 1 }]}>
                        {m.name} <Text style={styles.medDose}>{m.dosage}</Text>
                      </Text>
                      <Text style={[styles.medInfo, { fontSize: fs - 2 }]}>
                        Toque para ativar o controle
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={styles.hint}>
              O estoque é descontado sozinho toda vez que uma dose é validada. Quando fica
              baixo, você e o seu cuidador recebem um alerta.
            </Text>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal: repor / configurar ── */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editing?.name} <Text style={styles.medDose}>{editing?.dosage}</Text>
            </Text>
            <Text style={styles.modalSub}>
              {editing?.stock != null
                ? `${editing.stock} unidades em estoque`
                : 'Este medicamento ainda não tem controle de estoque'}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
              {/* Repor */}
              <Text style={styles.label}>
                {editing?.stock != null ? 'Adicionar unidades' : 'Quantidade inicial'}
              </Text>
              <View style={styles.quickRow}>
                {QUICK_AMOUNTS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.quickBtn, amount === String(q) && styles.quickBtnActive]}
                    onPress={() => setAmount(String(q))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.quickText, amount === String(q) && styles.quickTextActive]}>
                      +{q}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.inputWrap}>
                <Ionicons name="cube-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 4))}
                  placeholder="ex: 30"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              {/* Ajustes */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Avisar quando restar</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={threshold}
                      onChangeText={(t) => setThreshold(t.replace(/\D/g, '').slice(0, 3))}
                      placeholder="5"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unidades por dose</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={units}
                      onChangeText={(t) => setUnits(t.replace(/\D/g, '').slice(0, 2))}
                      placeholder="1"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Ações */}
            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              activeOpacity={0.85}
              onPress={() => {
                const qty = parseInt(amount, 10) || 0;
                if (editing?.stock != null) {
                  if (qty <= 0) { RNAlert.alert('Informe a quantidade', 'Diga quantas unidades você comprou.'); return; }
                  handleRestock(qty);
                } else {
                  handleSaveSettings(qty);   // ativa o controle com o valor informado
                }
              }}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : (
                  <Text style={styles.primaryText}>
                    {editing?.stock != null ? 'Repor estoque' : 'Ativar controle'}
                  </Text>
                )}
            </TouchableOpacity>

            {editing?.stock != null && (
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => handleSaveSettings(null)}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.ghostText}>Desativar controle deste remédio</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setEditing(null)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={styles.cancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  scroll:   { padding: 16, gap: 10 },

  section: { fontSize: 12.5, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 2 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 14, ...Shadows.sm,
  },
  pill: {
    minWidth: 54, height: 54, borderRadius: 16, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  pillValue: { fontSize: 20, fontWeight: '800' },
  pillUnit:  { fontSize: 10, fontWeight: '600', marginTop: -2 },
  medName: { fontWeight: '700', color: Colors.textPrimary },
  medDose: { fontWeight: '500', color: Colors.textSecondary },
  medInfo: { color: Colors.textSecondary, marginTop: 3 },
  warn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginTop: 6,
  },
  warnText: { fontSize: 11.5, fontWeight: '700' },

  hint: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginTop: 14, paddingHorizontal: 4 },

  empty:      { alignItems: 'center', paddingVertical: 60, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyText:  { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  modalWrap:  { flex: 1, backgroundColor: 'rgba(15,28,50,0.45)', justifyContent: 'flex-end' },
  modalCard:  { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30 },
  modalHandle:{ width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalSub:   { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 18 },

  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 7, marginTop: 8 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  quickBtnActive: { borderColor: Colors.navy, backgroundColor: Colors.navy },
  quickText: { fontWeight: '700', color: Colors.textSecondary, fontSize: 14 },
  quickTextActive: { color: '#fff' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg, paddingHorizontal: 13,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 16, paddingVertical: 13 },

  primaryBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  primaryText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  ghostBtn:   { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  ghostText:  { color: Colors.redText, fontSize: 13.5, fontWeight: '600' },
  cancelText: { color: Colors.textSecondary, fontSize: 14.5 },
});
