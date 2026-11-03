// 모든 소리는 Web Audio로 직접 합성한다. 저작권 걱정 없는 웨스트민스터 차임을 수업 종으로 쓴다.
const CHIME = [
  [659.25, 0], [523.25, 0.6], [587.33, 1.2], [392.0, 1.8],
  [392.0, 3.0], [587.33, 3.6], [659.25, 4.2], [523.25, 4.8],
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.volume = 0.7;
    this.birdTimer = null;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    // 교실 밖 바람 소리
    const length = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    this.noise = buffer;
    const wind = this.ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.16;
    wind.connect(filter).connect(gain).connect(this.master);
    wind.start();
  }

  setOn(on) {
    this.ensure();
    this.on = on;
    this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.15);
    clearTimeout(this.birdTimer);
    if (on) this.scheduleBird();
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.ctx && this.on) this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  stop() {
    clearTimeout(this.birdTimer);
    if (this.ctx) this.ctx.close();
    this.ctx = null;
    this.on = false;
  }

  scheduleBird() {
    this.birdTimer = setTimeout(() => {
      if (!this.on) return;
      this.bird();
      this.scheduleBird();
    }, 3500 + Math.random() * 9000);
  }

  tone(freq, start, duration, level, type = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
    return osc;
  }

  bird() {
    const now = this.ctx.currentTime;
    const base = 2600 + Math.random() * 1500;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const start = now + i * 0.17;
      const osc = this.tone(base, start, 0.11, 0.022);
      osc.frequency.setValueAtTime(base * 0.86, start);
      osc.frequency.exponentialRampToValueAtTime(base * 1.14, start + 0.08);
    }
  }

  chime() {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime + 0.05;
    for (const [freq, at] of CHIME) {
      this.tone(freq, now + at, 1.9, 0.2);
      this.tone(freq * 2, now + at, 0.9, 0.06);
      this.tone(freq * 3.01, now + at, 0.4, 0.025);
    }
  }

  burst(duration, level, frequency, type = 'bandpass', when = 0) {
    if (!this.ctx || !this.on) return;
    const start = this.ctx.currentTime + when;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 3;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start, Math.random() * 3);
    source.stop(start + duration + 0.02);
  }

  clap() {
    for (let i = 0; i < 6; i++) this.burst(0.09, 0.9, 1700, 'bandpass', i * 0.21);
  }

  whoosh() { this.burst(0.5, 0.55, 2300); }

  hop() {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    const osc = this.tone(300, now, 0.2, 0.09, 'triangle');
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.16);
  }

  ding() {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    this.tone(784, now, 0.25, 0.14);
    this.tone(1047, now + 0.13, 0.4, 0.14);
  }

  fanfare() {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => this.tone(freq, now + i * 0.13, 0.5, 0.14));
  }

  pop() {
    if (!this.ctx || !this.on) return;
    const osc = this.tone(620, this.ctx.currentTime, 0.14, 0.08, 'triangle');
    osc.frequency.exponentialRampToValueAtTime(980, this.ctx.currentTime + 0.1);
  }
}
