// Session generation: seeded PRNG, templates, key selection, URL hash.
// Pure, no DOM.

import { ROOTS, SESSION_TEMPLATES, scaleById, chordById, progressionById } from "./catalogue.js";

// Chord types with four distinct chord tones — the ones the voicings block uses.
const VOICING_CHORD_IDS = ["maj7", "maj6", "dom7", "min7", "min6", "minmaj7", "min7b5", "dim7", "aug7"];

/** mulberry32 — small, fast, good enough for shuffling practice material. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's seed as YYYYMMDD (local time). */
export function dateSeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick one element by weight. Weights ≤ 0 are treated as 0. */
function weightedPick(rng, items, weightOf) {
  const ws = items.map((it) => Math.max(0, weightOf(it)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Pick `n` distinct elements by weight (weights re-evaluated after each pick). */
function weightedSample(rng, items, n, weightOf) {
  const pool = items.slice();
  const out = [];
  while (out.length < n && pool.length) {
    const pick = weightedPick(rng, pool, weightOf);
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

/**
 * Days since an item/key was last marked done, from a "last practised" map
 * ({ "scale:dorian": "2026-09-10", "scale:dorian@Bb": "2026-09-10", ... }).
 * Never practised → `neverValue`.
 */
function daysSince(lastMap, key, today, neverValue = 31) {
  const d = lastMap && lastMap[key];
  if (!d) return neverValue;
  const ms = new Date(today) - new Date(d);
  return Math.max(0, Math.min(30, Math.round(ms / 86400000)));
}

/**
 * Generate a session.
 * @param {object} o
 * @param {number} o.seed
 * @param {object} o.settings   — see catalogue.DEFAULT_SETTINGS
 * @param {object} [o.lastMap]  — from storage.lastPractisedMap(); enables weighting
 * @param {string} [o.today]    — ISO date, for weighting
 */
export function generateSession({ seed, settings, lastMap = null, today = isoDate() }) {
  const rng = mulberry32(seed);
  const template = SESSION_TEMPLATES[settings.sessionLength] || SESSION_TEMPLATES[25];
  const weighting = settings.weightByHistory && lastMap;
  const itemWeight = (type, id) => (weighting ? 1 + daysSince(lastMap, `${type}:${id}`, today) : 1);
  const keyWeight = (type, id, key, extra = 1) =>
    (weighting ? 1 + daysSince(lastMap, `${type}:${id}@${key}`, today) : 1) * extra;

  // Key selection state for cycle mode.
  let cycleIdx = Math.floor(rng() * ROOTS.length);
  const nextCycleKey = () => ROOTS[cycleIdx++ % ROOTS.length];

  /** Choose `n` keys for a block of items (type, id) — no repeats inside a block. */
  const chooseKeys = (n, type, ids, extraWeights = null) => {
    if (settings.keyMode === "fixed") return Array(n).fill(settings.fixedKey || "C");
    if (settings.keyMode === "cycle") return Array.from({ length: n }, nextCycleKey);
    const avail = shuffle(rng, ROOTS);
    const out = [];
    ids.forEach((id, i) => {
      const remaining = avail.filter((k) => !out.includes(k));
      out.push(weightedPick(rng, remaining, (k) => keyWeight(type, id, k, extraWeights ? extraWeights[k] || 1 : 1)));
    });
    return out;
  };

  const items = [];
  const voicingPool = (settings.voicingPool || []).slice();
  let spareMinutes = 0;
  template.forEach((block, blockIdx) => {
    if (block.type === "free") {
      items.push({ type: "free", block: blockIdx, minutes: block.minutes + spareMinutes });
      return;
    }
    if (block.type === "voicing") {
      let pool = settings.chordPool.filter((id) => VOICING_CHORD_IDS.includes(id));
      if (!pool.length) pool = VOICING_CHORD_IDS.slice();
      if (!voicingPool.length) { spareMinutes += block.minutes; return; }
      const ids = weightedSample(rng, pool, block.count, (id) => itemWeight("voicing", id));
      const keys = chooseKeys(ids.length, "voicing", ids);
      ids.forEach((id, i) => {
        const voicing = voicingPool[Math.floor(rng() * voicingPool.length)];
        items.push({ type: "voicing", id, voicing, key: keys[i], block: blockIdx, minutes: block.minutes / ids.length });
      });
      return;
    }
    if (block.type === "scale") {
      const pool = settings.scalePool.filter(scaleById);
      const ids = weightedSample(rng, pool, block.count, (id) => itemWeight("scale", id));
      const keys = chooseKeys(ids.length, "scale", ids);
      ids.forEach((id, i) => items.push({ type: "scale", id, key: keys[i], block: blockIdx, minutes: block.minutes / ids.length }));
    } else if (block.type === "arpeggio") {
      const pool = settings.chordPool.filter(chordById);
      const ids = weightedSample(rng, pool, block.count, (id) => itemWeight("arpeggio", id));
      const keys = chooseKeys(ids.length, "arpeggio", ids);
      ids.forEach((id, i) => items.push({ type: "arpeggio", id, key: keys[i], block: blockIdx, minutes: block.minutes / ids.length }));
    } else if (block.type === "progression") {
      const pool = settings.progressionPool.filter(progressionById);
      const ids = weightedSample(rng, pool, block.count, (id) => itemWeight("progression", id));
      const nKeys = block.keys || 1;
      const perItem = block.minutes / (ids.length * nKeys);
      ids.forEach((id) => {
        const prog = progressionById(id);
        const keys = chooseKeys(nKeys, "progression", Array(nKeys).fill(id), prog.keyWeights);
        keys.forEach((key) => items.push({ type: "progression", id, key, block: blockIdx, minutes: perItem }));
      });
    }
  });

  items.forEach((it, i) => (it.idx = i));
  return { seed, length: settings.sessionLength, blocks: template, items };
}

/** Stable id for history / weighting: "scale:dorian@Bb". */
export const itemKey = (it) => `${it.type}:${it.id}@${it.key}`;

// ---- URL hash: #s=SEED&l=25 ----
export function encodeHash({ seed, length }) {
  return `#s=${seed}&l=${length}`;
}
export function decodeHash(hash) {
  const out = {};
  const q = (hash || "").replace(/^#/, "");
  for (const part of q.split("&")) {
    const [k, v] = part.split("=");
    if (k === "s" && /^\d+$/.test(v)) out.seed = Number(v);
    if (k === "l" && /^\d+$/.test(v)) out.length = Number(v);
  }
  return out;
}
