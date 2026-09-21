// Boot, view switching, wiring. Everything DOM-related lives here or in card.js.

import { ROOTS, SCALES, CHORDS, PROGRESSIONS, SCALE_GROUPS, VOICING_POOL_OPTIONS, DEFAULT_SETTINGS, scaleById, chordById, progressionById } from "./catalogue.js";
import { pretty, VOICING_CHORD_IDS, VOICING_TYPES } from "./theory.js";
import { generateSession, dateSeed, isoDate, randomSeed, encodeHash, decodeHash } from "./session.js";
import { loadSettings, saveSettings, loadHistory, markDone, unmarkDone, isDone, lastPractisedMap, stats, clearHistory } from "./storage.js";
import { renderCard } from "./card.js";
import { Metronome } from "./metronome.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  settings: loadSettings(),
  history: loadHistory(),
  today: isoDate(),
  session: null,
  idx: 0,
  view: "today",
  explore: { root: "C", kind: "scale", id: "ionian" },
};

// ---------- theme ----------
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme === "light" ? "light" : "dark";
  $('meta[name="theme-color"]').content = state.settings.theme === "light" ? "#faf6ee" : "#1b1815";
}

function setSetting(key, value) {
  state.settings[key] = value;
  saveSettings(state.settings);
}

// ---------- views ----------
function showView(name) {
  state.view = name;
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === name));
  if (name === "settings") renderSettings();
  if (name === "explore") renderExplore();
  updateWakeLock();
}
$$(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

// ---------- session (Today) ----------
function buildSession(seed) {
  const lastMap = lastPractisedMap(state.history);
  state.session = generateSession({ seed, settings: state.settings, lastMap, today: state.today });
  state.idx = 0;
  history.replaceState(null, "", encodeHash({ seed, length: state.settings.sessionLength }));
}

function initSession() {
  const h = decodeHash(location.hash);
  if (h.length && [15, 25, 30].includes(h.length) && h.length !== state.settings.sessionLength) {
    state.settings.sessionLength = h.length;
  }
  buildSession(h.seed ?? dateSeed());
}

const cardCtx = () => ({
  settings: state.settings,
  onSettingChange: (k, v) => setSetting(k, v),
});

let currentCard = null;
function renderToday() {
  const s = state.session;
  const item = s.items[state.idx];
  $("#session-date").textContent = s.seed === dateSeed() ? state.today : `seed ${s.seed}`;
  $("#session-progress").textContent = `${state.idx + 1} / ${s.items.length}`;

  const ov = $("#session-overview");
  ov.innerHTML = "";
  s.items.forEach((it, i) => {
    const d = document.createElement("button");
    d.className = "dot" + (i === state.idx ? " is-current" : "") + (it.type !== "free" && isDone(state.history, it, state.today) ? " is-done" : "");
    d.title = it.type === "free" ? "Free play" : `${it.type}: ${describe(it)}`;
    d.addEventListener("click", () => goTo(i));
    ov.appendChild(d);
  });

  if (currentCard && currentCard._cleanup) currentCard._cleanup();
  currentCard = renderCard($("#today-card"), item, cardCtx());

  $("#btn-prev").disabled = state.idx === 0;
  $("#btn-next").disabled = state.idx === s.items.length - 1;
  const doneBtn = $("#btn-done");
  const done = item.type !== "free" && isDone(state.history, item, state.today);
  doneBtn.hidden = item.type === "free";
  doneBtn.classList.toggle("is-done", done);
  doneBtn.textContent = done ? "✓ Done" : "Mark done";
  startTimer(item.minutes);
}

function describe(it) {
  if (it.type === "scale") return `${pretty(it.key)} ${scaleById(it.id).name}`;
  if (it.type === "arpeggio") return `${pretty(it.key)}${chordById(it.id).symbol}`;
  if (it.type === "progression") return `${progressionById(it.id).name} in ${pretty(it.key)}`;
  if (it.type === "voicing") return `${pretty(it.key)}${chordById(it.id).symbol} ${(VOICING_TYPES.find((t) => t.id === it.voicing) || {}).name || ""} voicings`;
  return "";
}

function goTo(i) {
  state.idx = Math.max(0, Math.min(state.session.items.length - 1, i));
  renderToday();
  window.scrollTo({ top: 0 });
}

function toggleDone() {
  const item = state.session.items[state.idx];
  if (item.type === "free") return;
  if (isDone(state.history, item, state.today)) state.history = unmarkDone(item, state.today);
  else state.history = markDone(item, state.today);
  renderToday();
}

$("#btn-prev").addEventListener("click", () => goTo(state.idx - 1));
$("#btn-next").addEventListener("click", () => goTo(state.idx + 1));
$("#btn-done").addEventListener("click", toggleDone);
$("#btn-reroll").addEventListener("click", () => { buildSession(randomSeed()); renderToday(); });

// ---------- per-item countdown timer ----------
const timer = { remaining: 0, running: false, handle: null, total: 0 };
function fmt(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function drawTimer() {
  const t = $("#block-timer");
  t.textContent = fmt(timer.remaining);
  t.classList.toggle("is-running", timer.running);
  t.classList.toggle("is-over", timer.remaining <= 0);
}
function startTimer(minutes) {
  clearInterval(timer.handle);
  timer.total = (minutes || 5) * 60;
  timer.remaining = timer.total;
  timer.running = true;
  timer.last = performance.now();
  timer.handle = setInterval(() => {
    if (!timer.running) return;
    const now = performance.now();
    timer.remaining -= (now - timer.last) / 1000;
    timer.last = now;
    if (timer.remaining <= 0) { timer.remaining = 0; timer.running = false; clearInterval(timer.handle); }
    drawTimer();
  }, 250);
  drawTimer();
}
$("#block-timer").addEventListener("click", () => {
  if (timer.remaining <= 0) { startTimer(timer.total / 60); return; }
  timer.running = !timer.running;
  timer.last = performance.now();
  drawTimer();
});

// ---------- Explore ----------
let exploreCard = null;
function renderExplore() {
  const ex = state.explore;
  const roots = $("#explore-roots");
  roots.innerHTML = "";
  for (const r of ROOTS) {
    const b = document.createElement("button");
    b.className = "chip" + (r === ex.root ? " is-active" : "");
    b.textContent = pretty(r) + (r === "Gb" ? "/F♯" : "");
    b.addEventListener("click", () => { ex.root = r; renderExplore(); });
    roots.appendChild(b);
  }
  $$("#explore-kind button").forEach((b) => b.classList.toggle("is-active", b.dataset.kind === ex.kind));
  const sel = $("#explore-item");
  sel.innerHTML = "";
  if (ex.kind === "scale") {
    $("#explore-item-label").textContent = "Scale";
    for (const g of SCALE_GROUPS) {
      const og = document.createElement("optgroup");
      og.label = g.name;
      for (const s of SCALES.filter((s) => s.group === g.id)) {
        const o = new Option(s.name, s.id);
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    if (!scaleById(ex.id)) ex.id = "ionian";
  } else if (ex.kind === "arpeggio") {
    $("#explore-item-label").textContent = "Chord type";
    for (const c of CHORDS) sel.appendChild(new Option(`${c.symbol} — ${c.name}`, c.id));
    if (!chordById(ex.id)) ex.id = "maj7";
  } else if (ex.kind === "voicing") {
    $("#explore-item-label").textContent = "Chord type";
    for (const c of CHORDS.filter((c) => VOICING_CHORD_IDS.includes(c.id))) sel.appendChild(new Option(`${c.symbol} — ${c.name}`, c.id));
    if (!VOICING_CHORD_IDS.includes(ex.id)) ex.id = "maj7";
  } else {
    $("#explore-item-label").textContent = "Progression";
    for (const p of PROGRESSIONS) sel.appendChild(new Option(p.name, p.id));
    if (!progressionById(ex.id)) ex.id = "ii_V_I";
  }
  sel.value = ex.id;
  if (exploreCard && exploreCard._cleanup) exploreCard._cleanup();
  exploreCard = renderCard($("#explore-card"), { type: ex.kind, id: ex.id, key: ex.root, voicing: ex.voicing || "drop2" }, cardCtx());
}
$$("#explore-kind button").forEach((b) => b.addEventListener("click", () => { state.explore.kind = b.dataset.kind; state.explore.id = null; renderExplore(); }));
$("#explore-item").addEventListener("change", (e) => { state.explore.id = e.target.value; renderExplore(); });

// ---------- Settings ----------
function renderSettings() {
  const s = state.settings;
  const root = $("#settings-root");
  const st = stats(state.history, state.today);
  const check = (name, id, label, checked) => `<label><input type="checkbox" data-pool="${name}" value="${id}" ${checked ? "checked" : ""}> ${label}</label>`;
  const seg = (key, opts) => `<div class="seg" data-setting="${key}">${opts.map(([v, l]) => `<button data-val="${v}" class="${String(s[key]) === String(v) ? "is-active" : ""}">${l}</button>`).join("")}</div>`;

  root.innerHTML = `
    <div class="settings-group">
      <h2>Practice log</h2>
      <div class="stats">Streak <b>${st.streak}</b> day${st.streak === 1 ? "" : "s"} · practised <b>${st.last21}</b> of the last 21 days · <b>${st.total}</b> items over <b>${st.days}</b> days</div>
      <div class="settings-row"><label><input type="checkbox" id="set-weight" ${s.weightByHistory ? "checked" : ""}> Favour things I haven't practised recently</label>
      <button class="btn btn-sm btn-ghost" id="set-clear-history">Clear history</button></div>
    </div>
    <div class="settings-group">
      <h2>Session</h2>
      <div class="settings-row"><span>Length</span>${seg("sessionLength", [[15, "15 min"], [25, "25 min"], [30, "30 min"]])}</div>
      <div class="settings-row"><span>Keys</span>${seg("keyMode", [["random", "Random"], ["cycle", "Cycle of 4ths"], ["fixed", "One key"]])}</div>
      <div class="settings-row" id="row-fixed-key" ${s.keyMode === "fixed" ? "" : "hidden"}><span>Fixed key</span>
        <select id="set-fixed-key" style="max-width:120px">${ROOTS.map((r) => `<option value="${r}" ${r === s.fixedKey ? "selected" : ""}>${pretty(r)}</option>`).join("")}</select></div>
    </div>
    <div class="settings-group">
      <h2>Scale pool</h2>
      <div class="pool-grid">${SCALE_GROUPS.map((g) => `<div class="grp">${g.name}</div>` + SCALES.filter((x) => x.group === g.id).map((x) => check("scalePool", x.id, x.name, s.scalePool.includes(x.id))).join("")).join("")}</div>
    </div>
    <div class="settings-group">
      <h2>Arpeggio pool</h2>
      <div class="pool-grid">${CHORDS.map((x) => check("chordPool", x.id, `${x.symbol} — ${x.name}`, s.chordPool.includes(x.id))).join("")}</div>
    </div>
    <div class="settings-group">
      <h2>Voicing pool</h2>
      <div class="pool-grid">${VOICING_POOL_OPTIONS.map((x) => check("voicingPool", x.id, x.name, s.voicingPool.includes(x.id))).join("")}</div>
      <div class="card-note">Uses the four-note chord types from the arpeggio pool. Untick all to skip the voicings block.</div>
    </div>
    <div class="settings-group">
      <h2>Progression pool</h2>
      <div class="pool-grid">${PROGRESSIONS.map((x) => check("progressionPool", x.id, x.name, s.progressionPool.includes(x.id))).join("")}</div>
    </div>
    <div class="settings-group">
      <h2>Display</h2>
      <div class="settings-row"><span>Theme</span>${seg("theme", [["dark", "Dark"], ["light", "Light"]])}</div>
      <div class="settings-row"><span>Fretboard labels</span>${seg("fretLabels", [["names", "Names"], ["degrees", "Degrees"], ["none", "None"]])}</div>
      <div class="settings-row"><span>Frets shown</span>${seg("fretCount", [[12, "12"], [15, "15"], [22, "22"]])}</div>
      <div class="settings-row"><span>G♭ / F♯ spelling</span>${seg("gbSpelling", [["auto", "Auto (fewest accidentals)"], ["Gb", "G♭"], ["F#", "F♯"]])}</div>
      <div class="settings-row"><label><input type="checkbox" id="set-keysig" ${s.showKeySig ? "checked" : ""}> Key signature on major scales</label></div>
    </div>
    <div class="settings-group">
      <h2>About</h2>
      <div class="card-note">A daily-randomised jazz guitar practice session. Same session all day; 🎲 Reroll for a fresh one. The URL holds the seed, so bookmark it to come back to a session.<br>
      Keys: <b>Space</b> metronome · <b>↑/↓</b> ±1 BPM (<b>Shift</b> ±5) · <b>T</b> tap · <b>←/→</b> prev/next · <b>D</b> mark done.</div>
      <div class="settings-row"><button class="btn btn-sm btn-ghost" id="set-reset">Reset all settings</button></div>
    </div>`;

  // wiring
  $$("[data-setting]", root).forEach((segEl) => {
    segEl.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const key = segEl.dataset.setting;
      let v = b.dataset.val;
      if (/^\d+$/.test(v)) v = Number(v);
      setSetting(key, v);
      if (key === "theme") applyTheme();
      if (key === "sessionLength" || key === "keyMode") { buildSession(state.session.seed); }
      renderSettings();
    });
  });
  $$("[data-pool]", root).forEach((cb) => {
    cb.addEventListener("change", () => {
      const pool = cb.dataset.pool;
      const list = $$(`[data-pool="${pool}"]`, root).filter((x) => x.checked).map((x) => x.value);
      if (!list.length && pool !== "voicingPool") { cb.checked = true; return; } // keep at least one
      setSetting(pool, list);
      buildSession(state.session.seed);
    });
  });
  $("#set-fixed-key").addEventListener("change", (e) => { setSetting("fixedKey", e.target.value); buildSession(state.session.seed); });
  $("#set-weight").addEventListener("change", (e) => { setSetting("weightByHistory", e.target.checked); buildSession(state.session.seed); });
  $("#set-keysig").addEventListener("change", (e) => setSetting("showKeySig", e.target.checked));
  $("#set-clear-history").addEventListener("click", () => {
    if (confirm("Clear the practice history?")) { clearHistory(); state.history = []; renderSettings(); }
  });
  $("#set-reset").addEventListener("click", () => {
    if (confirm("Reset all settings to defaults?")) {
      state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      saveSettings(state.settings);
      applyTheme(); buildSession(state.session.seed); renderSettings();
    }
  });
}

// ---------- Metronome ----------
const dotsEl = $("#metro-dots");
const metro = new Metronome({
  ...state.settings.metronome,
  onBeat: ({ beat, accent, muted }) => {
    $$("span", dotsEl).forEach((d, i) => {
      d.classList.toggle("is-on", i === beat);
      d.classList.toggle("is-accent", i === beat && accent);
      d.classList.toggle("is-muted", i === beat && muted);
    });
  },
});
function drawDots() {
  dotsEl.innerHTML = Array.from({ length: metro.timeSig }, () => "<span></span>").join("");
}
function saveMetro() {
  setSetting("metronome", { bpm: metro.bpm, timeSig: metro.timeSig, mode: metro.mode, accent: metro.accent, dropout: metro.dropout });
}
function setBpm(bpm) {
  metro.set({ bpm });
  $("#metro-bpm").value = metro.bpm;
  $("#metro-slider").value = metro.bpm;
  saveMetro();
}
function metroToggle() {
  metro.toggle();
  const b = $("#metro-toggle");
  b.textContent = metro.running ? "■" : "▶";
  b.classList.toggle("is-running", metro.running);
  if (!metro.running) $$("span", dotsEl).forEach((d) => d.classList.remove("is-on", "is-accent", "is-muted"));
  updateWakeLock();
}
$("#metro-toggle").addEventListener("click", metroToggle);
$("#metro-minus").addEventListener("click", () => setBpm(metro.bpm - 1));
$("#metro-plus").addEventListener("click", () => setBpm(metro.bpm + 1));
$("#metro-bpm").addEventListener("change", (e) => setBpm(Number(e.target.value) || 120));
$("#metro-slider").addEventListener("input", (e) => setBpm(Number(e.target.value)));
$("#metro-tap").addEventListener("click", () => { metro.ensureContext(); const b = metro.tap(); if (b) setBpm(b); });
$("#metro-more").addEventListener("click", () => { const o = $("#metro-options"); o.hidden = !o.hidden; });
function wireSeg(id, fn) {
  const segEl = $(id);
  segEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $$("button", segEl).forEach((x) => x.classList.toggle("is-active", x === b));
    fn(b.dataset.val);
  });
  return (val) => $$("button", segEl).forEach((x) => x.classList.toggle("is-active", x.dataset.val === String(val)));
}
const setTimeSigUI = wireSeg("#metro-timesig", (v) => { metro.set({ timeSig: Number(v) }); drawDots(); saveMetro(); });
const setModeUI = wireSeg("#metro-mode", (v) => { metro.set({ mode: v }); saveMetro(); });
const setDropoutUI = wireSeg("#metro-dropout", (v) => { metro.set({ dropout: Number(v) }); saveMetro(); });
$("#metro-accent").addEventListener("change", (e) => { metro.set({ accent: e.target.checked }); saveMetro(); });
// initial metronome UI from settings
setBpm(metro.bpm); setTimeSigUI(metro.timeSig); setModeUI(metro.mode); setDropoutUI(metro.dropout);
$("#metro-accent").checked = metro.accent;
drawDots();

// ---------- keyboard ----------
document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") {
    if (e.key === "Enter") e.target.blur();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case " ": e.preventDefault(); metroToggle(); break;
    case "ArrowUp": e.preventDefault(); setBpm(metro.bpm + (e.shiftKey ? 5 : 1)); break;
    case "ArrowDown": e.preventDefault(); setBpm(metro.bpm - (e.shiftKey ? 5 : 1)); break;
    case "t": case "T": metro.ensureContext(); { const b = metro.tap(); if (b) setBpm(b); } break;
    case "ArrowRight": case "n": case "N": if (state.view === "today") goTo(state.idx + 1); break;
    case "ArrowLeft": case "p": case "P": if (state.view === "today") goTo(state.idx - 1); break;
    case "d": case "D": if (state.view === "today") toggleDone(); break;
  }
});

// ---------- wake lock ----------
let wakeLock = null;
async function updateWakeLock() {
  const want = metro.running || state.view === "today";
  try {
    if (want && !wakeLock && "wakeLock" in navigator && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") updateWakeLock(); });

// ---------- boot ----------
applyTheme();
initSession();
renderToday();
showView("today");
window.addEventListener("hashchange", () => {
  const h = decodeHash(location.hash);
  if (h.seed != null && h.seed !== state.session.seed) { buildSession(h.seed); renderToday(); }
});
