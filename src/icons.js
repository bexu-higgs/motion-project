// Minimal line icons (24×24, stroke = currentColor).
const wrap = (body, sw = 1.8) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICON = {
  image: wrap('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9.5" r="1.8"/><path d="M4 18l5.5-5.5 4 4 2.5-2.5L20 18"/>'),
  person: wrap('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>'),
  video: wrap('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>'),
  mountain: wrap('<path d="M2.5 19l6-9 4 5.5 2.5-3.2L21.5 19z"/><circle cx="17" cy="6.5" r="1.8"/>'),
  camera: wrap('<path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.2" r="3.4"/>'),
  run: wrap('<circle cx="14.5" cy="4.5" r="2"/><path d="M8 21l3-5 3 2v4M6 11l3-3.5 4 .5 2.5 3.5 3 1M11 16l1.5-6"/>'),
  sparkle: wrap('<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" fill="currentColor" stroke="none"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" stroke="none"/>'),
  upload: wrap('<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  film: wrap('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>', 2.2),
  text: wrap('<path d="M5 6h14M5 10.5h14M5 15h9"/>'),
  light: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
  play: wrap('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  face: wrap('<path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16"/><circle cx="9.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="14.5" cy="10.5" r=".8" fill="currentColor"/><path d="M9.5 15c1.4 1 3.6 1 5 0"/>'),
  hair: wrap('<path d="M5 13c0-5 3-8.5 7-8.5s7 3.5 7 8.5"/><path d="M8 7.5c2.5 1.5 6 1.5 9 .5M6 10.5c3-1 7-1.2 12-.2"/>'),
  target: wrap('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>'),
  wand: wrap('<path d="M4 20L15 9M14 4v2.5M19.5 9.5H17M17.6 5.4l-1.6 1.6"/>'),
};

export const CURSOR_SVG = `<svg viewBox="0 0 64 64" width="64" height="64"><defs><filter id="cs" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/></filter></defs>
<path d="M10 6 L10 50 L21.5 39 L29.5 57 L37 53.5 L29 36 L45 36 Z" fill="#ffffff" stroke="#0a0f14" stroke-width="3" stroke-linejoin="round" filter="url(#cs)"/></svg>`;
