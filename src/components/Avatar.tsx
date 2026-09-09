// ─────────────────────────────────────────────
//  IASIS — Avatar do usuário
//  Mostra a foto de perfil; sem foto, cai nas iniciais sobre uma cor
//  derivada do nome (a mesma pessoa recebe sempre a mesma cor).
// ─────────────────────────────────────────────
import React from 'react';
import {
  View, Text, Image, StyleSheet,
  type ViewStyle, type ImageStyle, type StyleProp,
} from 'react-native';
import { useTheme, type ThemeColors } from '../theme';
import { initials } from '../services/avatar';

type Props = {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Anel claro em volta — usado sobre o cabeçalho azul. */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Paleta das iniciais. Tons escuros o bastante para o texto branco ler bem. */
const PALETTE = [
  '#1C2B4B',
  '#2E4A7A',
  '#2F6F5E',
  '#7A4E8C',
  '#A35A2D',
  '#3F6DA8',
  '#8C4A5E',
];

/**
 * Cor estável a partir do nome. Sem isso, uma lista de contatos vira um
 * arco-íris aleatório que muda a cada render.
 */
function colorFor(name?: string | null, muted = '#94A3B8'): string {
  const text = (name ?? '').trim();
  if (!text) return muted;

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({ name, uri, size = 44, ring = false, style }: Props) {
  const { C, styles } = useTheme(makeStyles);
  // Medidas do círculo. São compatíveis com ViewStyle e ImageStyle, por isso
  // ficam num objeto solto em vez de virem do StyleSheet.
  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    ...(ring ? { borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)' } : null),
  };

  if (uri) {
    const imageStyle: StyleProp<ImageStyle> = [
      styles.image,
      box,
      style as StyleProp<ImageStyle>,
    ];
    return (
      <Image
        source={{ uri }}
        style={imageStyle}
        // Evita o "pulo" de layout enquanto a imagem decodifica.
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.base, box, { backgroundColor: colorFor(name, C.textMuted) }, style]}>
      <Text
        style={[
          styles.initials,
          { fontSize: size * 0.38, lineHeight: size * 0.46 },
        ]}
        numberOfLines={1}
        // O avatar é decorativo: quem lê tela já ouve o nome ao lado.
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.borderSoft,
    overflow: 'hidden',
  },
  image: {
    backgroundColor: C.borderSoft,
  },
  initials: {
    color: C.white,
    fontWeight: '700',
  },
});
