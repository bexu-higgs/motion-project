// Small deterministic motion toolkit: every visual is a pure function of time t,
// so any frame can be rendered by seeking to it.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const prog = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / dur));

export const E = {
  linear: (p) => p,
  out3: (p) => 1 - Math.pow(1 - p, 3),
  out5: (p) => 1 - Math.pow(1 - p, 5),
  inOut3: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outBack: (p) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  },
};

// Fade-in at `inAt`, optional fade-out at `outAt`. Returns 0..1.
export function life(t, inAt, outAt = Infinity, inDur = 0.6, outDur = 0.45) {
  return E.out3(prog(t, inAt, inDur)) * (1 - E.inOut3(prog(t, outAt, outDur)));
}

export function css(el, { o = 1, x = 0, y = 0, s = 1, blur = 0, rot = 0 } = {}) {
  el.style.opacity = o.toFixed(4);
  el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
  el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
  el.style.visibility = o <= 0.001 ? "hidden" : "visible";
}

// Standard entrance (fade + rise + de-blur), with optional exit.
export function enter(el, t, at, { dur = 0.7, y = 36, x = 0, s = 1, blur = 8, out = Infinity, outDur = 0.45 } = {}) {
  const p = E.out3(prog(t, at, dur));
  const q = E.inOut3(prog(t, out, outDur));
  css(el, {
    o: p * (1 - q),
    x: x * (1 - p),
    y: y * (1 - p) - 24 * q,
    s: lerp(s, 1, p),
    blur: blur * (1 - p) + 6 * q,
  });
  return p * (1 - q);
}

export function el(tag, cls, parent, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  if (parent) parent.appendChild(n);
  return n;
}

export function place(node, { x, y, w, h }) {
  if (x != null) node.style.left = `${x}px`;
  if (y != null) node.style.top = `${y}px`;
  if (w != null) node.style.width = `${w}px`;
  if (h != null) node.style.height = `${h}px`;
  return node;
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function fit(aspect, box) {
  let w = box.w, h = box.w / aspect;
  if (h > box.h) { h = box.h; w = h * aspect; }
  return { w, h };
}

// ---------------------------------------------------------------- icons
const I = (d, extra = "") =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICON = {
  text: I('<path d="M10 13h28M10 21h28M10 29h20M10 37h14"/>'),
  image: I('<rect x="7" y="9" width="34" height="30" rx="5"/><circle cx="18" cy="19" r="3.5"/><path d="M8 34l10-9 8 7 6-5 9 8"/>'),
  film: I('<rect x="6" y="10" width="36" height="28" rx="5"/><path d="M21 19l9 5-9 5z" fill="currentColor"/>'),
  arrow: I('<path d="M8 24h30M30 15l9 9-9 9"/>'),
  clock: I('<circle cx="24" cy="24" r="16"/><path d="M24 15v10l6 4"/>'),
  detail: I('<rect x="8" y="8" width="32" height="32" rx="4"/><path d="M8 19h32M8 29h32M19 8v32M29 8v32"/>'),
  frame: I('<rect x="14" y="6" width="20" height="36" rx="4"/>'),
  camera: I('<rect x="6" y="14" width="26" height="20" rx="4"/><path d="M32 21l10-6v18l-10-6"/>'),
  person: I('<circle cx="24" cy="17" r="7"/><path d="M11 40c1-8 6-12 13-12s12 4 13 12"/>'),
  check: I('<path d="M12 25l8 8 16-17"/>'),
  cross: I('<path d="M14 14l20 20M34 14L14 34"/>'),
  upload: I('<path d="M24 32V10M15 18l9-9 9 9M10 38h28"/>'),
  target: I('<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="1.5" fill="currentColor"/>'),
  input: I('<rect x="6" y="10" width="15" height="12" rx="3"/><path d="M8 34h11M8 40h7"/><path d="M26 24h14M34 18l6 6-6 6"/>'),
  wave: I('<path d="M6 28c4-10 8-10 12 0s8 10 12 0 8-10 12 0"/>'),
  refresh: I('<path d="M38 22a14 14 0 1 0-3 11"/><path d="M39 11v11H28"/>'),
  sparkle: I('<path d="M24 6l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/>'),
  list: I('<path d="M18 14h22M18 24h22M18 34h22"/><circle cx="10" cy="14" r="1.8" fill="currentColor"/><circle cx="10" cy="24" r="1.8" fill="currentColor"/><circle cx="10" cy="34" r="1.8" fill="currentColor"/>'),
};

// ---------------------------------------------------------------- media slot
// Shows a real screen recording / generated clip / image when it exists in the
// build manifest. Otherwise draws a clearly-marked draft placeholder.
export class Slot {
  constructor(parent, ctx, { id, kind = "capture", box, align = "center", tag, note, aspect, loop = false }) {
    this.ctx = ctx;
    this.loop = loop;
    this.id = id;
    this.kind = kind;
    const m = kind === "image" ? ctx.manifest.images?.[id] : ctx.manifest.captures?.[id];
    this.media = m || null;
    this.cfg = (kind === "capture" && ctx.config.captures?.[id]) || {};
    const a = m ? m.width / m.height : aspect || 16 / 9;
    // contain: the frame takes the media's shape; cover: the frame fills the box
    // and the media is cropped (zoom keyframes then choose what is visible)
    let fw, fh, mw, mh;
    if (m && this.cfg.fit === "cover") {
      fw = box.w; fh = box.h;
      if (a > fw / fh) { mh = fh; mw = fh * a; } else { mw = fw; mh = fw / a; }
    } else {
      ({ w: fw, h: fh } = fit(a, box));
      mw = fw; mh = fh;
    }
    const x = box.x + (box.w - fw) / 2;
    const y = align === "top" ? box.y : box.y + (box.h - fh) / 2;
    this.w = fw; this.h = fh; this.mw = mw; this.mh = mh;
    this.el = place(el("div", "slot", parent), { x, y, w: fw, h: fh });
    if (tag) this.tag = el("div", "tag", this.el, `<i class="rec"></i><span>${tag}</span>`);
    this.frame = el("div", "frame", this.el);
    this.mediaEl = place(el("div", "media", this.frame), { w: mw, h: mh });
    this.mediaEl.style.transform = `translate(${(fw - mw) / 2}px, ${(fh - mh) / 2}px)`;
    this.src = "";
    if (m && this.cfg.ai) el("div", "ai-badge", this.frame, `<b>AI</b>${this.cfg.ai === true ? "Higgsfield" : this.cfg.ai}`);
    if (m) {
      this.img = el("img", "", this.mediaEl);
      this.img.decoding = "sync";
      // highlight rings live in the frame (not the zoomed media) so their line
      // and label keep the same size at any zoom; positions follow the zoom
      this.hls = (this.cfg.highlights || []).map((hlc) => {
        const n = el("div", `hl${hlc.dim === false ? " nodim" : ""}`, this.frame, hlc.label ? `<span>${hlc.label}</span>` : "");
        return { n, c: hlc };
      });
      if (kind === "image") this.setSrc("/" + m.src);
    } else {
      const file = kind === "image" ? ctx.config[id] : this.cfg.file;
      el("div", "ph", this.frame,
        `<div class="t">DRAFT · ОРЫН</div><div class="d">${note || ""}</div><div class="f">${file || id}</div>`);
    }
  }

  setSrc(src) {
    if (src === this.src) return;
    this.src = src;
    this.img.src = src;
    this.ctx.pending.push(this.img.decode().catch(() => {}));
  }

  // Scene time → recording time. `retime` is a list of [sceneT, clipT] anchors
  // (piecewise linear; two anchors at the same sceneT make a cut, two at the
  // same clipT a hold); before the first / after the last it runs at 1×.
  clipTime(tm) {
    const R = this.cfg.retime;
    if (!R || !R.length) return Math.max(0, tm) * (this.cfg.speed || 1);
    if (tm < R[0][0]) return Math.max(0, R[0][1] - (R[0][0] - tm));
    let i = 0;
    while (i + 1 < R.length && R[i + 1][0] <= tm) i++;
    const a = R[i], b = R[i + 1];
    if (!b) return a[1] + (tm - a[0]);
    return lerp(a[1], b[1], (tm - a[0]) / (b[0] - a[0]));
  }

  // tm: seconds since this clip started playing (negative = hold first frame)
  update(tm) {
    if (!this.media || this.kind === "image") return;
    const m = this.media;
    let tc = this.clipTime(tm);
    if (this.loop && tc > 0) tc %= m.frames / m.fps;
    let tx = (this.w - this.mw) / 2, ty = (this.h - this.mh) / 2, s = 1;
    const idx = clamp(Math.floor(tc * m.fps), 0, m.frames - 1) + 1;
    this.setSrc(`/${m.dir}/${String(idx).padStart(5, "0")}.jpg`);
    // camera moves inside the recording, keyed by recording time:
    // [{t, x, y, s}] with x,y = focus point (0..1) and s = zoom
    const zk = this.cfg.zoom || [];
    if (zk.length) {
      let a = zk[0], b = zk[0];
      for (let i = 0; i < zk.length; i++) { if (zk[i].t <= tc) { a = zk[i]; b = zk[i + 1] || zk[i]; } }
      const p = b === a ? 1 : E.inOut3(clamp((tc - a.t) / (b.t - a.t)));
      s = lerp(a.s, b.s, p);
      const fx = lerp(a.x, b.x, p), fy = lerp(a.y, b.y, p);
      tx = clamp(this.w / 2 - fx * this.mw * s, this.w - this.mw * s, 0);
      ty = clamp(this.h / 2 - fy * this.mh * s, this.h - this.mh * s, 0);
      this.mediaEl.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`;
    }
    for (const { n, c } of this.hls || []) {
      const o = life(tc, c.t, c.t + c.d, 0.35, 0.35);
      n.style.opacity = o.toFixed(3);
      n.style.visibility = o > 0.001 ? "visible" : "hidden";
      if (o > 0.001) {
        const pop = lerp(1.08, 1, E.out3(clamp((tc - c.t) / 0.35)));
        const w = c.w * this.mw * s * pop, h = c.h * this.mh * s * pop;
        place(n, { x: tx + (c.x + c.w / 2) * this.mw * s - w / 2, y: ty + (c.y + c.h / 2) * this.mh * s - h / 2, w, h });
      }
    }
  }
}

// ---------------------------------------------------------------- prompt view
export class PromptView {
  constructor(parent, segments, roles, cls = "prompt") {
    this.roles = roles;
    this.root = el("div", cls, parent);
    this.segs = segments.map((s) => ({ ...s, span: el("span", "seg", this.root) }));
    this.caret = el("i", "caret", this.root);
    this.total = segments.reduce((a, s) => a + s.text.length, 0);
    this.last = null;
  }

  // chars: number of characters typed; hl/dim: {role: 0..1}; caret: 0..1 opacity
  update({ chars = Infinity, hl = {}, dim = 0, caret = 0 }) {
    let left = Math.floor(chars);
    for (const s of this.segs) {
      const n = clamp(left, 0, s.text.length);
      left -= n;
      const txt = s.text.slice(0, n);
      if (s.span.textContent !== txt) s.span.textContent = txt;
      const a = hl[s.role] || 0;
      const col = this.roles[s.role]?.color || "#ffffff";
      s.span.style.background = a > 0 ? hexA(col, 0.2 * a) : "transparent";
      s.span.style.boxShadow = a > 0 ? `inset 0 -3px 0 ${hexA(col, a)}` : "none";
      s.span.style.color = a > 0.01 ? `color-mix(in srgb, ${col} ${Math.round(a * 45)}%, #f4f5f7)` : "";
      s.span.style.opacity = (1 - dim * (1 - a)).toFixed(3);
    }
    this.caret.style.opacity = caret;
  }
}

export function legendChip(parent, role, roles) {
  const r = roles[role];
  return el("div", "chip", parent, `<i class="dot" style="background:${r.color};box-shadow:0 0 10px ${r.color}"></i>${r.label}`);
}
