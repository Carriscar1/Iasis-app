import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useTheme, type ThemeColors } from '../theme';

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
  const { C, styles } = useTheme(makeStyles);
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
  const { C, styles } = useTheme(makeStyles);
  const ref = useRef<ScrollView>(null);
  const items = Array.from({ length: range }, (_, i) => i);
  const VISIBLE = 3;
  const height = itemH * VISIBLE;

  // Posiciona na opção atual quando muda externamente. Na abertura quem
  // posiciona é o onContentSizeChange: no Android, rolar antes de a lista
  // ter tamanho não faz nada e a roda abria sempre em 00.
  const ready = useRef(false);
  useEffect(() => {
    if (ready.current) ref.current?.scrollTo({ y: value * itemH, animated: false });
  }, [value, itemH]);

  const handleSize = () => {
    ref.current?.scrollTo({ y: value * itemH, animated: false });
    ready.current = true;
  };

  const settle = (y: number) => {
    const idx = Math.min(range - 1, Math.max(0, Math.round(y / itemH)));
    if (idx !== value) onChange(idx);
    // encaixa exatamente na opção
    ref.current?.scrollTo({ y: idx * itemH, animated: true });
  };

  // Soltou o dedo sem embalo: encaixa já. Com embalo, espera o fim do
  // deslize (onMomentumScrollEnd) — encaixar no meio cortava o giro no Android.
  const handleDragEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = e.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(v) < 0.05) settle(e.nativeEvent.contentOffset.y);
  };
  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => settle(e.nativeEvent.contentOffset.y);

  // Na web não existe "fim do deslize" (a roda do mouse e o arrastar no
  // navegador não disparam esses eventos): considera parado quando a rolagem
  // fica 150 ms quieta.
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (idle.current) clearTimeout(idle.current); }, []);
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS !== 'web') return;
    const y = e.nativeEvent.contentOffset.y;
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => settle(y), 150);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.wheelBox, { height }]}>
        {/* Faixa central destacada */}
        <View pointerEvents="none" style={[styles.centerBand, { height: itemH, top: itemH }]} />
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          // A roda fica dentro do formulário, que também rola: sem isto o
          // Android entrega o gesto para o formulário e a roda não gira.
          nestedScrollEnabled
          snapToInterval={itemH}
          decelerationRate="fast"
          onContentSizeChange={handleSize}
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleDragEnd}
          onScroll={handleScroll}
          scrollEventThrottle={32}
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

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap:        { alignItems: 'center' },
  display:     { alignItems: 'center', marginBottom: 12 },
  displayText: { fontWeight: '800', color: C.navy, letterSpacing: 1 },
  displaySub:  { color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  wheels:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  colon:       { fontWeight: '800', color: C.navy, marginHorizontal: 4 },
  wheelBox:    { width: 78, overflow: 'hidden', position: 'relative' },
  centerBand:  { position: 'absolute', left: 0, right: 0, backgroundColor: C.greenLight, borderRadius: 12, borderWidth: 1, borderColor: C.green },
  wheelText:   { color: C.textMuted, fontWeight: '600' },
  wheelTextActive: { color: C.navy, fontWeight: '800' },
  wheelLabel:  { fontSize: 11, color: C.textMuted, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
});
