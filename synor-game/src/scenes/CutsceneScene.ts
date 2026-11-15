/**
 * Cutscene Scene
 * Plays the pre-rendered 3D cinematic video exported from Blender (intro_cutscene.mp4)
 * with zero-latency video streaming, audio, and skip controls.
 * If video is not yet rendered, displays a cinematic narrative prelude with
 * hard-science telemetry logs and instant skip to GaleBaseScene.
 */

import Phaser from 'phaser';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';
import { attachUIInteraction } from '../utils/UIInteraction';

export class CutsceneScene extends Phaser.Scene {
  private videoElement: HTMLVideoElement | null = null;
  private isSkipping = false;
  private logIndex = 0;
  private logLines: string[] = [
    'ARES MISSION SYNOR // FLIGHT TELEMETRY LOG 001',
    'TRANSIT DURATION: 214 DAYS THROUGH DEEP INTERPLANETARY VOID.',
    'APPROACHING RED PLANET TERMINATOR. ORBITAL INSERTION CONFIRMED.',
    'AEROCAPTURE PROFILE NOMINAL. HEATSHIELD JETTISONED.',
    'LOCKED ONTO GALE CRATER OUTPOST BEACON: LAT -5.4° LON 137.8°.',
    'ATMOSPHERIC RE-ENTRY SEQUENCE INITIATED... WELCOME TO MARS.'
  ];

  constructor() {
    super({ key: 'CutsceneScene' });
  }

  create() {
    this.isSkipping = false;
    audioManager.stopMusic(500);
    soundFx.startSpaceAtmosphereDrone();

    // Check if an MP4 or WebM video file exists
    this.attemptPlayVideoCutscene();

    // Setup Skip key
    this.input.keyboard?.addKey('SPACE').on('down', () => this.finishCutscene());
    this.input.keyboard?.addKey('ENTER').on('down', () => this.finishCutscene());
    this.input.keyboard?.addKey('ESC').on('down', () => this.finishCutscene());
  }

  private attemptPlayVideoCutscene() {
    const videoUrl = '/assets/renders/intro_cutscene.mp4';
    const video = document.createElement('video');
    video.src = videoUrl;
    video.autoplay = true;
    video.playsInline = true;
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '100vw';
    video.style.height = '100vh';
    video.style.objectFit = 'cover';
    video.style.zIndex = '5';
    video.style.backgroundColor = '#000000';

    video.onloadeddata = () => {
      // Video genuinely exists and is ready to stream!
      this.videoElement = video;
      document.body.appendChild(video);
      video.play().catch(() => {});

      video.onended = () => {
        this.finishCutscene();
      };

      // Add HTML skip button over video
      this.createSkipOverlay();
    };

    video.onerror = () => {
      // Video not yet exported from Blender - show atmospheric procedural cutscene!
      video.remove();
      this.createProceduralCinematicCutscene();
    };
  }

  private createSkipOverlay() {
    const skipBtn = document.createElement('div');
    skipBtn.id = 'cutscene-skip-overlay';
    skipBtn.innerHTML = `[PRESS <b>SPACE</b> OR CLICK TO SKIP CUTSCENE]`;
    skipBtn.style.position = 'absolute';
    skipBtn.style.bottom = '28px';
    skipBtn.style.right = '36px';
    skipBtn.style.fontFamily = "'Share Tech Mono', monospace";
    skipBtn.style.fontSize = '14px';
    skipBtn.style.color = '#38bdf8';
    skipBtn.style.background = 'rgba(5, 10, 20, 0.75)';
    skipBtn.style.border = '1px solid rgba(56, 189, 248, 0.4)';
    skipBtn.style.padding = '8px 16px';
    skipBtn.style.borderRadius = '4px';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.zIndex = '15';
    skipBtn.style.letterSpacing = '2px';

    skipBtn.onclick = () => this.finishCutscene();
    document.body.appendChild(skipBtn);
  }

  private removeSkipOverlay() {
    const el = document.getElementById('cutscene-skip-overlay');
    if (el) el.remove();
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.remove();
      this.videoElement = null;
    }
  }

  private createProceduralCinematicCutscene() {
    const width = 1920;
    const height = 1080;

    // Pitch black background with subtle drifting stars
    this.add.rectangle(width / 2, height / 2, width, height, 0x010204);

    for (let i = 0; i < 90; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height);
      const star = this.add.circle(sx, sy, Math.random() * 1.5 + 0.5, 0xffffff, Math.random() * 0.7 + 0.3);
      this.tweens.add({
        targets: star,
        y: sy + Phaser.Math.Between(40, 100),
        alpha: { from: 0.2, to: 0.9 },
        duration: Phaser.Math.Between(4000, 8000),
        repeat: -1,
        yoyo: true
      });
    }

    // Cinematic Widescreen Letterboxing (2.39:1 Anamorphic ratio)
    const letterboxHeight = 110;
    const topBar = this.add.rectangle(width / 2, letterboxHeight / 2, width, letterboxHeight, 0x000000).setDepth(100);
    const bottomBar = this.add.rectangle(width / 2, height - letterboxHeight / 2, width, letterboxHeight, 0x000000).setDepth(100);

    // Audio cue
    soundFx.playTelemetryChirp();

    // Central Telemetry HUD
    const hudFrame = this.add.rectangle(width / 2, height / 2, 1100, 420, 0x040812, 0.85)
      .setStrokeStyle(1, 0x38bdf8, 0.4);

    const hudBadge = this.add.text(width / 2, height / 2 - 180, 'MISSION SYNOR // PROLOGUE CINEMATIC', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '18px',
      color: '#38bdf8',
      letterSpacing: 6
    }).setOrigin(0.5);

    const blenderNote = this.add.text(
      width / 2,
      height / 2 - 145,
      '[BLENDER 3D CUTSCENE SLOT READY: DROP VIDEO INTO /public/assets/renders/intro_cutscene.mp4]',
      {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '12px',
        color: '#f59e0b',
        letterSpacing: 2
      }
    ).setOrigin(0.5);

    // Dynamic typewriter log terminal
    const terminalText = this.add.text(width / 2 - 480, height / 2 - 100, '', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '16px',
      color: '#e2e8f0',
      lineSpacing: 16
    });

    this.typeNextLog(terminalText);

    // Skip Button
    const skipBtnBg = this.add.rectangle(width / 2, height / 2 + 155, 340, 44, 0x0a1424, 0.9)
      .setStrokeStyle(1, 0x38bdf8, 0.8)
      .setInteractive({ useHandCursor: true });

    const skipBtnText = this.add.text(width / 2, height / 2 + 155, 'ENTER GALE CRATER BASE [SPACE]', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '13px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    skipBtnBg.on('pointerover', () => {
      skipBtnBg.setFillStyle(0x38bdf8, 0.3);
      skipBtnText.setColor('#ffffff');
      soundFx.playClick(1000);
    });

    skipBtnBg.on('pointerout', () => {
      skipBtnBg.setFillStyle(0x0a1424, 0.9);
      skipBtnText.setColor('#38bdf8');
    });

    skipBtnBg.on('pointerdown', () => this.finishCutscene());

    attachUIInteraction(this, skipBtnBg, {
      colorTarget: skipBtnBg,
      textTarget: skipBtnText,
      hoverFill: 0x38bdf8,
      hoverFillAlpha: 0.3,
      defaultFill: 0x0a1424,
      defaultFillAlpha: 0.9,
      hoverStroke: 0x38bdf8,
      hoverStrokeWidth: 1.5,
      defaultStroke: 0x38bdf8,
      defaultStrokeWidth: 1,
      soundType: 'confirm',
      hoverScale: 1.03,
      pressScale: 0.97,
      tooltip: 'Skip the cinematic prelude and enter Gale Crater Base.',
      tooltipOffsetX: 24,
      tooltipOffsetY: -38,
      tooltipDepth: 9000,
    });
  }

  private typeNextLog(textObj: Phaser.GameObjects.Text) {
    if (this.logIndex >= this.logLines.length) {
      // Auto-finish after final log if user doesn't press skip
      this.time.delayedCall(3000, () => {
        if (!this.isSkipping) this.finishCutscene();
      });
      return;
    }

    const currentLine = this.logLines[this.logIndex];
    let charIdx = 0;
    const existing = textObj.text ? textObj.text + '\n> ' : '> ';

    this.time.addEvent({
      delay: 24,
      repeat: currentLine.length - 1,
      callback: () => {
        charIdx++;
        textObj.setText(existing + currentLine.substring(0, charIdx));
        if (charIdx % 3 === 0) soundFx.playClick(1600);
        if (charIdx >= currentLine.length) {
          this.logIndex++;
          this.time.delayedCall(700, () => this.typeNextLog(textObj));
        }
      }
    });
  }

  private finishCutscene() {
    if (this.isSkipping) return;
    this.isSkipping = true;

    audioManager.playSfx(this, 'sfx_ui_confirm', { volume: 0.8 });
    this.removeSkipOverlay();

    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GaleBaseScene');
      this.scene.launch('HUDScene');
    });
  }
}
