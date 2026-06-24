// ─────────────────────────────────────────────
//  IASIS Design Tokens
//  Paleta extraída do logo: azul-marinho + azul-claro + verde-saúde
// ─────────────────────────────────────────────

export const Colors = {
  // Primárias
  navy:       '#1C2B4B',   // navbar, headers
  navyLight:  '#2E4A7A',   // gradients
  blue:       '#5B9BD5',   // pulseira / azul claro do coração
  blueLight:  '#A8CCE8',   // ícones suaves

  // Secundárias
  green:      '#1D9E75',   // confirmado / tomado
  greenLight: '#E1F5EE',   // fundo badge sucesso
  greenText:  '#0F6E56',

  amber:      '#F59E0B',   // alerta / pendente
  amberLight: '#FAEEDA',
  amberText:  '#854F0B',

  red:        '#EF4444',   // erro / esquecimento
  redLight:   '#FCEBEB',
  redText:    '#A32D2D',

  // Neutros
  bg:         '#F4F6FA',   // fundo geral
  surface:    '#FFFFFF',   // cards
  border:     '#E2E8F0',
  borderSoft: '#F1F5F9',

  textPrimary:   '#1C2B4B',
  textSecondary: '#64748B',
  textMuted:     '#94A3B8',

  // Utility
  white:      '#FFFFFF',
  black:      '#000000',
  transparent: 'transparent',
} as const;

export const Fonts = {
  // Família
  regular: 'System',
  mono: 'Courier New',

  // Pesos
  weights: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
  },

  // Tamanhos
  sizes: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    xxl:  28,
    hero: 36,
  },

  // Line heights
  lineHeights: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
} as const;

export const Spacing = {
  xxs: 4,
  xs:  8,
  sm:  12,
  md:  16,
  lg:  20,
  xl:  24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  full: 999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
