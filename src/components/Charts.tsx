// ─────────────────────────────────────────────
//  IASIS — Gráficos de adesão (react-native-svg)
//  Vetoriais: nítidos em qualquer tela, sem dependência de imagem.
// ─────────────────────────────────────────────
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, G, Line, Text as SvgText } from 'react-native-svg';
import { useTheme, type ThemeColors } from '../theme';

// ── Anel de percentual (adesão geral) ─────────
export function DonutChart({
  percentage,
  size = 168,
  stroke = 18,
  label = 'de adesão',
}: {
  percentage: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const { C, styles } = useTheme(makeStyles);
  const pct    = Math.max(0, Math.min(100, percentage));
  const r      = (size - stroke) / 2;
  const c      = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  const color  = pct >= 80 ? C.green : pct >= 50 ? C.amber : C.red;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {/* trilho */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={C.borderSoft} strokeWidth={stroke} fill="none"
        />
        {/* progresso — começa no topo */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${filled} ${c - filled}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject as any}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.26, fontWeight: '800', color: C.textPrimary }}>
            {pct}%
          </Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Barras empilhadas por dia (tomadas × perdidas) ──
export interface DayDatum { date: string; total: number; taken: number; missed: number }

export function DayBars({
  data,
  height = 168,
  width,
}: {
  data: DayDatum[];
  height?: number;
  width: number;
}) {
  const { C, styles } = useTheme(makeStyles);
  if (!data.length) return null;

  const padB   = 22;                 // espaço do rótulo de data
  const padT   = 6;
  const plotH  = height - padB - padT;
  const maxVal = Math.max(1, ...data.map((d) => d.total));
  const gap    = data.length > 14 ? 2 : 6;
  const barW   = Math.max(3, (width - gap * (data.length - 1)) / data.length);

  // Com muitos dias, rotula só alguns para não embolar.
  const labelEvery = data.length <= 7 ? 1 : data.length <= 14 ? 2 : 5;

  return (
    <Svg width={width} height={height}>
      {/* linha de base */}
      <Line x1={0} y1={padT + plotH} x2={width} y2={padT + plotH} stroke={C.border} strokeWidth={1} />

      {data.map((d, i) => {
        const x        = i * (barW + gap);
        const totalH   = (d.total / maxVal) * plotH;
        const takenH   = d.total ? (d.taken / d.total) * totalH : 0;
        const missedH  = d.total ? (d.missed / d.total) * totalH : 0;
        const restH    = Math.max(0, totalH - takenH - missedH);
        const baseY    = padT + plotH;
        const day      = new Date(`${d.date}T00:00:00`).getDate();

        return (
          <G key={d.date}>
            {/* pendentes/sem dado — cinza claro no topo */}
            {restH > 0 && (
              <Rect x={x} y={baseY - totalH} width={barW} height={restH}
                    fill={C.borderSoft} rx={2} />
            )}
            {missedH > 0 && (
              <Rect x={x} y={baseY - takenH - missedH} width={barW} height={missedH}
                    fill={C.red} rx={2} />
            )}
            {takenH > 0 && (
              <Rect x={x} y={baseY - takenH} width={barW} height={takenH}
                    fill={C.green} rx={2} />
            )}
            {i % labelEvery === 0 && (
              <SvgText
                x={x + barW / 2} y={height - 6}
                fontSize={10} fill={C.textMuted} textAnchor="middle"
              >
                {day}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ── Barras horizontais (adesão por horário / dia da semana) ──
export interface RateDatum { label: string; total: number; taken: number }

export function RateBars({ data }: { data: RateDatum[] }) {
  const { C, styles } = useTheme(makeStyles);
  if (!data.length) return null;

  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => {
        const rate  = d.total ? Math.round((d.taken / d.total) * 100) : 0;
        const color = rate >= 80 ? C.green : rate >= 50 ? C.amber : C.red;
        return (
          <View key={d.label} style={styles.rateRow}>
            <Text style={styles.rateLabel}>{d.label}</Text>
            <View style={styles.rateTrack}>
              <View style={[styles.rateFill, { width: `${rate}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.ratePct, { color }]}>{rate}%</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Legenda reutilizável ──────────────────────
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  const { C, styles } = useTheme(makeStyles);
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: i.color }]} />
          <Text style={styles.legendText}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  rateRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateLabel: { width: 52, fontSize: 13, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  rateTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.borderSoft, overflow: 'hidden' },
  rateFill:  { height: '100%', borderRadius: 5 },
  ratePct:   { width: 40, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14, justifyContent: 'center' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: 12, color: C.textSecondary },
});
