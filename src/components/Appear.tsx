import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown, ReduceMotion, Easing,
  useSharedValue, useAnimatedStyle, useReducedMotion, withDelay, withTiming,
} from 'react-native-reanimated';

// ─────────────────────────────────────────────
//  IASIS — Entrada suave de cartões e seções
//  O bloco sobe um pouco e aparece. Com `index`, os blocos entram em
//  cascata (um atrás do outro). Quem pediu "reduzir movimento" no aparelho
//  vê o conteúdo direto, sem animação.
// ─────────────────────────────────────────────

interface Props {
  index?:    number;
  style?:    StyleProp<ViewStyle>;
  children:  React.ReactNode;
}

const STEP_MS = 70;
const MAX_STEPS = 8; // listas longas não ficam esperando a cascata inteira

export default function Appear({ index = 0, style, children }: Props) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown
        .delay(Math.min(index, MAX_STEPS) * STEP_MS)
        .duration(420)
        .reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}

// Barra de gráfico que cresce do zero até `pct` (0–100) quando aparece.
export function GrowBar({ pct, delay = 0, style }: { pct: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    p.value = reduce
      ? 1
      : withDelay(delay, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [pct, delay, reduce]);

  const animated = useAnimatedStyle(() => ({ height: `${pct * p.value}%` }));
  return <Animated.View style={[style, animated]} />;
}
