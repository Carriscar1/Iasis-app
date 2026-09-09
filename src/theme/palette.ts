// ─────────────────────────────────────────────
//  IASIS — Paletas clara e escura
//
//  As duas têm exatamente as mesmas chaves: é isso que permite trocar de
//  tema sem tocar em nenhuma tela. Cada chave descreve o PAPEL da cor
//  (superfície, texto secundário, borda), não a cor em si — por isso
//  `surface` no escuro é quase preto e continua fazendo sentido.
//
//  Uma separação importante: `navy` era usado tanto como FUNDO de cabeçalho
//  e botão (com texto branco por cima) quanto como COR de ícone e texto
//  sobre fundo claro. No tema claro os dois papéis coincidem; no escuro,
//  não — fundo precisa ser escuro para o branco ler, e texto precisa ser
//  claro para ler sobre o escuro. Daí `navyBg` (fundo) e `navy` (frente).
//
//  O escuro não é o claro invertido: preto puro com branco puro cansa a
//  vista, então o fundo é cinza-azulado e o texto é branco levemente
//  acinzentado.
// ─────────────────────────────────────────────

export const LIGHT = {
  // Frente: ícones e textos de destaque
  navy:       '#1C2B4B',
  // Fundo: cabeçalhos e botões primários (texto branco por cima)
  navyBg:     '#1C2B4B',
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

export type ThemeColors = { -readonly [K in keyof typeof LIGHT]: string };

export const DARK: ThemeColors = {
  // Frente: azul claro, para ler sobre superfície escura
  navy:       '#8AB8EA',
  // Fundo: azul profundo, para o texto branco continuar legível em cima
  navyBg:     '#22406E',
  navyLight:  '#6FA5DC',

  blue:       '#5B9BD5',
  blueLight:  '#7FB3E8',

  green:      '#34D399',
  greenLight: '#12362B',   // fundo das faixas de sucesso
  greenText:  '#6EE7B7',

  amber:      '#FBBF24',
  amberLight: '#3A2D11',
  amberText:  '#FCD34D',

  red:        '#F87171',
  redLight:   '#3A1A1A',
  redText:    '#FCA5A5',

  bg:         '#0F172A',
  surface:    '#1B253C',   // cartões, um degrau acima do fundo
  border:     '#38455F',
  borderSoft: '#26324A',

  textPrimary:   '#E8EDF6',
  textSecondary: '#A6B3C9',
  textMuted:     '#7C8AA3',

  white:      '#FFFFFF',
  black:      '#000000',
  transparent: 'transparent',
};

/** Sombra some no escuro: sombra preta sobre fundo escuro não aparece e só
 *  custa desempenho. A separação entre cartão e fundo vem do `surface`. */
export const SHADOW_OPACITY = { light: 1, dark: 0 } as const;
