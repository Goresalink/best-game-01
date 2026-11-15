// audio.js — every sound is synthesized with WebAudio, no audio files.
// A tiny synth: oscillators + filtered noise, plus a quiet bass pulse that
// acts as the game's music. Audio starts only after the first user gesture
// (the browser rule), and M toggles mute at any time.
export const AudioSys = {
  ctx: null,
  master: null,
  musicGain: null,
  muted: false,
  musicTimer: null,
  musicStep: 0,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.14;
      this.musicGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  },

  // A short oscillator blip with a pitch slide and an exponential decay.
  blip(freqA, freqB, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freqA, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  },

  // Filtered white noise, for explosions, hits and dashes.
  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch {
      // Ignore audio failures.
    }
  },

  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'shoot':
        this.blip(720, 320, 0.07, 'square', 0.08);
        break;
      case 'hit':
        this.blip(220, 140, 0.05, 'triangle', 0.12);
        break;
      case 'die':
        this.noise(0.18, 0.22, 900);
        this.blip(320, 60, 0.16, 'sawtooth', 0.12);
        break;
      case 'gem':
        this.blip(880 + Math.random() * 120, 1320, 0.08, 'sine', 0.1);
        break;
      case 'hurt':
        this.blip(160, 55, 0.28, 'sawtooth', 0.28);
        this.noise(0.2, 0.2, 500);
        break;
      case 'dash':
        this.noise(0.16, 0.16, 2400);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => {
          setTimeout(() => this.blip(f, f, 0.16, 'sine', 0.16), i * 70);
        });
        break;
      case 'pickup':
        this.blip(660, 990, 0.12, 'sine', 0.16);
        break;
      case 'bomb':
        this.noise(0.6, 0.4, 700);
        this.blip(90, 30, 0.5, 'sine', 0.3);
        break;
      case 'boss':
        this.blip(70, 38, 0.7, 'sawtooth', 0.3);
        this.noise(0.5, 0.2, 300);
        break;
      case 'waveclear':
        [392, 523, 659].forEach((f, i) => {
          setTimeout(() => this.blip(f, f, 0.14, 'triangle', 0.14), i * 80);
        });
        break;
      case 'victory':
        [523, 659, 784, 1047, 1319].forEach((f, i) => {
          setTimeout(() => this.blip(f, f, 0.3, 'triangle', 0.18), i * 120);
        });
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => {
          setTimeout(() => this.blip(f, f * 0.9, 0.35, 'sawtooth', 0.14), i * 160);
        });
        break;
      case 'click':
        this.blip(600, 500, 0.05, 'sine', 0.12);
        break;
      default:
        break;
    }
  },

  // A slow, quiet bass pulse in A minor. It is the whole "music": two notes
  // a bar apart, played on a timer while the game is running.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.41, 49];
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      this.blip(f, f, 0.9, 'sine', 0.1);
      if (this.musicStep % 4 === 0) this.blip(f * 2, f * 2, 0.4, 'triangle', 0.05);
    }, 480);
  },

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  },
};
