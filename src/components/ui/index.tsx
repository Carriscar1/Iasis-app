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
import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';

// ─── Card ─────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?:   ViewStyle;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
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

const pillColors: Record<PillVariant, { bg: string; text: string }> = {
  success: { bg: Colors.greenLight, text: Colors.greenText },
  warning: { bg: Colors.amberLight, text: Colors.amberText },
  error:   { bg: Colors.redLight,   text: Colors.redText   },
  info:    { bg: '#E6F1FB',         text: '#185FA5'        },
  neutral: { bg: Colors.borderSoft, text: Colors.textSecondary },
};

export const Pill: React.FC<PillProps> = ({
  label,
  variant = 'neutral',
  dot,
  style,
}) => {
  const { bg, text } = pillColors[variant];
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

const btnStyles: Record<string, { bg: string; text: string; border?: string }> = {
  primary:   { bg: Colors.navy,       text: Colors.white },
  secondary: { bg: Colors.greenLight, text: Colors.greenText },
  ghost:     { bg: 'transparent',     text: Colors.navy,    border: Colors.border },
  danger:    { bg: Colors.redLight,   text: Colors.redText, border: Colors.red },
};

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
  const s = btnStyles[variant];
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
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

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
  color = Colors.navy,
  icon,
  style,
}) => (
  <View style={[styles.metricCard, style]}>
    <View style={styles.metricHeader}>
      {icon}
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    {sub && <Text style={styles.metricSub}>{sub}</Text>}
  </View>
);

// ─── Divider ──────────────────────────────────
export const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.divider, style]} />
);

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
}) => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>{icon}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    {message && <Text style={styles.emptyMessage}>{message}</Text>}
    {action && onAction && (
      <Button label={action} onPress={onAction} style={{ marginTop: Spacing.md }} />
    )}
  </View>
);

// ─── Styles ───────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom:    Spacing.sm,
    borderWidth:     0.5,
    borderColor:     Colors.border,
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
    color:      Colors.textPrimary,
  },
  sectionAction: {
    fontSize:   Fonts.sizes.sm,
    color:      '#185FA5',
    fontWeight: Fonts.weights.medium as any,
  },
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    borderWidth:     0.5,
    borderColor:     Colors.border,
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
    color:    Colors.textSecondary,
    fontWeight: Fonts.weights.medium as any,
  },
  metricValue: {
    fontSize:   Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold as any,
    color:      Colors.textPrimary,
  },
  metricSub: {
    fontSize:  Fonts.sizes.xs,
    color:     Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height:          0.5,
    backgroundColor: Colors.border,
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
    color:      Colors.textPrimary,
    textAlign:  'center',
    marginBottom: Spacing.xs,
  },
  emptyMessage: {
    fontSize:  Fonts.sizes.sm,
    color:     Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Fonts.sizes.sm * Fonts.lineHeights.loose,
  },
});
