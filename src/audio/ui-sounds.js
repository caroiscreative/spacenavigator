

const MASTER_VOL = 0.22;

let _ctx     = null;
let _master  = null;
let _enabled = true;

function boot() {
  if (_ctx) return;
  _ctx    = new (window.AudioContext || window.webkitAudioContext)();
  _master = _ctx.createGain();
  _master.gain.value = MASTER_VOL;
  _master.connect(_ctx.destination);
}

function play(fn) {
  if (!_enabled) return;
  try {
    boot();

    const go = () => { try { fn(_ctx, _master); } catch (_) {} };
    if (_ctx.state === 'suspended') {
      _ctx.resume().then(go);
    } else {
      go();
    }
  } catch (_) {}
}

function mkOsc(ctx, type, freq) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = freq;
  return o;
}

function mkGain(ctx, val = 0) {
  const g = ctx.createGain(); g.gain.value = val; return g;
}

function env(g, peak, attack, total, now) {
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + total);
}

let _noiseBuf = null;
function noiseBuf(ctx) {
  if (_noiseBuf && _noiseBuf.sampleRate === ctx.sampleRate) return _noiseBuf;
  const len  = ctx.sampleRate * 0.5;
  _noiseBuf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const d    = _noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}

export function createUISounds() {

  function hover() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(ctx);
      const flt  = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 520;
      flt.Q.value = 3;
      const g = mkGain(ctx);
      env(g, 0.18, 0.001, 0.028, now);
      src.connect(flt); flt.connect(g); g.connect(out);
      src.start(now); src.stop(now + 0.032);
    });
  }

  function select() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'sine', 240);
      const g   = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(480, now + 0.07);
      env(g, 0.28, 0.005, 0.22, now);
      o.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.24);
    });
  }

  function toggle() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'sine', 280);
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 500;
      const g   = mkGain(ctx);
      env(g, 0.14, 0.003, 0.060, now);
      o.connect(flt); flt.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.065);
    });
  }

  function open() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'sine', 120);
      const g   = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(260, now + 0.16);
      env(g, 0.20, 0.012, 0.22, now);
      o.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.24);
    });
  }

  function close() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'sine', 260);
      const g   = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(100, now + 0.13);
      env(g, 0.18, 0.006, 0.18, now);
      o.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.20);
    });
  }

  function flyTo() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(ctx);
      const flt  = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(80, now);
      flt.frequency.exponentialRampToValueAtTime(1200, now + 0.28);
      flt.Q.value = 1.4;
      const gn = mkGain(ctx);
      env(gn, 0.24, 0.03, 0.30, now);
      src.connect(flt); flt.connect(gn); gn.connect(out);
      src.start(now); src.stop(now + 0.34);

      const o  = mkOsc(ctx, 'sine', 60);
      const g2 = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(320, now + 0.22);
      env(g2, 0.18, 0.018, 0.26, now);
      o.connect(g2); g2.connect(out);
      o.start(now); o.stop(now + 0.28);
    });
  }

  function conjWarning() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      [0, 0.15].forEach(t => {
        const o = mkOsc(ctx, 'sine', 280);
        const g = mkGain(ctx);
        env(g, 0.30, 0.006, 0.10, now + t);
        o.connect(g); g.connect(out);
        o.start(now + t); o.stop(now + t + 0.12);
      });
    });
  }

  function conjCritical() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      [0, 0.13, 0.26].forEach(t => {
        const o = mkOsc(ctx, 'sine', 180);
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 700;
        const g = mkGain(ctx);
        env(g, 0.38, 0.005, 0.10, now + t);
        o.connect(flt); flt.connect(g); g.connect(out);
        o.start(now + t); o.stop(now + t + 0.11);
      });
    });
  }

  function info() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      [220, 277, 330].forEach((freq, i) => {
        const o = mkOsc(ctx, 'sine', freq);
        const g = mkGain(ctx);
        env(g, 0.16 - i * 0.03, 0.008, 0.40 - i * 0.05, now + i * 0.05);
        o.connect(g); g.connect(out);
        o.start(now + i * 0.05);
        o.stop(now + 0.50);
      });
    });
  }

  return {
    hover,
    select,
    toggle,
    open,
    close,
    flyTo,
    conjWarning,
    conjCritical,
    info,

    setEnabled(v) { _enabled = v; },
    isEnabled()   { return _enabled; },
    setVolume(v)  {
      boot();
      _master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)), _ctx.currentTime + 0.05);
    },

    prime() {
      try {
        boot();
        if (_ctx.state === 'suspended') _ctx.resume();
      } catch (_) {}
    },
  };
}
