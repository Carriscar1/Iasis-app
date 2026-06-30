import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme';

// ─────────────────────────────────────────────
//  IASIS — Faixa de seleção do dia de início do tratamento
//  Lista horizontal de dias (a partir de hoje). Toque para escolher.
// ─────────────────────────────────────────────

interface Props {
  value:      Date;            // dia selecionado (00:00)
  onChange:   (d: Date) => void;
  days?:      number;          // quantos dias mostrar (padrão 30)
  isElderly?: boolean;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS   = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const atMidnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DateStrip({ value, onChange, days = 30, isElderly = false }: Props) {
  const today = atMidnight(new Date());
  const list  = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });

  const topLabel = (d: Date, i: number) =>
    i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : WEEKDAYS[d.getDay()];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
    >
      {list.map((d, i) => {
        const active = sameDay(d, value);
        return (
          <TouchableOpacity
            key={d.toISOString()}
            style={[styles.chip, { minWidth: isElderly ? 76 : 64 }, active && styles.chipActive]}
            onPress={() => onChange(atMidnight(d))}
            activeOpacity={0.85}
          >
            <Text style={[styles.top, { fontSize: isElderly ? 13 : 11 }, active && styles.textActive]}>
              {topLabel(d, i)}
            </Text>
            <Text style={[styles.day, { fontSize: isElderly ? 24 : 20 }, active && styles.textActive]}>
              {d.getDate()}
            </Text>
            <Text style={[styles.month, { fontSize: isElderly ? 12 : 10 }, active && styles.textActive]}>
              {MONTHS[d.getMonth()]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip:       { alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: Colors.bg },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  top:        { color: Colors.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  day:        { color: Colors.navy, fontWeight: '800', marginVertical: 2 },
  month:      { color: Colors.textMuted, textTransform: 'uppercase' },
  textActive: { color: '#fff' },
});
