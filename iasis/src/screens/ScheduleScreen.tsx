import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useStore } from '../store';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Card, Pill, SectionHeader, Button, EmptyState } from '../components/ui';
import { DoseItem } from '../components/DoseItem';
import { Dose } from '../types';

export default function ScheduleScreen() {
  const { todayDoses } = useStore();
  const [selectedDose, setSelectedDose] = useState<Dose | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const today    = new Date();
  const tomorrow = addDays(today, 1);

  const handleDosePress = (dose: Dose) => {
    setSelectedDose(dose);
    setModalVisible(true);
  };

  const takenCount  = todayDoses.filter(d => d.status === 'taken' || d.status === 'late').length;
  const pendingCount = todayDoses.filter(d => ['pending','upcoming','due'].includes(d.status)).length;
  const missedCount  = todayDoses.filter(d => d.status === 'missed').length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Agenda de Doses</Text>
        <Text style={styles.subtitle}>
          {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </Text>
      </View>

      {/* Resumo */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.greenText }]}>{takenCount}</Text>
          <Text style={styles.summaryLabel}>Tomadas</Text>
        </View>
        <View style={[styles.summaryDivider]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#185FA5' }]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pendentes</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.redText }]}>{missedCount}</Text>
          <Text style={styles.summaryLabel}>Perdidas</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <SectionHeader title="Hoje" />

        {todayDoses.length === 0 ? (
          <EmptyState
            icon="💊"
            title="Nenhuma dose agendada"
            message="Adicione medicamentos para começar o monitoramento."
            action="Adicionar medicamento"
            onAction={() => {}}
          />
        ) : (
          todayDoses.map(dose => (
            <DoseItem key={dose.id} dose={dose} onPress={handleDosePress} />
          ))
        )}

        <SectionHeader
          title={format(tomorrow, "EEEE, d/MM", { locale: ptBR })}
          action="Repetição automática"
        />
        <Card>
          <View style={styles.autoRepeat}>
            <Ionicons name="refresh" size={20} color={Colors.textSecondary} />
            <Text style={styles.autoRepeatText}>
              As doses de amanhã são geradas automaticamente com base no tratamento ativo.
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Modal detalhe da dose */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedDose && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>
                  {selectedDose.medication?.name ?? 'Medicamento'}
                </Text>
                <Text style={styles.modalSub}>
                  {selectedDose.medication?.dosage} · {format(new Date(selectedDose.scheduledAt), 'HH:mm')}
                </Text>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Pill
                    label={selectedDose.status}
                    variant={
                      selectedDose.status === 'taken' ? 'success' :
                      selectedDose.status === 'missed' ? 'error' :
                      selectedDose.status === 'late'   ? 'warning' : 'info'
                    }
                  />
                </View>

                {selectedDose.takenAt && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.infoLabel}>Tomada às</Text>
                    <Text style={styles.infoValue}>
                      {format(new Date(selectedDose.takenAt), 'HH:mm')}
                    </Text>
                  </View>
                )}

                {selectedDose.validatedBy && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.infoLabel}>Validação</Text>
                    <Text style={styles.infoValue}>
                      {selectedDose.validatedBy === 'rfid' ? '🔵 Pulseira RFID' : '✋ Manual'}
                    </Text>
                  </View>
                )}

                {selectedDose.delayMinutes !== undefined && selectedDose.delayMinutes > 0 && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.infoLabel}>Atraso</Text>
                    <Text style={[styles.infoValue, { color: Colors.amberText }]}>
                      {selectedDose.delayMinutes} minutos
                    </Text>
                  </View>
                )}

                {selectedDose.medication?.instructions && (
                  <View style={[styles.modalInfoRow, { flexDirection: 'column', gap: 4 }]}>
                    <Text style={styles.infoLabel}>Instruções</Text>
                    <Text style={styles.infoValue}>{selectedDose.medication.instructions}</Text>
                  </View>
                )}

                <Button
                  label="Fechar"
                  onPress={() => setModalVisible(false)}
                  variant="ghost"
                  style={{ marginTop: Spacing.lg }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.md },
  title:    { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.6)', marginTop: 4 },

  summaryRow: {
    flexDirection:    'row',
    backgroundColor:  Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop:        -12,
    borderRadius:     Radius.md,
    padding:          Spacing.md,
    ...Shadows.md,
    marginBottom:     Spacing.xs,
  },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryNum:     { fontSize: Fonts.sizes.xl, fontWeight: '700' },
  summaryLabel:   { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 0.5, backgroundColor: Colors.border },

  autoRepeat: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  autoRepeatText: {
    flex: 1,
    fontSize:  Fonts.sizes.sm,
    color:     Colors.textSecondary,
    lineHeight: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.5)',
    justifyContent:  'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle:  { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.textPrimary },
  modalSub:    { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md },
  modalInfoRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  infoValue: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },
});
