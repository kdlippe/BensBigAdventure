// All sounds are made with the Web Audio API, so there are no audio files to load.
// Browsers only allow audio after a tap/click, so call sfx.unlock() from one.

class Sfx {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slideTo = null, delay = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 800, delay = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  star(streak = 0) {
    // each star in a row goes a little higher in pitch
    const base = 784 * Math.pow(2, Math.min(streak, 12) / 12);
    this.tone(base, 0.12, { type: 'triangle', vol: 0.25 });
    this.tone(base * 1.5, 0.22, { type: 'triangle', vol: 0.2, delay: 0.06 });
  }

  jump() {
    this.tone(200, 0.28, { type: 'square', vol: 0.08, slideTo: 560 });
  }

  launch() {
    this.tone(260, 0.5, { type: 'triangle', vol: 0.2, slideTo: 900 });
  }

  land(power = 1) {
    this.noise(0.18, { vol: 0.25 * power, freq: 350 });
    this.tone(110, 0.18, { vol: 0.35 * power, slideTo: 45 });
  }

  crunch() {
    this.noise(0.3, { vol: 0.4, freq: 1500 });
    this.tone(160, 0.12, { type: 'square', vol: 0.08, slideTo: 70 });
  }

  nitroPickup() {
    [523, 784, 1047].forEach((n, i) => this.tone(n, 0.14, { type: 'square', vol: 0.08, delay: i * 0.07 }));
    this.tone(1568, 0.3, { type: 'triangle', vol: 0.18, delay: 0.21 });
  }

  boost() {
    this.noise(0.9, { vol: 0.35, freq: 2500 });
    this.tone(180, 0.8, { type: 'sawtooth', vol: 0.08, slideTo: 720 });
    this.tone(360, 0.6, { type: 'triangle', vol: 0.15, slideTo: 1200, delay: 0.05 });
  }

  squish() {
    this.tone(620, 0.25, { type: 'square', vol: 0.1, slideTo: 110 });
    this.noise(0.2, { vol: 0.3, freq: 600 });
    this.tone(330, 0.3, { type: 'triangle', vol: 0.2, slideTo: 880, delay: 0.12 }); // boing
  }

  bump() {
    this.tone(140, 0.2, { vol: 0.4, slideTo: 60 });
    this.noise(0.12, { vol: 0.25, freq: 500 });
    [988, 1319].forEach((n, i) => this.tone(n, 0.06, { type: 'square', vol: 0.06, delay: 0.05 + i * 0.07 })); // snip snip
  }

  skid() {
    this.noise(0.35, { vol: 0.18, freq: 900 });
  }

  empty() {
    this.tone(220, 0.12, { type: 'square', vol: 0.06 });
    this.tone(165, 0.18, { type: 'square', vol: 0.06, delay: 0.1 });
  }

  record() {
    [784, 988, 1175, 1568].forEach((n, i) => this.tone(n, 0.2, { type: 'triangle', vol: 0.2, delay: 1.1 + i * 0.1 }));
  }

  button() {
    this.tone(520, 0.1, { type: 'triangle', vol: 0.2, slideTo: 780 });
  }

  fanfare() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    const times = [0, 0.15, 0.3, 0.45, 0.65, 0.8];
    notes.forEach((n, i) => {
      this.tone(n, i === notes.length - 1 ? 0.8 : 0.18, { type: 'square', vol: 0.09, delay: times[i] });
      this.tone(n / 2, i === notes.length - 1 ? 0.8 : 0.18, { type: 'triangle', vol: 0.15, delay: times[i] });
    });
  }

  engine(speed, throttle) {
    if (!this.ready) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 380;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(42 + Math.abs(speed) * 0.13 + (throttle ? 10 : 0), t, 0.12);
    this.engineGain.gain.setTargetAtTime(throttle ? 0.07 : 0.03, t, 0.2);
  }

  engineStop() {
    if (this.engineOsc) {
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(0, t, 0.1);
      this.engineOsc.stop(t + 0.5);
      this.engineOsc = null;
    }
  }
}

export const sfx = new Sfx();
