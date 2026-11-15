/**
 * Audio Architecture Controller
 * Manages Master, Music, and SFX channels, persists to localStorage,
 * and controls background music looping and sound effects across Phaser scenes.
 */

import Phaser from 'phaser';
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
    music: 0.65,
    sfx: 0.75
  };

  private currentMusicKey: string | null = null;
  private currentMusicSound: Phaser.Sound.BaseSound | null = null;
  private activeScene: Phaser.Scene | null = null;

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
          music: typeof parsed.music === 'number' ? parsed.music : 0.65,
          sfx: typeof parsed.sfx === 'number' ? parsed.sfx : 0.75
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

    if (this.currentMusicSound) {
      const musicVol = this.settings.master * this.settings.music;
      // WebAudioSound in Phaser has setVolume method
      if ('setVolume' in this.currentMusicSound && typeof (this.currentMusicSound as { setVolume: (v: number) => void }).setVolume === 'function') {
        (this.currentMusicSound as { setVolume: (v: number) => void }).setVolume(musicVol);
      }
    }
  }

  /**
   * Play background music track seamlessly across scenes.
   * If the requested track is already playing, it will continue uninterrupted.
   */
  public playMusic(
    scene: Phaser.Scene,
    key: string,
    options: { loop?: boolean; volume?: number; fadeIn?: number } = {}
  ) {
    this.activeScene = scene;

    // If this exact track is already playing, keep looping seamlessly
    if (this.currentMusicKey === key && this.currentMusicSound && this.currentMusicSound.isPlaying) {
      return;
    }

    // Stop or fade out previous music if different
    if (this.currentMusicSound && this.currentMusicSound.isPlaying) {
      if (options.fadeIn && options.fadeIn > 0) {
        const oldSound = this.currentMusicSound;
        scene.tweens.add({
          targets: oldSound,
          volume: 0,
          duration: options.fadeIn / 2,
          onComplete: () => {
            oldSound.stop();
            oldSound.destroy();
          }
        });
      } else {
        this.currentMusicSound.stop();
        this.currentMusicSound.destroy();
      }
    }

    if (!scene.cache.audio.exists(key)) {
      console.warn(`[AudioManager] Music key '${key}' not found in audio cache.`);
      return;
    }

    const targetVolume = this.settings.master * this.settings.music * (options.volume ?? 1);

    try {
      const sound = scene.sound.add(key, {
        loop: options.loop ?? true,
        volume: (options.fadeIn && options.fadeIn > 0) ? 0 : targetVolume
      });

      sound.play();
      this.currentMusicKey = key;
      this.currentMusicSound = sound;

      if (options.fadeIn && options.fadeIn > 0) {
        scene.tweens.add({
          targets: sound,
          volume: targetVolume,
          duration: options.fadeIn,
          ease: 'Linear'
        });
      }
    } catch (e) {
      console.warn(`[AudioManager] Failed to play music '${key}':`, e);
    }
  }

  /**
   * Stop currently playing background music, with optional fade-out.
   */
  public stopMusic(fadeOut = 0) {
    if (!this.currentMusicSound) return;

    const sound = this.currentMusicSound;
    this.currentMusicKey = null;
    this.currentMusicSound = null;

    if (fadeOut > 0 && this.activeScene && sound.isPlaying) {
      this.activeScene.tweens.add({
        targets: sound,
        volume: 0,
        duration: fadeOut,
        onComplete: () => {
          sound.stop();
          sound.destroy();
        }
      });
    } else {
      sound.stop();
      sound.destroy();
    }
  }

  /**
   * Play a one-shot sound effect with volume and detune control.
   */
  public playSfx(
    scene: Phaser.Scene,
    key: string,
    options: { volume?: number; detune?: number; rate?: number } = {}
  ) {
    if (!scene || !scene.sound) return;

    const effectiveVolume = this.settings.master * this.settings.sfx * (options.volume ?? 1);
    if (effectiveVolume <= 0.001) return;

    if (scene.cache.audio.exists(key)) {
      try {
        scene.sound.play(key, {
          volume: effectiveVolume,
          detune: options.detune ?? 0,
          rate: options.rate ?? 1
        });
      } catch (e) {
        console.warn(`[AudioManager] Error playing SFX '${key}':`, e);
      }
    } else {
      // Fallback click sound
      soundFx.playClick(1000);
    }
  }

  /**
   * Play uniform footstep sound based on surface:
   * - 'ground': uniform Martian regolith ground step
   * - 'metal': crisp metallic clank step
   */
  public playStep(
    scene: Phaser.Scene,
    surface: 'ground' | 'metal' | 'sand' | 'gravel' = 'ground',
    volume = 0.42
  ) {
    const key = surface === 'metal' ? 'sfx_step_metal' : 'sfx_step_ground';
    // Uniform pitch & volume - zero detune for uniform cadence
    this.playSfx(scene, key, { volume, detune: 0 });
  }
}

export const audioManager = AudioManager.getInstance();
