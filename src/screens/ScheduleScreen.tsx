import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, useWindowDimensions, TextInput, ActivityIndicator,
  RefreshControl, Alert as RNAlert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import {
  listDosesForDay, createMedication, createDose, markDoseTaken,
  deleteDose, computeLiveStatus,
} from '../services/data';
import { searchMedications, type CatalogMed } from '../data/medications';
import {
  requestPermission, scheduleDoseReminder, cancelDoseReminder,
} from '../services/notifications';
import type { Dose, DoseStatus, MedForm } from '../types';

const CFG: Record<DoseStatus, { label: string; bg: string; tc: string; icon: string }> = {
  taken:    { label: 'Tomada',   bg: '#E1F5EE', tc: '#0F6E56', icon: 'checkmark-circle' },
  late:     { label: 'Atraso',   bg: '#FAEEDA', tc: '#854F0B', icon: 'time'            },
  missed:   { label: 'Perdida',  bg: '#FCEBEB', tc: '#A32D2D', icon: 'close-circle'    },
  due:      { label: 'Agora',    bg: '#FAEEDA', tc: '#854F0B', icon: 'notifications'   },
  upcoming: { label: 'Em breve', bg: '#E6F1FB', tc: '#185FA5', icon: 'alarm'           },
  pending:  { label: 'Aguarda',  bg: '#F1F5F9', tc: '#64748B', icon: 'ellipse-outline' },
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW      = isDesktop ? 900 : isTablet ? 680 : undefined;
  const fs        = isDesktop ? 15 : isTablet ? 14 : 13;

  const user = useStore((s) => s.user);

  const [doses, setDoses]     = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sel, setSel]         = useState<Dose | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await listDosesForDay(user.id);
    if (error) RNAlert.alert('Erro', error);
    // aplica status "ao vivo" (due/upcoming/missed) sem gravar ainda
    setDoses(data.map((d) => ({ ...d, status: computeLiveStatus(d) })));
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  // Pede permissão de notificação uma vez ao abrir a agenda (no-op na web).
  useEffect(() => { requestPermission(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleTake = async (dose: Dose) => {
    const { error } = await markDoseTaken(dose.id, 'manual', dose.scheduledAt);
    if (error) { RNAlert.alert('Erro', error); return; }
    await cancelDoseReminder(dose.id); // já tomou: não precisa mais lembrar
    setSel(null);
    load();
  };

  const handleDelete = async (dose: Dose) => {
    const { error } = await deleteDose(dose.id);
    if (error) { RNAlert.alert('Erro', error); return; }
    await cancelDoseReminder(dose.id);
    setSel(null);
    load();
  };

  const taken   = doses.filter((d) => d.status === 'taken' || d.status === 'late').length;
  const pending = doses.filter((d) => ['pending', 'upcoming', 'due'].includes(d.status)).length;
  const missed  = doses.filter((d) => d.status === 'missed').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Agenda de Doses</Text>
            <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setFormOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.navy} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

            <View style={styles.summaryCard}>
              {[
                { val: taken,   label: 'Tomadas',  color: '#0F6E56' },
                { val: pending, label: 'Pendentes', color: '#185FA5' },
                { val: missed,  label: 'Perdidas',  color: '#A32D2D' },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <View style={styles.summaryDivider} />}
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNum, { color: s.color, fontSize: isTablet ? 28 : 24 }]}>{s.val}</Text>
                    <Text style={[styles.summaryLabel, { fontSize: fs - 2 }]}>{s.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { fontSize: fs - 2, marginTop: 20 }]}>Doses de hoje</Text>

            {doses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
                <Text style={[styles.emptyTitle, { fontSize: fs }]}>Nenhuma dose para hoje</Text>
                <Text style={[styles.emptySub, { fontSize: fs - 2 }]}>Toque em + para adicionar um medicamento.</Text>
              </View>
            ) : (
              doses.map((dose) => {
                const cfg = CFG[dose.status];
                const med = dose.medication;
                return (
                  <TouchableOpacity
                    key={dose.id}
                    style={[styles.doseCard, (dose.status === 'upcoming' || dose.status === 'due') && { borderColor: '#93B4DA', backgroundColor: '#F0F6FF' }]}
                    onPress={() => setSel(dose)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.doseIcon, { backgroundColor: cfg.bg, width: isTablet ? 50 : 44, height: isTablet ? 50 : 44, borderRadius: isTablet ? 15 : 12 }]}>
                      <Ionicons name={cfg.icon as any} size={isTablet ? 24 : 20} color={cfg.tc} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.doseTime, { fontSize: fs - 2 }]}>{fmtTime(dose.scheduledAt)}</Text>
                      <Text style={[styles.doseName, { fontSize: fs + 1 }]}>{med ? `${med.name} ${med.dosage}` : 'Medicamento'}</Text>
                      {!!med?.instructions && <Text style={[styles.doseInstr, { fontSize: fs - 2 }]}>{med.instructions}</Text>}
                    </View>
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.badgeText, { color: cfg.tc, fontSize: fs - 3 }]}>{cfg.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Detalhe da dose */}
      <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { padding: isTablet ? 32 : 24, maxWidth: maxW ?? '100%', width: '100%' }]}>
            <View style={styles.handle} />
            {sel && (
              <>
                <Text style={[styles.sheetTitle, { fontSize: isTablet ? 22 : 19 }]}>
                  {sel.medication ? `${sel.medication.name} ${sel.medication.dosage}` : 'Dose'}
                </Text>
                <Text style={[styles.sheetSub, { fontSize: fs }]}>
                  {fmtTime(sel.scheduledAt)}{sel.medication?.instructions ? ` · ${sel.medication.instructions}` : ''}
                </Text>
                {[
                  { label: 'Status',      val: CFG[sel.status].label },
                  { label: 'Compartimento', val: `Nº ${sel.medication?.compartment ?? '—'}` },
                  { label: 'Validação',   val: sel.validatedBy === 'rfid' ? 'Pulseira RFID' : sel.validatedBy === 'caregiver' ? 'Cuidador' : sel.takenAt ? 'Manual' : 'Aguardando' },
                ].map((r) => (
                  <View key={r.label} style={styles.sheetRow}>
                    <Text style={[styles.sheetLabel, { fontSize: fs }]}>{r.label}</Text>
                    <Text style={[styles.sheetValue, { fontSize: fs }]}>{r.val}</Text>
                  </View>
                ))}

                {sel.status !== 'taken' && sel.status !== 'late' && (
                  <TouchableOpacity style={[styles.primaryBtn, { paddingVertical: isTablet ? 16 : 14 }]} onPress={() => handleTake(sel)}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={[styles.primaryBtnText, { fontSize: fs }]}>Marcar como tomada</Text>
                  </TouchableOpacity>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={[styles.closeBtn, { flex: 1, paddingVertical: isTablet ? 16 : 13 }]} onPress={() => setSel(null)}>
                    <Text style={[styles.closeBtnText, { fontSize: fs }]}>Fechar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.deleteBtn, { paddingVertical: isTablet ? 16 : 13 }]} onPress={() => handleDelete(sel)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.redText} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Formulário de novo medicamento */}
      <AddMedicationModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        userId={user?.id ?? null}
        onSaved={() => { setFormOpen(false); load(); }}
        isTablet={isTablet}
        maxW={maxW}
        fs={fs}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Modal: adicionar medicamento + dose de hoje
// ─────────────────────────────────────────────
function AddMedicationModal({
  visible, onClose, userId, onSaved, isTablet, maxW, fs,
}: {
  visible: boolean; onClose: () => void; userId: string | null;
  onSaved: () => void; isTablet: boolean; maxW?: number; fs: number;
}) {
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState<CatalogMed | null>(null);
  const [customMode, setCustom] = useState(false);
  const [name, setName]         = useState('');
  const [form, setForm]         = useState<MedForm>('comprimido');
  const [dosage, setDosage]     = useState('');
  const [time, setTime]         = useState('08:00');
  const [compartment, setComp]  = useState(1);
  const [instr, setInstr]       = useState('');
  const [saving, setSaving]     = useState(false);

  const reset = () => {
    setQuery(''); setSelected(null); setCustom(false); setName('');
    setForm('comprimido'); setDosage(''); setTime('08:00'); setComp(1); setInstr('');
  };

  const validTime = /^([01]?\d|2[0-3]):([0-5]\d)$/.test(time);
  const results = visible && !selected && !customMode ? searchMedications(query, 8) : [];

  const pickFromCatalog = (m: CatalogMed) => {
    setSelected(m);
    setName(m.name);
    setForm(m.form);
    setDosage(m.dosages[0] ?? '');
    setQuery('');
  };

  const clearSelection = () => {
    setSelected(null); setCustom(false); setName(''); setDosage(''); setQuery('');
  };

  const handleSave = async () => {
    if (!userId) { RNAlert.alert('Erro', 'Sessão expirada. Entre novamente.'); return; }
    if (!name.trim() || !dosage.trim()) { RNAlert.alert('Atenção', 'Escolha um remédio e a dosagem.'); return; }
    if (!validTime) { RNAlert.alert('Atenção', 'Horário inválido. Use HH:MM (ex: 08:30).'); return; }

    setSaving(true);
    const med = await createMedication(userId, { name, dosage, form, compartment, instructions: instr });
    if (med.error || !med.data) { setSaving(false); RNAlert.alert('Erro', med.error ?? 'Falha ao salvar.'); return; }

    const [h, m] = time.split(':').map(Number);
    const when = new Date(); when.setHours(h, m, 0, 0);
    const dose = await createDose(userId, { medicationId: med.data.id, scheduledAt: when.toISOString() });
    setSaving(false);
    if (dose.error || !dose.data) { RNAlert.alert('Erro', dose.error ?? 'Falha ao salvar.'); return; }

    // Agenda o lembrete local no horário da dose (no-op na web / sem permissão).
    await scheduleDoseReminder({
      doseId: dose.data.id,
      title:  '💊 Hora do remédio',
      body:   `${name} ${dosage}${instr ? ` · ${instr}` : ''}`,
      date:   when,
    });

    reset();
    onSaved();
  };

  const hasMed = !!selected || customMode;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { padding: isTablet ? 32 : 24, maxWidth: maxW ?? '100%', width: '100%', maxHeight: '90%' }]}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sheetTitle, { fontSize: isTablet ? 22 : 19, marginBottom: 16 }]}>Novo medicamento</Text>

            {/* Busca no catálogo */}
            {!hasMed && (
              <Field label="Buscar remédio" fs={fs}>
                <View style={[styles.inputWrap]}>
                  <Ionicons name="search" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.inputFlex, { fontSize: fs }]}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Nome ou marca (ex: Losartana, Tylenol)"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                  />
                </View>
                <View style={styles.resultsBox}>
                  {results.map((m) => (
                    <TouchableOpacity key={m.name} style={styles.resultRow} onPress={() => pickFromCatalog(m)} activeOpacity={0.7}>
                      <View style={styles.pillIcon}>
                        <Ionicons name="medkit-outline" size={16} color={Colors.navy} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultName, { fontSize: fs }]}>{m.name}{m.brand ? <Text style={{ color: Colors.textMuted }}>  · {m.brand}</Text> : null}</Text>
                        <Text style={[styles.resultMeta, { fontSize: fs - 3 }]}>{m.category} · {m.dosages.join(', ')}</Text>
                      </View>
                      <Ionicons name="add-circle" size={20} color={Colors.green} />
                    </TouchableOpacity>
                  ))}
                  {query.length > 0 && results.length === 0 && (
                    <Text style={{ padding: 12, color: Colors.textSecondary, fontSize: fs - 1 }}>Nenhum remédio encontrado no catálogo.</Text>
                  )}
                </View>
                <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => { setCustom(true); setName(query); setQuery(''); }}>
                  <Text style={{ fontSize: fs - 1, color: Colors.navy, fontWeight: '600' }}>Não encontrou? Digitar manualmente</Text>
                </TouchableOpacity>
              </Field>
            )}

            {/* Remédio escolhido */}
            {hasMed && (
              <>
                {customMode ? (
                  <Field label="Nome do remédio" fs={fs}>
                    <TextInput style={[styles.input, { fontSize: fs }]} value={name} onChangeText={setName}
                      placeholder="Ex: Losartana" placeholderTextColor={Colors.textMuted} autoFocus />
                  </Field>
                ) : (
                  <View style={styles.selectedCard}>
                    <View style={styles.pillIcon}>
                      <Ionicons name="medkit" size={18} color={Colors.navy} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultName, { fontSize: fs + 1 }]}>{selected?.name}</Text>
                      <Text style={[styles.resultMeta, { fontSize: fs - 2 }]}>{selected?.brand} · {selected?.category}</Text>
                    </View>
                    <TouchableOpacity onPress={clearSelection}>
                      <Text style={{ color: Colors.navy, fontWeight: '600', fontSize: fs - 1 }}>Trocar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Field label="Dosagem" fs={fs}>
                  {selected && selected.dosages.length > 0 && (
                    <View style={styles.chipRow}>
                      {selected.dosages.map((d) => (
                        <TouchableOpacity key={d} style={[styles.chip, dosage === d && styles.chipActive]} onPress={() => setDosage(d)}>
                          <Text style={[styles.chipText, { fontSize: fs - 2 }, dosage === d && styles.chipTextActive]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <TextInput style={[styles.input, { fontSize: fs, marginTop: selected ? 8 : 0 }]} value={dosage} onChangeText={setDosage}
                    placeholder="Ex: 50mg" placeholderTextColor={Colors.textMuted} />
                </Field>

                <Field label="Horário" fs={fs}>
                  <TextInput style={[styles.input, { fontSize: fs }]} value={time} onChangeText={setTime}
                    placeholder="08:00" placeholderTextColor={Colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={5} />
                </Field>

                <Field label="Compartimento" fs={fs}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity style={styles.stepper} onPress={() => setComp((c) => Math.max(1, c - 1))}>
                      <Ionicons name="remove" size={18} color={Colors.navy} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: fs + 2, fontWeight: '700', color: Colors.textPrimary, minWidth: 24, textAlign: 'center' }}>{compartment}</Text>
                    <TouchableOpacity style={styles.stepper} onPress={() => setComp((c) => Math.min(8, c + 1))}>
                      <Ionicons name="add" size={18} color={Colors.navy} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: fs - 2, color: Colors.textMuted, marginLeft: 4 }}>slot físico (1–8)</Text>
                  </View>
                </Field>

                <Field label="Instruções (opcional)" fs={fs}>
                  <TextInput style={[styles.input, { fontSize: fs }]} value={instr} onChangeText={setInstr}
                    placeholder="Ex: Tomar com água" placeholderTextColor={Colors.textMuted} />
                </Field>

                <TouchableOpacity style={[styles.primaryBtn, { paddingVertical: isTablet ? 16 : 14, marginTop: 8 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="save-outline" size={20} color="#fff" />
                      <Text style={[styles.primaryBtnText, { fontSize: fs }]}>Salvar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={[styles.closeBtn, { paddingVertical: isTablet ? 16 : 13, marginTop: 10 }]} onPress={() => { reset(); onClose(); }}>
              <Text style={[styles.closeBtnText, { fontSize: fs }]}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children, fs, style }: { label: string; children: React.ReactNode; fs: number; style?: any }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={[styles.fieldLabel, { fontSize: fs - 2 }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header:   { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  title:    { fontWeight: '700', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,.6)', marginTop: 4, textTransform: 'capitalize' },
  addBtn:   { width: 44, height: 44, borderRadius: 14, backgroundColor: '#2E4A7A', alignItems: 'center', justifyContent: 'center' },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard:    { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, marginTop: 16, ...Shadows.md },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryNum:     { fontWeight: '700' },
  summaryLabel:   { color: Colors.textSecondary, marginTop: 3 },
  summaryDivider: { width: 0.5, backgroundColor: Colors.border },
  sectionTitle:   { fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyCard:  { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 32, gap: 8, ...Shadows.sm },
  emptyTitle: { fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  emptySub:   { color: Colors.textSecondary, textAlign: 'center' },
  doseCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: 10, padding: 14, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  doseIcon:  { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  doseTime:  { color: Colors.textSecondary },
  doseName:  { fontWeight: '600', color: Colors.textPrimary, marginTop: 1 },
  doseInstr: { color: Colors.textSecondary, marginTop: 2 },
  badge:     { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontWeight: '600' },
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, alignSelf: 'center' },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:{ fontWeight: '700', color: Colors.textPrimary },
  sheetSub:  { color: Colors.textSecondary, marginTop: 4, marginBottom: 16 },
  sheetRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  sheetLabel:{ color: Colors.textSecondary },
  sheetValue:{ fontWeight: '500', color: Colors.textPrimary },
  primaryBtn: { marginTop: 18, backgroundColor: Colors.green, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { fontWeight: '700', color: '#fff' },
  closeBtn:  { backgroundColor: Colors.borderSoft ?? '#F1F5F9', borderRadius: 12, alignItems: 'center' },
  closeBtnText: { fontWeight: '600', color: Colors.textPrimary },
  deleteBtn: { width: 52, backgroundColor: Colors.redLight, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11, color: Colors.textPrimary },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14 },
  inputFlex: { flex: 1, color: Colors.textPrimary, paddingVertical: Platform.OS === 'web' ? 12 : 11 },
  stepper: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  resultsBox: { marginTop: 8, borderRadius: 10, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  resultName: { fontWeight: '600', color: Colors.textPrimary },
  resultMeta: { color: Colors.textSecondary, marginTop: 2 },
  pillIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  selectedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.greenLight, borderRadius: 12, padding: 12, marginBottom: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
});
