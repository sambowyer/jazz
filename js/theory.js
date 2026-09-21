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

// ---------------------------------------------------------------------------
// Chord voicings (drop-2, drop-3, shells) on the guitar.
// A drop voicing is a precisely defined set of pitches, so the frets follow
// from it: put the bass on the lowest string of the set, then each voice is
// the next occurrence of its pitch class above the previous voice.

export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // string index 0 = low E (E2)
export const STRING_SET_NAME = (strings) => `${6 - strings[0]}–${6 - strings[strings.length - 1]}`;

export const VOICING_TYPES = [
  { id: "drop2", name: "Drop-2", sets: [[0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 5]] },
  { id: "drop3", name: "Drop-3", sets: [[0, 2, 3, 4], [1, 3, 4, 5]] },
  { id: "shell", name: "Shell", sets: [] },
];
// Shells: fixed three-note shapes (roles index the chord tones 1-3-5-7).
const SHELL_SHAPES = [
  { roles: [0, 3, 1], strings: [0, 2, 3], label: "1–7–3, root on 6th" },
  { roles: [0, 1, 3], strings: [1, 2, 3], label: "1–3–7, root on 5th" },
  { roles: [0, 3, 1], strings: [1, 3, 4], label: "1–7–3, root on 5th" },
];
// Chord types with four distinct chord tones (voicable); the others map to
// the nearest four-note chord for comping.
export const VOICING_CHORD_IDS = ["maj7", "maj6", "dom7", "min7", "min6", "minmaj7", "min7b5", "dim7", "aug7"];
const VOICING_SUBSTITUTE = { dom7alt: "aug7", dom7b9: "dom7", dom7sharp11: "dom7" };
export const voicingChordId = (id) => VOICING_SUBSTITUTE[id] || id;

/** Bass→top chord-tone order for inversion k (k = index of the bass tone). */
function rolesFor(type, k) {
  if (type === "drop2") return [k, (k + 2) % 4, (k + 3) % 4, (k + 1) % 4];
  if (type === "drop3") return [k, (k + 3) % 4, (k + 1) % 4, (k + 2) % 4];
  throw new Error(`No inversions for ${type}`);
}

/** Note name with the octave that gives `midi`, keeping the spelling of `pc`. */
function nameAtMidi(pc, midi) {
  let oct = Math.floor(midi / 12) - 1;
  if (Note.midi(pc + oct) !== midi) oct += Note.midi(pc + oct) > midi ? -1 : 1;
  return pc + oct;
}

/**
 * Place `roles` (indices into `tones`) on `strings` (low→high). Returns
 * { strings, frets, midis, notes, position } or null if unplayable.
 */
function placeVoicing(tones, roles, strings, maxFret = 15, maxSpan = 5) {
  const bassStr = strings[0];
  const bassPc = tones[roles[0]].chroma;
  let bass = OPEN_STRINGS[bassStr] + ((bassPc - (OPEN_STRINGS[bassStr] % 12) + 12) % 12);
  for (let oct = 0; oct < 2; oct++, bass += 12) {
    const midis = [bass];
    for (let i = 1; i < roles.length; i++) {
      const pc = tones[roles[i]].chroma;
      const prev = midis[i - 1];
      let m = prev + ((pc - (prev % 12) + 12) % 12);
      if (m === prev) m += 12;
      midis.push(m);
    }
    const frets = midis.map((m, i) => m - OPEN_STRINGS[strings[i]]);
    if (frets.some((f) => f < 0 || f > maxFret)) continue;
    const fretted = frets.filter((f) => f > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    if (span > maxSpan) continue;
    return {
      strings, frets, midis,
      position: fretted.length ? Math.min(...fretted) : 0,
      notes: roles.map((r, i) => ({ ...tones[r], string: strings[i], fret: frets[i], midi: midis[i], full: nameAtMidi(tones[r].name, midis[i]) })),
    };
  }
  return null;
}

function slashSymbol(spelled, v) {
  const bass = v.notes[0];
  return spelled.symbol + (bass.chroma !== spelled.notes[0].chroma ? "/" + bass.pretty : "");
}

/**
 * All playable voicings of a chord for a voicing type.
 * Returns { chord (spelled), type, sets: [{ label, strings, voicings: [...] }] }
 * with each set's voicings ordered up the neck. Every voicing carries
 * symbol (e.g. "Cmaj7/E"), inversion (bass tone index) and inversionName.
 */
export function chordVoicings(rootIn, chordIdIn, typeId, opts = {}) {
  const chordId = voicingChordId(chordIdIn);
  const type = VOICING_TYPES.find((t) => t.id === typeId);
  if (!type) throw new Error(`Unknown voicing type ${typeId}`);
  const spelled = spellChord(rootIn, chordId, { extensions: false, gbSpelling: opts.gbSpelling, exactRoot: opts.exactRoot });
  const tones = spelled.notes;
  const maxFret = opts.maxFret || 15;
  const INV = ["root position", "1st inversion", "2nd inversion", "3rd inversion"];
  const sets = [];
  if (typeId === "shell") {
    for (const sh of SHELL_SHAPES) {
      const v = placeVoicing(tones, sh.roles, sh.strings, maxFret, 4);
      if (v) sets.push({ label: sh.label, strings: sh.strings, voicings: [{ ...v, symbol: slashSymbol(spelled, v), inversion: 0, inversionName: sh.label }] });
    }
  } else {
    for (const strings of type.sets) {
      const voicings = [];
      for (let k = 0; k < 4; k++) {
        const v = placeVoicing(tones, rolesFor(typeId, k), strings, maxFret);
        if (v) voicings.push({ ...v, symbol: slashSymbol(spelled, v), inversion: k, inversionName: INV[k] });
      }
      voicings.sort((a, b) => a.position - b.position);
      sets.push({ label: `Strings ${STRING_SET_NAME(strings)}`, strings, voicings });
    }
  }
  return { kind: "voicing", chord: spelled, type, sets, title: `${spelled.symbol} — ${type.name} voicings` };
}

/**
 * Voice-lead a progression with drop voicings on one string set: for each
 * chord pick the inversion that moves least from the previous grip (dynamic
 * programming over the whole sequence). chords = transposeProgression().chords.
 * Returns one voicing per chord (with symbol = the progression's chord symbol).
 */
export function voiceLeadVoicings(chords, typeId, strings, opts = {}) {
  const maxFret = opts.maxFret || 15;
  const cands = chords.map((c) => {
    const spelled = spellChord(c.root, voicingChordId(c.chordId), { extensions: false, exactRoot: true });
    const out = [];
    for (let k = 0; k < 4; k++) {
      const v = placeVoicing(spelled.notes, rolesFor(typeId, k), strings, maxFret);
      if (v) out.push({ ...v, symbol: c.symbol + (k ? "/" + v.notes[0].pretty : ""), inversion: k });
    }
    return out;
  });
  const move = (a, b) => a.frets.reduce((s, f, i) => s + Math.abs(f - b.frets[i]), 0);
  // Viterbi: best[i][j] = min cost ending at chord i with candidate j.
  let best = cands[0].map((v) => ({ cost: 0.01 * Math.abs(v.position - 5), path: [v] }));
  for (let i = 1; i < cands.length; i++) {
    best = cands[i].map((v) => {
      let bc = Infinity, bp = null;
      best.forEach((b) => {
        const c = b.cost + move(b.path[b.path.length - 1], v) + 0.01 * Math.abs(v.position - 5);
        if (c < bc) { bc = c; bp = b.path; }
      });
      return { cost: bc, path: [...bp, v] };
    });
  }
  if (!best.length) return [];
  return best.reduce((a, b) => (b.cost < a.cost ? b : a)).path;
}
