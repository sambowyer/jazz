// The music content. Pure data, no DOM, no Tonal.
// Scales and chords are defined as Tonal interval strings and spelled by
// theory.js, so enharmonics come out right in every key.

// Twelve roots in cycle-of-fourths order with conventional jazz spellings.
// Gb/F# share a slot; theory.js picks the spelling per item (see settings).
export const ROOTS = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"];
export const ENHARMONIC_ROOT = { Gb: "F#", "F#": "Gb", Db: "C#", "C#": "Db", Ab: "G#", "G#": "Ab" };

export const SCALE_GROUPS = [
  { id: "major", name: "Major scale modes" },
  { id: "melodic", name: "Melodic minor modes" },
  { id: "harmonic", name: "Harmonic minor" },
  { id: "symmetric", name: "Symmetric" },
  { id: "pent", name: "Pentatonic / blues" },
  { id: "bebop", name: "Bebop" },
];

// `passing` marks the index (0-based) of a bebop passing tone so the stave and
// fretboard can style it lighter. `essential` = in the default pool.
export const SCALES = [
  // Major modes
  { id: "ionian", name: "Ionian (major)", short: "major", group: "major", intervals: "1P 2M 3M 4P 5P 6M 7M", essential: true, notes: "Over maj7 / 6 chords; the home base." },
  { id: "dorian", name: "Dorian", group: "major", intervals: "1P 2M 3m 4P 5P 6M 7m", essential: true, notes: "The default minor sound over m7 (ii chords, modal tunes)." },
  { id: "phrygian", name: "Phrygian", group: "major", intervals: "1P 2m 3m 4P 5P 6m 7m", essential: true, notes: "Over iii chords; flamenco/Spanish colour with the ♭2." },
  { id: "lydian", name: "Lydian", group: "major", intervals: "1P 2M 3M 4A 5P 6M 7M", essential: true, notes: "Over maj7♯11; brighter than Ionian, no avoid note." },
  { id: "mixolydian", name: "Mixolydian", group: "major", intervals: "1P 2M 3M 4P 5P 6M 7m", essential: true, notes: "The plain dominant sound over 7 chords." },
  { id: "aeolian", name: "Aeolian (natural minor)", group: "major", intervals: "1P 2M 3m 4P 5P 6m 7m", essential: true, notes: "Tonic minor with ♭6; vi chords." },
  { id: "locrian", name: "Locrian", group: "major", intervals: "1P 2m 3m 4P 5d 6m 7m", essential: true, notes: "Over m7♭5 (the ii in a minor ii–V–i)." },
  // Melodic minor modes
  { id: "melodic_minor", name: "Melodic minor", group: "melodic", intervals: "1P 2M 3m 4P 5P 6M 7M", essential: true, notes: "Over mMaj7 and m6; the jazz tonic-minor sound." },
  { id: "dorian_b2", name: "Dorian ♭2", group: "melodic", intervals: "1P 2m 3m 4P 5P 6M 7m", notes: "Melodic minor mode 2; over sus♭9." },
  { id: "lydian_aug", name: "Lydian augmented", group: "melodic", intervals: "1P 2M 3M 4A 5A 6M 7M", notes: "Melodic minor mode 3; over maj7♯5." },
  { id: "lydian_dom", name: "Lydian dominant", group: "melodic", intervals: "1P 2M 3M 4A 5P 6M 7m", essential: true, notes: "Over 7♯11 and non-resolving / tritone-sub dominants." },
  { id: "mixo_b6", name: "Mixolydian ♭6", group: "melodic", intervals: "1P 2M 3M 4P 5P 6m 7m", notes: "Melodic minor mode 5; V7 going to a minor chord (softer than altered)." },
  { id: "locrian_nat2", name: "Locrian ♮2", group: "melodic", intervals: "1P 2M 3m 4P 5d 6m 7m", essential: true, notes: "Over m7♭5 with a natural 9; melodic minor mode 6." },
  // Altered and HW-diminished use 3m (not 2A) for the ♯9 so sharp-side roots
  // don't get double sharps (E altered would have F𝄪); `labels` gives the
  // jazz degree names for display.
  { id: "altered", name: "Altered (super Locrian)", group: "melodic", intervals: "1P 2m 3m 3M 5d 6m 7m", labels: "1 ♭9 ♯9 3 ♭5 ♭13 ♭7", essential: true, notes: "Over 7alt / V7 resolving to minor; melodic minor a semitone up." },
  // Harmonic minor
  { id: "harmonic_minor", name: "Harmonic minor", group: "harmonic", intervals: "1P 2M 3m 4P 5P 6m 7M", notes: "Tonic minor with the raised 7th." },
  { id: "phrygian_dom", name: "Phrygian dominant", group: "harmonic", intervals: "1P 2m 3M 4P 5P 6m 7m", notes: "Harmonic minor mode 5; over V7♭9 resolving to minor." },
  // Symmetric
  { id: "whole_tone", name: "Whole tone", group: "symmetric", intervals: "1P 2M 3M 4A 5A 7m", notes: "Over 7♯5 / 7♭5; only two of them exist." },
  { id: "dim_hw", name: "Diminished (half–whole)", group: "symmetric", intervals: "1P 2m 3m 3M 4A 5P 6M 7m", labels: "1 ♭9 ♯9 3 ♯11 5 13 ♭7", essential: true, notes: "Over 7♭9 / 7♭9♯11 / 13♭9; only three exist." },
  { id: "dim_wh", name: "Diminished (whole–half)", group: "symmetric", intervals: "1P 2M 3m 4P 5d 6m 6M 7M", notes: "Over dim7 chords." },
  // Pentatonic / blues
  { id: "maj_pent", name: "Major pentatonic", group: "pent", intervals: "1P 2M 3M 5P 6M", essential: true, notes: "Over maj7 / 6; also from the 5th of a dominant." },
  { id: "min_pent", name: "Minor pentatonic", group: "pent", intervals: "1P 3m 4P 5P 7m", essential: true, notes: "Over m7; also from the 6th of a maj7 (Lydian colour)." },
  { id: "blues", name: "Blues", group: "pent", intervals: "1P 3m 4P 5d 5P 7m", essential: true, notes: "Minor pentatonic plus the ♭5." },
  // Bebop (8-note). `passing` = index of the added chromatic tone.
  { id: "bebop_dom", name: "Bebop dominant", group: "bebop", intervals: "1P 2M 3M 4P 5P 6M 7m 7M", passing: 7, essential: true, notes: "Mixolydian plus ♮7 passing tone so chord tones land on downbeats." },
  { id: "bebop_maj", name: "Bebop major", group: "bebop", intervals: "1P 2M 3M 4P 5P 5A 6M 7M", passing: 5, notes: "Major plus ♯5 passing tone." },
  { id: "bebop_dor", name: "Bebop Dorian", group: "bebop", intervals: "1P 2M 3m 3M 4P 5P 6M 7m", passing: 3, notes: "Dorian plus ♮3 passing tone." },
];

// Chord types for arpeggios. `intervals` = chord tones root→7th,
// (the ♯9 is written 10m so sharp roots don't get a double sharp; it is
// labelled ♯9 by theory.degreeLabel),
// `extensions` = shown lighter on top, `scales` = ordered chord–scale options
// (first is the default), `essential` = in the default pool.
export const CHORDS = [
  { id: "maj7", symbol: "maj7", name: "Major seventh", intervals: "1P 3M 5P 7M", extensions: "9M 13M", scales: ["ionian", "lydian", "bebop_maj", "maj_pent"], essential: true },
  { id: "maj6", symbol: "6", name: "Major sixth", intervals: "1P 3M 5P 6M", extensions: "9M", scales: ["ionian", "maj_pent", "bebop_maj"], essential: true },
  { id: "dom7", symbol: "7", name: "Dominant seventh", intervals: "1P 3M 5P 7m", extensions: "9M 13M", scales: ["mixolydian", "bebop_dom", "lydian_dom", "blues"], essential: true },
  { id: "dom7sharp11", symbol: "7♯11", name: "Dominant ♯11", intervals: "1P 3M 5P 7m", extensions: "9M 11A 13M", scales: ["lydian_dom", "whole_tone"], essential: true },
  { id: "dom7alt", symbol: "7alt", name: "Altered dominant", intervals: "1P 3M 7m", extensions: "9m 10m 11A 13m", scales: ["altered", "dim_hw"], essential: true },
  { id: "dom7b9", symbol: "7♭9", name: "Dominant ♭9", intervals: "1P 3M 5P 7m", extensions: "9m 13M", scales: ["dim_hw", "phrygian_dom"], essential: false },
  { id: "min7", symbol: "m7", name: "Minor seventh", intervals: "1P 3m 5P 7m", extensions: "9M 11P", scales: ["dorian", "min_pent", "bebop_dor", "aeolian"], essential: true },
  { id: "min6", symbol: "m6", name: "Minor sixth", intervals: "1P 3m 5P 6M", extensions: "9M", scales: ["dorian", "melodic_minor"], essential: true },
  { id: "minmaj7", symbol: "mMaj7", name: "Minor–major seventh", intervals: "1P 3m 5P 7M", extensions: "9M", scales: ["melodic_minor", "harmonic_minor"], essential: true },
  { id: "min7b5", symbol: "m7♭5", name: "Half-diminished", intervals: "1P 3m 5d 7m", extensions: "9M 11P", scales: ["locrian", "locrian_nat2"], essential: true },
  { id: "dim7", symbol: "dim7", name: "Diminished seventh", intervals: "1P 3m 5d 7d", extensions: "", scales: ["dim_wh"], essential: true },
  { id: "aug7", symbol: "7♯5", name: "Augmented dominant", intervals: "1P 3M 5A 7m", extensions: "9M", scales: ["whole_tone", "altered"], essential: false },
];

// Progressions. Each chord: `root` = interval from the key's tonic, `chord` =
// a CHORDS id, `beats`, `numeral` for display, and optional `scales` override
// (context-sensitive chord–scale choice, e.g. V7 going to minor → altered).
// `keyWeights` (optional) biases the randomiser toward keys the tune is
// actually called in.
export const PROGRESSIONS = [
  {
    id: "ii_V_I", name: "ii–V–I (major)", keyMode: "major", essential: true,
    bars: [
      [{ root: "2M", chord: "min7", beats: 4, numeral: "ii" }],
      [{ root: "5P", chord: "dom7", beats: 4, numeral: "V", scales: ["mixolydian", "bebop_dom", "altered", "dim_hw"] }],
      [{ root: "1P", chord: "maj7", beats: 4, numeral: "I" }],
      [{ root: "1P", chord: "maj6", beats: 4, numeral: "I" }],
    ],
  },
  {
    id: "ii_V_i_minor", name: "ii–V–i (minor)", keyMode: "minor", essential: true,
    bars: [
      [{ root: "2M", chord: "min7b5", beats: 4, numeral: "iiø" }],
      [{ root: "5P", chord: "dom7alt", beats: 4, numeral: "V", scales: ["altered", "dim_hw", "phrygian_dom"] }],
      [{ root: "1P", chord: "minmaj7", beats: 4, numeral: "i" }],
      [{ root: "1P", chord: "min6", beats: 4, numeral: "i" }],
    ],
  },
  {
    id: "I_vi_ii_V", name: "I–VI–ii–V", keyMode: "major", essential: true,
    bars: [
      [{ root: "1P", chord: "maj7", beats: 2, numeral: "I" }, { root: "6M", chord: "dom7", beats: 2, numeral: "VI", scales: ["altered", "dim_hw", "mixolydian"] }],
      [{ root: "2M", chord: "min7", beats: 2, numeral: "ii" }, { root: "5P", chord: "dom7", beats: 2, numeral: "V", scales: ["mixolydian", "bebop_dom", "altered"] }],
    ],
  },
  {
    id: "I_vi_ii_V_min", name: "I–vi–ii–V (minor vi)", keyMode: "major", essential: false,
    bars: [
      [{ root: "1P", chord: "maj7", beats: 2, numeral: "I" }, { root: "6M", chord: "min7", beats: 2, numeral: "vi", scales: ["aeolian", "dorian", "min_pent"] }],
      [{ root: "2M", chord: "min7", beats: 2, numeral: "ii" }, { root: "5P", chord: "dom7", beats: 2, numeral: "V", scales: ["mixolydian", "bebop_dom", "altered"] }],
    ],
  },
  {
    id: "iii_vi_ii_V", name: "iii–VI–ii–V", keyMode: "major", essential: true,
    bars: [
      [{ root: "3M", chord: "min7", beats: 2, numeral: "iii", scales: ["phrygian", "dorian", "min_pent"] }, { root: "6M", chord: "dom7", beats: 2, numeral: "VI", scales: ["altered", "dim_hw", "mixolydian"] }],
      [{ root: "2M", chord: "min7", beats: 2, numeral: "ii" }, { root: "5P", chord: "dom7", beats: 2, numeral: "V", scales: ["mixolydian", "bebop_dom", "altered"] }],
    ],
  },
  {
    id: "jazz_blues", name: "Jazz blues", keyMode: "major", essential: true,
    keyWeights: { F: 4, Bb: 4, C: 2, G: 2, Eb: 2 },
    bars: [
      [{ root: "1P", chord: "dom7", beats: 4, numeral: "I7", scales: ["mixolydian", "bebop_dom", "blues"] }],
      [{ root: "4P", chord: "dom7", beats: 4, numeral: "IV7", scales: ["mixolydian", "bebop_dom", "lydian_dom"] }],
      [{ root: "1P", chord: "dom7", beats: 4, numeral: "I7", scales: ["mixolydian", "bebop_dom", "blues"] }],
      [{ root: "5P", chord: "min7", beats: 2, numeral: "v" }, { root: "1P", chord: "dom7", beats: 2, numeral: "I7", scales: ["mixolydian", "bebop_dom", "altered"] }],
      [{ root: "4P", chord: "dom7", beats: 4, numeral: "IV7", scales: ["mixolydian", "bebop_dom", "lydian_dom"] }],
      [{ root: "4A", chord: "dim7", beats: 4, numeral: "♯iv°" }],
      [{ root: "1P", chord: "dom7", beats: 4, numeral: "I7", scales: ["mixolydian", "bebop_dom", "blues"] }],
      [{ root: "3M", chord: "min7", beats: 2, numeral: "iii", scales: ["phrygian", "dorian"] }, { root: "6M", chord: "dom7", beats: 2, numeral: "VI", scales: ["altered", "dim_hw", "mixolydian"] }],
      [{ root: "2M", chord: "min7", beats: 4, numeral: "ii" }],
      [{ root: "5P", chord: "dom7", beats: 4, numeral: "V", scales: ["mixolydian", "bebop_dom", "altered"] }],
      [{ root: "1P", chord: "dom7", beats: 2, numeral: "I7", scales: ["mixolydian", "bebop_dom", "blues"] }, { root: "6M", chord: "dom7", beats: 2, numeral: "VI", scales: ["altered", "dim_hw"] }],
      [{ root: "2M", chord: "min7", beats: 2, numeral: "ii" }, { root: "5P", chord: "dom7", beats: 2, numeral: "V", scales: ["mixolydian", "bebop_dom", "altered"] }],
    ],
  },
  {
    id: "backdoor", name: "Backdoor ii–V", keyMode: "major", essential: false,
    bars: [
      [{ root: "4P", chord: "min7", beats: 4, numeral: "iv" }],
      [{ root: "7m", chord: "dom7", beats: 4, numeral: "♭VII", scales: ["lydian_dom", "mixolydian"] }],
      [{ root: "1P", chord: "maj7", beats: 4, numeral: "I" }],
      [{ root: "1P", chord: "maj6", beats: 4, numeral: "I" }],
    ],
  },
  {
    id: "tritone_sub", name: "Tritone-sub ii–V", keyMode: "major", essential: false,
    bars: [
      [{ root: "2M", chord: "min7", beats: 4, numeral: "ii" }],
      [{ root: "2m", chord: "dom7", beats: 4, numeral: "♭II7", scales: ["lydian_dom", "mixolydian"] }],
      [{ root: "1P", chord: "maj7", beats: 4, numeral: "I" }],
      [{ root: "1P", chord: "maj6", beats: 4, numeral: "I" }],
    ],
  },
  {
    id: "I_IV_vamp", name: "I–IV vamp (Dorian)", keyMode: "minor", essential: false,
    bars: [
      [{ root: "1P", chord: "min7", beats: 4, numeral: "i", scales: ["dorian", "min_pent", "bebop_dor"] }],
      [{ root: "4P", chord: "dom7", beats: 4, numeral: "IV7", scales: ["mixolydian", "lydian_dom"] }],
    ],
  },
];

// Session templates: blocks of { type, count, keys, minutes }.
// `keys` = number of keys per item (progressions get 2). The voicing block
// is skipped (and its minutes given to free play) when the voicing pool is empty.
export const SESSION_TEMPLATES = {
  15: [
    { type: "scale", count: 1, minutes: 3 },
    { type: "arpeggio", count: 1, minutes: 3 },
    { type: "voicing", count: 1, minutes: 4 },
    { type: "progression", count: 1, keys: 1, minutes: 4 },
    { type: "free", minutes: 1 },
  ],
  25: [
    { type: "scale", count: 2, minutes: 5 },
    { type: "arpeggio", count: 2, minutes: 4 },
    { type: "voicing", count: 1, minutes: 6 },
    { type: "progression", count: 1, keys: 2, minutes: 7 },
    { type: "free", minutes: 3 },
  ],
  30: [
    { type: "scale", count: 2, minutes: 6 },
    { type: "arpeggio", count: 3, minutes: 6 },
    { type: "voicing", count: 1, minutes: 6 },
    { type: "progression", count: 1, keys: 2, minutes: 9 },
    { type: "free", minutes: 3 },
  ],
};

// Chord voicing types for the voicings block (see theory.VOICING_TYPES).
export const VOICING_POOL_OPTIONS = [
  { id: "drop2", name: "Drop-2" },
  { id: "drop3", name: "Drop-3" },
  { id: "shell", name: "Shell (1–3–7)" },
];

export const DEFAULT_SETTINGS = {
  sessionLength: 25,             // 15 | 25 | 30
  keyMode: "random",             // random | cycle | fixed
  fixedKey: "C",
  scalePool: SCALES.filter((s) => s.essential).map((s) => s.id),
  chordPool: CHORDS.filter((c) => c.essential).map((c) => c.id),
  progressionPool: PROGRESSIONS.filter((p) => p.essential).map((p) => p.id),
  voicingPool: ["drop2", "drop3", "shell"],
  gbSpelling: "auto",            // auto | Gb | F#
  fretLabels: "names",           // names | degrees | none
  fretCount: 15,                 // 12 | 15 | 22
  showKeySig: false,             // key signature for major-mode scales
  progressionView: "guide",      // guide | chords | voicings
  progressionVoicing: "drop2",   // voicing type for the progression "voicings" view
  progressionSet: 2,             // string-set index for it (2 = strings 4–1 for drop-2)
  theme: "dark",                 // dark | light
  weightByHistory: true,
  metronome: { bpm: 120, timeSig: 4, mode: "all", accent: true, dropout: 0 },
};

export const scaleById = (id) => SCALES.find((s) => s.id === id);
export const chordById = (id) => CHORDS.find((c) => c.id === id);
export const progressionById = (id) => PROGRESSIONS.find((p) => p.id === id);
