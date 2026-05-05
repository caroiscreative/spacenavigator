
/**
 * SpaceNavigator — UI Sound Engine
 * Synthesized entirely via Web Audio API — no external files.
 *
 * BROWSER RULE: AudioContext must be created/resumed AFTER a user gesture.
 * We handle this by:
 *  1. Calling prime() on first click/keydown in main.js.
 *  2. Calling _ctx.resume() at the top of every play() call.
 */

const MASTER_VOL = 0.65;   // raised — browsers compress audio, needs headroom

let _ctx     = null;
let _master  = null;
let _enabled = true;

// ── AudioContext bootstrap ────────────────────────────────────────────────────
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
    // Resume if browser auto-suspended (common on page load)
    const go = () => { try { fn(_ctx, _master); } catch (_) {} };
    if (_ctx.state === 'suspended') {
      _ctx.resume().then(go);
    } else {
      go();
    }
  } catch (_) {}
}

// ── Tiny DSP helpers ──────────────────────────────────────────────────────────
function mkOsc(ctx, type, freq) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = freq;
  return o;
}

function mkGain(ctx, val = 0) {
  const g = ctx.createGain(); g.gain.value = val; return g;
}

// Attack → peak → exponential release
function env(g, peak, attack, total, now) {
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + total);
}

// White-noise buffer (shared, created once per session)
let _noiseBuf = null;
function noiseBuf(ctx) {
  if (_noiseBuf && _noiseBuf.sampleRate === ctx.sampleRate) return _noiseBuf;
  const len  = ctx.sampleRate * 0.5;
  _noiseBuf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const d    = _noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOUNDS
// ─────────────────────────────────────────────────────────────────────────────

export function createUISounds() {

  /**
   * hover — ficha / token click
   * Tiny percussive tick, like a poker chip or key switch.
   * Very short, neutral pitch. High repetition-friendly.
   */
  function hover() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      // Impulse: very short bandpass noise burst
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(ctx);
      const flt  = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 3200;
      flt.Q.value = 6;
      const g = mkGain(ctx);
      env(g, 0.55, 0.001, 0.030, now);
      src.connect(flt); flt.connect(g); g.connect(out);
      src.start(now); src.stop(now + 0.035);
    });
  }

  /**
   * select — ascending ping
   * Satellite or object clicked.
   */
  function select() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'sine', 800);
      const g   = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(1600, now + 0.06);
      env(g, 0.70, 0.005, 0.30, now);
      o.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.32);
    });
  }

  /**
   * toggle — short square click
   * HUD layer on/off.
   */
  function toggle() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'square', 1100);
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 2000;
      const g   = mkGain(ctx);
      env(g, 0.20, 0.003, 0.065, now);
      o.connect(flt); flt.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.07);
    });
  }

  /**
   * open — upward sweep
   * Panel slides into view.
   */
  function open() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'sine', 260);
      const g   = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(580, now + 0.18);
      env(g, 0.45, 0.012, 0.24, now);
      o.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.26);
    });
  }

  /**
   * close — downward sweep
   * Panel dismissed.
   */
  function close() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      const o   = mkOsc(ctx, 'sine', 580);
      const g   = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(200, now + 0.14);
      env(g, 0.38, 0.006, 0.20, now);
      o.connect(g); g.connect(out);
      o.start(now); o.stop(now + 0.22);
    });
  }

  /**
   * flyTo — warp whoosh
   * Camera jumps to a target.
   */
  function flyTo() {
    play((ctx, out) => {
      const now = ctx.currentTime;

      // Rising noise whoosh
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(ctx);
      const flt  = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(150, now);
      flt.frequency.exponentialRampToValueAtTime(5000, now + 0.30);
      flt.Q.value = 1.6;
      const gn = mkGain(ctx);
      env(gn, 0.55, 0.03, 0.34, now);
      src.connect(flt); flt.connect(gn); gn.connect(out);
      src.start(now); src.stop(now + 0.38);

      // Tone sweep underneath
      const o  = mkOsc(ctx, 'sine', 100);
      const g2 = mkGain(ctx);
      o.frequency.exponentialRampToValueAtTime(900, now + 0.24);
      env(g2, 0.35, 0.018, 0.28, now);
      o.connect(g2); g2.connect(out);
      o.start(now); o.stop(now + 0.30);
    });
  }

  /**
   * conjWarning — double beep
   * Warning-level conjunction event selected.
   */
  function conjWarning() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      [0, 0.14].forEach(t => {
        const o = mkOsc(ctx, 'sine', 720);
        const g = mkGain(ctx);
        env(g, 0.65, 0.006, 0.11, now + t);
        o.connect(g); g.connect(out);
        o.start(now + t); o.stop(now + t + 0.13);
      });
    });
  }

  /**
   * conjCritical — triple sawtooth burst
   * Critical conjunction — urgent alert character.
   */
  function conjCritical() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      [0, 0.12, 0.24].forEach(t => {
        const o = mkOsc(ctx, 'sawtooth', 400);
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 1600;
        const g = mkGain(ctx);
        env(g, 0.72, 0.005, 0.10, now + t);
        o.connect(flt); flt.connect(g); g.connect(out);
        o.start(now + t); o.stop(now + t + 0.11);
      });
    });
  }

  /**
   * info — soft chime
   * Planet / galaxy / DSO info panel opens.
   */
  function info() {
    play((ctx, out) => {
      const now = ctx.currentTime;
      [440, 554, 660].forEach((freq, i) => {
        const o = mkOsc(ctx, 'sine', freq);
        const g = mkGain(ctx);
        env(g, 0.30 - i * 0.06, 0.008, 0.45 - i * 0.05, now + i * 0.04);
        o.connect(g); g.connect(out);
        o.start(now + i * 0.04);
        o.stop(now + 0.55);
      });
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────
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
    /**
     * prime() — call once on first user interaction (click / keydown).
     * This creates and immediately resumes the AudioContext so subsequent
     * sounds play without delay.
     */
    prime() {
      try {
        boot();
        if (_ctx.state === 'suspended') _ctx.resume();
      } catch (_) {}
    },
  };
}
