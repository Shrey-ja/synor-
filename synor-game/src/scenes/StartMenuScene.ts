/**
 * Start Menu Scene
 * 4-Layer multi-depth parallax starfield, Mars limb, drifting asteroids,
 * pulsing outpost beacon, and seamless zero-cut camera zoom transition into Gale Base.
 */

import Phaser from 'phaser';
import { AudioSettingsModal } from '../ui/AudioSettingsModal';
import { soundFx } from '../utils/ProceduralAudio';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';

export class StartMenuScene extends Phaser.Scene {
  private menuContainer!: Phaser.GameObjects.Container;
  private asteroids: { sprite: Phaser.GameObjects.Arc; speedX: number; speedY: number; rotSpeed: number }[] = [];
  private beaconGlow!: Phaser.GameObjects.Arc;

  constructor() {
    super({ key: 'StartMenuScene' });
  }

  create() {
    // Initialize ambient audio on first user gesture to comply with browser audio policies
    this.input.once('pointerdown', () => {
      soundFx.startSpaceAtmosphereDrone();
    });

    // Attach Blender Slot or Procedural Parallax Backdrop
    attachBlenderSceneSlot(this, 'START_MENU', () => {
      this.createProceduralParallaxBackdrop();
    });

    this.createDriftingAsteroids();
    this.createMinimalistUI();

    // Mouse parallax tracking
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const offsetX = (pointer.x - 960) * 0.02;
      const offsetY = (pointer.y - 540) * 0.02;
      this.cameras.main.scrollX = offsetX;
      this.cameras.main.scrollY = offsetY;
    });
  }

  private createProceduralParallaxBackdrop() {
    // Layer 0: Deep space gradient + Stars
    const bg = this.add.rectangle(960, 540, 2400, 1400, 0x020307)
      .setScrollFactor(0.05);

    // Procedural twinkling starfield
    for (let i = 0; i < 220; i++) {
      const sx = Phaser.Math.Between(0, 2400);
      const sy = Phaser.Math.Between(0, 1400);
      const radius = Math.random() < 0.15 ? 2.2 : (Math.random() < 0.5 ? 1.5 : 0.8);
      const star = this.add.circle(sx, sy, radius, 0xffffff, Math.random() * 0.8 + 0.2)
        .setScrollFactor(0.05);

      this.tweens.add({
        targets: star,
        alpha: { from: 0.2, to: 1.0 },
        duration: Phaser.Math.Between(1200, 3500),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // Layer 1: Distant Nebula Dust
    for (let n = 0; n < 8; n++) {
      const nx = 400 + n * 240;
      const ny = 200 + (n % 3) * 120;
      const neb = this.add.circle(nx, ny, 160 + n * 15, 0x3b1842, 0.12)
        .setScrollFactor(0.2);
    }

    // Layer 2: Mars Limb Artwork & Atmospheric Rim Glow
    // Atmospheric outer glow
    const atmosGlow = this.add.ellipse(960, 1380, 2100, 1300, 0xdd6b20, 0.18)
      .setScrollFactor(0.45);
    const atmosRim = this.add.ellipse(960, 1380, 2040, 1240, 0x38bdf8, 0.25)
      .setScrollFactor(0.45);

    // Planet body
    const marsBody = this.add.ellipse(960, 1400, 2000, 1200, 0x9c4221, 1.0)
      .setScrollFactor(0.45);

    // Outpost Beacon on Mars Horizon
    const outpostX = 1280;
    const outpostY = 780;
    const outpostPylon = this.add.rectangle(outpostX, outpostY, 6, 24, 0x475569)
      .setScrollFactor(0.45);
    this.beaconGlow = this.add.circle(outpostX, outpostY - 14, 6, 0x38bdf8, 1.0)
      .setScrollFactor(0.45);

    this.tweens.add({
      targets: this.beaconGlow,
      scale: { from: 0.6, to: 2.2 },
      alpha: { from: 1.0, to: 0.1 },
      duration: 1200,
      repeat: -1,
      yoyo: true,
      ease: 'Sine.easeInOut'
    });
  }

  private createDriftingAsteroids() {
    // Layer 3: Object-pooled drifting asteroids in foreground/midground
    for (let i = 0; i < 18; i++) {
      const ax = Phaser.Math.Between(100, 1820);
      const ay = Phaser.Math.Between(80, 900);
      const size = Phaser.Math.Between(4, 14);
      const asteroid = this.add.circle(ax, ay, size, 0x334155, 0.75)
        .setStrokeStyle(1, 0x475569)
        .setScrollFactor(0.9);

      this.asteroids.push({
        sprite: asteroid,
        speedX: Phaser.Math.FloatBetween(-0.4, 0.4),
        speedY: Phaser.Math.FloatBetween(-0.2, 0.3),
        rotSpeed: Phaser.Math.FloatBetween(-0.01, 0.01)
      });
    }
  }

  private createMinimalistUI() {
    this.menuContainer = this.add.container(960, 480);

    // Title
    const title = this.add.text(0, -120, 'SYNOR', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '76px',
      fontStyle: '900',
      color: '#f8fafc',
      letterSpacing: 16
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, -40, 'THE SILENCE BETWEEN WORLDS', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '18px',
      color: '#38bdf8',
      letterSpacing: 8
    }).setOrigin(0.5);

    const tagline = this.add.text(0, -8, 'HUMANITY SENT AN EXPLORER TO UNCOVER MARS. IT DID NOT PREPARE HIM FOR BEING ALONE.', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
      letterSpacing: 2
    }).setOrigin(0.5);

    // Three Buttons: Start Game, Settings, Exit
    const btnStart = this.createMenuButton(0, 80, 'START EXPEDITION', () => this.handleStartTransition());
    const btnSettings = this.createMenuButton(0, 150, 'AUDIO SUBSYSTEMS', () => {
      soundFx.playClick(1000);
      new AudioSettingsModal(this);
    });
    const btnExit = this.createMenuButton(0, 220, 'ABORT PROTOCOL', () => {
      soundFx.playClick(600);
      window.location.reload();
    });

    // Version & Hard-Science Tag
    const footText = this.add.text(0, 320, 'HARD-SCIENCE MARS MISSION // NASA MARS TREK GEODYNAMICS // 2047', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#475569'
    }).setOrigin(0.5);

    this.menuContainer.add([title, subtitle, tagline, btnStart, btnSettings, btnExit, footText]);
  }

  private createMenuButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const btnCont = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 320, 48, 0x0a101d, 0.85)
      .setStrokeStyle(1, 0x38bdf8, 0.6)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8',
      letterSpacing: 3
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x38bdf8, 0.25);
      bg.setStrokeStyle(2, 0x38bdf8, 1);
      txt.setColor('#ffffff');
      soundFx.playClick(1200);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x0a101d, 0.85);
      bg.setStrokeStyle(1, 0x38bdf8, 0.6);
      txt.setColor('#38bdf8');
    });

    bg.on('pointerdown', onClick);

    btnCont.add([bg, txt]);
    return btnCont;
  }

  /**
   * Zero-Cut Seamless Transition to GaleBaseScene:
   * Tweens menu alpha to 0, pans and zooms camera smoothly through the asteroids
   * straight into the Martian surface without black screens!
   */
  private handleStartTransition() {
    soundFx.playTelemetryChirp();

    // Disable all inputs
    this.input.enabled = false;

    // Fade out menu container over 1000ms
    this.tweens.add({
      targets: this.menuContainer,
      alpha: 0,
      y: '+=40',
      duration: 1000,
      ease: 'Sine.easeInOut'
    });

    // Zero-cut dramatic camera zoom & pan toward Martian surface
    this.cameras.main.pan(1280, 800, 2600, 'Sine.easeInOut');
    this.cameras.main.zoomTo(2.6, 2600, 'Sine.easeInOut');

    this.time.delayedCall(2500, () => {
      this.scene.start('GaleBaseScene');
      this.scene.launch('HUDScene');
    });
  }

  update() {
    // Animate drifting asteroids
    this.asteroids.forEach(a => {
      a.sprite.x += a.speedX;
      a.sprite.y += a.speedY;
      if (a.sprite.x < -50) a.sprite.x = 2000;
      if (a.sprite.x > 2000) a.sprite.x = -50;
      if (a.sprite.y < -50) a.sprite.y = 1150;
      if (a.sprite.y > 1150) a.sprite.y = -50;
    });
  }
}

