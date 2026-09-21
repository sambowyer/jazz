// Thin helpers over Tonal. Pure functions, no DOM.
// The catalogue owns interval lists; Tonal does transposition and spelling.

import { SCALES, CHORDS, PROGRESSIONS, ENHARMONIC_ROOT, scaleById, chordById, progressionById } from "./catalogue.js";

const T = globalThis.Tonal;
const { Note, Interval } = T;

export const splitIntervals = (str) => (str ? str.trim().split(/\s+/) : []);

/** "Bb" → "B♭", "F##" → "F♯♯". */
export function pretty(name) {
  if (!name) return "";
  return name[0] + name.slice(1).replace(/b/g, "♭").replace(/#/g, "♯");
}

/** Tonal interval → jazz degree label: 3m → ♭3, 4A → ♯4, 9m → ♭9, 7d → ♭♭7. */
export function degreeLabel(interval) {
  const m = /^(\d+)([PMmAd]+)$/.exec(interval);
  if (!m) return interval;
  if (interval === "10m") return "♯9"; // jazz has no ♭10
  const num = m[1], q = m[2];
  const simple = ((Number(num) - 1) % 7) + 1;
  const perfect = simple === 1 || simple === 4 || simple === 5;
  let acc = "";
  if (q === "m") acc = "♭";
  else if (q === "d") acc = perfect ? "♭" : "♭♭";
  else if (q === "dd") acc = perfect ? "♭♭" : "♭♭♭";
  else if (q === "A") acc = "♯";
  else if (q === "AA") acc = "♯♯";
  return acc + num;
}

const ENHARMONIC_PAIRS = { Db: "C#", "C#": "Db", Eb: "D#", "D#": "Eb", Gb: "F#", "F#": "Gb", Ab: "G#", "G#": "Ab", Bb: "A#", "A#": "Bb" };
const ODD_NOTES = /^(E#|B#|Cb|Fb)$/;

/**
 * Tidy a spelled note: double accidentals are always simplified (B𝄫 → A);
 * with `full`, E#/B#/Cb/Fb are simplified too (for symmetric scales, where
 * "correct" spelling is meaningless and players write whatever reads best).
 */
function tidy(name, full) {
  const n = Note.get(name);
  if (Math.abs(n.alt) >= 2 || (full && ODD_NOTES.test(n.pc))) return Note.simplify(name);
  return name;
}

/** Sum of |alteration| over the (tidied) notes produced by spelling `intervals` from `root`. */
function accidentalWeight(root, intervals, full) {
  let w = 0;
  for (const iv of intervals) {
    const n = Note.get(tidy(Note.transpose(root, iv), full));
    w += Math.abs(n.alt || 0);
  }
  return w;
}

/**
 * Pick a spelling for `root` (e.g. Gb vs F#, Eb vs D#) that gives the fewest
 * accidentals for the given intervals (ties keep the original). `pref`
 * ("auto" | "Gb" | "F#") forces the Gb/F# slot.
 */
export function resolveRoot(root, intervals, pref = "auto", full = false) {
  const alt = ENHARMONIC_PAIRS[root];
  if (!alt) return root;
  if ((root === "Gb" || root === "F#") && (pref === "Gb" || pref === "F#")) return pref;
  const ivs = typeof intervals === "string" ? splitIntervals(intervals) : intervals;
  const a = accidentalWeight(root, ivs, full);
  const b = accidentalWeight(alt, ivs, full);
  return b < a ? alt : root;
}

/** Octave for `root` such that its MIDI number lands in [lo, hi] (default E3–E♭4). */
export function chooseOctave(root, lo = 52, hi = 63) {
  for (const o of [2, 3, 4, 5]) {
    const m = Note.midi(root + o);
    if (m != null && m >= lo && m <= hi) return o;
  }
  return 3;
}

/** Spell `intervals` from `root` (pitch class) starting in a chosen octave. */
function spellIntervals(root, intervals, labels, octave, fullTidy = false) {
  const o = octave ?? chooseOctave(root);
  const base = root + o;
  return intervals.map((iv, i) => {
    const full = tidy(Note.transpose(base, iv), fullTidy);
    const n = Note.get(full);
    return {
      name: n.pc,             // "Eb"
      pretty: pretty(n.pc),   // "E♭"
      octave: n.oct,
      full,                   // "Eb4"
      midi: n.midi,
      chroma: n.chroma,       // 0–11 pitch class
      interval: iv,
      label: labels ? labels[i] : degreeLabel(iv),
      semitones: Interval.semitones(iv),
    };
  });
}

/**
 * Spell a scale. Returns { root, scale, notes, formula, names } where notes is
 * one octave ascending (root … 7th) — the octave root is appended by callers
 * that want it (see withOctave).
 */
export function spellScale(rootIn, scaleId, opts = {}) {
  const scale = scaleById(scaleId);
  if (!scale) throw new Error(`Unknown scale ${scaleId}`);
  const intervals = splitIntervals(scale.intervals);
  const symmetric = scale.group === "symmetric";
  const root = opts.exactRoot ? rootIn : resolveRoot(rootIn, intervals, opts.gbSpelling, symmetric);
  const labels = scale.labels ? scale.labels.split(/\s+/) : null;
  const notes = spellIntervals(root, intervals, labels, opts.octave, symmetric);
  if (scale.passing != null) notes[scale.passing].passing = true;
  return {
    kind: "scale",
    root, scale, notes,
    title: `${pretty(root)} ${scale.name}`,
    formula: notes.map((n) => n.label).join(" "),
    names: notes.map((n) => n.pretty).join(" "),
    chromas: new Set(notes.map((n) => n.chroma)),
  };
}

/** Add the octave root to the end of a spelled scale's notes. */
export function withOctave(notes) {
  const r = notes[0];
  const full = Note.transpose(r.full, "8P");
  const n = Note.get(full);
  return [...notes, { ...r, full, octave: n.oct, midi: n.midi, label: r.label === "R" ? "R" : "8" }];
}

/**
 * Spell a chord (for arpeggios). Chord tones get isChordTone=true; extensions
 * (9/11/13) are appended above and marked isExtension=true.
 */
export function spellChord(rootIn, chordId, opts = {}) {
  const chord = chordById(chordId);
  if (!chord) throw new Error(`Unknown chord ${chordId}`);
  const tones = splitIntervals(chord.intervals);
  const exts = opts.extensions === false ? [] : splitIntervals(chord.extensions);
  const all = [...tones, ...exts];
  const root = opts.exactRoot ? rootIn : resolveRoot(rootIn, all, opts.gbSpelling);
  const notes = spellIntervals(root, all, null, opts.octave);
  notes.forEach((n, i) => {
    n.isChordTone = i < tones.length;
    n.isExtension = i >= tones.length;
    if (i === 0) n.label = "R";
  });
  const symbol = pretty(root) + chord.symbol;
  return {
    kind: "arpeggio",
    root, chord, notes, symbol,
    title: `${symbol} arpeggio`,
    formula: notes.map((n) => n.label).join(" "),
    names: notes.map((n) => n.pretty).join(" "),
    chromas: new Set(notes.map((n) => n.chroma)),
    chordChromas: new Set(notes.filter((n) => n.isChordTone).map((n) => n.chroma)),
    scales: chord.scales,
  };
}

/** Guide tones of a chord type: the 3rd and the 7th (6th for 6 chords). */
export function guideToneIntervals(chordId) {
  const ivs = splitIntervals(chordById(chordId).intervals);
  return [ivs[1], ivs[ivs.length - 1]];
}

/**
 * Transpose a progression to a key. Returns { prog, key, keyPretty, bars }
 * where each bar is an array of chords: { root, chordId, chord, symbol,
 * numeral, beats, scales, chromas, guide: [pc, pc], tones: [pc...] }.
 */
export function transposeProgression(progId, keyIn, opts = {}) {
  const prog = progressionById(progId);
  if (!prog) throw new Error(`Unknown progression ${progId}`);
  const keyScale = prog.keyMode === "minor" ? "1P 2M 3m 4P 5P 6m 7m" : "1P 2M 3M 4P 5P 6M 7M";
  const key = opts.exactRoot ? keyIn : resolveRoot(keyIn, keyScale, opts.gbSpelling);
  const bars = prog.bars.map((bar) =>
    bar.map((c) => {
      let root = Note.transpose(key, c.root);
      if (ODD_NOTES.test(root) || Math.abs(Note.get(root).alt) >= 2) root = Note.simplify(root);
      const chord = chordById(c.chord);
      const tones = splitIntervals(chord.intervals).map((iv) => tidy(Note.transpose(root, iv)));
      const [g3, g7] = guideToneIntervals(c.chord);
      return {
        root, chordId: c.chord, chord,
        symbol: pretty(root) + chord.symbol,
        numeral: c.numeral, beats: c.beats,
        scales: c.scales || chord.scales,
        tones,
        chromas: new Set(tones.map((n) => Note.chroma(n))),
        guide: [tidy(Note.transpose(root, g3)), tidy(Note.transpose(root, g7))],
      };
    })
  );
  const keyPretty = pretty(key) + (prog.keyMode === "minor" ? " minor" : "");
  return {
    kind: "progression",
    prog, key, keyPretty, bars,
    title: `${prog.name} in ${keyPretty}`,
    chords: bars.flat(),
  };
}

/**
 * Voice-lead a sequence of guide-tone pairs. Input: array of [pcA, pcB]
 * (pitch classes). Output: array of [noteA, noteB] with octaves (e.g.
 * ["F4","C5"]), each pair chosen to minimise movement from the previous one.
 */
export function voiceLeadGuideTones(pairs, { lo = 55, hi = 76, centre = 64 } = {}) {
  const candidatesFor = (pc) => {
    const out = [];
    for (let o = 2; o <= 6; o++) {
      const m = Note.midi(pc + o);
      if (m != null && m >= lo && m <= hi) out.push(pc + o);
    }
    return out;
  };
  const result = [];
  let prev = null;
  for (const [a, b] of pairs) {
    let best = null, bestCost = Infinity;
    for (const na of candidatesFor(a)) {
      for (const nb of candidatesFor(b)) {
        const ma = Note.midi(na), mb = Note.midi(nb);
        if (ma === mb) continue;
        const gap = Math.abs(ma - mb);
        if (gap > 12) continue;
        const [lowN, highN] = ma < mb ? [na, nb] : [nb, na];
        const lowM = Math.min(ma, mb), highM = Math.max(ma, mb);
        let cost;
        if (!prev) {
          cost = Math.abs((lowM + highM) / 2 - centre);
        } else {
          cost = Math.abs(lowM - prev[0]) + Math.abs(highM - prev[1]) + 0.05 * Math.abs((lowM + highM) / 2 - centre);
        }
        if (cost < bestCost) { bestCost = cost; best = { notes: [lowN, highN], midis: [lowM, highM] }; }
      }
    }
    result.push(best.notes);
    prev = best.midis;
  }
  return result;
}

/** Full chord tones stacked in root position, root octave in [lo, hi]. */
export function stackChord(chord, lo = 50, hi = 61) {
  const o = chooseOctave(chord.root, lo, hi);
  return chord.tones.map((pc, i) => Note.transpose(chord.root + o, splitIntervals(chord.chord.intervals)[i]));
}

/** Names of scale ids as human strings, e.g. for chips. */
export function scaleName(id) {
  const s = scaleById(id);
  return s ? s.name : id;
}

export const midiOf = (n) => Note.midi(n);
export const chromaOf = (n) => Note.chroma(n);
export const noteName = (full) => Note.get(full).pc;
