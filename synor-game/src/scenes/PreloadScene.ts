/**
 * Preload Scene
 * Loads narrative datasets, UI assets, transparent astronaut sprites,
 * and dynamically detects & loads Blender 3D renders from /public/assets/renders/.
 */

import Phaser from 'phaser';
import { BLENDER_SCENE_SLOTS } from '../utils/BlenderSceneBridge';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    this.createProgressUI();

    // Load Data Files
    this.load.json('chapters_data', '/assets/data/chapters.json');
    this.load.json('experiments_data', '/assets/data/experiments.json');
    this.load.json('conjunction_data', '/assets/data/conjunction.json');

    // Load Astronaut Sprites & Spritesheet
    this.load.spritesheet('astronaut_walk', '/assets/sprites/astronaut_sheet.png', {
      frameWidth: 70,
      frameHeight: 106
    });
    this.load.image('astronaut_portrait', '/assets/sprites/astronaut_portrait.png');
    this.load.image('astronaut_idle', '/assets/sprites/astronaut_idle.png');

    // Load realistic Mars menu backdrop if available
    this.load.image('mars_menu_realistic', '/assets/renders/mars_menu_realistic.jpg');

    // Only load Blender 3D scene renders that genuinely exist in /public/assets/renders/
    const existingRenders = import.meta.glob('/public/assets/renders/*.{png,jpg,jpeg,webp}', { eager: true });
    const existingFileNames = Object.keys(existingRenders).map(p => p.split('/').pop());

    Object.values(BLENDER_SCENE_SLOTS).forEach(slot => {
      if (existingFileNames.includes(slot.expectedFilename)) {
        const textureKey = `blender_${slot.id}`;
        const path = `/assets/renders/${slot.expectedFilename}`;
        this.load.image(textureKey, path);
      }
    });

    // Cleanup any failed textures if any error occurs
    this.load.on('loaderror', (fileObj: Phaser.Loader.File) => {
      if (fileObj && fileObj.key && this.textures.exists(fileObj.key)) {
        this.textures.remove(fileObj.key);
      }
    });
  }

  private createProgressUI() {
    const width = 1920;
    const height = 1080;

    const title = this.add.text(width / 2, height / 2 - 80, 'MISSION SYNOR // SUBSYSTEM INITIALIZATION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '20px',
      color: '#38bdf8',
      letterSpacing: 4
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height / 2 - 45, 'VERIFYING ECLSS, FLIGHT AVIONICS & NASA MARS TREK GEODATA', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x0a101d, 0.8);
    progressBox.lineStyle(1, 0x38bdf8, 0.7);
    progressBox.strokeRect(width / 2 - 250, height / 2, 500, 24);

    const percentText = this.add.text(width / 2, height / 2 + 12, '0%', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      percentText.setText(`${Math.round(value * 100)}%`);
      progressBar.clear();
      progressBar.fillStyle(0x0284c7, 1);
      progressBar.fillRect(width / 2 - 248, height / 2 + 2, 496 * value, 20);
    });

    this.load.on('complete', () => {
      // Register Astronaut animations globally
      if (this.textures.exists('astronaut_walk')) {
        if (!this.anims.exists('astro_walk_anim')) {
          this.anims.create({
            key: 'astro_walk_anim',
            frames: this.anims.generateFrameNumbers('astronaut_walk', { start: 0, end: 3 }),
            frameRate: 6,
            repeat: -1
          });
        }
        if (!this.anims.exists('astro_idle_anim')) {
          this.anims.create({
            key: 'astro_idle_anim',
            frames: [{ key: 'astronaut_walk', frame: 0 }],
            frameRate: 1
          });
        }
      }

      progressBar.destroy();
      progressBox.destroy();
      percentText.destroy();
      title.destroy();
      subtitle.destroy();
      this.scene.start('StartMenuScene');
    });
  }
}
