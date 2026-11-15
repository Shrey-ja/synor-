/**
 * UISoundFX — Zero-Dependency Web Audio UI Sound Synthesizer
 * ──────────────────────────────────────────────────────────
 * Synthesizes crisp sci-fi UI sounds using the Web Audio API.
 * Completely independent of Phaser, ProceduralAudio, and AudioManager.
 * Manages its own AudioContext lifecycle and self-unlocks on first user gesture.
 *
 * Usage:
 *   import { uiSfx } from './UISoundFX';
 *   uiSfx.hoverTick();
 *   uiSfx.clickConfirm();
 */

export class UISoundFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _volume = 0.55;
  private _unlocked = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (!this._unlocked) {
          this._unlocked = true;
          this._init();
        }
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      };
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /** Crisp 1800 Hz sine blip — hover highlight tick */
  public hoverTick() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.025);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this._volume * 0.28, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  /** Two-tone ascending chirp (880 -> 1760 Hz, triangle) — confirm click */
  public clickConfirm() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // First partial: sine attack
    this._playNote(ctx, 'sine', 880, 1100, now, 0.06, this._volume * 0.32);
    // Second partial: triangle rise
    this._playNote(ctx, 'triangle', 1760, 2200, now + 0.055, 0.075, this._volume * 0.24);
    // Soft harmonic shimmer
    this._playNote(ctx, 'sine', 3520, 3520, now + 0.08, 0.04, this._volume * 0.08);
  }

  /** Descending short tone (600 -> 280 Hz, sawtooth) — cancel / close */
  public cancel() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.11);

    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(2800, now);
    filt.frequency.exponentialRampToValueAtTime(900, now + 0.11);
    filt.Q.value = 1.5;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this._volume * 0.3, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(filt);
    filt.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Double-beep sawtooth alarm pulse — hazard / warning */
  public warningPulse() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Pulse 1: high
    this._playNote(ctx, 'sawtooth', 650, 650, now, 0.14, this._volume * 0.35);
    // Pulse 2: low (overlapping drop)
    this._playNote(ctx, 'sawtooth', 440, 440, now + 0.14, 0.12, this._volume * 0.3);
    // Noise burst accent for urgency
    this._playNoise(ctx, now + 0.01, 0.06, this._volume * 0.08, 1800);
  }

  /**
   * Three-step staircase chirp (440 -> 880 -> 1320 Hz, triangle)
   * — live telemetry / data update blip
   */
  public telemetryUpdate() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    this._playNote(ctx, 'triangle', 440,  480,  now,         0.045, this._volume * 0.2);
    this._playNote(ctx, 'triangle', 880,  920,  now + 0.055, 0.045, this._volume * 0.18);
    this._playNote(ctx, 'triangle', 1320, 1360, now + 0.11,  0.05,  this._volume * 0.15);
  }

  /** Set output volume (0.0 to 1.0) */
  public setVolume(vol: number) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this._volume, this.ctx.currentTime);
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private _init() {
    if (this.ctx) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._volume;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Web Audio not available in this environment
    }
  }

  private _getCtx(): AudioContext | null {
    if (!this.ctx) this._init();
    if (!this.ctx || !this.masterGain) return null;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private _playNote(
    ctx: AudioContext,
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    start: number,
    duration: number,
    peakGain: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, start);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
    }

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + duration * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.01);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(start);
    osc.stop(start + duration + 0.015);
  }

  private _playNoise(
    ctx: AudioContext,
    start: number,
    duration: number,
    peakGain: number,
    filterHz: number
  ) {
    const bufSize = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterHz;
    filt.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + duration * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.masterGain!);
    src.start(start);
    src.stop(start + duration + 0.01);
  }
}

/** Global singleton — import this everywhere */
export const uiSfx = new UISoundFX();
