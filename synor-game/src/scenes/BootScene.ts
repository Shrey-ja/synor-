/**
 * Boot Scene
 * Minimal boot initialization: loads audio settings and checks local storage.
 */

import Phaser from 'phaser';
import { audioManager } from '../state/AudioManager';
import { gameState } from '../state/GameState';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Ensure audio manager settings are hydrated
    audioManager.applySettings();
    // Hydrate game state if saved slot exists
    gameState.load();
  }

  create() {
    this.scene.start('PreloadScene');
  }
}

