export const colors = {
  bg: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1F1F1F',
  border: '#2A2A2A',

  text: '#FFFFFF',
  textMuted: '#A1A1AA',
  textDim: '#6B6B70',

  primary: '#FF5722',
  primaryDark: '#E64A19',
  accent: '#FFEB3B',

  success: '#22C55E',
  danger: '#EF4444',

  gradientStart: '#FFEB3B',
  gradientEnd: '#FF5722',

  black: '#000000',
  white: '#FFFFFF',
} as const;

export type ColorKey = keyof typeof colors;
