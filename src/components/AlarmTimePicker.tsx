import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Colors } from '../theme';

// ─────────────────────────────────────────────
//  IASIS — Seletor de horário estilo "despertador"
//  Duas rodas (horas / minutos) que rolam e encaixam no centro.
//  Funciona na web e no celular (sem dependências nativas).
// ─────────────────────────────────────────────

interface Props {
  value:     string;           // "HH:MM"
  onChange:  (v: string) => void;
  isElderly?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const parse = (v: string): [number, number] => {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(v);
  if (!m) return [8, 0];
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return [h, mm];
};

export default function AlarmTimePicker({ value, onChange, isElderly = false }: Props) {
  const [h, m] = parse(value);

  const setH = (nh: number) => onChange(`${pad(nh)}:${pad(m)}`);
  const setM = (nm: number) => onChange(`${pad(h)}:${pad(nm)}`);

  const itemH = isElderly ? 56 : 46;

  return (
    <View style={styles.wrap}>
      {/* Visor digital */}
      <View style={styles.display}>
        <Text style={[styles.displayText, { fontSize: isElderly ? 40 : 34 }]}>
          {pad(h)}:{pad(m)}
        </Text>
        <Text style={[styles.displaySub, { fontSize: isElderly ? 14 : 12 }]}>
          {h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite'}
        </Text>
      </View>

      {/* Rodas */}
      <View style={styles.wheels}>
        <Wheel range={24} value={h} onChange={setH} itemH={itemH} label="hora" />
        <Text style={[styles.colon, { fontSize: isElderly ? 34 : 28 }]}>:</Text>
        <Wheel range={60} value={m} onChange={setM} itemH={itemH} label="min" />
      </View>
    </View>
  );
}

function Wheel({
  range, value, onChange, itemH, label,
}: { range: number; value: number; onChange: (n: number) => void; itemH: number; label: string }) {
  const ref = useRef<ScrollView>(null);
  const items = Array.from({ length: range }, (_, i) => i);
  const VISIBLE = 3;
  const height = itemH * VISIBLE;

  // Posiciona na opção atual ao montar / quando muda externamente.
  useEffect(() => {
    const id = setTimeout(() => {
      ref.current?.scrollTo({ y: value * itemH, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [value, itemH]);

  const handleEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.min(range - 1, Math.max(0, Math.round(y / itemH)));
    if (idx !== value) onChange(idx);
    // encaixa exatamente na opção
    ref.current?.scrollTo({ y: idx * itemH, animated: true });
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.wheelBox, { height }]}>
        {/* Faixa central destacada */}
        <View pointerEvents="none" style={[styles.centerBand, { height: itemH, top: itemH }]} />
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemH}
          decelerationRate="fast"
          onMomentumScrollEnd={handleEnd}
          onScrollEndDrag={handleEnd}
          contentContainerStyle={{ paddingVertical: itemH }}
        >
          {items.map((n) => {
            const active = n === value;
            return (
              <TouchableOpacity
                key={n}
                style={{ height: itemH, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.6}
                onPress={() => onChange(n)}
              >
                <Text style={[styles.wheelText, { fontSize: itemH * 0.42 }, active && styles.wheelTextActive]}>
                  {pad(n)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <Text style={styles.wheelLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { alignItems: 'center' },
  display:     { alignItems: 'center', marginBottom: 12 },
  displayText: { fontWeight: '800', color: Colors.navy, letterSpacing: 1 },
  displaySub:  { color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  wheels:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  colon:       { fontWeight: '800', color: Colors.navy, marginHorizontal: 4 },
  wheelBox:    { width: 78, overflow: 'hidden', position: 'relative' },
  centerBand:  { position: 'absolute', left: 0, right: 0, backgroundColor: Colors.greenLight, borderRadius: 12, borderWidth: 1, borderColor: Colors.green },
  wheelText:   { color: Colors.textMuted, fontWeight: '600' },
  wheelTextActive: { color: Colors.navy, fontWeight: '800' },
  wheelLabel:  { fontSize: 11, color: Colors.textMuted, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
});
