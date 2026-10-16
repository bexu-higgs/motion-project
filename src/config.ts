/**
 * Everything you need to edit after recording lives in this file.
 *
 * Asset paths are relative to /public. Any file that is missing is rendered as
 * a clearly-labelled placeholder, so the video always renders and you can see
 * which slots still need real footage. See docs/SHOT_LIST.md.
 *
 * A slot can be a screen recording (.mp4) or a screenshot (.jpg / .png / .webp).
 * For a recording, times in `segments`, `focus` and `callouts` are seconds in the
 * SOURCE file (what any video player shows), so trimming never shifts them.
 * For a screenshot, they are seconds from the start of the scene.
 * Rectangles are in SOURCE pixels: x, y = top-left corner, w, h = size.
 */
import type {PartId} from './theme';

export type Rect = {x: number; y: number; w: number; h: number};
export type FocusKey = Rect & {at: number};
export type Callout = Rect & {
	from: number;
	to: number;
	/** Short label shown next to the highlight. Use the exact UI wording. */
	label?: string;
	/** Adds a click ripple + click sound at `from`. */
	click?: boolean;
};
export type Segment = {start: number; end: number; rate?: number};
export type RecordingSlot = {
	file: string;
	/** Pixel size of the recording or screenshot. */
	size: [number, number];
	/** Which parts of a recording to play, in order (cuts out waiting time). */
	segments?: Segment[];
	/** Camera moves (zoom/pan) so interface text stays readable on a phone. */
	focus?: FocusKey[];
	callouts?: Callout[];
	/** Placeholder text (only visible while the file is missing). */
	slotTitle: string;
	shot: string;
};

/** The official logo, exactly as supplied. Never redrawn, recoloured or stretched. */
export const LOGO_FILES = [
	'brand/higgsfield-logo.jpg',
	'brand/higgsfield-logo.svg',
	'brand/higgsfield-logo.png',
	'brand/higgsfield-logo.webp',
];

/** Model used in the demo, exactly as the Image section shows it. */
export const MODEL_NAME = 'Nano Banana 2.1';

// Real Higgsfield screenshots (public/screens). Callout times follow the narration.
const PROMPT_BAR = {file: 'screens/02-prompt-field.jpg', size: [1080, 348] as [number, number]};
const PROMPT_TEXT: Rect = {x: 60, y: 48, w: 840, h: 100};
const GENERATE_BUTTON: Rect = {x: 830, y: 182, w: 188, h: 106};

export const RECORDINGS = {
	model: {
		file: 'screens/01-image-model-picker.jpg',
		size: [1080, 1028],
		focus: [
			{at: 0, x: 0, y: 0, w: 1080, h: 756},
			{at: 7.6, x: 0, y: 0, w: 1080, h: 756},
			{at: 9.0, x: 0, y: 272, w: 1080, h: 756},
		],
		callouts: [
			{from: 0.4, to: 5.2, x: 40, y: 26, w: 258, h: 74, click: true},
			{from: 9.2, to: 13.5, x: 36, y: 488, w: 1008, h: 148, click: true},
		],
		slotTitle: 'Image бөлімі → модель',
		shot: 'Screenshot of the Image section with the model list.',
	},
	promptField: {
		...PROMPT_BAR,
		callouts: [{from: 0.7, to: 4.3, ...PROMPT_TEXT}],
		slotTitle: 'Промпт өрісі',
		shot: 'Screenshot of the prompt field.',
	},
	generate: {
		...PROMPT_BAR,
		callouts: [
			{from: 0.15, to: 2.0, ...GENERATE_BUTTON, click: true},
			{from: 2.3, to: 4.1, ...PROMPT_TEXT},
			{from: 4.3, to: 6.4, ...GENERATE_BUTTON, click: true},
		],
		slotTitle: 'Промпт өрісі · генерация',
		shot: 'Screenshot of the prompt field with the generate button.',
	},
} satisfies Record<string, RecordingSlot>;

/** Still images: the reference photo and real Higgsfield results. */
export const IMAGES = {
	reference: 'images/reference-bottle.jpg',
	variant1: 'images/variant-1.jpg',
	variant2: 'images/variant-2.jpg',
	variant3: 'images/variant-3.jpg',
};
type ImageId = keyof typeof IMAGES;

/** The example prompt, split into highlighted parts (joined with spaces, in order). */
export const DEMO_PROMPT: {text: string; part?: PartId}[] = [
	{text: 'Turn this'},
	{text: 'simple glass water bottle', part: 'subject'},
	{text: 'into a'},
	{text: 'premium studio advertisement.', part: 'style'},
	{text: 'Preserve the bottle’s shape and proportions.', part: 'subject'},
	{text: 'Place it on a clean ivory pedestal', part: 'composition'},
	{text: 'against a warm beige background.', part: 'background'},
	{text: 'Use soft side lighting, subtle shadows,', part: 'lighting'},
	{text: 'crisp detail, and elegant product photography.', part: 'style'},
	{text: 'Do not add text, logos, or extra objects.'},
];

/**
 * "Generate, review, improve": two real results that differ in one visible element.
 * `note` describes what is visibly different between them.
 */
export const ITERATION: {part: PartId; note: string; from: ImageId; to: ImageId} = {
	part: 'composition',
	note: 'Тұғырды өзгертеміз',
	from: 'variant2',
	to: 'variant3',
};

/** Practice: the three variations, each with a short description of what it shows. */
export const VARIANTS: {image: ImageId; note: string}[] = [
	{image: 'variant1', note: 'Ашық фон, ағаш үстел'},
	{image: 'variant2', note: 'Қараңғы интерьер, тақтатас'},
	{image: 'variant3', note: 'Қараңғы интерьер, тегіс тас'},
];

/** Which variation is "saved" in the wrap-up (1, 2 or 3). */
export const FINAL_PICK = 3;

/**
 * Optional labels for the shape cards / resolution demo. Leave as null unless the
 * selected model's controls show exactly these values, so the video never
 * displays unsupported options.
 * Example (only if the UI shows them): {square: '1:1', vertical: '9:16', horizontal: '16:9'}
 */
export const RATIO_LABELS: {square: string | null; vertical: string | null; horizontal: string | null} = {
	square: null,
	vertical: null,
	horizontal: null,
};
/** Example (only if the UI shows them): ['1K', '2K'] */
export const RESOLUTION_LABELS: [string, string] | null = null;
