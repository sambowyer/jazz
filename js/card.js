// The exercise card: title, formula, stave, fretboard, chord–scale chips.
// One component renders scales, arpeggios, progressions and the free-play block.

import { scaleById, chordById, progressionById } from "./catalogue.js";
import { spellScale, spellChord, transposeProgression, withOctave, scaleName, pretty, chromaOf, degreeLabel } from "./theory.js";
import { renderScaleStave, renderArpeggioStave, renderProgressionStave } from "./stave.js";
import { renderFretboard } from "./fretboard.js";

const KIND_LABEL = { scale: "Scale", arpeggio: "Arpeggio", progression: "Progression", free: "Free play" };

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function miniSeg(options, current, onChange) {
  const wrap = el("div", "mini-seg");
  for (const [val, label] of options) {
    const b = el("button", val === current ? "is-active" : "", label);
    b.addEventListener("click", () => {
      wrap.querySelectorAll("button").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      onChange(val);
    });
    wrap.appendChild(b);
  }
  return wrap;
}

/** Build the fretboard note list for a scale (root / passing / scale). */
function scaleFretNotes(spelled) {
  return spelled.notes.map((n, i) => ({
    chroma: n.chroma, name: n.pretty, label: n.label,
    role: i === 0 ? "root" : n.passing ? "passing" : "scale",
  }));
}

/** Fretboard notes for a chord, optionally overlaid with a scale. */
function chordFretNotes(spelledChord, scaleSpelled) {
  const byChroma = new Map();
  if (scaleSpelled) {
    for (const n of scaleSpelled.notes) byChroma.set(n.chroma, { chroma: n.chroma, name: n.pretty, label: n.label, role: n.passing ? "passing" : "scale" });
  }
  for (const n of spelledChord.notes) {
    byChroma.set(n.chroma, { chroma: n.chroma, name: n.pretty, label: n.label, role: n.isChordTone ? "chord" : "ext" });
  }
  const r = spelledChord.notes[0];
  byChroma.set(r.chroma, { chroma: r.chroma, name: r.pretty, label: "R", role: "root" });
  return [...byChroma.values()];
}

/**
 * Render an exercise card into `container`.
 * @param {HTMLElement} container
 * @param {{type, id, key, minutes?}} item
 * @param {{settings, onSettingChange?, done?, onToggleDone?}} ctx
 */
export function renderCard(container, item, ctx) {
  const { settings } = ctx;
  container.innerHTML = "";
  const card = el("div", "card");
  container.appendChild(card);

  if (item.type === "free") {
    card.appendChild(el("div", "free-play", `<h2>Free play</h2><div>Put the metronome on and play whatever you like for ${Math.round(item.minutes || 5)} minutes.<br>Try improvising over the progression you just practised.</div>`));
    return card;
  }

  const head = el("div", "card-head");
  const headL = el("div");
  head.appendChild(headL);
  card.appendChild(head);

  const fretOpts = { frets: settings.fretCount, labels: settings.fretLabels };
  const staveSection = el("div", "card-section");
  const staveTitle = el("div", "card-section-title", "<span>Stave</span>");
  const staveBox = el("div", "stave");
  staveSection.append(staveTitle, staveBox);
  const fretSection = el("div", "card-section");
  const fretTitle = el("div", "card-section-title", "<span>Fretboard</span>");
  const fretBox = el("div", "fretboard");
  fretSection.append(fretTitle, fretBox);
  const labelSeg = miniSeg([["names", "Names"], ["degrees", "Degrees"], ["none", "None"]], settings.fretLabels, (v) => {
    fretOpts.labels = v;
    ctx.onSettingChange && ctx.onSettingChange("fretLabels", v);
    redrawFret();
  });
  fretTitle.appendChild(labelSeg);

  let redrawStave = () => {};
  let redrawFret = () => {};

  if (item.type === "scale") {
    const s = spellScale(item.key, item.id, { gbSpelling: settings.gbSpelling });
    headL.innerHTML = `<div class="card-kind">${KIND_LABEL.scale}</div><h2 class="card-title">${s.title}</h2>
      <div class="card-sub"><span>${s.formula}</span><b>${s.names}</b></div>` +
      (s.scale.notes ? `<div class="card-note">${s.scale.notes}</div>` : "");
    const notes = withOctave(s.notes);
    redrawStave = () => renderScaleStave(staveBox, notes, { showKeySig: settings.showKeySig && s.scale.id === "ionian" ? s.root : null });
    redrawFret = () => renderFretboard(fretBox, { ...fretOpts, notes: scaleFretNotes(s) });
    card.append(staveSection, fretSection);
  } else if (item.type === "arpeggio") {
    const c = spellChord(item.key, item.id, { gbSpelling: settings.gbSpelling });
    headL.innerHTML = `<div class="card-kind">${KIND_LABEL.arpeggio}</div><h2 class="card-title">${c.title}</h2>
      <div class="card-sub"><span>${c.formula}</span><b>${c.names}</b></div>
      <div class="card-note">${c.chord.name}</div>`;
    // chord–scale chips
    const chipSection = el("div", "card-section");
    chipSection.appendChild(el("div", "card-section-title", "<span>Scales that fit — tap to overlay</span>"));
    const chips = el("div", "chip-row");
    let activeScale = null;
    for (const sid of c.scales) {
      const chip = el("button", "chip is-soft", scaleName(sid));
      chip.addEventListener("click", () => {
        chips.querySelectorAll(".chip").forEach((x) => x.classList.remove("is-active"));
        if (activeScale === sid) { activeScale = null; }
        else { activeScale = sid; chip.classList.add("is-active"); }
        redrawStave(); redrawFret();
      });
      chips.appendChild(chip);
    }
    chipSection.appendChild(chips);
    redrawStave = () => {
      if (activeScale) {
        const s = spellScale(c.root, activeScale, { exactRoot: true, octave: c.notes[0].octave });
        staveTitle.firstChild.textContent = `Stave — ${s.title}`;
        renderScaleStave(staveBox, withOctave(s.notes), {});
      } else {
        staveTitle.firstChild.textContent = "Stave";
        renderArpeggioStave(staveBox, c.notes, {});
      }
    };
    redrawFret = () => {
      const s = activeScale ? spellScale(c.root, activeScale, { exactRoot: true }) : null;
      renderFretboard(fretBox, { ...fretOpts, notes: chordFretNotes(c, s) });
    };
    card.append(staveSection, chipSection, fretSection);
  } else if (item.type === "progression") {
    const p = transposeProgression(item.id, item.key, { gbSpelling: settings.gbSpelling });
    headL.innerHTML = `<div class="card-kind">${KIND_LABEL.progression}</div><h2 class="card-title">${p.title}</h2>
      <div class="card-sub"><b>${p.chords.map((c) => c.symbol).join(" · ")}</b></div>`;
    let view = settings.progressionView || "guide";
    staveTitle.appendChild(miniSeg([["guide", "Guide tones"], ["chords", "Chord tones"]], view, (v) => {
      view = v;
      ctx.onSettingChange && ctx.onSettingChange("progressionView", v);
      redrawStave();
    }));
    redrawStave = () => renderProgressionStave(staveBox, p, { view });

    // chord list with chord–scale suggestions; tapping one drives the fretboard
    const chordSection = el("div", "card-section");
    chordSection.appendChild(el("div", "card-section-title", "<span>Chords &amp; scales — tap a chord to see it on the fretboard</span>"));
    const list = el("div", "chord-list");
    let active = 0;
    let activeScale = p.chords[0].scales[0];
    const chipRow = el("div", "chip-row");
    chipRow.style.marginTop = "8px";
    const uniq = [];
    p.chords.forEach((c, i) => {
      const sig = c.symbol;
      if (uniq.some((u) => u.sig === sig)) return;
      uniq.push({ sig, i });
      const it = el("div", "chord-item" + (i === active ? " is-active" : ""));
      it.innerHTML = `<span class="sym">${c.symbol}</span><span class="num">${c.numeral}</span>
        <div class="scales">${c.scales.map((s, k) => (k === 0 ? `<b>${scaleName(s)}</b>` : scaleName(s))).join(" · ")}</div>`;
      it.addEventListener("click", () => {
        active = i; activeScale = c.scales[0];
        list.querySelectorAll(".chord-item").forEach((x) => x.classList.remove("is-active"));
        it.classList.add("is-active");
        buildChips(); redrawFret();
      });
      list.appendChild(it);
    });
    const buildChips = () => {
      chipRow.innerHTML = "";
      const c = p.chords[active];
      for (const sid of c.scales) {
        const chip = el("button", "chip" + (sid === activeScale ? " is-active" : " is-soft"), scaleName(sid));
        chip.addEventListener("click", () => { activeScale = sid; buildChips(); redrawFret(); });
        chipRow.appendChild(chip);
      }
    };
    buildChips();
    chordSection.append(list, chipRow);
    redrawFret = () => {
      const c = p.chords[active];
      const chordSpelled = spellChord(c.root, c.chordId, { exactRoot: true, extensions: false });
      const s = activeScale ? spellScale(c.root, activeScale, { exactRoot: true }) : null;
      fretTitle.firstChild.textContent = `Fretboard — ${c.symbol}` + (s ? ` · ${s.scale.name}` : "");
      renderFretboard(fretBox, { ...fretOpts, notes: chordFretNotes(chordSpelled, s) });
    };
    card.append(staveSection, chordSection, fretSection);
  }

  const safe = (fn, box) => { try { fn(); } catch (e) { console.error(e); box.innerHTML = `<div class="card-note">Render error: ${e.message}</div>`; } };
  const draw = () => { safe(redrawStave, staveBox); safe(redrawFret, fretBox); };
  draw();

  // Re-render the stave on resize (debounced); the fretboard is a scalable SVG.
  let t = null;
  const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => safe(redrawStave, staveBox), 120); });
  ro.observe(staveBox);
  card._cleanup = () => ro.disconnect();
  return card;
}
