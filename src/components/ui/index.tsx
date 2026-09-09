// ─────────────────────────────────────────────
//  IASIS — Componentes UI reutilizáveis
// ─────────────────────────────────────────────
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Fonts, Spacing, Radius, Shadows, useTheme, type ThemeColors } from '../../theme';

// ─── Card ─────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?:   ViewStyle;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  const { C, styles } = useTheme(makeStyles);
  const content = (
    <View style={[styles.card, style]}>{children}</View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};

// ─── Pill / Badge ──────────────────────────────
type PillVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface PillProps {
  label:    string;
  variant?: PillVariant;
  dot?:     boolean;
  style?:   ViewStyle;
}

// Depende do tema, entao e funcao da paleta e nao constante de modulo.
const pillColors = (C: ThemeColors): Record<PillVariant, { bg: string; text: string }> => ({
  success: { bg: C.greenLight, text: C.greenText },
  warning: { bg: C.amberLight, text: C.amberText },
  error:   { bg: C.redLight,   text: C.redText   },
  info:    { bg: C.blueLight,  text: C.navy      },
  neutral: { bg: C.borderSoft, text: C.textSecondary },
});

export const Pill: React.FC<PillProps> = ({
  label,
  variant = 'neutral',
  dot,
  style,
}) => {
  const { C, styles } = useTheme(makeStyles);
  const { bg, text } = pillColors(C)[variant];
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {dot && (
        <View style={[styles.pillDot, { backgroundColor: text }]} />
      )}
      <Text style={[styles.pillText, { color: text }]}>{label}</Text>
    </View>
  );
};

// ─── Button ───────────────────────────────────
interface ButtonProps {
  label:      string;
  onPress:    () => void;
  variant?:   'primary' | 'secondary' | 'ghost' | 'danger';
  loading?:   boolean;
  disabled?:  boolean;
  icon?:      React.ReactNode;
  style?:     ViewStyle;
  textStyle?: TextStyle;
}

// Depende do tema: `navy` como FUNDO precisa ser escuro (texto branco por
// cima) e como TEXTO precisa ser claro. Por isso primary usa navyBg.
const btnStyles = (C: ThemeColors): Record<string, { bg: string; text: string; border?: string }> => ({
  primary:   { bg: C.navyBg,      text: C.white },
  secondary: { bg: C.greenLight,  text: C.greenText },
  ghost:     { bg: 'transparent', text: C.navy,    border: C.border },
  danger:    { bg: C.redLight,    text: C.redText, border: C.red },
});

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant  = 'primary',
  loading  = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const { C, styles } = useTheme(makeStyles);
  const s = btnStyles(C)[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        { backgroundColor: s.bg },
        s.border ? { borderWidth: 1, borderColor: s.border } : {},
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={s.text} size="small" />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={[styles.buttonText, { color: s.text }, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// ─── Section Header ───────────────────────────
interface SectionHeaderProps {
  title:      string;
  action?:    string;
  onAction?:  () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  action,
  onAction,
}) => {
  const { styles } = useTheme(makeStyles);
  return (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
  );
};

// ─── Metric Card ──────────────────────────────
interface MetricCardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  color?:   string;
  icon?:    React.ReactNode;
  style?:   ViewStyle;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sub,
  color,
  icon,
  style,
}) => {
  const { C, styles } = useTheme(makeStyles);
  return (
  <View style={[styles.metricCard, style]}>
    <View style={styles.metricHeader}>
      {icon}
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
    <Text style={[styles.metricValue, { color: color ?? C.navy }]}>{value}</Text>
    {sub && <Text style={styles.metricSub}>{sub}</Text>}
  </View>
  );
};

// ─── Divider ──────────────────────────────────
export const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { styles } = useTheme(makeStyles);
  return <View style={[styles.divider, style]} />;
};

// ─── Empty State ──────────────────────────────
interface EmptyProps {
  icon?:    string;
  title:    string;
  message?: string;
  action?:  string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyProps> = ({
  icon = '💊',
  title,
  message,
  action,
  onAction,
}) => {
  const { styles } = useTheme(makeStyles);
  return (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>{icon}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    {message && <Text style={styles.emptyMessage}>{message}</Text>}
    {action && onAction && (
      <Button label={action} onPress={onAction} style={{ marginTop: Spacing.md }} />
    )}
  </View>
  );
};

// ─── Styles ───────────────────────────────────
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom:    Spacing.sm,
    borderWidth:     0.5,
    borderColor:     C.border,
    ...Shadows.sm,
  },
  pill: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:   Radius.full,
  },
  pillDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  pillText: {
    fontSize:   Fonts.sizes.xs,
    fontWeight: Fonts.weights.semibold as any,
  },
  button: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   14,
    paddingHorizontal: Spacing.lg,
    borderRadius:      Radius.md,
  },
  buttonText: {
    fontSize:   Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
  },
  sectionHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop:       Spacing.md,
    paddingBottom:    Spacing.xs,
  },
  sectionTitle: {
    fontSize:   Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold as any,
    color:      C.textPrimary,
  },
  sectionAction: {
    fontSize:   Fonts.sizes.sm,
    color:      '#185FA5',
    fontWeight: Fonts.weights.medium as any,
  },
  metricCard: {
    backgroundColor: C.surface,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    borderWidth:     0.5,
    borderColor:     C.border,
    ...Shadows.sm,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  Spacing.xs,
  },
  metricLabel: {
    fontSize: Fonts.sizes.xs,
    color:    C.textSecondary,
    fontWeight: Fonts.weights.medium as any,
  },
  metricValue: {
    fontSize:   Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold as any,
    color:      C.textPrimary,
  },
  metricSub: {
    fontSize:  Fonts.sizes.xs,
    color:     C.textMuted,
    marginTop: 2,
  },
  divider: {
    height:          0.5,
    backgroundColor: C.border,
    marginHorizontal: Spacing.md,
  },
  empty: {
    alignItems:   'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize:     40,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize:   Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold as any,
    color:      C.textPrimary,
    textAlign:  'center',
    marginBottom: Spacing.xs,
  },
  emptyMessage: {
    fontSize:  Fonts.sizes.sm,
    color:     C.textSecondary,
    textAlign: 'center',
    lineHeight: Fonts.sizes.sm * Fonts.lineHeights.loose,
  },
});
