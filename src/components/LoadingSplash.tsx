import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn, ReduceMotion, Easing,
  useSharedValue, useAnimatedStyle, useReducedMotion,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { LogoMark } from './Logo';

// ─────────────────────────────────────────────
//  IASIS — Tela de carregamento
//  O coração da marca bate (duas batidas e uma pausa, como um pulso)
//  enquanto o app restaura a sessão. Sem animação para quem pediu
//  "reduzir movimento" no aparelho.
// ─────────────────────────────────────────────

export default function LoadingSplash() {
  const reduce = useReducedMotion();
  const beat = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    const up = (s: number, ms: number) => withTiming(s, { duration: ms, easing: Easing.out(Easing.quad) });
    beat.value = withRepeat(
      withSequence(up(1.12, 140), up(1, 120), up(1.08, 140), up(1, 220), withTiming(1, { duration: 500 })),
      -1,
    );
  }, [reduce]);

  const heart = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={heart}>
        <LogoMark size={88} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(150).duration(500).reduceMotion(ReduceMotion.System)} style={{ alignItems: 'center' }}>
        <Text style={styles.name}>Iasis</Text>
        <Text style={styles.tagline}>Sua saúde em dia</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2B4B', gap: 14 },
  name:    { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -2 },
  tagline: { color: 'rgba(255,255,255,.5)', fontSize: 13, marginTop: 4 },
});
