// localStorage wrapper. Everything is namespaced jazz.* and wrapped in
// try/catch so the app works with storage disabled (private mode etc.).

import { DEFAULT_SETTINGS } from "./catalogue.js";

const KEY_SETTINGS = "jazz.settings";
const KEY_HISTORY = "jazz.history";
const HISTORY_CAP = 365;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Settings merged over defaults (so new keys get defaults automatically). */
export function loadSettings() {
  const saved = read(KEY_SETTINGS, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    metronome: { ...DEFAULT_SETTINGS.metronome, ...(saved.metronome || {}) },
  };
}
export function saveSettings(settings) {
  return write(KEY_SETTINGS, settings);
}
export function resetSettings() {
  try { localStorage.removeItem(KEY_SETTINGS); } catch {}
}

/** History: [{ date: "2026-09-21", items: [{ type, id, key, done_at }] }], newest last. */
export function loadHistory() {
  const h = read(KEY_HISTORY, []);
  return Array.isArray(h) ? h : [];
}

export function markDone(item, date) {
  const history = loadHistory();
  let day = history.find((d) => d.date === date);
  if (!day) {
    day = { date, items: [] };
    history.push(day);
    history.sort((a, b) => (a.date < b.date ? -1 : 1));
    while (history.length > HISTORY_CAP) history.shift();
  }
  const dup = day.items.find((x) => x.type === item.type && x.id === item.id && x.key === item.key);
  if (!dup) day.items.push({ type: item.type, id: item.id, key: item.key, done_at: new Date().toISOString() });
  write(KEY_HISTORY, history);
  return history;
}

export function unmarkDone(item, date) {
  const history = loadHistory();
  const day = history.find((d) => d.date === date);
  if (!day) return history;
  day.items = day.items.filter((x) => !(x.type === item.type && x.id === item.id && x.key === item.key));
  if (!day.items.length) history.splice(history.indexOf(day), 1);
  write(KEY_HISTORY, history);
  return history;
}

export function isDone(history, item, date) {
  const day = history.find((d) => d.date === date);
  return !!day && day.items.some((x) => x.type === item.type && x.id === item.id && x.key === item.key);
}

/** { "scale:dorian": "2026-09-10", "scale:dorian@Bb": "2026-09-10", ... } */
export function lastPractisedMap(history) {
  const map = {};
  for (const day of history) {
    for (const it of day.items) {
      const k1 = `${it.type}:${it.id}`;
      const k2 = `${k1}@${it.key}`;
      if (!map[k1] || map[k1] < day.date) map[k1] = day.date;
      if (!map[k2] || map[k2] < day.date) map[k2] = day.date;
    }
  }
  return map;
}

/** Streak (consecutive days ending today or yesterday), days practised in the last N, total items. */
export function stats(history, today) {
  const days = new Set(history.filter((d) => d.items.length).map((d) => d.date));
  const total = history.reduce((n, d) => n + d.items.length, 0);
  const dayMs = 86400000;
  const t = new Date(today + "T00:00:00");
  const iso = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  let streak = 0;
  let cursor = new Date(t);
  if (!days.has(iso(cursor))) cursor = new Date(cursor - dayMs); // allow "yesterday" to keep the streak alive
  while (days.has(iso(cursor))) {
    streak++;
    cursor = new Date(cursor - dayMs);
  }
  let last21 = 0;
  for (let i = 0; i < 21; i++) if (days.has(iso(new Date(t - i * dayMs)))) last21++;
  return { streak, last21, total, days: days.size };
}

export function clearHistory() {
  try { localStorage.removeItem(KEY_HISTORY); } catch {}
}
