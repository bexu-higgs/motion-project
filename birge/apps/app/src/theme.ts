/** Кинозалға ұқсас қараңғы тақырып. */
export const colors = {
  bg: '#0B0D17',
  surface: '#141726',
  surfaceAlt: '#1C2033',
  surfaceHover: '#232843',
  border: '#272C44',
  text: '#F4F5FA',
  textMuted: '#A0A6BE',
  textFaint: '#6B7290',
  primary: '#7C5CFF',
  primaryPressed: '#6747F0',
  primarySoft: 'rgba(124, 92, 255, 0.16)',
  accent: '#FF5C8A',
  danger: '#FF5A5F',
  dangerSoft: 'rgba(255, 90, 95, 0.14)',
  success: '#33D69F',
  warning: '#FFB547',
  overlay: 'rgba(4, 5, 12, 0.72)',
  black: '#000000',
  white: '#FFFFFF',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  hero: 34,
  title: 26,
  h2: 20,
  h3: 17,
  body: 16,
  small: 14,
  tiny: 12,
};

/** Аватар түсі қолданушы ID-іне қарай тұрақты болады. */
const AVATAR_COLORS = ['#7C5CFF', '#FF5C8A', '#2EC4B6', '#FF9F1C', '#3A86FF', '#8AC926', '#E76F51', '#B5179E'];
export function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export const WIDE_BREAKPOINT = 900;
