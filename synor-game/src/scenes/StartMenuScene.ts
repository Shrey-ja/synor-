/**
 * Start Menu Scene
 * Features:
 * - Photorealistic Mars positioned in the bottom-right quadrant with authentic texture.
 * - Active colonization habitat dome on the Martian surface with glowing interior, solar arrays, and pulsing beacon.
 * - Deep space starfield with realistic stellar magnitudes and subtle atmospheric rim glow.
 * - Sleek, left-aligned sci-fi menu with mature typography and audio feedback.
 * - Smooth camera swoop panning beyond the stars into infinite black void, seamlessly transitioning into the Blender cutscene.
 */

import Phaser from 'phaser';
import { AudioSettingsModal } from '../ui/AudioSettingsModal';
import { MissionDossierModal } from '../ui/MissionDossierModal';
import { audioManager } from '../state/AudioManager';
import { soundFx } from '../utils/ProceduralAudio';
import { ProceduralGraphics } from '../utils/ProceduralGraphics';

export class StartMenuScene extends Phaser.Scene {
  private menuContainer!: Phaser.GameObjects.Container;
  private marsContainer!: Phaser.GameObjects.Container;
  private starsContainer!: Phaser.GameObjects.Container;
  private beaconGlow!: Phaser.GameObjects.Arc;
  private beaconRing!: Phaser.GameObjects.Arc;
  private isStarting = false;

  constructor() {
    super({ key: 'StartMenuScene' });
  }

  create() {
    this.isStarting = false;

    // Start 16-Bit Chiptune Main Menu Music
    audioManager.playMusic(this, 'music_menu', { loop: true, fadeIn: 800 });

    // Browser audio policy unlock fallback
    const resumeAudio = () => {
      audioManager.playMusic(this, 'music_menu', { loop: true });
    };
    this.input.once('pointerdown', resumeAudio);
    this.input.keyboard?.once('keydown', resumeAudio);

    // 1. Deep Space Void & Realistic Starfield (Left/Background)
    this.createDeepSpaceStarfield();

    // 2. Realistic Mars in the Bottom-Right with Colonization Habitat Dome
    this.createRealisticMars();

    // 3. Left-Aligned Sci-Fi UI
    this.createLeftAlignedMenu();

    // 4. Subtle, Mature Mouse Parallax (2.5D Depth)
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isStarting) return;
      const normX = (pointer.x - 960) / 960;
      const normY = (pointer.y - 540) / 540;

      // Stars have deep background parallax
      this.starsContainer.x = normX * -12;
      this.starsContainer.y = normY * -8;

      // Mars has midground parallax
      this.marsContainer.x = normX * -22;
      this.marsContainer.y = normY * -15;

      // Menu has slight foreground float
      this.menuContainer.x = 160 + normX * 6;
      this.menuContainer.y = 220 + normY * 4;
    });

    // Keyboard shortcut to start expedition immediately
    this.input.keyboard?.addKey('ENTER').on('down', () => {
      if (!this.isStarting) this.handleStartTransition();
    });
  }

  private createDeepSpaceStarfield() {
    this.starsContainer = this.add.container(0, 0);

    // Deep space gradient backdrop
    const bg = this.add.rectangle(960, 540, 2400, 1400, 0x020409);
    this.starsContainer.add(bg);

    // Faint interstellar dust veil in deep space (upper-left)
    for (let d = 0; d < 5; d++) {
      const neb = this.add.circle(300 + d * 180, 240 + (d % 3) * 120, 240 + d * 40, 0x0c1e38, 0.08);
      this.starsContainer.add(neb);
    }

    // Realistic multi-magnitude starfield
    for (let i = 0; i < 240; i++) {
      const sx = Phaser.Math.Between(0, 2400);
      const sy = Phaser.Math.Between(0, 1400);

      // Varying astronomical magnitudes (mostly faint, a few prominent)
      let radius = 0.8;
      let alpha = Math.random() * 0.6 + 0.3;
      let tint = 0xffffff;

      const r = Math.random();
      if (r < 0.08) {
        radius = 2.0;
        alpha = 0.95;
        tint = 0xe0f2fe; // Blue-white giant
      } else if (r < 0.25) {
        radius = 1.4;
        alpha = 0.8;
        tint = 0xfef3c7; // Pale yellow star
      }

      const star = this.add.circle(sx, sy, radius, tint, alpha);
      this.starsContainer.add(star);

      // Gentle, realistic twinkling (slow sinusoids, no harsh strobe)
      if (Math.random() < 0.6) {
        this.tweens.add({
          targets: star,
          alpha: { from: alpha * 0.3, to: alpha },
          duration: Phaser.Math.Between(2000, 4800),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Phaser.Math.Between(0, 3000)
        });
      }
    }

    // Rare subtle drifting cosmic dust motes
    for (let m = 0; m < 12; m++) {
      const mx = Phaser.Math.Between(80, 1200);
      const my = Phaser.Math.Between(60, 900);
      const dust = this.add.circle(mx, my, 1, 0x94a3b8, 0.4);
      this.starsContainer.add(dust);

      this.tweens.add({
        targets: dust,
        x: mx + Phaser.Math.Between(-60, 60),
        y: my + Phaser.Math.Between(-40, 40),
        alpha: { from: 0.1, to: 0.6 },
        duration: Phaser.Math.Between(8000, 16000),
        repeat: -1,
        yoyo: true,
        ease: 'Linear'
      });
    }
  }

  private createRealisticMars() {
    this.marsContainer = this.add.container(0, 0);

    // Check if the photorealistic 3D render exists
    const hasRealisticTexture = this.textures.exists('mars_menu_realistic');
    const hasBlenderSlot = this.textures.exists('blender_start_menu');

    if (hasRealisticTexture || hasBlenderSlot) {
      const texKey = hasRealisticTexture ? 'mars_menu_realistic' : 'blender_start_menu';
      const marsImg = this.add.image(960, 540, texKey);
      marsImg.setDisplaySize(1920, 1080);
      this.marsContainer.add(marsImg);
    } else {
      // Procedural fallback: generate realistic textured 3D Mars sphere
      const sphereKey = ProceduralGraphics.generateRealisticMarsSphere(this, 'mars_sphere_procedural', 1200);
      const marsSphere = this.add.image(1420, 840, sphereKey);
      marsSphere.setDisplaySize(1280, 1280);
      this.marsContainer.add(marsSphere);
    }

    // Atmospheric limb glow layer (thin cyan-amber Rayleigh scattering)
    const atmoRim = this.add.ellipse(1420, 820, 1260, 1260, 0x38bdf8, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.marsContainer.add(atmoRim);

    this.tweens.add({
      targets: atmoRim,
      alpha: { from: 0.06, to: 0.14 },
      duration: 3500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Active Human Colonization Habitat Dome on Mars Surface
    // Located on the sunlit curve of Mars near the terminator
    const domeX = 1260;
    const domeY = 640;

    // Dome Beacon Glow & Expanding Telemetry Ring
    this.beaconGlow = this.add.circle(domeX, domeY - 14, 5, 0x38bdf8, 1.0);
    this.beaconRing = this.add.circle(domeX, domeY - 14, 6, 0x38bdf8, 0.8)
      .setStrokeStyle(1.5, 0x38bdf8);

    this.marsContainer.add([this.beaconRing, this.beaconGlow]);

    // Pulsing beacon light
    this.tweens.add({
      targets: this.beaconGlow,
      scale: { from: 0.8, to: 2.2 },
      alpha: { from: 1.0, to: 0.2 },
      duration: 1400,
      repeat: -1,
      yoyo: true,
      ease: 'Sine.easeInOut'
    });

    // Expanding radar/telemetry ping ring
    this.tweens.add({
      targets: this.beaconRing,
      scale: { from: 1, to: 4.5 },
      alpha: { from: 0.9, to: 0 },
      duration: 2400,
      repeat: -1,
      ease: 'Cubic.easeOut'
    });

    // High-Tech Diegetic HUD Tag for the Colonization Dome
    const hudContainer = this.add.container(domeX, domeY);

    // Callout hairline
    const line = this.add.graphics();
    line.lineStyle(1, 0x38bdf8, 0.6);
    line.beginPath();
    line.moveTo(0, -18);
    line.lineTo(-40, -60);
    line.lineTo(-180, -60);
    line.stroke();

    // Callout badge text
    const badgeText = this.add.text(-185, -84, 'GALE BASE // HABITAT CORE 01', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#38bdf8',
      letterSpacing: 2
    });

    const statusText = this.add.text(-185, -68, 'STATUS: COMMISSIONING ACTIVE [SOL 0]', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '9px',
      color: '#94a3b8',
      letterSpacing: 1
    });

    hudContainer.add([line, badgeText, statusText]);
    this.marsContainer.add(hudContainer);
  }

  private createLeftAlignedMenu() {
    this.menuContainer = this.add.container(160, 220);

    // 1. Mission Classification Badge
    const badgeBg = this.add.rectangle(0, -50, 360, 24, 0x071120, 0.8)
      .setStrokeStyle(1, 0x38bdf8, 0.5)
      .setOrigin(0, 0.5);

    const badgeText = this.add.text(12, -50, 'ARES MISSION // HARD-SCIENCE EXPEDITION 2047', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0, 0.5);

    // 2. Main Title: SYNOR
    const title = this.add.text(0, 0, 'SYNOR', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '78px',
      fontStyle: '900',
      color: '#f8fafc',
      letterSpacing: 16
    }).setOrigin(0, 0);

    // Subtitle
    const subtitle = this.add.text(4, 92, 'THE SILENCE BETWEEN WORLDS', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '17px',
      color: '#38bdf8',
      letterSpacing: 8
    }).setOrigin(0, 0);

    // Narrative Tagline / Mood Setup
    const tagline = this.add.text(4, 128, 'Humanity sent an explorer to uncover the secrets of Mars.\nIt did not prepare him for being alone.', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '15px',
      color: '#94a3b8',
      lineSpacing: 6,
      letterSpacing: 1
    }).setOrigin(0, 0);

    // Divider Line
    const divider = this.add.rectangle(0, 185, 420, 1, 0x38bdf8, 0.3).setOrigin(0, 0.5);

    // 3. Left-Aligned Menu Options
    const btnStart = this.createSleekMenuButton(0, 220, 'START EXPEDITION [ENTER]', true, () => this.handleStartTransition());
    const btnDossier = this.createSleekMenuButton(0, 285, 'MISSION DOSSIER & LOGS', false, () => {
      audioManager.playSfx(this, 'sfx_ui_modal_open', { volume: 0.8 });
      new MissionDossierModal(this);
    });
    const btnAudio = this.createSleekMenuButton(0, 350, 'AUDIO SUBSYSTEMS', false, () => {
      audioManager.playSfx(this, 'sfx_ui_modal_open', { volume: 0.8 });
      new AudioSettingsModal(this);
    });
    const btnAbort = this.createSleekMenuButton(0, 415, 'ABORT PROTOCOL', false, () => {
      audioManager.playSfx(this, 'sfx_ui_modal_close', { volume: 0.8 });
      window.location.reload();
    });

    // 4. NASA Mars Trek Geodetic Telemetry Footer (Bottom Left)
    const telemetry = this.add.text(4, 495, 'NASA MARS TREK TOPOGRAPHY // MOLA ELEVATION // DSN CARRIER LOCK', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '10px',
      color: '#475569',
      letterSpacing: 1
    }).setOrigin(0, 0);

    this.menuContainer.add([
      badgeBg,
      badgeText,
      title,
      subtitle,
      tagline,
      divider,
      btnStart,
      btnDossier,
      btnAudio,
      btnAbort,
      telemetry
    ]);
  }

  private createSleekMenuButton(
    x: number,
    y: number,
    label: string,
    isPrimary: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const btnCont = this.add.container(x, y);

    const width = 360;
    const height = 46;

    // Background rectangle
    const bg = this.add.rectangle(0, 0, width, height, isPrimary ? 0x0c1e36 : 0x070d18, 0.85)
      .setStrokeStyle(1, isPrimary ? 0x38bdf8 : 0x334155, isPrimary ? 0.8 : 0.6)
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });

    // Glowing left indicator bar
    const indicator = this.add.rectangle(0, 0, 4, height, isPrimary ? 0x38bdf8 : 0x475569)
      .setOrigin(0, 0.5);

    // Label text
    const txt = this.add.text(24, 0, label, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '13px',
      color: isPrimary ? '#f0f9ff' : '#94a3b8',
      letterSpacing: 2
    }).setOrigin(0, 0.5);

    // Hover effects
    bg.on('pointerover', () => {
      bg.setFillStyle(0x132e52, 0.95);
      bg.setStrokeStyle(1.5, 0x38bdf8, 1);
      indicator.setFillStyle(0x38bdf8);
      indicator.setScale(2, 1);
      txt.setColor('#ffffff');
      audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.5 });
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(isPrimary ? 0x0c1e36 : 0x070d18, 0.85);
      bg.setStrokeStyle(1, isPrimary ? 0x38bdf8 : 0x334155, isPrimary ? 0.8 : 0.6);
      indicator.setFillStyle(isPrimary ? 0x38bdf8 : 0x475569);
      indicator.setScale(1, 1);
      txt.setColor(isPrimary ? '#f0f9ff' : '#94a3b8');
    });

    bg.on('pointerdown', () => {
      audioManager.playSfx(this, 'sfx_ui_click', { volume: 0.7 });
      onClick();
    });

    // If primary, add subtle breathing glow on border
    if (isPrimary) {
      this.tweens.add({
        targets: indicator,
        alpha: { from: 0.6, to: 1.0 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    btnCont.add([bg, indicator, txt]);
    return btnCont;
  }

  /**
   * Cinematic Start Transition:
   * Smoothly fades and slides menu out,
   * camera pans up and away from Mars beyond the stars into pure deep void,
   * and launches the Blender Cutscene Scene!
   */
  private handleStartTransition() {
    if (this.isStarting) return;
    this.isStarting = true;

    audioManager.playSfx(this, 'sfx_click_detonator', { volume: 0.85 });
    audioManager.stopMusic(1500); // Fades out 16-bit chiptune smoothly

    // Disable all inputs
    this.input.enabled = false;

    // 1. Fade and slide menu UI away to the left
    this.tweens.add({
      targets: this.menuContainer,
      x: -300,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeIn'
    });

    // 2. Camera sweeps away from Mars: zooms slightly and pans deep into the black void
    // Panning top-left moves the view away from Mars in bottom-right
    this.cameras.main.pan(300, 200, 2200, 'Sine.easeInOut');
    this.cameras.main.zoomTo(1.5, 2200, 'Sine.easeInOut');

    // 3. Mars recedes and fades as we enter the cosmic blackness
    this.tweens.add({
      targets: this.marsContainer,
      alpha: 0.15,
      x: '+=120',
      y: '+=120',
      duration: 1800,
      ease: 'Sine.easeInOut'
    });

    // 4. Fade to absolute deep space blackness before launching the Blender cutscene
    this.time.delayedCall(1600, () => {
      this.cameras.main.fadeOut(800, 1, 2, 4);
    });

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('CutsceneScene');
    });
  }
}
