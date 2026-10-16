import React from 'react';

type P = {size?: number; color?: string; stroke?: number};

const Svg: React.FC<P & {children: React.ReactNode}> = ({size = 48, color = 'currentColor', stroke = 2.2, children}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth={stroke}
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		{children}
	</svg>
);

export const IconImageEdit: React.FC<P> = (p) => (
	<Svg {...p}>
		<rect x="3" y="3" width="14" height="14" rx="3" />
		<path d="M3 13l4-4 4 4" />
		<circle cx="12.5" cy="7.5" r="1.4" />
		<path d="M14.5 20.5l1-3.5 5-5a1.6 1.6 0 012.3 2.3l-5 5z" />
	</Svg>
);

export const IconStyle: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M12 3a9 9 0 100 18c1.2 0 1.8-.9 1.5-1.9-.4-1.2.3-2.1 1.5-2.1H17a4 4 0 004-4c0-5.5-4-10-9-10z" />
		<circle cx="7.5" cy="11" r="1.2" />
		<circle cx="10.5" cy="7" r="1.2" />
		<circle cx="15" cy="7.5" r="1.2" />
	</Svg>
);

export const IconText: React.FC<P> = (p) => (
	<Svg {...p}>
		<rect x="2.5" y="4" width="19" height="16" rx="3" />
		<path d="M7 16l3-8 3 8M8 13.5h4" />
		<path d="M15.5 11.5a1.8 1.8 0 113.6 0V16M19.1 13.2c-2.6-.4-3.8.4-3.8 1.5 0 .8.6 1.4 1.5 1.4 1 0 2.3-.7 2.3-2.2" />
	</Svg>
);

export const IconUpload: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
		<path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
	</Svg>
);

export const IconSparkle: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
		<path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
	</Svg>
);

export const IconCheck: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M5 12.5l4.5 4.5L19 7.5" />
	</Svg>
);

export const IconDownload: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
		<path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
	</Svg>
);

export const IconArrow: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5" />
	</Svg>
);

export const IconRefresh: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M20 11a8 8 0 10-2.3 5.7" />
		<path d="M20 4v7h-7" />
	</Svg>
);

export const IconGrid: React.FC<P> = (p) => (
	<Svg {...p}>
		<rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
		<rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
		<rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
		<rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
	</Svg>
);

export const IconPhone: React.FC<P> = (p) => (
	<Svg {...p}>
		<rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
		<path d="M10.5 18.5h3" />
	</Svg>
);

export const IconBanner: React.FC<P> = (p) => (
	<Svg {...p}>
		<rect x="2.5" y="6.5" width="19" height="11" rx="2" />
		<path d="M6 10.5h7M6 13.5h4" />
	</Svg>
);

export const IconFilm: React.FC<P> = (p) => (
	<Svg {...p}>
		<rect x="3" y="4" width="18" height="16" rx="3" />
		<path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
	</Svg>
);

export const IconPhoto: React.FC<P> = (p) => (
	<Svg {...p}>
		<rect x="3" y="3" width="18" height="18" rx="3" />
		<circle cx="9" cy="9" r="1.8" />
		<path d="M21 15l-5-5L5 21" />
	</Svg>
);
