import '@fontsource-variable/onest';
import '@fontsource-variable/inter';

export const W = 1080;
export const H = 1920;
export const FPS = 30;

/** Layout guides for 9:16 social video (keeps text clear of the Reels/Stories UI). */
export const SAFE = {
	top: 150,
	captionBottom: 380, // distance from the bottom edge to the caption baseline box
	side: 60,
	contentTop: 270,
	contentBottom: 1370,
};

export const C = {
	bg: '#0E0F12',
	bgRaised: '#15171C',
	surface: 'rgba(255,255,255,0.045)',
	surfaceStrong: 'rgba(255,255,255,0.075)',
	border: 'rgba(255,255,255,0.09)',
	borderStrong: 'rgba(255,255,255,0.16)',
	text: '#F5F5F7',
	muted: '#A3A6B1',
	faint: '#6C707C',
	purple: '#8B5CF6',
	purpleSoft: '#B49CFF',
	cyan: '#22D3EE',
	cyanSoft: '#7FE7F6',
	gradient: 'linear-gradient(100deg, #B49CFF 0%, #8B5CF6 35%, #22D3EE 100%)',
	gradientSoft: 'linear-gradient(100deg, rgba(139,92,246,0.22), rgba(34,211,238,0.18))',
};

/** Prompt components: one colour each, used consistently from the formula to the highlights. */
export const PART = {
	subject: {kk: 'Нысан', color: '#C4A5FF'},
	background: {kk: 'Фон', color: '#8EA2FF'},
	lighting: {kk: 'Жарық', color: '#7FE7F6'},
	composition: {kk: 'Композиция', color: '#4FE0C4'},
	style: {kk: 'Стиль', color: '#F29CFF'},
} as const;
export type PartId = keyof typeof PART;
export const PART_ORDER: PartId[] = ['subject', 'background', 'lighting', 'composition', 'style'];

export const FONT = {
	kk: "'Onest Variable', 'Inter Variable', system-ui, sans-serif",
	en: "'Inter Variable', 'Onest Variable', system-ui, sans-serif",
};
