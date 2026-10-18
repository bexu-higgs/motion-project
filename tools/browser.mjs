// Shared browser setup for recording the Higgsfield site: visible cursor and
// playable media in Playwright's Chromium.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { ROOT } from "./server.mjs";

export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!fs.existsSync(base)) return undefined;
  const dir = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return dir ? path.join(base, dir, "chrome-linux", "chrome") : undefined;
}

// Visible pointer + click ripple (headless Chromium draws no cursor).
const CURSOR = () => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 10-7 1.5L8.5 21z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none", transform: "translate(-200px,-200px)", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" });
    document.documentElement.appendChild(c);
    const put = (x, y) => (c.style.transform = `translate(${x - 4}px, ${y - 2}px)`);
    try { const p = JSON.parse(sessionStorage.__cur || "null"); if (p) put(p[0], p[1]); } catch {}
    addEventListener("mousemove", (e) => {
      put(e.clientX, e.clientY);
      try { sessionStorage.__cur = JSON.stringify([e.clientX, e.clientY]); } catch {}
    }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      Object.assign(r.style, { position: "fixed", left: `${e.clientX - 22}px`, top: `${e.clientY - 22}px`, width: "44px", height: "44px", borderRadius: "50%",
        border: "3px solid #22d3ee", zIndex: 2147483646, pointerEvents: "none", transition: "transform .45s ease-out, opacity .45s ease-out", transform: "scale(.3)", opacity: "1" });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.4)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
};

// Playwright's Chromium has no H.264 decoder, so the site's own MP4 media would
// show "error while loading". Re-encode each of those files to WebM on the fly
// (same content, playable codec) so the interface looks as it does in Chrome.
const CACHE = path.join(ROOT, "out/.mediacache");
async function playableMedia(route) {
  const url = route.request().url();
  const key = crypto.createHash("sha1").update(url.split("?")[0]).digest("hex");
  const webm = path.join(CACHE, `${key}.webm`);
  try {
    if (!fs.existsSync(webm)) {
      fs.mkdirSync(CACHE, { recursive: true });
      const src = path.join(CACHE, `${key}.src`);
      // curl goes through the session's HTTPS proxy and CA bundle
      execFileSync("curl", ["-sSfL", "-m", "120", "-o", src, url]);
      // these clips are shown as small cards: 720 px wide keeps them sharp at 2×
      // while keeping software decoding light enough for smooth recording
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", "scale='min(720,iw)':-2", "-c:v", "libvpx", "-deadline", "good", "-cpu-used", "4",
        "-b:v", "1500k", "-c:a", "libopus", "-b:a", "96k", webm]);
      fs.rmSync(src);
    }
    await route.fulfill({ status: 200, contentType: "video/webm", body: fs.readFileSync(webm), headers: { "access-control-allow-origin": "*" } });
  } catch (e) {
    console.error(`media passthrough (${e.message.split("\n")[0]}): ${url}`);
    await route.continue();
  }
}

export async function newPage(browser, vp, scale) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: scale, locale: "en-US" });
  await ctx.addInitScript(CURSOR);
  await ctx.route(/\.(mp4|mov|m4v)(\?|$)/i, playableMedia);
  return ctx.newPage();
}

// scale > 1 renders (and screencasts) at that device pixel ratio
export function launch(scale = 1) {
  const args = scale > 1 ? [`--force-device-scale-factor=${scale}`] : [];
  return chromium.launch({ executablePath: chromePath(), args });
}
