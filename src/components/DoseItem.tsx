import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dose, DoseStatus } from '../types';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Pill } from './ui';
import { format } from 'date-fns';


interface Props {
  dose:    Dose;
  onPress?: (dose: Dose) => void;
}

const statusConfig: Record<DoseStatus, {
  pill: { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' };
  icon: string;
  iconColor: string;
  iconBg:    string;
  highlight?: string;
}> = {
  taken:    { pill: { label: 'Tomada', variant: 'success' }, icon: 'checkmark-circle', iconColor: Colors.greenText, iconBg: Colors.greenLight, },
  late:     { pill: { label: 'Atrasada', variant: 'warning' }, icon: 'time', iconColor: Colors.amberText, iconBg: Colors.amberLight, },
  missed:   { pill: { label: 'Perdida', variant: 'error' }, icon: 'close-circle', iconColor: Colors.redText, iconBg: Colors.redLight, },
  due:      { pill: { label: 'Agora!', variant: 'info' }, icon: 'notifications', iconColor: '#185FA5', iconBg: '#E6F1FB', highlight: '#E6F1FB' },
  upcoming: { pill: { label: 'Em breve', variant: 'info' }, icon: 'alarm', iconColor: '#185FA5', iconBg: '#EEF5FD', },
  pending:  { pill: { label: 'Aguarda', variant: 'neutral' }, icon: 'ellipse-outline', iconColor: Colors.textMuted, iconBg: Colors.borderSoft, },
};

export const DoseItem: React.FC<Props> = ({ dose, onPress }) => {
  const cfg = statusConfig[dose.status];
  const time = format(new Date(dose.scheduledAt), 'HH:mm');
  const medName = dose.medication?.name ?? 'Medicamento';
  const dosage  = dose.medication?.dosage ?? '';

  return (
    <TouchableOpacity
      style={[styles.container, cfg.highlight && { backgroundColor: cfg.highlight, borderColor: '#93B4DA' }]}
      onPress={() => onPress?.(dose)}
      activeOpacity={0.8}
    >
      {/* Ícone */}
      <View style={[styles.icon, { backgroundColor: cfg.iconBg }]}>
        <Ionicons name={cfg.icon as any} size={22} color={cfg.iconColor} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.name}>{medName} {dosage}</Text>
        {dose.medication?.instructions && (
          <Text style={styles.detail}>{dose.medication.instructions}</Text>
        )}
        {dose.delayMinutes && dose.delayMinutes > 0 && (
          <Text style={styles.delay}>Atraso: {dose.delayMinutes} min</Text>
        )}
      </View>

      {/* Status */}
      <Pill
        label={cfg.pill.label}
        variant={cfg.pill.variant}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              Spacing.sm,
    backgroundColor:  Colors.surface,
    borderRadius:     Radius.md,
    marginHorizontal: Spacing.md,
    marginBottom:     Spacing.xs,
    padding:          Spacing.md,
    borderWidth:      0.5,
    borderColor:      Colors.border,
    ...Shadows.sm,
  },
  icon: {
    width:        44,
    height:       44,
    borderRadius: Radius.sm,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
  },
  info: {
    flex: 1,
  },
  time: {
    fontSize:   Fonts.sizes.xs,
    color:      Colors.textSecondary,
    fontWeight: '500',
  },
  name: {
    fontSize:   Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
    color:      Colors.textPrimary,
    marginTop:  1,
  },
  detail: {
    fontSize: Fonts.sizes.xs,
    color:    Colors.textSecondary,
    marginTop: 2,
  },
  delay: {
    fontSize:   Fonts.sizes.xs,
    color:      Colors.amberText,
    marginTop:  2,
    fontWeight: '500',
  },
});
