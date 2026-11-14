/**
 * Audio Settings Modal
 * Strictly contains Master, Music, and SFX sliders plus a Back button.
 */

import Phaser from 'phaser';
import { audioManager } from '../state/AudioManager';
import { soundFx } from '../utils/ProceduralAudio';

export class AudioSettingsModal extends Phaser.GameObjects.Container {
  private panelBg!: Phaser.GameObjects.Rectangle;
  private closeCallback?: () => void;

  constructor(scene: Phaser.Scene, onClose?: () => void) {
    super(scene, 960, 540);
    this.closeCallback = onClose;
    this.createModal();
    scene.add.existing(this);
    this.setDepth(200);
  }

  private createModal() {
    // Backdrop shadow to block input behind
    const blocker = this.scene.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.7)
      .setInteractive()
      .setOrigin(0.5);
    this.add(blocker);

    // Main Modal Box
    this.panelBg = this.scene.add.rectangle(0, 0, 640, 480, 0x0a101d, 0.95)
      .setStrokeStyle(2, 0x38bdf8, 0.8)
      .setOrigin(0.5);
    this.add(this.panelBg);

    // Title
    const title = this.scene.add.text(0, -180, 'AUDIO SUBSYSTEM CALIBRATION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '22px',
      color: '#38bdf8'
    }).setOrigin(0.5);
    this.add(title);

    const subtitle = this.scene.add.text(0, -145, 'THREE-CHANNEL SOUND BUS [GAIN STAGE PERSISTENCE]', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#94a3b8'
    }).setOrigin(0.5);
    this.add(subtitle);

    const settings = audioManager.getSettings();

    // Sliders
    this.createSlider('MASTER GAIN', -70, settings.master, (val) => {
      audioManager.setMaster(val);
      soundFx.playClick(800 + val * 400);
    });

    this.createSlider('MUSIC & AMBIENT DRONE', 10, settings.music, (val) => {
      audioManager.setMusic(val);
      soundFx.playClick(800 + val * 400);
    });

    this.createSlider('SFX & TELEMETRY ALARMS', 90, settings.sfx, (val) => {
      audioManager.setSfx(val);
      soundFx.playClick(800 + val * 400);
    });

    // BACK Button
    const backBtn = this.scene.add.rectangle(0, 180, 220, 44, 0x1e293b, 0.9)
      .setStrokeStyle(1, 0x38bdf8, 0.9)
      .setInteractive({ useHandCursor: true });
    
    const backText = this.scene.add.text(0, 180, 'BACK TO SYSTEM', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    backBtn.on('pointerover', () => {
      backBtn.setFillStyle(0x38bdf8, 0.25);
      soundFx.playClick(1000);
    });

    backBtn.on('pointerout', () => {
      backBtn.setFillStyle(0x1e293b, 0.9);
    });

    backBtn.on('pointerdown', () => {
      soundFx.playClick(700);
      this.close();
    });

    this.add([backBtn, backText]);
  }

  private createSlider(label: string, yPos: number, initialVal: number, onChange: (val: number) => void) {
    const trackWidth = 320;
    const trackX = 0;

    const lbl = this.scene.add.text(-220, yPos - 12, label, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '15px',
      color: '#cbd5e1'
    }).setOrigin(0, 0.5);

    const valText = this.scene.add.text(180, yPos - 12, `${Math.round(initialVal * 100)}%`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '15px',
      color: '#38bdf8'
    }).setOrigin(1, 0.5);

    const track = this.scene.add.rectangle(trackX, yPos + 12, trackWidth, 8, 0x1e293b)
      .setStrokeStyle(1, 0x475569)
      .setOrigin(0.5);

    const fillWidth = Math.max(1, trackWidth * initialVal);
    const fill = this.scene.add.rectangle(trackX - trackWidth / 2, yPos + 12, fillWidth, 8, 0x38bdf8)
      .setOrigin(0, 0.5);

    const thumbX = trackX - trackWidth / 2 + trackWidth * initialVal;
    const thumb = this.scene.add.circle(thumbX, yPos + 12, 10, 0x38bdf8)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    // Drag behavior
    this.scene.input.setDraggable(thumb);

    thumb.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const minX = trackX - trackWidth / 2;
      const maxX = trackX + trackWidth / 2;
      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX);
      thumb.x = clampedX;
      const ratio = (clampedX - minX) / trackWidth;
      fill.width = clampedX - minX;
      valText.setText(`${Math.round(ratio * 100)}%`);
      onChange(ratio);
    });

    // Click track to jump
    track.setInteractive({ useHandCursor: true });
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - (this.x + trackX - trackWidth / 2);
      const ratio = Phaser.Math.Clamp(localX / trackWidth, 0, 1);
      thumb.x = trackX - trackWidth / 2 + trackWidth * ratio;
      fill.width = trackWidth * ratio;
      valText.setText(`${Math.round(ratio * 100)}%`);
      onChange(ratio);
    });

    this.add([lbl, valText, track, fill, thumb]);
  }

  public close() {
    this.destroy();
    if (this.closeCallback) {
      this.closeCallback();
    }
  }
}

