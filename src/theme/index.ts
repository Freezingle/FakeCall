import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  danger: string;
  success: string;
}

const light: Palette = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEEF2',
  border: '#DFE2E8',
  text: '#101828',
  textMuted: '#5B6475',
  accent: '#5B3DF5',
  onAccent: '#FFFFFF',
  danger: '#C4281C',
  success: '#067647',
};

const dark: Palette = {
  background: '#0F1115',
  surface: '#181B21',
  surfaceAlt: '#232830',
  border: '#2B313B',
  text: '#F2F4F7',
  textMuted: '#9AA3B2',
  accent: '#6F5BFF',
  onAccent: '#FFFFFF',
  danger: '#FF7A70',
  success: '#47CD89',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** The call screens are always dark, independent of the system theme. */
export const callColors = {
  background: '#0B0D12',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.68)',
  control: 'rgba(255,255,255,0.14)',
  controlActive: '#FFFFFF',
  onControlActive: '#0B0D12',
  accept: '#1FA85A',
  decline: '#E5484D',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Android minimum recommended touch target. */
export const MIN_TOUCH = 48;
