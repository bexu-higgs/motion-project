import React from 'react';
import {useCurrentFrame} from 'remotion';
import {IconArrow, IconRefresh} from '../components/Icons';
import {ScreenPanel} from '../components/ScreenPanel';
import {Sfx} from '../components/Sfx';
import {ImageSlot} from '../components/Slots';
import {Card, Chip, PartPill} from '../components/ui';
import {IMAGES, ITERATION, RECORDINGS} from '../config';
import {appear, prog, sec as s} from '../lib/anim';
import {Section, wordFrame} from '../timeline';
import {C, FONT, PART} from '../theme';

export const IterateScene: React.FC<{sec: Section}> = ({sec}) => {
	const frame = useCurrentFrame();
	const [l09] = sec.lines;
	const r1 = s(0.5);
	const diffAt = wordFrame(l09, 'бір бөлігін') - 6;
	const strike = prog(frame, diffAt + 14, 14);
	const newAt = diffAt + 30;
	const typed = Math.max(0, Math.floor((frame - newAt) * 1.4));
	const againAt = wordFrame(l09, 'қайта') - 4;
	const r2 = Math.max(againAt + s(1.2), l09.end - s(0.4));
	const color = PART[ITERATION.part].color;

	return (
		<>
			<ScreenPanel slot={RECORDINGS.generate} width={1000} height={540} planned={sec.duration} style={{left: 40, top: 290}} />

			{/* the single edit */}
			<Card style={{left: 60, top: 860, width: 960, height: 150, ...appear(frame, diffAt)}}>
				<div style={{display: 'flex', alignItems: 'center', gap: 26, padding: '0 30px', height: '100%'}}>
					<PartPill part={ITERATION.part} size={30} />
					<div style={{fontFamily: FONT.en, fontSize: 32, lineHeight: 1.35, minWidth: 0}}>
						<div style={{position: 'relative', color: C.muted, display: 'inline-block'}}>
							{ITERATION.from}
							<div
								style={{
									position: 'absolute',
									left: 0,
									top: '52%',
									height: 3,
									width: `${strike * 100}%`,
									background: '#FF6B8B',
									borderRadius: 3,
								}}
							/>
						</div>
						<div style={{color: C.text, fontWeight: 600}}>
							<span style={{background: `${color}33`, boxShadow: `inset 0 -3px 0 ${color}`, borderRadius: 6, padding: '0 4px'}}>
								{ITERATION.to.slice(0, typed)}
							</span>
							<span style={{color: 'transparent'}}>{ITERATION.to.slice(typed)}</span>
						</div>
					</div>
				</div>
			</Card>
			<Sfx name="pop" at={diffAt} />
			<Sfx name="whoosh-soft" at={diffAt + 14} gain={0.6} />

			{/* result 1 -> result 2 */}
			<div style={{position: 'absolute', left: 60, top: 1040, ...appear(frame, r1)}}>
				<ImageSlot file={IMAGES.result1} width={410} height={300} label="1-нәтиже" />
				<Chip style={{position: 'absolute', left: 16, top: 16, fontSize: 24, padding: '6px 16px', background: 'rgba(14,15,18,0.8)'}}>
					1-нәтиже
				</Chip>
			</div>
			<Sfx name="shimmer" at={r1} gain={0.5} />

			<div
				style={{
					position: 'absolute',
					left: 470,
					top: 1140,
					width: 140,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 8,
					color: C.cyanSoft,
					...appear(frame, againAt),
				}}
			>
				<div style={{transform: `rotate(${prog(frame, againAt, 30) * 360}deg)`}}>
					<IconRefresh size={50} />
				</div>
				<IconArrow size={44} />
			</div>
			<Sfx name="click" at={againAt} gain={0.7} />

			<div style={{position: 'absolute', left: 610, top: 1040, ...appear(frame, r2)}}>
				<ImageSlot file={IMAGES.result2} width={410} height={300} label="2-нәтиже" />
				<Chip style={{position: 'absolute', left: 16, top: 16, fontSize: 24, padding: '6px 16px', background: 'rgba(14,15,18,0.8)'}}>
					2-нәтиже
				</Chip>
			</div>
			<Sfx name="shimmer" at={r2} gain={0.6} />
		</>
	);
};
