# jazz — daily jazz guitar practice

A small static web app that generates a randomised 15–30 minute jazz guitar
practice session each day: a couple of scales, a few arpeggios and a chord
progression, each in a random key, shown on a stave and a fretboard diagram,
with a built-in metronome.

- **Today** — today's session (same all day; 🎲 reroll for a new one; the URL
  holds the seed so it can be bookmarked). Prev/Next, a per-exercise timer and
  a "mark done" button that feeds a practice log.
- **Explore** — pick any root × scale / chord type / progression.
- **Settings** — which scales/chords/progressions go in the pool, key-selection
  mode (random / cycle of fourths / one key), session length, display prefs.
- **Metronome** — Web Audio look-ahead scheduler, tap tempo, 4/4 or 3/4,
  "2 & 4 only" mode, drop-out bars. Keyboard: `Space`, `↑/↓`, `T`.

No build step, no backend, no accounts. Vanilla ES modules plus vendored
[Tonal](https://github.com/tonaljs/tonal) (music theory) and
[VexFlow](https://www.vexflow.com/) (notation). History and settings live in
`localStorage`.

## Run locally

ES modules don't load over `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>. Tests: <http://localhost:8000/tests/test.html>.

## Deploy

The app is copied into the personal site with `./deploy-to-site.sh` (see
`PLAN.md` §10). Everything uses relative paths so it works at `/` and `/jazz/`.
