/**
 * Audio Architecture Controller
 * Manages Master, Music, and SFX channels, persists to localStorage,
 * and controls Web Audio synthesizer and Phaser SoundManager.
 */

import { soundFx } from '../utils/ProceduralAudio';

export interface AudioSettings {
  master: number; // 0.0 to 1.0
  music: number;  // 0.0 to 1.0
  sfx: number;    // 0.0 to 1.0
}

const STORAGE_KEY = 'synor_audio_settings_v1';

export class AudioManager {
  private static instance: AudioManager;
  private settings: AudioSettings = {
    master: 0.8,
    music: 0.6,
    sfx: 0.7
  };

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = {
          master: typeof parsed.master === 'number' ? parsed.master : 0.8,
          music: typeof parsed.music === 'number' ? parsed.music : 0.6,
          sfx: typeof parsed.sfx === 'number' ? parsed.sfx : 0.7
        };
      }
    } catch (e) {
      console.warn('Could not read audio settings from localStorage', e);
    }
    this.applySettings();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public setMaster(val: number) {
    this.settings.master = Math.max(0, Math.min(1, val));
    this.save();
    this.applySettings();
  }

  public setMusic(val: number) {
    this.settings.music = Math.max(0, Math.min(1, val));
    this.save();
    this.applySettings();
  }

  public setSfx(val: number) {
    this.settings.sfx = Math.max(0, Math.min(1, val));
    this.save();
    this.applySettings();
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Could not save audio settings to localStorage', e);
    }
  }

  public applySettings() {
    soundFx.setVolumes(
      this.settings.master,
      this.settings.master * this.settings.music,
      this.settings.master * this.settings.sfx
    );
  }
}

export const audioManager = AudioManager.getInstance();

