import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {pop, prog} from '../lib/anim';
import {C, FONT, PART, PART_ORDER, PartId} from '../theme';
import {PartPill} from './ui';

export type PromptPart = {text: string; part?: PartId};

const alpha = (hex: string, a: number) =>
	`${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255)
		.toString(16)
		.padStart(2, '0')}`;

/** Character offset at which each part finishes, given parts joined by single spaces. */
export function partEnds(parts: PromptPart[]): number[] {
	let acc = 0;
	return parts.map((p, i) => {
		acc += p.text.length + (i < parts.length - 1 ? 1 : 0);
		return acc;
	});
}

/**
 * The demo prompt, large and readable: types in, and each component is
 * highlighted in its formula colour the moment it is complete.
 */
export const PromptText: React.FC<{
	parts: PromptPart[];
	typeStart: number;
	charsPerFrame: number;
	fontSize?: number;
	showLegend?: boolean;
}> = ({parts, typeStart, charsPerFrame, fontSize = 33, showLegend = true}) => {
	const frame = useCurrentFrame();
	const typed = Math.max(0, Math.floor((frame - typeStart) * charsPerFrame));
	const ends = partEnds(parts);
	const doneAt = (i: number) => typeStart + ends[i] / charsPerFrame;
	const finished = typed >= ends[ends.length - 1];
	const caretOn = !finished || Math.floor(frame / 15) % 2 === 0;

	let offset = 0;
	const spans = parts.map((p, i) => {
		const start = offset;
		const text = p.text + (i < parts.length - 1 ? ' ' : '');
		offset += text.length;
		const visible = Math.max(0, Math.min(text.length, typed - start));
		const hl = p.part ? prog(frame, doneAt(i), 10) : 0;
		const color = p.part ? PART[p.part].color : C.text;
		const caretHere = typed >= start && typed < start + text.length;
		const body = p.text;
		const shown = body.slice(0, visible);
		const hidden = body.slice(visible);
		return (
			<React.Fragment key={i}>
				<span
					style={{
						background: p.part ? alpha(color, 0.2 * hl) : 'transparent',
						boxShadow: p.part ? `inset 0 -3px 0 ${alpha(color, 0.9 * hl)}` : 'none',
						borderRadius: 8,
						padding: '1px 3px',
						margin: '0 -3px',
						WebkitBoxDecorationBreak: 'clone',
						boxDecorationBreak: 'clone',
						color: p.part ? undefined : C.muted,
					}}
				>
					{shown}
					{caretHere ? <Caret on={caretOn} size={fontSize} /> : null}
					<span style={{color: 'transparent'}}>{hidden}</span>
				</span>
				{i < parts.length - 1 ? ' ' : null}
			</React.Fragment>
		);
	});

	const firstHighlight: Partial<Record<PartId, number>> = {};
	parts.forEach((p, i) => {
		if (p.part && firstHighlight[p.part] === undefined) firstHighlight[p.part] = doneAt(i);
	});

	return (
		<div>
			<div style={{fontFamily: FONT.en, fontSize, lineHeight: 1.52, color: C.text, fontWeight: 480, letterSpacing: -0.1}}>
				{spans}
				{finished ? <Caret on={caretOn} size={fontSize} /> : null}
			</div>
			{showLegend ? (
				<div style={{display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26}}>
					{PART_ORDER.map((id) => {
						const at = firstHighlight[id];
						const lit = at === undefined ? 0 : prog(frame, at, 8);
						const bump = at === undefined ? 1 : interpolate(pop(frame, at), [0, 1], [1.15, 1]);
						return (
							<div key={id} style={{transform: `scale(${lit > 0 ? bump : 1})`}}>
								<PartPill part={id} size={26} dim={lit < 0.5} />
							</div>
						);
					})}
				</div>
			) : null}
		</div>
	);
};

const Caret: React.FC<{on: boolean; size: number}> = ({on, size}) => (
	<span
		style={{
			display: 'inline-block',
			width: 3,
			height: size * 1.05,
			marginLeft: 2,
			marginRight: -5,
			verticalAlign: 'text-bottom',
			background: C.cyan,
			opacity: on ? 1 : 0,
			boxShadow: `0 0 10px ${C.cyan}`,
		}}
	/>
);
