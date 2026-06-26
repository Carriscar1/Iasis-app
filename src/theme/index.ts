import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Breakpoints
export const isSmall  = SCREEN_W < 375;
export const isMedium = SCREEN_W >= 375 && SCREEN_W < 768;
export const isTablet = SCREEN_W >= 768;

// Escala proporcional
export const scale  = (size: number) => (SCREEN_W / 390) * size;
export const vscale = (size: number) => (SCREEN_H / 844) * size;
export const SCREEN_WIDTH  = SCREEN_W;
export const SCREEN_HEIGHT = SCREEN_H;

export const Colors = {
  navy:       '#1C2B4B',
  navyLight:  '#2E4A7A',
  blue:       '#5B9BD5',
  blueLight:  '#A8CCE8',
  green:      '#1D9E75',
  greenLight: '#E1F5EE',
  greenText:  '#0F6E56',
  amber:      '#F59E0B',
  amberLight: '#FAEEDA',
  amberText:  '#854F0B',
  red:        '#EF4444',
  redLight:   '#FCEBEB',
  redText:    '#A32D2D',
  bg:         '#F4F6FA',
  surface:    '#FFFFFF',
  border:     '#E2E8F0',
  borderSoft: '#F1F5F9',
  textPrimary:   '#1C2B4B',
  textSecondary: '#64748B',
  textMuted:     '#94A3B8',
  white:      '#FFFFFF',
  black:      '#000000',
  transparent: 'transparent',
} as const;

export const Fonts = {
  sizes: {
    xs:   scale(11),
    sm:   scale(13),
    base: scale(15),
    md:   scale(17),
    lg:   scale(20),
    xl:   scale(24),
    xxl:  scale(28),
    hero: scale(36),
  },
  weights: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
  },
  lineHeights: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
} as const;

export const Spacing = {
  xxs: scale(4),
  xs:  scale(8),
  sm:  scale(12),
  md:  scale(16),
  lg:  scale(20),
  xl:  scale(24),
  xxl: scale(32),
  xxxl: scale(48),
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
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
