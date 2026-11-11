// Background music in a 16-bit (SNES-era) style, made with the Web Audio API:
// a square-wave lead with a little vibrato, a round triangle bass, a soft
// string pad, punchy drums, and the trademark echo. Four original songs, one
// per level look. Nothing is loaded from files.
//
// music.play('meadow' | 'spooky' | 'desert' | 'snow'), music.stop(), music.duck()
// It shares the sound effects' AudioContext, so call it after sfx.unlock().

import { sfx } from './sound.js';

const VOLUME = 0.55; // overall music level (the sound effects stay louder)
const LOOKAHEAD = 0.15; // schedule notes this far ahead (seconds)

// ---------------------------------------------------------------- the songs
// Melodies are written as "note:length" with lengths in 16th notes; "-" is a
// rest. Each song is 8 bars of 16 sixteenths, with one chord per bar.

const SONGS = {
  // bouncy and sunny, C major
  meadow: {
    bpm: 140,
    lead: 'pulse',
    style: 'pop',
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    melody: `
      E5:4 G5:2 E5:2 C5:4 D5:4
      D5:2 E5:2 D5:2 B4:2 G4:4 -:4
      C5:4 E5:2 A5:2 G5:4 E5:4
      F5:2 E5:2 D5:2 C5:2 A4:4 C5:4
      E5:4 G5:2 C6:2 B5:4 G5:4
      A5:2 G5:2 F5:2 D5:2 B4:4 D5:4
      C5:2 D5:2 E5:2 F5:2 A5:4 G5:4
      G5:6 F5:2 E5:4 D5:4`,
  },
  // creepy-cute, D minor, music-box bells and a ticking clock
  spooky: {
    bpm: 104,
    lead: 'bell',
    style: 'tick',
    chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'],
    melody: `
      D5:2 F5:2 A5:2 F5:2 D6:4 C#6:4
      D6:2 Bb5:2 F5:2 Bb5:2 D6:6 -:2
      G5:2 Bb5:2 D6:2 Bb5:2 G5:4 A5:4
      A5:2 C#6:2 E6:2 C#6:2 A5:8
      F5:2 E5:2 F5:2 A5:2 D6:4 A5:4
      Bb5:2 A5:2 G5:2 F5:2 D5:8
      E5:2 G5:2 Bb5:2 D6:2 C#6:4 E6:4
      D6:4 C#6:4 A5:8`,
  },
  // cowboy trot, A minor, whistled tune over a galloping bass
  desert: {
    bpm: 118,
    lead: 'whistle',
    style: 'gallop',
    chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'],
    melody: `
      A4:4 C5:2 E5:2 A5:6 G5:2
      G5:2 F5:2 E5:2 D5:2 B4:4 D5:4
      C5:2 D5:2 E5:2 F5:2 A5:4 G5:4
      G#5:2 F5:2 E5:4 -:8
      E5:2 A5:2 C6:2 B5:2 A5:4 E5:4
      D5:2 G5:2 B5:2 A5:2 G5:4 D5:4
      C5:2 F5:2 A5:2 G5:2 F5:4 E5:2 D5:2
      E5:4 G#5:4 B5:4 E5:4`,
  },
  // snowy sleigh ride, G major: twinkly music-box tune, oom-pah bass, jingles
  snow: {
    bpm: 132,
    lead: 'bell',
    style: 'sleigh',
    chords: ['G', 'C', 'D', 'G', 'Em', 'C', 'D', 'G'],
    melody: `
      B4:2 D5:2 G5:4 F#5:2 G5:2 A5:4
      G5:2 E5:2 C5:4 E5:4 -:4
      F#5:2 A5:2 D6:4 C6:2 B5:2 A5:4
      B5:6 A5:2 G5:8
      E5:2 G5:2 B5:4 A5:2 G5:2 E5:4
      C5:2 E5:2 G5:4 A5:4 G5:4
      A5:2 B5:2 C6:2 B5:2 A5:4 F#5:4
      G5:8 D5:4 B4:4`,
  },
};

// ---------------------------------------------------------------- notes
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);
const midiOf = (name, octave) => 12 * (octave + 1) + NOTE[name];

function parseMelody(text) {
  const events = [];
  let step = 0;
  for (const tok of text.trim().split(/\s+/)) {
    const [n, d] = tok.split(':');
    const len = Number(d);
    if (n !== '-') {
      const m = n.match(/^([A-G][#b]?)(\d)$/);
      events.push({ step, midi: midiOf(m[1], Number(m[2])), len });
    }
    step += len;
  }
  return events;
}

// chord name -> root (octave 3) and triad
function chordNotes(name) {
  const m = name.match(/^([A-G][#b]?)(m|dim)?$/);
  const root = midiOf(m[1], 3);
  const third = m[2] === 'm' || m[2] === 'dim' ? 3 : 4;
  const fifth = m[2] === 'dim' ? 6 : 7;
  return { root, triad: [root, root + third, root + fifth] };
}

// Turn a song into a list of things to play on each 16th-note step.
function compile(song) {
  const steps = song.chords.length * 16;
  const at = Array.from({ length: steps }, () => []);
  for (const e of parseMelody(song.melody)) at[e.step].push({ v: 'lead', midi: e.midi, len: e.len });

  song.chords.forEach((name, bar) => {
    const { root, triad } = chordNotes(name);
    const b = bar * 16;
    // string pad: the chord held for the whole bar
    at[b].push({ v: 'pad', notes: triad.map((n) => n + 12), len: 16 });
    // bass
    if (song.style === 'pop') {
      for (let i = 0; i < 16; i += 2) at[b + i].push({ v: 'bass', midi: root - 12 + (i % 4 === 2 ? 12 : 0), len: 2 });
    } else if (song.style === 'tick') {
      for (const [i, len] of [[0, 4], [6, 2], [8, 4], [14, 2]]) at[b + i].push({ v: 'bass', midi: root - 12, len });
    } else if (song.style === 'sleigh') {
      // oom-pah: root, fifth, root, fifth
      for (let beat = 0; beat < 4; beat++) at[b + beat * 4].push({ v: 'bass', midi: root - 12 + (beat % 2 ? 7 : 0), len: 3 });
    } else {
      // gallop: da-da-dum, da-da-dum
      for (let beat = 0; beat < 4; beat++) {
        const n = root - 12 + (beat % 2 ? 7 : 0);
        at[b + beat * 4].push({ v: 'bass', midi: n, len: 2 });
        at[b + beat * 4 + 2].push({ v: 'bass', midi: n, len: 1 });
        at[b + beat * 4 + 3].push({ v: 'bass', midi: n, len: 1 });
      }
    }
    // drums
    for (let i = 0; i < 16; i++) {
      const s = b + i;
      if (song.style === 'pop') {
        if (i === 0 || i === 8 || i === 10) at[s].push({ v: 'kick' });
        if (i === 4 || i === 12) at[s].push({ v: 'snare' });
        if (i % 2 === 0) at[s].push({ v: 'hat' });
      } else if (song.style === 'tick') {
        if (i === 0 || i === 8) at[s].push({ v: 'kick' });
        if (i === 12 && bar % 2 === 1) at[s].push({ v: 'snare' });
        if (i % 4 === 0) at[s].push({ v: 'tick' });
      } else if (song.style === 'sleigh') {
        // sleigh bells: a jingle on every 8th, with a soft backbeat
        if (i === 0 || i === 8) at[s].push({ v: 'kick' });
        if (i === 4 || i === 12) at[s].push({ v: 'snare' });
        if (i % 2 === 0) at[s].push({ v: 'hat' });
        if (i % 4 === 2) at[s].push({ v: 'tick' });
      } else {
        if (i === 0 || i === 8) at[s].push({ v: 'kick' });
        if (i % 4 === 2) at[s].push({ v: 'clop', high: i % 8 === 2 });
        if (i % 4 === 3) at[s].push({ v: 'clop', high: false });
        if (i === 12) at[s].push({ v: 'snare' });
      }
    }
  });
  return { steps, at, stepDur: 60 / song.bpm / 4 };
}

// ---------------------------------------------------------------- player
class Music {
  constructor() {
    this.name = null;
    this.timer = null;
  }

  // build the mixer (lazily, once the AudioContext exists)
  graph() {
    const ctx = sfx.ctx;
    if (!ctx) return false;
    if (this.out) return true;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = VOLUME;
    this.out.connect(sfx.master);
    // the 16-bit echo: a feedback delay mixed in quietly
    this.echo = ctx.createDelay(1);
    this.echoFb = ctx.createGain();
    this.echoFb.gain.value = 0.3;
    this.echoWet = ctx.createGain();
    this.echoWet.gain.value = 0.25;
    this.echo.connect(this.echoFb).connect(this.echo);
    this.echo.connect(this.echoWet).connect(this.out);
    this.bus = ctx.createGain(); // instruments go here
    this.bus.connect(this.out);
    this.bus.connect(this.echo);
    // noise for the drums
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  play(name) {
    if (this.name === name && this.timer) return;
    this.stop();
    this.name = name;
    if (!SONGS[name] || !this.graph()) return;
    const song = compile(SONGS[name]);
    this.song = song;
    this.echo.delayTime.value = song.stepDur * 3; // echo lands on a dotted 8th
    this.step = 0;
    this.next = this.ctx.currentTime + 0.1;
    const tick = () => {
      while (this.next < this.ctx.currentTime + LOOKAHEAD) {
        for (const ev of song.at[this.step]) this.voice(ev, this.next, song.stepDur);
        this.next += song.stepDur;
        this.step = (this.step + 1) % song.steps;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.name = null;
  }

  // dip the music for a moment (e.g. under the finish fanfare)
  duck(seconds = 2.5) {
    if (!this.out) return;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(VOLUME * 0.25, t, 0.05);
    this.out.gain.setTargetAtTime(VOLUME, t + seconds, 0.4);
  }

  // ---- instruments
  env(gainNode, t, peak, attack, hold, release) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.setValueAtTime(peak, t + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return t + attack + hold + release + 0.05;
  }

  osc(type, f, t, end, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  }

  vibrato(osc, t, end, depth, rate = 5.5) {
    const lfo = this.ctx.createOscillator();
    const amt = this.ctx.createGain();
    lfo.frequency.value = rate;
    amt.gain.value = depth;
    lfo.connect(amt).connect(osc.detune);
    lfo.start(t + 0.12); // vibrato comes in after the note starts, like a singer
    lfo.stop(end);
  }

  noiseHit(t, dur, peak, filterType, f, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = f;
    filt.Q.value = q;
    const g = this.ctx.createGain();
    src.connect(filt).connect(g).connect(this.bus);
    const end = this.env(g, t, peak, 0.002, 0, dur);
    src.start(t, Math.random() * 0.5);
    src.stop(end);
  }

  voice(ev, t, stepDur) {
    const ctx = this.ctx;
    const len = (ev.len || 1) * stepDur;
    switch (ev.v) {
      case 'lead': {
        const g = ctx.createGain();
        const f = freq(ev.midi);
        if (this.song && SONGS[this.name].lead === 'bell') {
          // music box: bright triangle + a soft octave above, ringing out
          g.connect(this.bus);
          const end = this.env(g, t, 0.13, 0.005, 0, Math.max(0.6, len * 1.4));
          this.osc('triangle', f, t, end, g);
          const g2 = ctx.createGain();
          g2.gain.value = 0.35;
          g2.connect(g);
          this.osc('sine', f * 2, t, end, g2);
        } else if (SONGS[this.name].lead === 'whistle') {
          // whistle: pure sine with a wide vibrato
          g.connect(this.bus);
          const end = this.env(g, t, 0.16, 0.03, len * 0.75, 0.12);
          const o = this.osc('sine', f, t, end, g);
          this.vibrato(o, t, end, 22, 6);
        } else {
          // pulse lead: square wave, softened, with a little vibrato
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 2600;
          lp.connect(g).connect(this.bus);
          const end = this.env(g, t, 0.075, 0.01, len * 0.7, 0.1);
          const o = this.osc('square', f, t, end, lp);
          this.vibrato(o, t, end, 10);
        }
        break;
      }
      case 'bass': {
        const g = ctx.createGain();
        g.connect(this.bus);
        const end = this.env(g, t, 0.24, 0.005, len * 0.55, 0.06);
        this.osc('triangle', freq(ev.midi), t, end, g);
        break;
      }
      case 'pad': {
        // strings: two detuned saws through a soft filter, slow fade in
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1300;
        const g = ctx.createGain();
        lp.connect(g).connect(this.bus);
        const end = this.env(g, t, 0.022, 0.18, len - 0.3, 0.25);
        for (const n of ev.notes) {
          this.osc('sawtooth', freq(n), t, end, lp, -7);
          this.osc('sawtooth', freq(n), t, end, lp, 7);
        }
        break;
      }
      case 'kick': {
        const g = ctx.createGain();
        g.connect(this.bus);
        const end = this.env(g, t, 0.5, 0.002, 0, 0.18);
        const o = this.osc('sine', 150, t, end, g);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        break;
      }
      case 'snare':
        this.noiseHit(t, 0.16, 0.22, 'bandpass', 1900, 0.8);
        this.noiseHit(t, 0.06, 0.12, 'lowpass', 400);
        break;
      case 'hat':
        this.noiseHit(t, 0.035, 0.06, 'highpass', 7500);
        break;
      case 'tick': {
        // clock tick: a tiny high click
        const g = ctx.createGain();
        g.connect(this.bus);
        const end = this.env(g, t, 0.07, 0.001, 0, 0.03);
        this.osc('square', 2400, t, end, g);
        break;
      }
      case 'clop': {
        // coconut-shell hooves: a short hollow knock
        const g = ctx.createGain();
        g.connect(this.bus);
        const end = this.env(g, t, ev.high ? 0.16 : 0.11, 0.001, 0, 0.05);
        const o = this.osc('sine', ev.high ? 1050 : 820, t, end, g);
        o.frequency.exponentialRampToValueAtTime(ev.high ? 700 : 560, t + 0.05);
        break;
      }
      default:
        break;
    }
  }
}

export const music = new Music();
