import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme';

// ─────────────────────────────────────────────
//  IASIS — Faixa de seleção do dia de início do tratamento
//  Lista horizontal de dias (a partir de hoje). Toque para escolher.
// ─────────────────────────────────────────────

interface Props {
  value:      Date;            // dia selecionado (00:00)
  onChange:   (d: Date) => void;
  days?:      number;          // quantos dias à frente mostrar (padrão 30)
  pastDays?:  number;          // quantos dias PASSADOS mostrar (padrão 0)
  isElderly?: boolean;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS   = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const atMidnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DateStrip({ value, onChange, days = 30, pastDays = 0, isElderly = false }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const today = atMidnight(new Date());
  const list  = Array.from({ length: pastDays + days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + (i - pastDays)); return d;
  });

  const chipW = (isElderly ? 76 : 64) + 8; // largura + gap para centralizar

  // Com dias passados, começa rolado até "hoje" (senão o usuário abre no passado).
  useEffect(() => {
    if (pastDays > 0) {
      const id = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: Math.max(0, pastDays * chipW - chipW), animated: false });
      }, 0);
      return () => clearTimeout(id);
    }
  }, [pastDays, chipW]);

  const diffDays = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86400000);

  const topLabel = (d: Date) => {
    const diff = diffDays(d);
    if (diff === 0)  return 'Hoje';
    if (diff === 1)  return 'Amanhã';
    if (diff === -1) return 'Ontem';
    return WEEKDAYS[d.getDay()];
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
    >
      {list.map((d) => {
        const active = sameDay(d, value);
        const isPast = diffDays(d) < 0;
        return (
          <TouchableOpacity
            key={d.toISOString()}
            style={[styles.chip, { minWidth: isElderly ? 76 : 64 }, isPast && !active && styles.chipPast, active && styles.chipActive]}
            onPress={() => onChange(atMidnight(d))}
            activeOpacity={0.85}
          >
            <Text style={[styles.top, { fontSize: isElderly ? 13 : 11 }, active && styles.textActive]}>
              {topLabel(d)}
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
  chipPast:   { opacity: 0.55 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  top:        { color: Colors.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  day:        { color: Colors.navy, fontWeight: '800', marginVertical: 2 },
  month:      { color: Colors.textMuted, textTransform: 'uppercase' },
  textActive: { color: '#fff' },
});
