// Hand-written SVG fretboard. Horizontal, nut on the left, low E at the bottom.
// Pure function of its options; re-render by calling again.

const TUNING = [64, 59, 55, 50, 45, 40]; // top→bottom: E4 B3 G3 D3 A2 E2 (MIDI)
const MARKERS = { 3: 1, 5: 1, 7: 1, 9: 1, 12: 2, 15: 1, 17: 1, 19: 1, 21: 1 };

const ROLE_STYLE = {
  root:    { fill: "var(--accent)", stroke: "var(--accent)", text: "var(--accent-fg)", weight: 700 },
  chord:   { fill: "var(--second)", stroke: "var(--second)", text: "var(--accent-fg)", weight: 600 },
  ext:     { fill: "var(--bg)", stroke: "var(--second)", text: "var(--second)", weight: 500 },
  scale:   { fill: "var(--bg)", stroke: "var(--fg)", text: "var(--fg)", weight: 500 },
  passing: { fill: "var(--bg)", stroke: "var(--muted)", text: "var(--muted)", weight: 400, dash: "3 2" },
};

/**
 * @param {HTMLElement} container
 * @param {object} o
 * @param {number} [o.frets=15]
 * @param {"names"|"degrees"|"none"} [o.labels="names"]
 * @param {Array<{chroma:number,name:string,label:string,role:string}>} o.notes
 * @param {Array<{string:number,fret:number,name:string,label:string,role:string}>} [o.positions]
 *        — if given, only these exact positions are drawn (string 0 = low E)
 */
export function renderFretboard(container, { frets = 15, labels = "names", notes = [], positions = null }) {
  const byChroma = new Map(notes.map((n) => [n.chroma, n]));
  const byPos = positions ? new Map(positions.map((p) => [`${p.string}:${p.fret}`, p])) : null;
  const fretW = 46, nutW = 34, strH = 24, top = 26, left = 8, right = 8;
  const W = left + nutW + frets * fretW + right;
  const H = top + strH * 5 + 30;
  const nutX = left + nutW;
  const fretX = (f) => nutX + f * fretW; // x of fret wire f (f ≥ 1)
  const strY = (s) => top + s * strH;
  const r = 10;

  let s = "";
  // fretboard background
  s += `<rect x="${nutX}" y="${strY(0) - 8}" width="${frets * fretW}" height="${strH * 5 + 16}" rx="2" style="fill: var(--bg-2); stroke: none"/>`;
  // markers
  for (let f = 1; f <= frets; f++) {
    const m = MARKERS[f];
    if (!m) continue;
    const cx = fretX(f) - fretW / 2;
    if (m === 1) s += `<circle cx="${cx}" cy="${strY(2.5)}" r="4.5" style="fill: var(--rule-soft)"/>`;
    else {
      s += `<circle cx="${cx}" cy="${strY(1.5)}" r="4.5" style="fill: var(--rule-soft)"/>`;
      s += `<circle cx="${cx}" cy="${strY(3.5)}" r="4.5" style="fill: var(--rule-soft)"/>`;
    }
  }
  // nut + frets
  s += `<rect x="${nutX - 3}" y="${strY(0) - 8}" width="4" height="${strH * 5 + 16}" style="fill: var(--fg)"/>`;
  for (let f = 1; f <= frets; f++) {
    s += `<line x1="${fretX(f)}" y1="${strY(0) - 8}" x2="${fretX(f)}" y2="${strY(5) + 8}" style="stroke: var(--muted); stroke-width: 1.2"/>`;
    s += `<text x="${fretX(f) - fretW / 2}" y="${strY(5) + 24}" text-anchor="middle" style="fill: var(--muted); font: 11px var(--mono)">${f}</text>`;
  }
  // strings (thicker toward the bottom)
  for (let i = 0; i < 6; i++) {
    s += `<line x1="${nutX - 3}" y1="${strY(i)}" x2="${fretX(frets)}" y2="${strY(i)}" style="stroke: var(--fg); stroke-width: ${0.8 + i * 0.35}; opacity: .8"/>`;
  }
  // notes
  for (let i = 0; i < 6; i++) {
    for (let f = 0; f <= frets; f++) {
      const chroma = (TUNING[i] + f) % 12;
      const n = byPos ? byPos.get(`${5 - i}:${f}`) : byChroma.get(chroma);
      if (!n) continue;
      const st = ROLE_STYLE[n.role] || ROLE_STYLE.scale;
      const cx = f === 0 ? nutX - 3 - r - 6 : fretX(f) - fretW / 2;
      const cy = strY(i);
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill: ${st.fill}; stroke: ${st.stroke}; stroke-width: 1.6${st.dash ? `; stroke-dasharray: ${st.dash}` : ""}"/>`;
      if (labels !== "none") {
        const txt = labels === "degrees" ? n.label : n.name;
        const fs = txt.length > 2 ? 9 : 10.5;
        s += `<text x="${cx}" y="${cy + 3.6}" text-anchor="middle" style="fill: ${st.text}; font: ${st.weight} ${fs}px var(--sans)">${txt}</text>`;
      }
    }
  }
  // Keep the circles readable on phones: below ~85% of natural size the
  // diagram scrolls horizontally instead of shrinking further.
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="min-width: ${Math.round(W * 0.85)}px" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fretboard diagram">${s}</svg>`;
}

/**
 * A chord box (vertical diagram): strings low→high left→right, five frets,
 * base-fret label, x/o markers. Returns an SVG string.
 * @param {{strings:number[], frets:number[], notes:[{name,label,role?}]}} v  string 0 = low E
 */
export function chordBoxSvg(v, { labels = "names", rootChroma = null } = {}) {
  const sx = 13, fy = 16, x0 = 24, y0 = 20, W = x0 + sx * 5 + 12, H = y0 + fy * 5 + 8;
  const fretted = v.frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const base = maxF <= 5 ? 1 : Math.min(...fretted);
  let s = "";
  // grid
  for (let i = 0; i < 6; i++) s += `<line x1="${x0 + i * sx}" y1="${y0}" x2="${x0 + i * sx}" y2="${y0 + fy * 5}" style="stroke: var(--muted); stroke-width: 1"/>`;
  for (let f = 0; f <= 5; f++) s += `<line x1="${x0}" y1="${y0 + f * fy}" x2="${x0 + sx * 5}" y2="${y0 + f * fy}" style="stroke: var(--muted); stroke-width: 1"/>`;
  if (base === 1) s += `<rect x="${x0 - 1}" y="${y0 - 2.5}" width="${sx * 5 + 2}" height="3" style="fill: var(--fg)"/>`;
  else s += `<text x="${x0 - 7}" y="${y0 + fy / 2 + 4}" text-anchor="end" style="fill: var(--muted); font: 10px var(--mono)">${base}</text>`;
  // markers + dots
  const onString = new Map(v.strings.map((st, i) => [st, i]));
  for (let st = 0; st < 6; st++) {
    const x = x0 + st * sx;
    const i = onString.get(st);
    if (i == null) { s += `<text x="${x}" y="${y0 - 6}" text-anchor="middle" style="fill: var(--muted); font: 10px var(--sans)">×</text>`; continue; }
    const f = v.frets[i], n = v.notes[i];
    const isRoot = n.role === "root" || (rootChroma != null && n.chroma === rootChroma);
    const txt = labels === "none" ? "" : labels === "degrees" ? n.label : n.pretty || n.name;
    if (f === 0) {
      s += `<circle cx="${x}" cy="${y0 - 8}" r="4.5" style="fill: none; stroke: ${isRoot ? "var(--accent)" : "var(--fg)"}; stroke-width: 1.2"/>`;
      continue;
    }
    const y = y0 + (f - base) * fy + fy / 2;
    s += `<circle cx="${x}" cy="${y}" r="6.5" style="fill: ${isRoot ? "var(--accent)" : "var(--fg)"}"/>`;
    if (txt) s += `<text x="${x}" y="${y + 2.8}" text-anchor="middle" style="fill: var(--bg); font: 600 ${txt.length > 1 ? 7 : 8}px var(--sans)">${txt}</text>`;
  }
  // open-string labels below? (skip — keep the box compact)
  return `<svg viewBox="0 0 ${W} ${H}" width="${W * 1.15}" height="${H * 1.15}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="chord diagram">${s}</svg>`;
}
