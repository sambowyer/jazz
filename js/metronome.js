// Web Audio metronome with a look-ahead scheduler ("A Tale of Two Clocks").
// A setInterval every ~25 ms schedules any clicks in the next ~100 ms against
// audioCtx.currentTime, so timing doesn't depend on the JS event loop.

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

/** Pure helper (unit-testable): times of the next `n` beats from `start` at `bpm`. */
export function nextBeatTimes(start, bpm, n) {
  const dt = 60 / bpm;
  return Array.from({ length: n }, (_, i) => start + i * dt);
}

export class Metronome {
  /**
   * @param {object} o
   * @param {number} o.bpm
   * @param {number} o.timeSig   beats per bar (4 or 3)
   * @param {"all"|"24"} o.mode  click every beat, or only 2 & 4
   * @param {boolean} o.accent   accent beat 1
   * @param {number} o.dropout   0 = off, N = N bars on / N bars off
   * @param {(info:{beat:number,accent:boolean,muted:boolean,bar:number})=>void} [o.onBeat]
   */
  constructor(o) {
    this.bpm = o.bpm || 120;
    this.timeSig = o.timeSig || 4;
    this.mode = o.mode || "all";
    this.accent = o.accent !== false;
    this.dropout = o.dropout || 0;
    this.onBeat = o.onBeat || (() => {});
    this.running = false;
    this.ctx = null;
    this.timer = null;
    this.queue = [];
    this.taps = [];
  }

  /** Create/resume the AudioContext — must be called from a user gesture on iOS. */
  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  start() {
    if (this.running) return;
    this.ensureContext();
    this.running = true;
    this.beat = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.queue = [];
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.raf = requestAnimationFrame(() => this.tick());
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.queue = [];
  }

  toggle() { this.running ? this.stop() : this.start(); }

  set(opts) {
    if (opts.bpm != null) this.bpm = Math.min(240, Math.max(40, Math.round(opts.bpm)));
    if (opts.timeSig != null) { this.timeSig = opts.timeSig; this.beat = 0; }
    if (opts.mode != null) this.mode = opts.mode;
    if (opts.accent != null) this.accent = opts.accent;
    if (opts.dropout != null) { this.dropout = opts.dropout; this.bar = 0; }
  }

  /** Tap tempo: average of the last 4 intervals. Returns the new bpm or null. */
  tap() {
    const now = performance.now();
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2000) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 5) this.taps.shift();
    if (this.taps.length < 2) return null;
    const ivs = [];
    for (let i = 1; i < this.taps.length; i++) ivs.push(this.taps[i] - this.taps[i - 1]);
    const avg = ivs.reduce((a, b) => a + b, 0) / ivs.length;
    this.set({ bpm: 60000 / avg });
    return this.bpm;
  }

  schedule() {
    const ctx = this.ctx;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const beat = this.beat;
      const isOne = beat === 0;
      const muted = this.dropout > 0 && Math.floor(this.bar / this.dropout) % 2 === 1;
      const clicks = this.mode === "24" ? beat % 2 === 1 : true;
      const accent = isOne && this.accent && this.mode !== "24";
      if (clicks && !muted) this.click(this.nextTime, accent);
      this.queue.push({ time: this.nextTime, beat, accent, muted: muted || !clicks, bar: this.bar });
      this.nextTime += 60 / this.bpm;
      this.beat = (this.beat + 1) % this.timeSig;
      if (this.beat === 0) this.bar++;
    }
  }

  click(time, accent) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = accent ? "square" : "sine";
    osc.frequency.value = accent ? 1000 : 800;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  /** Visual beat callback, driven by rAF against the audio clock. */
  tick() {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    while (this.queue.length && this.queue[0].time <= now) {
      this.onBeat(this.queue.shift());
    }
    this.raf = requestAnimationFrame(() => this.tick());
  }
}
