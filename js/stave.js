// VexFlow rendering: scales, arpeggios, progressions with guide tones.
// Treble clef, guitar convention (sounds an octave lower; no 8vb shown).

import { voiceLeadGuideTones, stackChord, midiOf } from "./theory.js";

const VF = globalThis.Vex.Flow;
const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation, Barline } = VF;

// VexFlow draws the top stave line 40px below the Stave's y and the bottom
// line 80px below it. Ledger-line notes hang further, so system height is
// computed from the actual pitch range rather than fixed.
const LINE_TOP = 40, LINE_BOTTOM = 80, STEP = 5; // px per staff step (half a line space)

/** Pixels needed above the top line / below the bottom line for these MIDI notes. */
function extent(midis) {
  const lo = Math.min(...midis), hi = Math.max(...midis);
  const steps = (semis) => Math.ceil((semis * 7) / 12); // ≈ diatonic steps
  return {
    above: hi > 77 ? steps(hi - 77) * STEP + 10 : 0,   // F5 is the top line
    below: lo < 64 ? steps(64 - lo) * STEP + 10 : 0,   // E4 is the bottom line
  };
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** "Eb4" → "eb/4"; "Bbb3" → "bbb/3"; "E#4" → "e#/4". */
export function toVexKey(full) {
  const m = /^([A-Ga-g])([#b]*)(-?\d+)$/.exec(full);
  if (!m) throw new Error(`Bad note ${full}`);
  return `${m[1].toLowerCase()}${m[2]}/${m[3]}`;
}

/** Fresh SVG renderer in `container`, sized w×h; VexFlow's black becomes currentColor. */
function makeRenderer(container, w, h) {
  container.innerHTML = "";
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(w, h);
  const ctx = renderer.getContext();
  return { renderer, ctx };
}

function themeSvg(container) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  svg.style.color = cssVar("--stave-fg", "#eee");
  svg.querySelectorAll("[fill='black'], [fill='#000000'], [fill='#000']").forEach((e) => e.setAttribute("fill", "currentColor"));
  svg.querySelectorAll("[stroke='black'], [stroke='#000000'], [stroke='#000']").forEach((e) => e.setAttribute("stroke", "currentColor"));
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
}

function containerWidth(container) {
  return Math.floor(container.getBoundingClientRect().width);
}

/**
 * Render a sequence of single notes (quarters) across one or more systems.
 * notes: [{ full: "Eb4", label, passing?, isExtension? }]
 */
function renderSequence(container, notes, { annotate = false, keySig = null, duration = "q" } = {}) {
  const width = containerWidth(container);
  if (width < 40) return;
  const muted = cssVar("--muted", "#999");
  const perSystem = Math.max(4, Math.floor((width - 60) / 30));
  const systems = [];
  for (let i = 0; i < notes.length; i += perSystem) systems.push(notes.slice(i, i + perSystem));
  const ext = extent(notes.map((n) => n.midi));
  const topPad = Math.max(0, ext.above - LINE_TOP + 8);
  const sysH = topPad + LINE_BOTTOM + ext.below + (annotate ? 30 : 0) + 8;
  const h = systems.length * sysH;
  const { ctx } = makeRenderer(container, width, h);

  systems.forEach((sys, si) => {
    const y = topPad + si * sysH;
    const stave = new Stave(0, y, width - 1);
    if (si === 0) {
      stave.addClef("treble");
      if (keySig) stave.addKeySignature(keySig);
    }
    stave.setBegBarType(Barline.type.NONE);
    stave.setEndBarType(si === systems.length - 1 ? Barline.type.END : Barline.type.NONE);
    stave.setContext(ctx).draw();

    const vfNotes = sys.map((n) => {
      const sn = new StaveNote({ keys: [toVexKey(n.full)], duration, auto_stem: true });
      if (n.passing || n.isExtension) sn.setStyle({ fillStyle: muted, strokeStyle: muted });
      if (annotate && n.label) {
        const a = new Annotation(n.label).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
        a.setFont("sans-serif", 12, n.isExtension ? "normal" : "bold");
        a.setStyle({ fillStyle: n.isExtension ? muted : "currentColor" });
        sn.addModifier(a, 0);
      }
      return sn;
    });
    const voice = new Voice({ num_beats: 4, beat_value: 4 }).setMode(Voice.Mode.SOFT);
    voice.addTickables(vfNotes);
    Accidental.applyAccidentals([voice], keySig || "C");
    new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 20);
    voice.draw(ctx, stave);
  });
  themeSvg(container);
}

/** One octave ascending, quarter notes. notes should already include the octave root. */
export function renderScaleStave(container, notes, { showKeySig = null } = {}) {
  renderSequence(container, notes, { annotate: false, keySig: showKeySig });
}

/** Root–3–5–7(–9…) ascending with degree labels under each note. */
export function renderArpeggioStave(container, notes) {
  renderSequence(container, notes, { annotate: true });
}

/**
 * Progression: one stave per bar, chord symbols above, guide tones (3rd & 7th)
 * voice-led as half/whole notes — or full chord tones stacked (view: "chords"),
 * or explicit voicings (view: "voicings", with opts.voicings from
 * theory.voiceLeadVoicings). p = theory.transposeProgression(...) result.
 */
export function renderProgressionStave(container, p, { view = "guide", voicings = null } = {}) {
  let voiced;
  if (view === "voicings" && voicings) voiced = voicings.map((v) => v.notes.map((n) => n.full));
  else if (view === "chords") voiced = p.chords.map((c) => stackChord(c));
  else voiced = voiceLeadGuideTones(p.chords.map((c) => c.guide));
  renderChordsStave(container, p.bars, voiced);
}

/**
 * Bars of stacked chords. bars = [[{ symbol, beats }, ...], ...] and voiced =
 * one array of note names (with octaves) per chord, in bar order.
 */
export function renderChordsStave(container, bars, voiced, { perLineWide = 4 } = {}) {
  const width = containerWidth(container);
  if (width < 40) return;
  const perLine = width >= 640 ? perLineWide : Math.min(2, perLineWide);
  const lines = [];
  for (let i = 0; i < bars.length; i += perLine) lines.push(bars.slice(i, i + perLine));

  const ext = extent(voiced.flat().map(midiOf));
  const topPad = Math.max(0, ext.above + 22 - LINE_TOP); // chord symbols sit above the notes
  const lineH = topPad + LINE_BOTTOM + ext.below + 12;
  const h = lines.length * lineH;
  const { ctx } = makeRenderer(container, width, h);

  const clefW = 62;
  let chordIdx = 0;
  lines.forEach((line, li) => {
    const y = topPad + li * lineH;
    const barW = Math.floor((width - 1 - clefW) / perLine);
    line.forEach((bar, bi) => {
      const isFirst = bi === 0;
      const x = isFirst ? 0 : clefW + bi * barW;
      const w = isFirst ? clefW + barW : barW;
      const stave = new Stave(x, y, w);
      if (isFirst) {
        stave.addClef("treble");
        if (li === 0) stave.addTimeSignature("4/4");
      }
      const isLastBar = li === lines.length - 1 && bi === line.length - 1;
      if (isLastBar) stave.setEndBarType(Barline.type.END);
      stave.setContext(ctx).draw();

      const vfNotes = bar.map((c) => {
        const keys = voiced[chordIdx].slice().sort((a, b) => midiOf(a) - midiOf(b)).map(toVexKey);
        chordIdx++;
        const dur = c.beats >= 4 ? "w" : c.beats === 2 ? "h" : "q";
        const sn = new StaveNote({ keys, duration: dur, auto_stem: true });
        const a = new Annotation(c.symbol).setVerticalJustification(Annotation.VerticalJustify.TOP);
        a.setFont("sans-serif", 14, "bold");
        sn.addModifier(a, 0);
        return sn;
      });
      const voice = new Voice({ num_beats: 4, beat_value: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(vfNotes);
      Accidental.applyAccidentals([voice], "C");
      new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 16);
      voice.draw(ctx, stave);
    });
  });
  themeSvg(container);
}
