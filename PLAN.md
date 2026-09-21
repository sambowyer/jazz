# Jazz Guitar Practice App — Plan

A small, static, single-page web app for daily jazz guitar practice (15–30 min a
day). It generates a randomised practice session each day from a pool of scales,
chord/arpeggio types and common chord progressions, renders each exercise on a
stave and a fretboard diagram, and has a built-in metronome.

This document is the full plan and design brief. It was written in one Claude Code
session (in the personal-website repo) so that the actual build can happen in a
fresh session pointed at this folder. Read this first.

---

## 1. Goals and non-goals

### Goals
- Make daily practice frictionless: open the page, get today's session, play.
- Randomise keys and material every day so all 12 keys and the important
  scales/chords get covered, but allow manual choice too.
- Show the material on a **stave** (treble clef, guitar convention) and on a
  **fretboard diagram** so it's usable at the guitar without thinking.
- A simple, accurate **metronome**.
- Work well on a **phone/tablet** propped up next to the guitar.
- Zero build step, no backend, no accounts. Everything is static files.
- Eventually hosted at **https://sambowyer.com/jazz/** as part of the personal
  website (a Jekyll site on GitHub Pages, repo `sambowyer/sambowyer.github.io`).

### Non-goals (for v1)
- Audio playback of the exercise (scale/arpeggio played at tempo). **Deferred**;
  design so it's easy to add later (see §11).
- Guitar tab. Rendering is cheap with VexFlow, but choosing fret positions
  (fingering) is the hard part. The fretboard diagram covers most of the need.
  **Deferred.**
- Ear training, backing tracks, recording, user accounts, sync between devices.

---

## 2. Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Location during development | `~/Documents/jazz/` (this folder), its own git repo, pushed to a separate GitHub repo (e.g. `sambowyer/jazz`) with GitHub Pages enabled | Keeps the Jekyll toolchain out of the way; a Pages URL lets us test on a phone next to the guitar |
| Final home | Copied into `sambowyer.github.io/jazz/` → `sambowyer.com/jazz/` | User wants it on the personal site |
| Stack | Vanilla HTML/CSS/JS (ES modules), no bundler, no framework | Simplicity; mirrors `tennis.html` already on the site; trivially copyable |
| Music theory | **Tonal.js** | Correct note spelling/transposition/enharmonics; don't hand-roll this |
| Notation rendering | **VexFlow** | Mature, SVG output, handles key sigs and accidentals, supports tab later |
| Metronome | Web Audio API with a look-ahead scheduler | `setInterval` alone drifts audibly |
| Fretboard | Hand-written SVG | Simple; no library needed |
| Fretboard in v1 | Yes | More useful for guitar than the stave and much easier than tab |
| Progressions in v1 | ii–V–I (major & minor), I–vi–ii–V, iii–vi–ii–V, jazz blues | Data is trivial; user asked for all of them |
| Audio playback | Not in v1 | Deferred |
| Git | **No git actions in the planning session.** `git init`, first commit and GitHub remote happen in the build session, with the user | User's explicit instruction |

---

## 3. Tech stack details

### Libraries (vendored, not CDN)
Download minified browser builds once into `lib/` and commit them. Reasons:
works offline, no CDN dependency for a personal site, and the folder copies
cleanly into the Jekyll repo.

- **Tonal** — browser bundle (`tonal.min.js`, exposes `window.Tonal`).
  Modules we'll use: `Note`, `Interval`, `Scale`, `Chord`, `Key`, `Midi`.
  Get it from `https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js`.
- **VexFlow 4.x** — `vexflow.js` UMD build (exposes `window.Vex` / `VexFlow`).
  Get it from `https://cdn.jsdelivr.net/npm/vexflow@4/build/cjs/vexflow.js`
  (check the exact current path/version at build time and pin it in a comment
  in `index.html`).

> ⚠️ Do **not** call the vendored folder `vendor/`. Jekyll's default `exclude`
> list contains `vendor/bundle/`, `vendor/cache/` etc. and it's easy to get
> bitten. Use `lib/`.

### Why ES modules + a local server
ES modules don't load over `file://`. Always develop over HTTP:

```bash
cd ~/Documents/jazz && python3 -m http.server 8000
```

Add a `.claude/launch.json` so Claude Code can preview it in the browser pane:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "jazz",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8000"],
      "port": 8000
    }
  ]
}
```

### Relative paths only
All `<script src>`, `<link href>` and fetches must be **relative** (`./js/main.js`,
not `/js/main.js`) so the same files work at the root of the separate repo's
Pages site *and* under `/jazz/` on sambowyer.com.

---

## 4. Proposed file layout

```
jazz/
├── PLAN.md               ← this document
├── README.md             ← short public readme (write later)
├── CLAUDE.md             ← conventions for Claude Code sessions (write at start of build)
├── .claude/launch.json   ← dev server config for Claude Code preview
├── index.html            ← single page; loads lib/ then js/main.js as a module
├── style.css
├── lib/
│   ├── tonal.min.js
│   └── vexflow.js
├── js/
│   ├── main.js           ← boot, view switching, wiring
│   ├── catalogue.js      ← DATA: scales, chord types, progressions, chord→scale map, keys
│   ├── theory.js         ← thin helpers over Tonal: spell a scale/chord from root + intervals, choose octave, guide tones
│   ├── session.js        ← seeded PRNG, session templates, session generator
│   ├── stave.js          ← VexFlow rendering (scale, arpeggio, progression w/ guide tones)
│   ├── fretboard.js      ← SVG fretboard rendering
│   ├── metronome.js      ← Web Audio metronome
│   ├── storage.js        ← localStorage wrapper (settings, history)
│   └── ui/               ← (optional) small DOM helpers / components if main.js gets big
├── tests/
│   └── test.html         ← browser-run assertions for catalogue/theory/session (see §9)
└── deploy-to-site.sh     ← copies the app into ../sambowyer.github.io/jazz/ (see §10)
```

Keep modules pure where possible: `catalogue.js`, `theory.js`, `session.js`
should not touch the DOM so they can be tested in isolation.

---

## 5. Music content (the catalogue)

**Design principle:** the catalogue owns interval lists; Tonal handles
transposition and spelling. I.e. we define each scale/chord as an array of
Tonal interval strings (`"1P 2M 3M 4P 5P 6M 7M"`) and spell notes with
`Tonal.Note.transpose(root, interval)`. This gives consistent, correct
enharmonics (Gb major contains Cb; F# major contains E#) without depending on
Tonal's scale-name dictionary being complete for every exotic name.
Tonal's `Scale.get()` / `Chord.get()` can still be used for cross-checking in
tests.

### 5.1 Keys / roots
Twelve roots, listed in **cycle-of-fourths order** with the conventional jazz
spellings:

```
C  F  Bb  Eb  Ab  Db  Gb  B  E  A  D  G
```

Notes:
- Prefer flats for Db/Eb/Gb/Ab/Bb roots and sharps for F#/B/E/A/D/G contexts.
  Offer Gb and F# as the same slot with a per-item spelling preference
  (default Gb for major/dominant material, F# for minor keys — or just let the
  user toggle enharmonic spelling; keep it simple in v1: **Gb by default,
  toggle available in Settings**).
- Scales on some roots will produce double sharps/flats (e.g. G# altered).
  Acceptable but avoid by choosing roots from the list above.

### 5.2 Scales

Group them in the UI. Each entry: `id`, `name`, `group`, `intervals`, optional
`aliases`, optional `notes` (a one-line "when to use it").

**Major scale modes**
| id | name | intervals |
|---|---|---|
| ionian | Ionian (major) | 1P 2M 3M 4P 5P 6M 7M |
| dorian | Dorian | 1P 2M 3m 4P 5P 6M 7m |
| phrygian | Phrygian | 1P 2m 3m 4P 5P 6m 7m |
| lydian | Lydian | 1P 2M 3M 4A 5P 6M 7M |
| mixolydian | Mixolydian | 1P 2M 3M 4P 5P 6M 7m |
| aeolian | Aeolian (natural minor) | 1P 2M 3m 4P 5P 6m 7m |
| locrian | Locrian | 1P 2m 3m 4P 5d 6m 7m |

**Melodic minor modes** (the jazz-essential ones marked ★)
| id | name | intervals |
|---|---|---|
| melodic_minor | Melodic minor ★ | 1P 2M 3m 4P 5P 6M 7M |
| dorian_b2 | Dorian ♭2 | 1P 2m 3m 4P 5P 6M 7m |
| lydian_aug | Lydian augmented | 1P 2M 3M 4A 5A 6M 7M |
| lydian_dom | Lydian dominant ★ | 1P 2M 3M 4A 5P 6M 7m |
| mixo_b6 | Mixolydian ♭6 | 1P 2M 3M 4P 5P 6m 7m |
| locrian_nat2 | Locrian ♮2 (half-diminished) ★ | 1P 2M 3m 4P 5d 6m 7m |
| altered | Altered (super Locrian) ★ | 1P 2m 3m 3M 5d 6m 7m  *(spell as 1 ♭9 ♯9 3 ♭5 ♭13 ♭7)* |

**Harmonic minor**
| id | name | intervals |
|---|---|---|
| harmonic_minor | Harmonic minor | 1P 2M 3m 4P 5P 6m 7M |
| phrygian_dom | Phrygian dominant (HM mode 5) | 1P 2m 3M 4P 5P 6m 7m |

**Symmetric**
| id | name | intervals |
|---|---|---|
| whole_tone | Whole tone | 1P 2M 3M 4A 5A 7m |
| dim_hw | Diminished (half–whole) | 1P 2m 3m 3M 4A 5P 6M 7m |
| dim_wh | Diminished (whole–half) | 1P 2M 3m 4P 5d 6m 6M 7M |

**Pentatonic / blues**
| id | name | intervals |
|---|---|---|
| maj_pent | Major pentatonic | 1P 2M 3M 5P 6M |
| min_pent | Minor pentatonic | 1P 3m 4P 5P 7m |
| blues | Blues | 1P 3m 4P 5d 5P 7m |

**Bebop** (8-note; the passing tone is marked so the stave/fretboard can style it)
| id | name | intervals |
|---|---|---|
| bebop_dom | Bebop dominant | 1P 2M 3M 4P 5P 6M 7m 7M |
| bebop_maj | Bebop major | 1P 2M 3M 4P 5P 5A 6M 7M |
| bebop_dor | Bebop Dorian | 1P 2M 3m 3M 4P 5P 6M 7m |

Spelling caveat: for the altered scale and the HW diminished scale the "3m 3M"
pair should be displayed as ♯9/3 (or ♭3/♮3). Tonal will spell `C + 3m = Eb`
and `C + 3M = E`. That's fine on a stave. If we want ♯9 spelling (D#) we can
use interval `2A` instead of `3m` for the altered scale: `1P 2m 2A 3M 5d 6m 7m`.
**Decide at build time by looking at the rendered output; prefer whatever reads
best on the stave.**

### 5.3 Chord types (for arpeggios)

Each entry: `id`, `symbol` (suffix, e.g. `m7b5`), `name`, `intervals` (chord
tones only, root through 7th), `extensions` (optional 9/11/13 intervals shown
lighter), `scales` (ordered list of scale ids that fit — see 5.5).

| id | symbol | name | chord tones | typical extensions |
|---|---|---|---|---|
| maj7 | maj7 | Major seventh | 1P 3M 5P 7M | 9M 13M (♯11 if Lydian) |
| maj6 | 6 | Major sixth | 1P 3M 5P 6M | 9M |
| dom7 | 7 | Dominant seventh | 1P 3M 5P 7m | 9M 13M |
| dom7sharp11 | 7♯11 | Dominant ♯11 | 1P 3M 5P 7m | 9M 11A 13M |
| dom7alt | 7alt | Altered dominant | 1P 3M 7m | 9m 9A 5d/11A 13m |
| dom7b9 | 7♭9 | Dominant ♭9 | 1P 3M 5P 7m | 9m 13M |
| min7 | m7 | Minor seventh | 1P 3m 5P 7m | 9M 11P |
| min6 | m6 | Minor sixth | 1P 3m 5P 6M | 9M |
| minmaj7 | mMaj7 | Minor–major seventh | 1P 3m 5P 7M | 9M |
| min7b5 | m7♭5 (ø) | Half-diminished | 1P 3m 5d 7m | 11P (9M if Locrian ♮2) |
| dim7 | dim7 (°7) | Diminished seventh | 1P 3m 5d 7d | — |
| aug7 | 7♯5 | Augmented dominant | 1P 3M 5A 7m | 9M |

In the arpeggio exercise, render **root–3–5–7 (–9 …)** ascending, one octave
plus the extensions on top, and label each note with its degree (R, 3, 5, ♭7, 9…).

### 5.4 Progressions

Each entry: `id`, `name`, `bars` (array of bars; each bar is an array of chords
with `{ degree, quality, beats }`), and a `key_mode` (`major` | `minor`).
Chords are stored as **Roman-numeral degree + quality** relative to the key so
they transpose to any key. Each chord also gets a suggested scale (via 5.5,
with per-progression overrides where context matters — e.g. the V7 in a minor
ii–V–i should suggest *altered* / *HW diminished*, not Mixolydian).

- **ii–V–I (major)** — `Dm7 | G7 | Cmaj7 | Cmaj7` (1 bar each; last bar can be C6)
- **ii–V–i (minor)** — `Dm7♭5 | G7alt | CmMaj7 | Cm6` (or `Cm7`)
- **I–vi–ii–V** (rhythm-changes A-section turnaround) — `Cmaj7 A7 | Dm7 G7` (2 beats each). Include the vi as `A7` (dominant, more idiomatic) with `Am7` as a variant.
- **iii–vi–ii–V** — `Em7 A7 | Dm7 G7` (2 beats each)
- **Jazz blues (12 bar)** — in C:
  ```
  | C7      | F7      | C7      | Gm7  C7 |
  | F7      | F#dim7  | C7      | Em7  A7 |
  | Dm7     | G7      | C7  A7  | Dm7  G7 |
  ```
  Default keys for blues in the randomiser: weight F and B♭ heavily (the ones
  actually called at jams), but allow all.

Optional extras (cheap to add, low priority): **I–IV** vamp (Dorian practice),
**Coltrane changes** (later), **backdoor ii–V** (`Fm7 B♭7 → Cmaj7`),
**tritone-sub ii–V** (`Dm7 D♭7 → Cmaj7`).

### 5.5 Chord → scale map (chord-scale relationships)

Displayed under every chord (arpeggio exercise and each chord of a progression):

| chord | scales (first = default) |
|---|---|
| maj7 | Ionian, Lydian, bebop major, major pentatonic |
| 6 | Ionian, major pentatonic, bebop major |
| 7 | Mixolydian, bebop dominant, Lydian dominant, blues |
| 7 → resolving to a minor chord | Altered, HW diminished, Phrygian dominant |
| 7 → resolving to a major chord (ii–V–I) | Mixolydian, bebop dominant, altered (for tension), HW diminished |
| 7♯11 | Lydian dominant, whole tone |
| 7alt | Altered, HW diminished |
| 7♭9 | HW diminished, Phrygian dominant |
| 7♯5 | Whole tone, altered |
| m7 | Dorian, minor pentatonic, bebop Dorian, Aeolian (if tonic minor) |
| m6 | Dorian, melodic minor |
| mMaj7 | Melodic minor, harmonic minor |
| m7♭5 | Locrian, Locrian ♮2 |
| dim7 | WH diminished |

---

## 6. Feature specification

### 6.1 Views
Single page with three views (tabs at top) and a **persistent metronome bar**
at the bottom that stays visible in every view.

1. **Today** — the generated session, one exercise card at a time with
   Prev/Next, a progress indicator ("3 / 8"), and a per-block countdown timer.
2. **Explore** — free choice: pick a root, then a scale / chord type /
   progression, and see the same card. This is also the "manual choice" mode.
3. **Settings** — pool configuration, key-selection mode, display prefs,
   metronome defaults, enharmonic preference, and a history/streak readout.

### 6.2 Exercise card
The same component renders every exercise. Contents:
- Title: e.g. **"E♭ Lydian dominant"** / **"F♯m7♭5 arpeggio"** / **"ii–V–I in A♭"**.
- Sub-line: interval formula (`1 2 3 ♯4 5 6 ♭7`) and note names (`Eb F G A Bb C Db`).
- **Stave** (VexFlow SVG).
- **Fretboard** (SVG).
- For chords/progressions: the chord–scale suggestions as small chips; clicking
  a chip swaps the fretboard/stave to that scale (Explore mode).
- A "mark done ✓" button (Today view) which records it to history.

### 6.3 Stave rendering (VexFlow)
- Treble clef, guitar convention (sounds an octave lower; we don't show the 8vb).
- **Scales:** one octave ascending, quarter notes, 4/4, no key signature by
  default — use accidentals on each note (clearer for modes; a key signature
  would be misleading for e.g. D Dorian). Setting: "show key signature for
  major-mode scales".
- **Arpeggios:** root, 3, 5, 7 (+ extensions) ascending; degree labels under
  the notes (VexFlow `Annotation`).
- **Progressions:** one bar per chord (or two chords per bar for the
  2-beats-each ones), chord symbols above the stave, and **guide tones**
  (3rd and 7th) as half notes (or whole notes for one-chord bars) with voice
  leading — choose the inversion of each guide-tone pair that minimises
  movement from the previous pair. Toggle to show full four-note chord tones
  stacked instead. Blues: 12 bars laid out 4 per line.
- **Octave choice:** pick the root octave so the root's MIDI number is in
  `[52, 63]` (E3–E♭4). This keeps most scales within a comfortable stave range
  with few ledger lines. (Written guitar range is E3–~E6 in treble.)
- Responsive: render into a container, re-render on resize (debounced) using
  the container width; on narrow screens split into more systems.

### 6.4 Fretboard diagram (SVG)
- Standard tuning `E2 A2 D3 G3 B3 E4`, frets 0–15 (setting: 12 / 15 / 22).
- Horizontal, nut on the left, **low E at the bottom** (standard diagram
  orientation). Fret markers at 3, 5, 7, 9, 12 (double), 15.
- Light all positions whose pitch class is in the current scale/chord.
  Root = filled accent colour; chord tones (3, 5, 7) = secondary colour;
  extensions/passing tones = outlined/lighter.
- Label toggle: **note names** / **scale degrees** / **none**.
- Later: a "position box" filter (show only frets `n..n+4`) — this also becomes
  the input to a tab-fingering algorithm.
- Pure function: `renderFretboard(container, { pitchClasses, root, labels, degreeOf })`.

### 6.5 Session generator
- **Seeded PRNG** (mulberry32 or similar) seeded from the date (`YYYYMMDD` as an
  integer). Reloading gives the same session; tomorrow gives a new one.
  "🎲 Reroll" reseeds with a random seed. Encode the seed (and optionally the
  pool config) in the URL hash so a session is bookmarkable/shareable.
- **Default template (~25 min):**
  1. Scales — 2 scales from the enabled pool, each in a randomly chosen key (5 min)
  2. Arpeggios — 3 chord types from the pool, each in a key (5 min)
  3. Progression — 1 progression in 2 keys (10 min)
  4. Free play / metronome only (5 min)
- Template is data (array of blocks with `{ type, count, minutes }`) so it's
  editable in Settings: session length presets **15 / 25 / 30 min**.
- **Key selection modes:** `random` (default, without repeats inside a session),
  `cycle_of_fourths` (starting key random, subsequent items step around the
  cycle), `fixed` (one key for the whole session — useful for deep-dive days).
- **Pool weighting (phase 5):** weight each (item, key) pair by how long ago it
  was last marked done, so under-practised things come up more often. Purely
  a weight, never a hard constraint.
- Pools default to a sensible "essentials" subset: 7 major modes, melodic
  minor, Lydian dominant, altered, Locrian ♮2, HW dim, bebop dominant, major &
  minor pentatonic, blues; all chord types except aug7/7♭9; all progressions.

### 6.6 Metronome
- Web Audio API. Create/resume the `AudioContext` on the first user gesture
  (required on iOS/Safari).
- **Look-ahead scheduler:** a `setInterval` (or `setTimeout` loop) every ~25 ms
  schedules any clicks falling within the next ~100 ms using
  `audioCtx.currentTime`. (The classic "A Tale of Two Clocks" pattern.)
- Click sound: short oscillator burst (e.g. sine/square at 1000 Hz for accents,
  800 Hz for normal beats) with a ~50 ms exponential decay. No samples needed.
- Controls: **BPM** (40–240; slider + −/+ buttons + numeric input),
  **tap tempo** (average of last 4 taps), **time signature** 4/4 or 3/4,
  **accent beat 1** toggle, **mode:** `all beats` | `2 & 4 only` (the jazz
  hi-hat feel), and a visual beat indicator (four dots that light up).
- **Drop-out mode** (phase 5): play N bars then mute M bars (e.g. 2 on / 2 off)
  to test internal time.
- Keyboard: `Space` start/stop, `↑/↓` ±1 BPM, `Shift+↑/↓` ±5, `T` tap.
- Later: swing-8th subdivision click, count-in.

### 6.7 Storage (localStorage)
Keys, all JSON, all namespaced `jazz.*`:
- `jazz.settings` — pool toggles, key mode, session length, display prefs,
  metronome defaults, enharmonic preference, fret count.
- `jazz.history` — array of `{ date: "2026-09-21", items: [{ type, id, key, done_at }] }`.
  Cap at e.g. 365 entries.
- Derived at runtime: current streak, per-item "last practised" map, totals for
  a small Settings readout ("Practised 14 of the last 21 days · 47 items").
- Wrap all access in try/catch; the app must work fine with storage disabled.

### 6.8 Mobile / practical
- Mobile-first layout; large touch targets on the metronome bar.
- **Screen wake lock** (`navigator.wakeLock.request('screen')`) while the
  metronome is running or a session is open; re-request on `visibilitychange`.
- Dark theme by default (matches a dim practice room); light theme optional.
  Later, borrow the palette from `sambowyer.github.io/_sass/_theme.scss` so it
  feels like part of the site.
- Keyboard shortcuts: `N`/`→` next exercise, `P`/`←` previous, `Space`
  metronome, `D` mark done.
- No horizontal scroll at 375 px width.

---

## 7. Build order (phases)

Each phase leaves the app in a usable state.

**Phase 0 — Scaffold**
- `index.html`, `style.css`, `js/main.js` shell with the three views and empty
  metronome bar; download libs into `lib/`; `.claude/launch.json`; `CLAUDE.md`.
- Verify Tonal and VexFlow load (render a C major scale as a smoke test).

**Phase 1 — Catalogue & theory (pure data + functions)**
- `catalogue.js` with everything in §5.
- `theory.js`: `spellScale(root, scaleId)`, `spellChord(root, chordId)`,
  `chooseOctave(root)`, `guideTones(chord)`, `voiceLeadGuideTones(chords)`,
  `transposeProgression(progId, key)`, `degreeLabel(interval)`.
- `tests/test.html` with assertions (Gb major has Cb; F# major has E#; altered
  scale spelling; every catalogue entry has 5–8 notes; every progression
  transposes to all 12 keys without throwing).

**Phase 2 — Session generator + Today/Explore UI**
- `session.js`: seeded PRNG, template, generator, URL-hash encode/decode.
- Today view with cards (title + formula + note names only — no graphics yet),
  Prev/Next, timer. Explore view pickers.
- *At this point the app is already usable for practice.*

**Phase 3 — Stave (VexFlow)**
- `stave.js`: scales, arpeggios, progressions with guide tones.
- Responsive re-render.

**Phase 4 — Metronome**
- `metronome.js` per §6.6 (without drop-out mode). Persistent bar. Keyboard.

**Phase 5 — Fretboard, storage, polish**
- `fretboard.js`. `storage.js`, history + streak, least-recently-practised
  weighting. Wake lock. Drop-out mode. Settings view fully wired. Mobile pass.

**Phase 6 — Ship**
- `README.md`. Push to GitHub, enable Pages on the separate repo, test on phone.
- `deploy-to-site.sh` → copy into `sambowyer.github.io/jazz/`, add a link on the
  homepage (`_data/content.yml`), commit there. See §10.

Suggested first milestone to aim for in the build session: **Phases 0–2**
(usable, no graphics), then 3 and 4.

---

## 8. Development workflow

- Start the server: `python3 -m http.server 8000` (or `preview_start` with the
  `jazz` launch config from Claude Code) and open http://localhost:8000.
- No build, no `npm install`. If a `package.json` ever appears it should be
  devDependencies only (e.g. for a linter) — the shipped app must remain plain
  files.
- Keep `catalogue.js` / `theory.js` / `session.js` DOM-free.
- Pin library versions in a comment at the top of `index.html` and note the
  download URLs in `lib/README.md` (or `CLAUDE.md`) so they can be updated.
- Commits: small, one concern each. Git is set up in the build session.

Suggested `CLAUDE.md` for this folder (write it in phase 0):

```
# jazz — jazz guitar practice app
Static single-page app, no build step. See PLAN.md for the full design.
- Run: python3 -m http.server 8000 (launch config "jazz")
- Libraries are vendored in lib/ (Tonal, VexFlow). Don't add a bundler.
- All paths relative (app is served from / and from /jazz/).
- js/catalogue.js, js/theory.js, js/session.js must stay DOM-free; tests in tests/test.html.
- Deploy to the personal site with ./deploy-to-site.sh (see PLAN.md §10).
```

---

## 9. Testing

No test runner needed. `tests/test.html` loads `lib/` and the pure modules,
runs a list of `assert(...)` checks and prints pass/fail to the page and the
console. Claude Code can open it in the browser pane and read the console.
Things worth asserting:

- Spelling: `spellScale("Gb","ionian")` includes `Cb`; `spellScale("F#","ionian")`
  includes `E#`; `spellChord("B","dom7")` = `B D# F# A`.
- Every scale has the expected number of notes; no duplicated pitch classes
  (except deliberately for bebop passing tones — which are still distinct PCs).
- Every progression transposes to all 12 roots and every chord in it has ≥1
  suggested scale.
- Session generator is deterministic for a given seed and never repeats a key
  within a block.
- Guide-tone voice leading: consecutive pairs move by ≤ a major 2nd per voice
  for ii–V–I.
- Metronome scheduler: unit-test the pure `nextBeatTimes(startTime, bpm, ...)`
  helper if it's factored out; the audio itself is checked by ear.

Manual checks: iOS Safari audio starts after tap; wake lock works; nothing
overflows at 375 px; stave re-renders on rotate.

---

## 10. Deploying to sambowyer.com/jazz/

The personal site is a Jekyll site (`~/Documents/sambowyer.github.io`), built
and deployed by GitHub Actions on push to `main`. Files without YAML front
matter are copied through verbatim, so the app needs no Jekyll integration.

`deploy-to-site.sh` (in this folder):

```bash
#!/usr/bin/env bash
# Copy the built app into the personal-site repo. Run from ~/Documents/jazz.
set -euo pipefail
SITE="${1:-$HOME/Documents/sambowyer.github.io}"
DEST="$SITE/jazz"
mkdir -p "$DEST"
rsync -av --delete \
  --exclude PLAN.md --exclude README.md --exclude CLAUDE.md \
  --exclude .claude --exclude .git --exclude tests --exclude deploy-to-site.sh \
  ./ "$DEST/"
echo "Copied to $DEST — now review, commit and push in the site repo."
```

Then in the site repo:
- Add a link to `/jazz/` on the homepage (content lives in `_data/content.yml`;
  the layout is `_layouts/home.html`).
- Check `_config.yml` `exclude:` doesn't accidentally exclude anything in `jazz/`.
- Cache-busting: the site already versions its stylesheet with a query string;
  do the same in `index.html` for `style.css` and `js/main.js` (`?v=N`) and bump
  it on each deploy — or have `deploy-to-site.sh` substitute a timestamp.
- Commit ("Add jazz practice app"), push, wait for the Pages action, check
  https://sambowyer.com/jazz/.

Alternatives considered and rejected: git submodule (complicates the Actions
checkout and Jekyll build for little gain); building the app inside the Jekyll
repo (drags Ruby/Jekyll into every dev loop).

---

## 11. Future ideas (not v1)

Roughly in order of value/effort:

1. **Audio playback** of the current scale/arpeggio/guide tones at the
   metronome tempo. Use the same `AudioContext`; a simple oscillator with an
   envelope is enough (or Tone.js with a sampled instrument later). Design hook:
   every exercise already has an ordered list of `{ note, midi }` — the player
   just needs that list plus the metronome's schedule.
2. **Guitar tab** via VexFlow `TabStave`/`TabNote`. Needs a fingering algorithm:
   choose a position (fret window of 4–5 frets), map each pitch to the
   string/fret inside the window with the fewest position shifts. The fretboard
   "position box" filter is a stepping stone.
3. **Swing subdivision / count-in** on the metronome; drum-loop style click.
4. **More progressions:** Coltrane changes, backdoor and tritone-sub ii–Vs,
   rhythm changes bridge, "Autumn Leaves" / "All The Things You Are" chord
   sheets with per-chord scales.
5. **Ear training:** play a chord quality or interval, multiple-choice answer;
   or play a ii–V–I and ask for the key.
6. **Chord voicings** (drop-2 / shell voicings) as fretboard grids for the
   comping side of things.
7. **Practice notes** per exercise (free text, localStorage) and an export of
   history as JSON.
8. **Theme** matching the personal site's light/dark toggle.

---

## 12. Open questions to settle during the build

- Altered / HW-dim spelling on the stave (♯9 vs ♭3) — pick by eye (§5.2).
- Gb vs F# default, and whether progressions in "Gb" should be spelt as F#
  for minor (§5.1).
- Whether Today's session should force `mark done` before Next, or just track it.
- Exactly how much of Settings to expose in v1 vs hard-code.
- Whether the fretboard should show the full neck or default to 12 frets on
  phones.

---

## 13. Summary for the build session

1. Read this file. Create `CLAUDE.md` and `.claude/launch.json` (§8).
2. `git init`, first commit, create the GitHub repo and push (user will drive).
3. Download Tonal and VexFlow into `lib/`.
4. Work through the phases in §7, starting with 0–2.
5. Verify in the browser pane after each phase; keep `tests/test.html` green.
6. When it feels good, ship it with §10.
