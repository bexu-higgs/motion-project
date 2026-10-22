// Интерфейс белгішелері (SVG, 24x24).
const s = (p) => `<svg viewBox="0 0 24 24">${p}</svg>`;
export const ICON = {
  fire: s('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.5" fill="#fff"/>'),
  aim: s('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  jump: s('<path d="M12 20V5M5 11l7-7 7 7"/>'),
  crouch: s('<circle cx="12" cy="5" r="2.4"/><path d="M12 8l-3 5h6l2 6M9 13l-3 6"/>'),
  reload: s('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>'),
  gloo: s('<path d="M3 20c2-9 16-9 18 0"/><path d="M7 15l1.5-4M12 13V8M17 15l-1.5-4"/>'),
  heal: s('<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M12 9v7M8.5 12.5h7M9 6V4h6v2"/>'),
  kymyz: s('<path d="M10 3h4v3l1 1c2.5 1.5 3.5 4 3.5 6.5C18.5 18 15.5 21 12 21s-6.5-3-6.5-7.5C5.5 11 6.5 8.5 9 7l1-1z"/><path d="M8 14c2 1.2 6 1.2 8 0"/>'),
  grenade: s('<circle cx="11" cy="14" r="6"/><path d="M11 8V5h4M15 5l3-2M9 11.5l4 5M13 11.5l-4 5"/>'),
  pause: s('<path d="M8 5v14M16 5v14"/>'),
  map: s('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  pickup: s('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>'),
  parachute: s('<path d="M3 10a9 7 0 0 1 18 0"/><path d="M3 10l9 9 9-9M8 10l4 9 4-9"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  person: s('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'),
  book: s('<path d="M4 5c3-1.5 5.5-1.5 8 0v15c-2.5-1.5-5-1.5-8 0zM20 5c-3-1.5-5.5-1.5-8 0v15c2.5-1.5 5-1.5 8 0z"/>'),
  chart: s('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  exit: s('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
  car: s('<path d="M3 15v-3l2-5h14l2 5v3z"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/><path d="M6 12h12"/>'),
  skull: s('<path d="M5 11a7 7 0 0 1 14 0v3l-2 1v3H7v-3l-2-1z"/><circle cx="9" cy="11" r="1.6" fill="#fff"/><circle cx="15" cy="11" r="1.6" fill="#fff"/>'),
};
