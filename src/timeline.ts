import narration from './generated/narration-timing.json';
import {FPS} from './theme';

export type SectionId = 'intro' | 'model' | 'prompt' | 'ad' | 'iterate' | 'format' | 'practice' | 'wrap';

type Plan = {
	id: SectionId;
	/** seconds of visuals before the first line */
	lead: number;
	/** seconds between lines */
	gap: number;
	/** seconds after the last line */
	tail: number;
	/** the section is never shorter than this (visual action needs time) */
	min: number;
	/** optional earliest start (seconds into the section) per line id */
	minStart?: Record<string, number>;
};

// Storyboard order. Durations follow the narration, never cut a sentence short.
const PLAN: Plan[] = [
	{id: 'intro', lead: 0.9, gap: 0.5, tail: 0.5, min: 6},
	{id: 'model', lead: 0.5, gap: 0.55, tail: 0.6, min: 11},
	{id: 'prompt', lead: 0.45, gap: 0.6, tail: 0.9, min: 10},
	{id: 'ad', lead: 0.45, gap: 0.6, tail: 0.6, min: 15.5, minStart: {L08: 5.0}},
	{id: 'iterate', lead: 0.6, gap: 0.5, tail: 0.6, min: 10.5},
	{id: 'format', lead: 0.45, gap: 0.6, tail: 0.6, min: 11},
	{id: 'practice', lead: 0.7, gap: 0.5, tail: 0.6, min: 11.5},
	{id: 'wrap', lead: 0.35, gap: 0.5, tail: 0.6, min: 8},
];

/** Frames two neighbouring scenes overlap (cross-transition). */
export const OVERLAP = 12;

export type Phrase = {text: string; start: number; end: number};
export type Line = {
	id: string;
	text: string;
	file: string;
	/** frames, relative to the section start */
	start: number;
	end: number;
	phrases: Phrase[];
};
export type Section = {id: SectionId; from: number; duration: number; lines: Line[]};

const f = (s: number) => Math.round(s * FPS);

function build() {
	const sections: Section[] = [];
	let cursor = 0;
	for (const plan of PLAN) {
		const src = narration.lines.filter((l) => l.section === plan.id);
		let t = plan.lead;
		const lines: Line[] = src.map((l) => {
			const start = Math.max(t, plan.minStart?.[l.id] ?? 0);
			t = start + l.duration + plan.gap;
			return {
				id: l.id,
				text: l.text,
				file: l.file,
				start: f(start),
				end: f(start + l.duration),
				phrases: l.phrases.map((p) => ({text: p.text, start: f(start + p.start), end: f(start + p.end)})),
			};
		});
		const last = lines.length ? lines[lines.length - 1].end / FPS : 0;
		const duration = f(Math.max(plan.min, last + plan.tail));
		sections.push({id: plan.id, from: cursor, duration, lines});
		cursor += duration - OVERLAP;
	}
	const total = sections[sections.length - 1].from + sections[sections.length - 1].duration;
	return {sections, total};
}

export const TIMELINE = build();

export const section = (id: SectionId): Section => {
	const s = TIMELINE.sections.find((x) => x.id === id);
	if (!s) throw new Error(`Unknown section ${id}`);
	return s;
};

/** Absolute-frame view of every line (for captions, audio and ducking). */
export const ALL_LINES = TIMELINE.sections.flatMap((s) =>
	s.lines.map((l) => ({
		...l,
		start: s.from + l.start,
		end: s.from + l.end,
		phrases: l.phrases.map((p) => ({...p, start: s.from + p.start, end: s.from + p.end})),
	})),
);

/** Approximate frame at which `word` (substring) is spoken within a line, by character position. */
export function wordFrame(line: Line, word: string): number {
	for (const p of line.phrases) {
		const i = p.text.indexOf(word);
		if (i >= 0) return Math.round(p.start + ((p.end - p.start) * (i + word.length * 0.3)) / p.text.length);
	}
	return line.start;
}
