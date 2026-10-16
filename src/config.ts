/**
 * Everything you need to edit after recording lives in this file.
 *
 * Asset paths are relative to /public. Any file that is missing is rendered as
 * a clearly-labelled placeholder, so the video always renders and you can see
 * which slots still need real footage. See docs/SHOT_LIST.md.
 *
 * Times in `segments`, `focus` and `callouts` are seconds in the SOURCE
 * recording (what any video player shows), so trimming never shifts them.
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
	/** Pixel size of the recording. */
	size: [number, number];
	/** Which parts of the source to play, in order (cuts out waiting time). */
	segments?: Segment[];
	/** Camera moves (zoom/pan) so interface text stays readable on a phone. */
	focus?: FocusKey[];
	callouts?: Callout[];
	/** Placeholder text (only visible while the file is missing). */
	slotTitle: string;
	shot: string;
};

/** The official logo, exactly as supplied by Higgsfield. Never redrawn. */
export const LOGO_FILES = ['brand/higgsfield-logo.svg', 'brand/higgsfield-logo.png', 'brand/higgsfield-logo.webp'];

/** Model used in the demo. Must match the name shown in your account. */
export const MODEL_NAME = 'Nano Banana';

export const RECORDINGS = {
	model: {
		file: 'recordings/01-image-model.mp4',
		size: [1920, 1080],
		slotTitle: 'REC 01 · Image бөлімі → модель',
		shot: 'Open the Image section, open the model picker, select Nano Banana.',
	},
	promptField: {
		file: 'recordings/02-prompt-field.mp4',
		size: [1920, 1080],
		slotTitle: 'REC 02 · Промпт өрісі',
		shot: 'Hold on the empty prompt field for ~5 s (cursor in the field).',
	},
	upload: {
		file: 'recordings/03-upload-and-prompt.mp4',
		size: [1920, 1080],
		slotTitle: 'REC 03 · Сурет жүктеу + промпт',
		shot: 'Upload the reference bottle photo, then type the demo prompt.',
	},
	generate: {
		file: 'recordings/04-generate-iterate.mp4',
		size: [1920, 1080],
		slotTitle: 'REC 04 · Generate → нәтиже → түзету',
		shot: 'Click Generate, show result; change only the background phrase; Generate again.',
	},
	format: {
		file: 'recordings/05-aspect-resolution.mp4',
		size: [1920, 1080],
		slotTitle: 'REC 05 · Кадр пішімі + ажыратымдылық',
		shot: 'Open the aspect-ratio control, then the resolution control.',
	},
} satisfies Record<string, RecordingSlot>;

/** Still images. All results must be real Higgsfield outputs from the recording session. */
export const IMAGES = {
	reference: 'images/reference-bottle.png',
	result1: 'images/result-1.png',
	result2: 'images/result-2.png',
	variant1: 'images/variant-1.png',
	variant2: 'images/variant-2.png',
	variant3: 'images/variant-3.png',
};

/** The demonstration prompt, split into highlighted parts (joined with spaces, in order). */
export const DEMO_PROMPT: {text: string; part?: PartId}[] = [
	{text: 'Turn this'},
	{text: 'simple skincare bottle', part: 'subject'},
	{text: 'into a'},
	{text: 'premium studio advertisement.', part: 'style'},
	{text: 'Preserve the bottle’s shape and proportions.', part: 'subject'},
	{text: 'Place it on a clean ivory pedestal', part: 'composition'},
	{text: 'against a warm beige background.', part: 'background'},
	{text: 'Use soft side lighting, subtle shadows,', part: 'lighting'},
	{text: 'crisp detail, and elegant product photography.', part: 'style'},
	{text: 'Do not add text, logos, or extra objects.'},
];

/** The single edit shown in the "generate, review, improve" step (must match REC 04). */
export const ITERATION = {
	part: 'background' as PartId,
	from: 'against a warm beige background.',
	to: 'against a soft sage-green background.',
};

/** Practice variations: same reference + core prompt, ONE element changed each time. */
export const VARIANTS: {image: keyof typeof IMAGES; part: PartId; change: string}[] = [
	{image: 'variant1', part: 'background', change: 'soft blush-pink background'},
	{image: 'variant2', part: 'lighting', change: 'warm golden window light'},
	{image: 'variant3', part: 'composition', change: 'low-angle close-up'},
];

/** Which variation is "saved" in the wrap-up (1, 2 or 3). */
export const FINAL_PICK = 2;

/**
 * Optional labels for the shape cards / resolution demo. Leave as null unless the
 * selected model's controls in your recording show exactly these values, so the
 * video never displays unsupported options.
 * Example (only if the UI shows them): {square: '1:1', vertical: '9:16', horizontal: '16:9'}
 */
export const RATIO_LABELS: {square: string | null; vertical: string | null; horizontal: string | null} = {
	square: null,
	vertical: null,
	horizontal: null,
};
/** Example (only if the UI shows them): ['1K', '2K'] */
export const RESOLUTION_LABELS: [string, string] | null = null;
