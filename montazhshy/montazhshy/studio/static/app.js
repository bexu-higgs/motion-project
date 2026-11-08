/* Монтажшы Студиясы — интерфейс логикасы (кітапханасыз). */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let S = null;            // соңғы /api/state
let view = "preview";    // плеердегі нұсқа
let zoom = 1;
const thumbs = {};       // id -> Image
let settingsTimer = null;
let live = null;         // агенттің ағымдағы жауабы (DOM)

const ROLE_NAMES = { footage: "Видео", photo: "Фото", music: "Музыка", voiceover: "Диктор", sfx: "Эффектілер" };
const TRANS_NAMES = {
  dissolve: "араласу", dip_black: "қараға", dip_white: "аққа", flash: "жарқыл", whip_left: "whip", whip_right: "whip",
  whip_up: "whip", whip_down: "whip", slide_left: "slide", slide_right: "slide", zoom: "zoom", iris: "iris",
  wipe: "wipe", blur: "blur", radial: "radial", fade_slow: "баяу",
};

/* ---------------------------------------------------------------- көмекшілер */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtTime(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}
function fmtSize(b) {
  if (b > 1e9) return (b / 1e9).toFixed(2) + " ГБ";
  if (b > 1e6) return (b / 1e6).toFixed(1) + " МБ";
  return Math.round(b / 1e3) + " КБ";
}
function toast(text, err = false) {
  const el = document.createElement("div");
  el.className = "toast" + (err ? " err" : "");
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), err ? 6000 : 3200);
}
async function api(path, body, method = "POST") {
  const res = await fetch(path, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* бос жауап */ }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
function hue(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function md(text) {
  // Қарапайым markdown: тақырып, тізім, қалың, курсив, код.
  const lines = esc(text).split("\n");
  let html = "", list = null;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if ((m = l.match(/^\s*[-•*]\s+(.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; continue; }
    close();
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { html += `<h4>${inline(m[1])}</h4>`; continue; }
    if (!l.trim()) continue;
    html += `<p>${inline(l)}</p>`;
  }
  close();
  return html;
}

/* ---------------------------------------------------------------- күй */
async function refresh() {
  try {
    S = await api("/api/state", undefined, "GET");
  } catch (e) {
    toast("Серверге қосылу мүмкін болмады: " + e.message, true);
    return;
  }
  renderTop();
  renderMedia();
  renderSettings();
  renderViewer();
  renderTimeline();
  renderAgentStatus();
  renderFiles();
  if (!$("#chat").dataset.loaded) loadChat();
}

function renderTop() {
  const sel = $("#projectSel");
  const cur = S.project.name;
  sel.innerHTML = S.projects.map(n => `<option ${n === cur ? "selected" : ""}>${esc(n)}</option>`).join("")
    + (S.projects.includes(cur) ? "" : `<option selected>${esc(cur)}</option>`);
  renderJob(S.job);
  const hasTl = S.timeline && S.timeline.clips && S.timeline.clips.length;
  $("#btnPreview").disabled = !hasTl;
  $("#btnFinal").disabled = !hasTl;
  $("#folderHint").textContent = S.media.length ? `${S.media.length} файл · ${S.output.width}×${S.output.height} · ${S.output.fps} fps` : "";
}

function renderJob(job) {
  const el = $("#job");
  if (!job) { el.hidden = true; return; }
  el.hidden = false;
  el.classList.toggle("error", !!job.error);
  $("#jobName").textContent = job.error ? `${job.name}: қате` : job.done ? `${job.name} ✓` : job.name;
  $("#jobStage").textContent = job.error || job.stage || "";
  $("#jobBar").style.width = Math.round((job.value || 0) * 100) + "%";
  if (job.done && !job.error) setTimeout(() => { if (S && S.job && S.job.done) $("#job").hidden = true; }, 4000);
}

/* ---------------------------------------------------------------- медиа */
function renderMedia() {
  const box = $("#mediaList");
  box.innerHTML = "";
  if (!S.media.length) {
    box.innerHTML = `<p class="hint" style="padding:6px">Әзірге файл жоқ. Видео, фото және музыканы жоғарыдағы аймаққа сүйреңіз.</p>`;
    return;
  }
  const tpl = $("#tplMedia");
  for (const role of Object.keys(ROLE_NAMES)) {
    const items = S.media.filter(m => m.role === role);
    if (!items.length) continue;
    const g = document.createElement("div");
    g.className = "group-title";
    g.innerHTML = `<span>${ROLE_NAMES[role]}</span><span>${items.length}</span>`;
    box.appendChild(g);
    for (const m of items) {
      const el = tpl.content.firstElementChild.cloneNode(true);
      if (!m.analyzed) el.classList.add("pending");
      const th = $(".thumb", el);
      if (m.thumb) th.style.backgroundImage = `url("${m.thumb}")`;
      else if (m.wave) th.appendChild(waveThumb(m.wave));
      else th.textContent = m.kind === "audio" ? "♪" : "";
      $(".name", el).innerHTML = `<span class="id">${esc(m.id)}</span>${esc(m.name)}`;
      const sub = [];
      if (m.kind !== "image") sub.push(fmtTime(m.duration));
      if (m.width) sub.push(`${m.width}×${m.height}`);
      if (m.bpm) sub.push(`${Math.round(m.bpm)} BPM`);
      if (m.shots > 1) sub.push(`${m.shots} кесінді`);
      if (m.speech_ratio > 0.3) sub.push("сөйлеу");
      $(".sub", el).textContent = sub.join(" · ");
      const rs = $(".role", el);
      rs.value = m.role;
      rs.onchange = async () => {
        try { await api("/api/media/role", { id: m.id, role: rs.value }); toast("Рөлі өзгертілді"); }
        catch (e) { toast(e.message, true); }
      };
      $(".del", el).onclick = async () => {
        if (!confirm(`«${m.name}» жобадан алынсын ба? (Файл .montazh/trash қалтасына жылжиды)`)) return;
        try { await api("/api/media/remove", { id: m.id }); } catch (e) { toast(e.message, true); }
      };
      box.appendChild(el);
    }
  }
}

function waveThumb(wave) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 80;
  const g = c.getContext("2d");
  g.fillStyle = "#1d2130"; g.fillRect(0, 0, 128, 80);
  g.fillStyle = "#5aa9ff";
  const n = 64, step = wave.length / n;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = Math.floor(i * step); k < Math.floor((i + 1) * step); k++) v = Math.max(v, wave[k] || 0);
    const h = Math.max(2, v / 100 * 70);
    g.fillRect(i * 2, 40 - h / 2, 1.4, h);
  }
  return c;
}

/* ---------------------------------------------------------------- жүктеу */
async function uploadFiles(files) {
  const list = [...files];
  if (!list.length) return;
  let i = 0;
  for (const f of list) {
    i++;
    renderJob({ name: "Жүктеу", stage: `${i}/${list.length}: ${f.name}`, value: (i - 1) / list.length });
    const folder = /voice|vo_|диктор|diktor|дауыс/i.test(f.name) ? "voiceover" : /sfx|whoosh|effect|эффект/i.test(f.name) ? "sfx" : "music";
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/api/upload?name=${encodeURIComponent(f.name)}&folder=${folder}`);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) renderJob({ name: "Жүктеу", stage: `${i}/${list.length}: ${f.name}`, value: (i - 1 + e.loaded / e.total) / list.length });
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(JSON.parse(xhr.responseText || "{}").error || xhr.status)));
        xhr.onerror = () => reject(new Error("желі қатесі"));
        xhr.send(f);
      });
    } catch (e) {
      toast(`${f.name}: ${e.message}`, true);
    }
  }
  await api("/api/scan", {});
}

/* ---------------------------------------------------------------- баптаулар */
function renderSettings() {
  const st = S.settings;
  const ae = document.activeElement;
  if (ae !== $("#script")) $("#script").value = st.script || "";
  if (ae !== $("#title")) $("#title").value = st.title || "";
  if (ae !== $("#duration")) $("#duration").value = st.target_duration ? st.target_duration : "";
  $("#styles").innerHTML = S.catalog.styles.map(s =>
    `<button class="style ${s.key === st.style ? "on" : ""}" data-style="${s.key}" title="${esc(s.desc)}"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></button>`).join("");
  $$("#styles .style").forEach(b => b.onclick = () => saveSettings({ style: b.dataset.style }, true));
  $("#aspects").innerHTML = S.catalog.aspects.map(a => `<button class="${a === st.aspect ? "on" : ""}" data-a="${a}">${a}</button>`).join("");
  $$("#aspects button").forEach(b => b.onclick = () => saveSettings({ aspect: b.dataset.a }, true));
  $("#platform").innerHTML = S.catalog.platforms.map(p => `<option value="${p.key}" ${p.key === st.platform ? "selected" : ""}>${esc(p.name)} · ${p.lufs} LUFS</option>`).join("");
  $("#grade").innerHTML = `<option value="auto">Стильге сай</option>` + S.catalog.grades.map(g => `<option value="${g.key}" ${g.key === st.grade ? "selected" : ""}>${esc(g.name)}</option>`).join("");
  if (st.grade === "auto") $("#grade").value = "auto";
  $("#musicFit").value = st.music_fit || "auto";
}

function saveSettings(patch, now = false) {
  const go = async () => {
    try { await api("/api/settings", patch); } catch (e) { toast(e.message, true); }
  };
  clearTimeout(settingsTimer);
  if (now) go(); else settingsTimer = setTimeout(go, 600);
}

/* ---------------------------------------------------------------- плеер */
function renderViewer() {
  const r = S.renders[view] || null;
  const v = $("#player");
  $$(".viewer-tabs button").forEach(b => {
    b.classList.toggle("on", b.dataset.view === view);
    b.disabled = !S.renders[b.dataset.view];
  });
  $("#emptyScreen").hidden = !!r;
  v.hidden = !r;
  if (r) {
    const src = r.url;
    if (v.dataset.src !== src) {
      const t = v.currentTime;
      v.dataset.src = src;
      v.src = src;
      if (t) v.currentTime = Math.min(t, (S.timeline && S.timeline.total) || t);
    }
    $("#viewerInfo").textContent = `${view === "final" ? `${S.output.width}×${S.output.height}` : "640p превью"} · ${fmtSize(r.size)} · ${new Date(r.mtime * 1000).toLocaleTimeString()}`;
  } else {
    $("#viewerInfo").textContent = "";
  }
}

/* ---------------------------------------------------------------- таймлайн */
const TL = { pad: 10, ruler: 22, v: 64, t: 22, m: 50, vo: 26, gap: 8 };

function renderTimeline() {
  const c = $("#tl");
  const wrap = $("#tlScroll");
  const tl = S && S.timeline;
  const W = Math.max(wrap.clientWidth - 2, 300) * zoom;
  const dpr = window.devicePixelRatio || 1;
  const H = TL.ruler + TL.v + TL.t + TL.m + TL.vo + TL.gap * 4 + 6;
  c.style.width = W + "px";
  c.style.height = H + "px";
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.font = "600 10px Montserrat, system-ui, sans-serif";
  if (!tl || tl.error || !tl.clips || !tl.clips.length) {
    g.fillStyle = "#626a7c";
    g.fillText(tl && tl.error ? "Таймлайн қатесі: " + tl.error : "Монтаж әлі жоқ — агентке тапсырма беріңіз немесе «⚡ Автомонтаж» басыңыз.", 14, 40);
    $("#tlInfo").textContent = "";
    return;
  }
  const total = tl.total;
  const sx = (W - TL.pad * 2) / total;
  const X = t => TL.pad + t * sx;
  // сызғыш
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60].find(s => s * sx > 48) || 120;
  g.fillStyle = "#626a7c"; g.strokeStyle = "#2a2e39";
  for (let t = 0; t <= total + 1e-6; t += step) {
    const x = X(t);
    g.beginPath(); g.moveTo(x, TL.ruler - 6); g.lineTo(x, H); g.stroke();
    g.fillText(fmtTime(t), x + 3, 12);
  }
  let y = TL.ruler + 4;
  const yV = y;
  // видео жолы
  for (const cl of tl.clips) {
    const x = X(cl.start), w = Math.max(2, cl.dur * sx);
    const h = hue(cl.media);
    g.fillStyle = `hsl(${h} 45% 26%)`;
    roundRect(g, x + 0.5, y, w - 1, TL.v, 6); g.fill();
    const img = thumbs[cl.media];
    if (img && img.complete && img.naturalWidth && w > 30) {
      g.save(); roundRect(g, x + 0.5, y, w - 1, TL.v, 6); g.clip();
      const ih = TL.v, iw = ih * img.naturalWidth / img.naturalHeight;
      for (let k = 0; k * iw < w; k++) g.drawImage(img, x + k * iw, y, iw, ih);
      g.fillStyle = "rgba(10,12,16,.35)"; g.fillRect(x, y, w, TL.v);
      g.restore();
    }
    g.strokeStyle = `hsl(${h} 60% 55%)`; g.lineWidth = 1;
    roundRect(g, x + 0.5, y, w - 1, TL.v, 6); g.stroke();
    if (w > 26) {
      g.fillStyle = "#fff";
      g.fillText(`${cl.i} · ${cl.media}`, x + 5, y + 13);
      if (w > 70 && cl.speed !== 1) { g.fillStyle = "#ffc24a"; g.fillText(`${Math.round(cl.speed * 100)}%`, x + 5, y + TL.v - 6); }
    }
    if (cl.trans && cl.trans !== "cut" && cl.tdur > 0) {
      const tx = X(cl.start), tw = cl.tdur * sx;
      const grd = g.createLinearGradient(tx, 0, tx + tw, 0);
      grd.addColorStop(0, "rgba(255,138,61,.0)"); grd.addColorStop(0.5, "rgba(255,138,61,.55)"); grd.addColorStop(1, "rgba(255,138,61,0)");
      g.fillStyle = grd; g.fillRect(tx, y, tw, TL.v);
      if (tw > 18 || zoom > 1.5) { g.fillStyle = "#ffd2b8"; g.fillText(TRANS_NAMES[cl.trans] || cl.trans, tx + 2, y + TL.v / 2 + 3); }
    }
  }
  y += TL.v + TL.gap;
  // титрлер
  for (const t of tl.titles || []) {
    const x = X(t.start), w = Math.max(4, t.duration * sx);
    g.fillStyle = "rgba(90,169,255,.22)"; roundRect(g, x, y, w, TL.t, 5); g.fill();
    g.strokeStyle = "rgba(90,169,255,.7)"; roundRect(g, x, y, w, TL.t, 5); g.stroke();
    g.fillStyle = "#cfe4ff";
    g.save(); g.beginPath(); g.rect(x, y, w, TL.t); g.clip();
    g.fillText("T  " + t.text, x + 5, y + 14); g.restore();
  }
  y += TL.t + TL.gap;
  // музыка: толқын, биттер, такт бастары
  const yM = y;
  g.fillStyle = "#141821"; g.fillRect(TL.pad, y, total * sx, TL.m);
  for (const mu of tl.music || []) {
    let pos = mu.start;
    for (const [a, b] of mu.segments) {
      const rate = mu.wave_rate || 10;
      g.fillStyle = "rgba(90,169,255,.75)";
      for (let t = a; t < b; t += 1 / rate) {
        const v = (mu.wave[Math.floor(t * rate)] || 0) / 100;
        const xx = X(pos + t - a);
        const hh = Math.max(1, v * (TL.m - 8));
        g.fillRect(xx, y + TL.m / 2 - hh / 2, Math.max(1, sx / rate - 0.4), hh);
      }
      pos += b - a;
      if (pos < total - 0.05) {
        g.strokeStyle = "#ff5a36"; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(X(pos), y - 2); g.lineTo(X(pos), y + TL.m + 2); g.stroke(); g.setLineDash([]);
      }
    }
  }
  g.strokeStyle = "rgba(255,255,255,.12)";
  for (const b of tl.beats || []) { const x = X(b); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); }
  g.strokeStyle = "rgba(255,194,74,.55)";
  for (const b of tl.downbeats || []) { const x = X(b); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + TL.m); g.stroke(); }
  g.fillStyle = "#9097a8";
  if (tl.music && tl.music.length) g.fillText(`♪ ${tl.music[0].media}`, TL.pad + 4, y + 11);
  y += TL.m + TL.gap;
  // диктор
  for (const vo of tl.voiceover || []) {
    const m = S.media.find(x => x.id === vo.media);
    const d = vo.duration || (m ? m.duration - (vo.src_in || 0) : 2);
    const x = X(vo.start), w = Math.max(4, d * sx);
    g.fillStyle = "rgba(60,207,142,.2)"; roundRect(g, x, y, w, TL.vo, 5); g.fill();
    g.strokeStyle = "rgba(60,207,142,.6)"; roundRect(g, x, y, w, TL.vo, 5); g.stroke();
    g.fillStyle = "#b9f5d8"; g.fillText("🎙 " + vo.media, x + 5, y + 16);
  }
  // кесу нүктелері бойынша жіңішке сызық (видео мен музыка арасы)
  g.strokeStyle = "rgba(255,255,255,.05)";
  for (const cl of tl.clips.slice(1)) { const x = X(cl.start + cl.tdur / 2); g.beginPath(); g.moveTo(x, yV + TL.v); g.lineTo(x, yM); g.stroke(); }
  // ойнату сызығы
  const v = $("#player");
  if (!v.hidden && v.duration) {
    const x = X(Math.min(total, v.currentTime));
    g.strokeStyle = "#ff5a36"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, TL.ruler - 4); g.lineTo(x, H); g.stroke(); g.lineWidth = 1;
    g.fillStyle = "#ff5a36"; g.beginPath(); g.moveTo(x - 5, TL.ruler - 8); g.lineTo(x + 5, TL.ruler - 8); g.lineTo(x, TL.ruler - 2); g.fill();
  }
  const a = tl.audio || {}, gr = tl.grade || {};
  $("#tlInfo").textContent = `${fmtTime(total)} · ${tl.clips.length} кадр · түс: ${gr.preset}${gr.letterbox ? " · " + gr.letterbox + ":1" : ""} · ${a.target_lufs} LUFS` + (tl.warnings && tl.warnings.length ? ` · ⚠ ${tl.warnings.length}` : "");
  c.onclick = e => {
    const r = c.getBoundingClientRect();
    const t = (e.clientX - r.left - TL.pad) / sx;
    if (!v.hidden && v.duration) { v.currentTime = Math.max(0, Math.min(v.duration - 0.05, t)); }
  };
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function loadThumbs() {
  for (const m of S.media) {
    if (!m.thumb) continue;
    const key = m.id;
    if (thumbs[key] && thumbs[key].dataset_src === m.thumb) continue;
    const img = new Image();
    img.dataset_src = m.thumb;
    img.onload = () => renderTimeline();
    img.src = m.thumb;
    thumbs[key] = img;
  }
}

/* ---------------------------------------------------------------- агент */
function renderAgentStatus() {
  const a = S.agent;
  const el = $("#agentStatus");
  const dot = a.busy ? "busy" : a.available ? "ok" : "off";
  const txt = a.busy ? "Агент жұмыс істеп жатыр…" : a.available ? `Агент дайын · ${a.model}` : "API кілті жоқ — «Баптау» бөлімінде енгізіңіз (автомонтаж кілтсіз де істейді)";
  el.innerHTML = `<span class="dot ${dot}"></span><span>${esc(txt)}</span>` + (a.usage ? `<span style="margin-left:auto;color:var(--faint)">${Math.round((a.usage.input + a.usage.output) / 1000)}k токен</span>` : "");
  setBusy(a.busy);
}

function setBusy(b) {
  $("#sendBtn").disabled = b;
  $("#stopBtn").hidden = !b;
  $("#msg").disabled = false;
}

function loadChat() {
  const chat = $("#chat");
  chat.dataset.loaded = "1";
  chat.innerHTML = "";
  if (!S.chat.length) {
    chat.innerHTML = `<div class="welcome"><b>Сәлем! Мен — Монтажшы, сіздің ЖИ монтаж көмекшіңіз.</b>
      <ul><li>Кадрларды көріп, сценарий бойынша ретке қоямын</li><li>Музыканы талдап, кесулерді битке дәл қоямын</li>
      <li>Дыбысты тазартып, музыканы сөз астында басамын, LUFS бойынша теңестіремін</li>
      <li>Түсті біркелкі етіп, кәсіби ауысулар мен титрлер қосамын</li>
      <li>Өз жұмысымды тексеріп, Premiere/DaVinci-ге экспорттаймын</li></ul>
      <p style="margin:8px 0 0">Материалды жүктеп, не қалайтыныңызды жазыңыз.</p></div>`;
    return;
  }
  for (const m of S.chat) addMsg(m.role === "user" ? "user" : "bot", m.text);
}

function addMsg(kind, text) {
  const el = document.createElement("div");
  el.className = "msg " + kind;
  el.innerHTML = kind === "user" ? esc(text).replace(/\n/g, "<br>") : md(text);
  $("#chat").appendChild(el);
  scrollChat();
  return el;
}
function scrollChat() {
  const c = $("#chat");
  c.scrollTop = c.scrollHeight;
}
function ensureLive() {
  if (!live) {
    live = { steps: null, think: null, text: null, textBuf: "", thinkBuf: "", typing: null, current: null };
  }
  return live;
}
function liveTyping(on) {
  const L = ensureLive();
  if (on && !L.typing) {
    L.typing = document.createElement("div");
    L.typing.className = "typing";
    L.typing.innerHTML = "<i></i><i></i><i></i><span>ойланып жатыр</span>";
    $("#chat").appendChild(L.typing);
    scrollChat();
  } else if (!on && L.typing) {
    L.typing.remove();
    L.typing = null;
  }
}

function onAgentEvent(ev) {
  const L = ensureLive();
  switch (ev.type) {
    case "user":
      break;
    case "thinking_start":
      L.text = null; L.textBuf = ""; L.think = null; L.thinkBuf = ""; L.steps = null;
      liveTyping(true);
      break;
    case "thinking_delta": {
      if (!L.think) {
        L.think = document.createElement("details");
        L.think.className = "think";
        L.think.innerHTML = "<summary>Агенттің ойы</summary><div></div>";
        $("#chat").insertBefore(L.think, L.typing || null);
      }
      L.thinkBuf += ev.text;
      $("div", L.think).textContent = L.thinkBuf;
      break;
    }
    case "text_delta": {
      liveTyping(false);
      if (!L.text) { L.text = addMsg("bot", ""); }
      L.textBuf += ev.text;
      L.text.innerHTML = md(L.textBuf);
      scrollChat();
      break;
    }
    case "assistant":
      liveTyping(false);
      if (!L.text) L.text = addMsg("bot", ev.text);
      else L.text.innerHTML = md(ev.text);
      L.textBuf = ev.text;
      break;
    case "tool": {
      liveTyping(false);
      if (!L.steps) {
        L.steps = document.createElement("div");
        L.steps.className = "steps";
        $("#chat").appendChild(L.steps);
      }
      const st = document.createElement("div");
      st.className = "step run";
      st.innerHTML = `<span class="ic"></span><span class="lbl"><b>${esc(ev.label)}</b>${ev.detail ? `<small>${esc(ev.detail)}</small>` : ""}</span><span class="sec"></span><div class="pbar" hidden><i></i></div>`;
      L.steps.appendChild(st);
      L.current = st;
      scrollChat();
      break;
    }
    case "progress":
      if (L.current) {
        const pb = $(".pbar", L.current);
        pb.hidden = false;
        $("i", pb).style.width = Math.round(ev.value * 100) + "%";
        $(".sec", L.current).textContent = ev.stage || "";
      }
      break;
    case "tool_done":
      if (L.current) {
        L.current.className = "step " + (ev.ok ? "ok" : "bad");
        $(".sec", L.current).textContent = ev.seconds ? ev.seconds + " с" : "";
        $(".pbar", L.current).hidden = true;
        if (!ev.ok && ev.summary) {
          const sm = $("small", L.current) || document.createElement("small");
          sm.textContent = ev.summary;
          $(".lbl", L.current).appendChild(sm);
        }
        L.current = null;
      }
      break;
    case "render":
      view = ev.mode === "final" ? "final" : "preview";
      break;
    case "error":
      liveTyping(false);
      addMsg("err", ev.text);
      break;
    case "stopped":
    case "done":
      liveTyping(false);
      live = null;
      if (S) { S.agent.busy = false; renderAgentStatus(); }
      break;
  }
}

async function sendMessage(text) {
  text = (text || "").trim();
  if (!text) return;
  if (!S.agent.available) {
    toast("Агентке API кілті керек. «Баптау» → Anthropic API кілті. Әзірге «⚡ Автомонтаж» қолданыңыз.", true);
    $$(".side-tabs button").find(b => b.dataset.tab === "settings").click();
    return;
  }
  if ($(".welcome")) $("#chat").innerHTML = "";
  addMsg("user", text);
  $("#msg").value = "";
  try {
    await api("/api/agent", { message: text });
    S.agent.busy = true;
    renderAgentStatus();
    liveTyping(true);
  } catch (e) {
    addMsg("err", e.message);
  }
}

/* ---------------------------------------------------------------- файлдар */
function renderFiles() {
  $("#projectPath").textContent = S.project.path;
  const out = [];
  if (S.renders.final) out.push(`<a href="${S.renders.final.url}" download="final.mp4">🎬 final.mp4 · ${fmtSize(S.renders.final.size)}</a>`);
  if (S.renders.preview) out.push(`<a href="${S.renders.preview.url}" download="preview.mp4">👁 preview.mp4 · ${fmtSize(S.renders.preview.size)}</a>`);
  for (const f of S.exports) {
    if (f === "stems") { out.push(`<span class="hint">🎚 stems/ — dialog.wav · music.wav · effects.wav</span>`); continue; }
    out.push(`<a href="/files/exports/${encodeURIComponent(f)}" download>📄 ${esc(f)}</a>`);
  }
  $("#outputs").innerHTML = out.join("") || `<p class="hint">Әзірге нәтиже жоқ.</p>`;
}

/* ---------------------------------------------------------------- оқиғалар ағыны */
function connectEvents() {
  const es = new EventSource("/api/events");
  let stateTimer = null;
  es.onmessage = e => {
    let ev;
    try { ev = JSON.parse(e.data); } catch (_) { return; }
    if (ev.type === "job") {
      if (S) S.job = ev;
      renderJob(ev);
      if (ev.done && ev.error) toast(ev.error, true);
      return;
    }
    if (ev.type === "state") {
      clearTimeout(stateTimer);
      stateTimer = setTimeout(async () => { await refresh(); loadThumbs(); }, 150);
      return;
    }
    if (ev.agent) onAgentEvent(ev);
  };
  es.onerror = () => { /* браузер өзі қайта қосылады */ };
}

/* ---------------------------------------------------------------- іске қосу */
function bind() {
  const drop = $("#drop");
  $("#fileInput").onchange = e => uploadFiles(e.target.files);
  ["dragenter", "dragover"].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => document.addEventListener(t, e => { e.preventDefault(); if (t === "drop" || e.target === document.documentElement) drop.classList.remove("over"); }));
  document.addEventListener("drop", e => { drop.classList.remove("over"); if (e.dataTransfer && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });
  $("#rescan").onclick = () => api("/api/scan", {}).catch(e => toast(e.message, true));
  $("#projectSel").onchange = e => api("/api/project", { name: e.target.value }).then(() => { $("#chat").dataset.loaded = ""; refresh(); }).catch(e2 => toast(e2.message, true));
  $("#newProject").onclick = async () => {
    const name = prompt("Жаңа жобаның атауы:", "Жоба_" + new Date().toISOString().slice(0, 10));
    if (!name) return;
    try { await api("/api/project", { name }); $("#chat").dataset.loaded = ""; await refresh(); } catch (e) { toast(e.message, true); }
  };
  $("#btnAuto").onclick = () => api("/api/auto", {}).then(r => { if (!r.ok) toast("Басқа тапсырма орындалып жатыр"); else view = "preview"; }).catch(e => toast(e.message, true));
  $("#btnPreview").onclick = () => api("/api/render", { mode: "preview" }).then(() => { view = "preview"; }).catch(e => toast(e.message, true));
  $("#btnFinal").onclick = () => api("/api/render", { mode: "final" }).then(() => { view = "final"; }).catch(e => toast(e.message, true));
  $("#btnExport").onclick = () => api("/api/export", {}).then(() => toast("Экспорт дайын: exports/ қалтасы")).catch(e => toast(e.message, true));
  $("#btnStems").onclick = () => api("/api/render", { mode: "final", stems: true }).then(() => { view = "final"; }).catch(e => toast(e.message, true));
  $$(".viewer-tabs button").forEach(b => b.onclick = () => { view = b.dataset.view; renderViewer(); renderTimeline(); });
  $$(".side-tabs button").forEach(b => b.onclick = () => {
    $$(".side-tabs button").forEach(x => x.classList.toggle("on", x === b));
    $$(".tab").forEach(p => p.classList.toggle("on", p.dataset.pane === b.dataset.tab));
  });
  $("#script").oninput = e => saveSettings({ script: e.target.value });
  $("#title").oninput = e => saveSettings({ title: e.target.value });
  $("#duration").oninput = e => saveSettings({ target_duration: Number(e.target.value) || 0 });
  $("#platform").onchange = e => saveSettings({ platform: e.target.value }, true);
  $("#grade").onchange = e => saveSettings({ grade: e.target.value }, true);
  $("#musicFit").onchange = e => saveSettings({ music_fit: e.target.value }, true);
  $("#saveKey").onclick = async () => {
    try { await api("/api/key", { key: $("#apiKey").value }); $("#apiKey").value = ""; toast("Кілт сақталды ✓"); await refresh(); }
    catch (e) { toast(e.message, true); }
  };
  $("#composer").onsubmit = e => { e.preventDefault(); sendMessage($("#msg").value); };
  $("#msg").onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage($("#msg").value); } };
  $$("#chips button").forEach(b => b.onclick = () => sendMessage(b.textContent));
  $("#stopBtn").onclick = () => api("/api/agent/stop", {}).catch(() => {});
  $("#resetChat").onclick = async () => {
    try { await api("/api/agent/reset", {}); $("#chat").dataset.loaded = ""; await refresh(); } catch (e) { toast(e.message, true); }
  };
  $("#zoom").oninput = e => { zoom = Number(e.target.value); renderTimeline(); };
  const v = $("#player");
  v.ontimeupdate = () => renderTimeline();
  v.onseeked = () => renderTimeline();
  window.addEventListener("resize", () => renderTimeline());
}

bind();
refresh().then(() => { loadThumbs(); connectEvents(); });
