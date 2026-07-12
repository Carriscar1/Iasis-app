import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, useWindowDimensions, TextInput, ActivityIndicator,
  RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import {
  listDosesForDay, listMedications, createMedication, updateMedication,
  deleteMedication, createDosesBulk, markDoseTaken, deleteDose,
  computeLiveStatus, syncOverdueDoses,
} from '../services/data';
import { searchMedications, MEDICATIONS_ALPHABETICAL, type CatalogMed } from '../data/medications';
import {
  requestPermission, scheduleRemindersForDoses, cancelDoseReminder,
} from '../services/notifications';
import AlarmTimePicker from '../components/AlarmTimePicker';
import DateStrip from '../components/DateStrip';
import ConfirmAction from '../components/ConfirmAction';
import type { Dose, DoseStatus, Medication, MedForm } from '../types';

const CFG: Record<DoseStatus, { label: string; bg: string; tc: string; icon: string }> = {
  taken:    { label: 'Tomada',   bg: '#E1F5EE', tc: '#0F6E56', icon: 'checkmark-circle' },
  late:     { label: 'Atraso',   bg: '#FAEEDA', tc: '#854F0B', icon: 'time'            },
  missed:   { label: 'Perdida',  bg: '#FCEBEB', tc: '#A32D2D', icon: 'close-circle'    },
  due:      { label: 'Agora',    bg: '#FAEEDA', tc: '#854F0B', icon: 'notifications'   },
  upcoming: { label: 'Em breve', bg: '#E6F1FB', tc: '#185FA5', icon: 'alarm'           },
  pending:  { label: 'Aguarda',  bg: '#F1F5F9', tc: '#64748B', icon: 'ellipse-outline' },
};

// Presets de frequência (horários típicos de tratamento).
const FREQ_PRESETS = [
  { label: '1×/dia', times: ['08:00'] },
  { label: '2×/dia', times: ['08:00', '20:00'] },
  { label: '3×/dia', times: ['08:00', '14:00', '20:00'] },
] as const;

const DURATIONS = [
  { label: 'Só hoje', days: 1  },
  { label: '7 dias',  days: 7  },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
] as const;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const atMidnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isToday = (d: Date) => atMidnight(d).getTime() === atMidnight(new Date()).getTime();

const FORM_ICON: Record<MedForm, string> = {
  comprimido: 'tablet-portrait-outline',
  'cápsula':  'ellipse-outline',
  'líquido':  'water-outline',
  outro:      'medkit-outline',
};

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW      = isDesktop ? 900 : isTablet ? 680 : undefined;
  const fs        = isDesktop ? 15 : isTablet ? 14 : 13;

  const user = useStore((s) => s.user);
  const isElderly = user?.role === 'patient';

  const [view, setView]       = useState<'doses' | 'meds'>('doses');
  const [selDay, setSelDay]   = useState<Date>(atMidnight(new Date()));
  const [doses, setDoses]     = useState<Dose[]>([]);
  const [meds, setMeds]       = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sel, setSel]         = useState<Dose | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMed, setEditMed]   = useState<Medication | null>(null);
  const [screenError, setScreenError] = useState('');
  const [screenSuccess, setScreenSuccess] = useState('');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    // Persiste como "missed" as doses vencidas antes de listar, para o banco
    // (e a tela do cuidador) ficarem consistentes com o que o app mostra.
    await syncOverdueDoses(user.id);
    const [dRes, mRes] = await Promise.all([
      listDosesForDay(user.id, selDay),
      listMedications(user.id),
    ]);
    setScreenError(dRes.error ?? mRes.error ?? '');
    setDoses(dRes.data.map((d) => ({ ...d, status: computeLiveStatus(d) })));
    setMeds(mRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [user, selDay]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { setLoading(true); load(); }, [selDay]);

  // Pede permissão de notificação uma vez ao abrir a agenda (no-op na web).
  useEffect(() => { requestPermission(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleTake = async (dose: Dose) => {
    const { error } = await markDoseTaken(dose.id, 'manual', dose.scheduledAt);
    if (error) { setScreenError(error); setSel(null); return; }
    await cancelDoseReminder(dose.id); // já tomou: não precisa mais lembrar
    setSel(null);
    load();
  };

  const handleDelete = async (dose: Dose) => {
    const { error } = await deleteDose(dose.id);
    if (error) { setScreenError(error); setSel(null); return; }
    await cancelDoseReminder(dose.id);
    setSel(null);
    load();
  };

  const handleDeleteMed = async (med: Medication) => {
    const { error } = await deleteMedication(med.id);
    if (error) { setScreenError(error); return; }
    setScreenSuccess(`${med.name} excluído. Doses futuras foram removidas; o histórico foi mantido.`);
    load();
  };

  const taken   = doses.filter((d) => d.status === 'taken' || d.status === 'late').length;
  const pending = doses.filter((d) => ['pending', 'upcoming', 'due'].includes(d.status)).length;
  const missed  = doses.filter((d) => d.status === 'missed').length;

  const dayLabel = isToday(selDay)
    ? 'Doses de hoje'
    : `Doses de ${selDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Agenda</Text>
            <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setFormOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Alternância Doses / Meus remédios */}
        <View style={styles.segment}>
          {([
            { key: 'doses', label: 'Doses',         icon: 'calendar'  },
            { key: 'meds',  label: 'Meus remédios', icon: 'medkit' },
          ] as const).map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.segmentBtn, view === s.key && styles.segmentActive]}
              onPress={() => setView(s.key)}
              activeOpacity={0.85}
            >
              <Ionicons name={s.icon as any} size={14} color={view === s.key ? Colors.navy : 'rgba(255,255,255,.7)'} />
              <Text style={[styles.segmentLabel, { fontSize: fs - 2 }, view === s.key && styles.segmentLabelActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
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

            {!!screenError && (
              <TouchableOpacity style={styles.errorBanner} onPress={() => setScreenError('')} activeOpacity={0.8}>
                <Ionicons name="alert-circle" size={18} color={Colors.redText} />
                <Text style={[styles.errorBannerText, { fontSize: fs - 1 }]}>{screenError}</Text>
                <Ionicons name="close" size={16} color={Colors.redText} />
              </TouchableOpacity>
            )}

            {!!screenSuccess && (
              <TouchableOpacity style={styles.successBanner} onPress={() => setScreenSuccess('')} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.greenText} />
                <Text style={[styles.successBannerText, { fontSize: fs - 1 }]}>{screenSuccess}</Text>
                <Ionicons name="close" size={16} color={Colors.greenText} />
              </TouchableOpacity>
            )}

            {view === 'doses' ? (
              <>
                {/* Navegação por dia */}
                <View style={{ marginTop: 14 }}>
                  <DateStrip value={selDay} onChange={setSelDay} pastDays={14} days={30} isElderly={isElderly} />
                </View>

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

                <Text style={[styles.sectionTitle, { fontSize: fs - 2, marginTop: 20 }]}>{dayLabel}</Text>

                {doses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
                    <Text style={[styles.emptyTitle, { fontSize: fs }]}>
                      {isToday(selDay) ? 'Nenhuma dose para hoje' : 'Nenhuma dose neste dia'}
                    </Text>
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
              </>
            ) : (
              <>
                {/* Meus remédios */}
                <Text style={[styles.sectionTitle, { fontSize: fs - 2, marginTop: 20 }]}>
                  Medicamentos cadastrados ({meds.length})
                </Text>

                {meds.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="medkit-outline" size={40} color={Colors.textMuted} />
                    <Text style={[styles.emptyTitle, { fontSize: fs }]}>Nenhum remédio cadastrado</Text>
                    <Text style={[styles.emptySub, { fontSize: fs - 2 }]}>Toque em + para adicionar seu primeiro medicamento.</Text>
                  </View>
                ) : (
                  meds.map((med) => (
                    <View key={med.id} style={styles.medCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.medIcon}>
                          <Ionicons name={(FORM_ICON[med.form] ?? 'medkit-outline') as any} size={20} color={Colors.navy} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.medName, { fontSize: fs + 1 }]}>{med.name} {med.dosage}</Text>
                          <Text style={[styles.medMeta, { fontSize: fs - 2 }]}>
                            {med.form} · compartimento {med.compartment}
                            {med.instructions ? ` · ${med.instructions}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.medActions}>
                        <TouchableOpacity style={styles.medEditBtn} onPress={() => setEditMed(med)} activeOpacity={0.8}>
                          <Ionicons name="pencil" size={14} color={Colors.navy} />
                          <Text style={[styles.medEditText, { fontSize: fs - 2 }]}>Editar</Text>
                        </TouchableOpacity>
                        <ConfirmAction
                          label="Excluir" confirmLabel="Excluir"
                          onConfirm={() => handleDeleteMed(med)}
                          bg={Colors.redLight} txtColor={Colors.redText} fs={fs - 2}
                        />
                      </View>
                    </View>
                  ))
                )}
              </>
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

      {/* Formulário de novo tratamento */}
      <AddMedicationModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        userId={user?.id ?? null}
        onSaved={(msg) => { setFormOpen(false); setScreenError(''); setScreenSuccess(msg ?? 'Remédio salvo!'); load(); }}
        isTablet={isTablet}
        maxW={maxW}
        fs={fs}
        isElderly={isElderly}
      />

      {/* Edição de medicamento */}
      <EditMedicationModal
        med={editMed}
        onClose={() => setEditMed(null)}
        onSaved={(msg) => { setEditMed(null); setScreenError(''); setScreenSuccess(msg); load(); }}
        isTablet={isTablet}
        maxW={maxW}
        fs={fs}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Modal: novo tratamento (medicamento + doses recorrentes)
// ─────────────────────────────────────────────
function AddMedicationModal({
  visible, onClose, userId, onSaved, isTablet, maxW, fs, isElderly,
}: {
  visible: boolean; onClose: () => void; userId: string | null;
  onSaved: (msg?: string) => void; isTablet: boolean; maxW?: number; fs: number; isElderly: boolean;
}) {
  const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState<CatalogMed | null>(null);
  const [customMode, setCustom] = useState(false);
  const [name, setName]         = useState('');
  const [form, setForm]         = useState<MedForm>('comprimido');
  const [dosage, setDosage]     = useState('');
  const [times, setTimes]       = useState<string[]>(['08:00']);
  const [timeDraft, setTimeDraft] = useState('08:00');
  const [duration, setDuration] = useState(7);
  const [startDate, setStart]   = useState<Date>(midnight());
  const [compartment, setComp]  = useState(1);
  const [instr, setInstr]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  const reset = () => {
    setQuery(''); setSelected(null); setCustom(false); setName('');
    setForm('comprimido'); setDosage(''); setTimes(['08:00']); setTimeDraft('08:00');
    setDuration(7); setStart(midnight()); setComp(1); setInstr(''); setFormError('');
  };

  // Com busca: melhores resultados. Sem busca: catálogo inteiro de A a Z para rolar.
  const showList = visible && !selected && !customMode;
  const results  = showList
    ? (query.trim() ? searchMedications(query, 40) : MEDICATIONS_ALPHABETICAL)
    : [];

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

  const addTime = () => {
    if (times.includes(timeDraft)) return;
    setTimes((t) => [...t, timeDraft].sort());
  };
  const removeTime = (t: string) => setTimes((arr) => arr.filter((x) => x !== t));
  const applyPreset = (preset: readonly string[]) => setTimes([...preset]);

  const handleSave = async () => {
    setFormError('');
    if (!userId) { setFormError('Sessão expirada. Entre novamente.'); return; }
    if (!name.trim() || !dosage.trim()) { setFormError('Escolha um remédio e a dosagem.'); return; }
    if (times.length === 0) { setFormError('Adicione pelo menos um horário.'); return; }

    setSaving(true);
    const med = await createMedication(userId, { name, dosage, form, compartment, instructions: instr });
    if (med.error || !med.data) {
      setSaving(false);
      console.error('IASIS salvar (medicamento):', med.error);
      setFormError(med.error ?? 'Falha ao salvar.');
      return;
    }

    // Gera todas as doses do tratamento: N dias × M horários.
    // No primeiro dia, horários que já passaram há mais de 15 min são pulados
    // (senão nasceriam "perdidas").
    const isoList: string[] = [];
    const cutoff = Date.now() - 15 * 60000;
    for (let d = 0; d < duration; d++) {
      for (const t of times) {
        const [h, m] = t.split(':').map(Number);
        const when = new Date(startDate);
        when.setDate(when.getDate() + d);
        when.setHours(h, m, 0, 0);
        if (when.getTime() < cutoff) continue;
        isoList.push(when.toISOString());
      }
    }

    if (isoList.length === 0) {
      setSaving(false);
      setFormError('Todos os horários escolhidos já passaram. Ajuste o horário ou o dia de início.');
      return;
    }

    const dosesRes = await createDosesBulk(userId, med.data.id, isoList);
    setSaving(false);
    if (dosesRes.error) {
      console.error('IASIS salvar (doses):', dosesRes.error);
      setFormError(dosesRes.error);
      return;
    }

    // Lembretes locais para as próximas doses (no-op na web / sem permissão).
    await scheduleRemindersForDoses(
      dosesRes.data.map((dose) => ({
        doseId: dose.id,
        title:  '💊 Hora do remédio',
        body:   `${name} ${dosage}${instr ? ` · ${instr}` : ''}`,
        date:   new Date(dose.scheduledAt),
      }))
    );

    const n = dosesRes.data.length;
    const freq = `${times.length}×/dia`;
    const durLabel = duration === 1 ? 'hoje' : `por ${duration} dias`;
    const msg = `${name} ${dosage}: ${n} ${n === 1 ? 'dose agendada' : 'doses agendadas'} (${freq} ${durLabel}).`;

    reset();
    onSaved(msg);
  };

  const hasMed = !!selected || customMode;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { padding: isTablet ? 32 : 24, maxWidth: maxW ?? '100%', width: '100%', maxHeight: '90%' }]}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sheetTitle, { fontSize: isTablet ? 22 : 19, marginBottom: 16 }]}>Novo tratamento</Text>

            {/* Busca + lista completa A–Z */}
            {!hasMed && (
              <Field label="Escolher remédio" fs={fs}>
                <View style={[styles.inputWrap]}>
                  <Ionicons name="search" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.inputFlex, { fontSize: fs }]}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar por nome ou marca…"
                    placeholderTextColor={Colors.textMuted}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.listHint, { fontSize: fs - 3 }]}>
                  {query.trim()
                    ? `${results.length} resultado(s)`
                    : `Todos os remédios · A a Z (${results.length}) — role para ver`}
                </Text>

                <ScrollView
                  style={styles.resultsScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {results.map((m) => (
                    <TouchableOpacity key={`${m.name}-${m.brand ?? ''}`} style={styles.resultRow} onPress={() => pickFromCatalog(m)} activeOpacity={0.7}>
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
                    <Text style={{ padding: 12, color: Colors.textSecondary, fontSize: fs - 1 }}>Nenhum remédio encontrado.</Text>
                  )}
                </ScrollView>

                <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => { setCustom(true); setName(query); setQuery(''); }}>
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

                <Field label="Quantas vezes por dia" fs={fs}>
                  <View style={styles.chipRow}>
                    {FREQ_PRESETS.map((p) => {
                      const active = times.length === p.times.length && p.times.every((t) => times.includes(t));
                      return (
                        <TouchableOpacity key={p.label} style={[styles.chip, active && styles.chipActive]} onPress={() => applyPreset(p.times)}>
                          <Text style={[styles.chipText, { fontSize: fs - 2 }, active && styles.chipTextActive]}>{p.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Field>

                <Field label={`Horários (${times.length})`} fs={fs}>
                  <View style={[styles.chipRow, { marginBottom: 10 }]}>
                    {times.map((t) => (
                      <TouchableOpacity key={t} style={styles.timeChip} onPress={() => removeTime(t)} activeOpacity={0.7}>
                        <Ionicons name="alarm-outline" size={14} color={Colors.greenText} />
                        <Text style={[styles.timeChipText, { fontSize: fs - 1 }]}>{t}</Text>
                        {times.length > 1 && <Ionicons name="close-circle" size={15} color={Colors.greenText} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.pickerCard}>
                    <AlarmTimePicker value={timeDraft} onChange={setTimeDraft} isElderly={isElderly} />
                    <TouchableOpacity style={styles.addTimeBtn} onPress={addTime} activeOpacity={0.85}>
                      <Ionicons name="add" size={16} color={Colors.navy} />
                      <Text style={[styles.addTimeText, { fontSize: fs - 1 }]}>Adicionar este horário</Text>
                    </TouchableOpacity>
                  </View>
                </Field>

                <Field label="Duração do tratamento" fs={fs}>
                  <View style={styles.chipRow}>
                    {DURATIONS.map((d) => (
                      <TouchableOpacity key={d.label} style={[styles.chip, duration === d.days && styles.chipActive]} onPress={() => setDuration(d.days)}>
                        <Text style={[styles.chipText, { fontSize: fs - 2 }, duration === d.days && styles.chipTextActive]}>{d.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>

                <Field label="Início do tratamento" fs={fs}>
                  <DateStrip value={startDate} onChange={setStart} isElderly={isElderly} />
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

                {/* Resumo do que será criado */}
                <View style={styles.previewBox}>
                  <Ionicons name="information-circle" size={16} color="#185FA5" />
                  <Text style={[styles.previewText, { fontSize: fs - 2 }]}>
                    Serão agendadas {times.length * duration} doses: {times.join(', ')} · {duration === 1 ? 'só hoje' : `${duration} dias`}
                  </Text>
                </View>

                {!!formError && (
                  <View style={styles.formError}>
                    <Ionicons name="alert-circle" size={16} color={Colors.redText} />
                    <Text style={[styles.formErrorText, { fontSize: fs - 1 }]}>{formError}</Text>
                  </View>
                )}

                <TouchableOpacity style={[styles.primaryBtn, { paddingVertical: isTablet ? 16 : 14, marginTop: 8 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="save-outline" size={20} color="#fff" />
                      <Text style={[styles.primaryBtnText, { fontSize: fs }]}>Salvar tratamento</Text>
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

// ─────────────────────────────────────────────
//  Modal: editar medicamento existente
// ─────────────────────────────────────────────
function EditMedicationModal({
  med, onClose, onSaved, isTablet, maxW, fs,
}: {
  med: Medication | null; onClose: () => void;
  onSaved: (msg: string) => void; isTablet: boolean; maxW?: number; fs: number;
}) {
  const [name, setName]         = useState('');
  const [dosage, setDosage]     = useState('');
  const [compartment, setComp]  = useState(1);
  const [instr, setInstr]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  // Preenche o formulário quando um medicamento é selecionado.
  useEffect(() => {
    if (med) {
      setName(med.name);
      setDosage(med.dosage);
      setComp(med.compartment);
      setInstr(med.instructions ?? '');
      setFormError('');
    }
  }, [med]);

  const handleSave = async () => {
    if (!med) return;
    setFormError('');
    if (!name.trim() || !dosage.trim()) { setFormError('Nome e dosagem são obrigatórios.'); return; }
    setSaving(true);
    const { error } = await updateMedication(med.id, {
      name, dosage, compartment, instructions: instr,
    });
    setSaving(false);
    if (error) { setFormError(error); return; }
    onSaved(`${name.trim()} ${dosage.trim()} atualizado.`);
  };

  return (
    <Modal visible={!!med} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { padding: isTablet ? 32 : 24, maxWidth: maxW ?? '100%', width: '100%', maxHeight: '85%' }]}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sheetTitle, { fontSize: isTablet ? 22 : 19, marginBottom: 16 }]}>Editar medicamento</Text>

            <Field label="Nome" fs={fs}>
              <TextInput style={[styles.input, { fontSize: fs }]} value={name} onChangeText={setName}
                placeholder="Ex: Losartana" placeholderTextColor={Colors.textMuted} />
            </Field>

            <Field label="Dosagem" fs={fs}>
              <TextInput style={[styles.input, { fontSize: fs }]} value={dosage} onChangeText={setDosage}
                placeholder="Ex: 50mg" placeholderTextColor={Colors.textMuted} />
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

            {!!formError && (
              <View style={styles.formError}>
                <Ionicons name="alert-circle" size={16} color={Colors.redText} />
                <Text style={[styles.formErrorText, { fontSize: fs - 1 }]}>{formError}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryBtn, { paddingVertical: isTablet ? 16 : 14, marginTop: 8 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={[styles.primaryBtnText, { fontSize: fs }]}>Salvar alterações</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.closeBtn, { paddingVertical: isTablet ? 16 : 13, marginTop: 10 }]} onPress={onClose}>
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
  header:   { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  title:    { fontWeight: '700', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,.6)', marginTop: 4, textTransform: 'capitalize' },
  addBtn:   { width: 44, height: 44, borderRadius: 14, backgroundColor: '#2E4A7A', alignItems: 'center', justifyContent: 'center' },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segment:       { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 12, padding: 3, marginTop: 14 },
  segmentBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  segmentActive: { backgroundColor: '#fff' },
  segmentLabel:  { color: 'rgba(255,255,255,.7)', fontWeight: '600' },
  segmentLabelActive: { color: Colors.navy },
  errorBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.redLight, borderRadius: Radius.sm, padding: 12, marginTop: 14 },
  errorBannerText:{ flex: 1, color: Colors.redText },
  successBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.greenLight, borderRadius: Radius.sm, padding: 12, marginTop: 14 },
  successBannerText:{ flex: 1, color: Colors.greenText },
  pickerCard:     { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12 },
  addTimeBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, borderWidth: 1.5, borderColor: Colors.navy, borderRadius: 10, paddingVertical: 10 },
  addTimeText:    { color: Colors.navy, fontWeight: '700' },
  timeChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.greenLight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  timeChipText:   { color: Colors.greenText, fontWeight: '700' },
  previewBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E6F1FB', borderRadius: 10, padding: 12, marginBottom: 8 },
  previewText:    { flex: 1, color: '#185FA5', fontWeight: '500' },
  formError:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.redLight, borderRadius: 10, padding: 12, marginTop: 8 },
  formErrorText:  { flex: 1, color: Colors.redText },
  summaryCard:    { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, marginTop: 14, ...Shadows.md },
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
  medCard:    { backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: 10, padding: 14, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  medIcon:    { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  medName:    { fontWeight: '700', color: Colors.textPrimary },
  medMeta:    { color: Colors.textSecondary, marginTop: 2 },
  medActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border },
  medEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E6F1FB', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  medEditText:{ color: Colors.navy, fontWeight: '700' },
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
  listHint:    { color: Colors.textMuted, marginTop: 10, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  resultsScroll: { maxHeight: 280, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.surface },
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
