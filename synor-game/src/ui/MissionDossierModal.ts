/**
 * Mission Dossier Modal
 * Provides narrative background, mission directives, and science parameters
 * inspired by Until Then & Don't Escape storytelling and hard-science Mars exploration.
 */

import Phaser from 'phaser';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';
import { uiSfx } from '../utils/UISoundFX';
import { attachUIInteraction } from '../utils/UIInteraction';

export class MissionDossierModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene) {
    super(scene, 960, 540);
    audioManager.playSfx(scene, 'sfx_ui_modal_open', { volume: 0.75 });
    this.createModal();
    scene.add.existing(this);
    this.setDepth(200);
  }

  private createModal() {
    // Backdrop shadow to block input behind
    const blocker = this.scene.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.75)
      .setInteractive()
      .setOrigin(0.5);
    this.add(blocker);

    // Main Modal Box
    const panelBg = this.scene.add.rectangle(0, 0, 840, 560, 0x070c18, 0.96)
      .setStrokeStyle(2, 0x38bdf8, 0.8)
      .setOrigin(0.5);
    this.add(panelBg);

    // Header Accent Line
    const line = this.scene.add.rectangle(0, -210, 800, 2, 0x38bdf8, 0.5);
    this.add(line);

    // Title
    const title = this.scene.add.text(0, -240, 'MISSION SYNOR // OPERATIONAL DOSSIER', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '22px',
      color: '#38bdf8',
      letterSpacing: 4
    }).setOrigin(0.5);
    this.add(title);

    // Content body
    const bodyContent = [
      'CLASSIFICATION: ARES-V EXPEDITION / TOP SECRET',
      'YEAR: 2047 // DESTINATION: GALE CRATER & JEZERO DELTA',
      'PRIMARY OBJECTIVE: Commission Gale Habitat Dome, survey Arcadia Cryo-ISRU,',
      'and extract fossil biosignature tubes before the 14-day Solar Conjunction.',
      '',
      'DESIGN INSPIRATION & PILLARS:',
      '• DON\'T ESCAPE STYLE: Tension, resource management, shelter fortification, and survival against catastrophic environmental events.',
      '• UNDER TALE & UNTIL THEN STYLE: Rich psychological isolation, interactive character logs, branching dilemmas with delayed consequences, and cinematic 2.5D atmosphere.',
      '• HARD-SCIENCE ACCURACY: Powered by real NASA Mars Trek MOLA topological elevation, authentic Martian chemistry, and planetary mechanics.'
    ];

    const bodyText = this.scene.add.text(-380, -170, bodyContent.join('\n'), {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '14px',
      color: '#cbd5e1',
      lineSpacing: 10
    });
    this.add(bodyText);

    // Close Button
    const btnClose = this.scene.add.rectangle(0, 220, 240, 42, 0x0e1726, 0.9)
      .setStrokeStyle(1, 0x38bdf8, 0.8)
      .setInteractive({ useHandCursor: true });

    const btnCloseText = this.scene.add.text(0, 220, 'RETURN TO SYSTEM [ESC]', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '13px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    btnClose.on('pointerover', () => {
      btnClose.setFillStyle(0x38bdf8, 0.25);
      btnCloseText.setColor('#ffffff');
      audioManager.playSfx(this.scene, 'sfx_ui_hover', { volume: 0.4 });
    });

    btnClose.on('pointerout', () => {
      btnClose.setFillStyle(0x0e1726, 0.9);
      btnCloseText.setColor('#38bdf8');
    });

    const doClose = () => {
      audioManager.playSfx(this.scene, 'sfx_ui_modal_close', { volume: 0.65 });
      this.destroy();
    };

    btnClose.on('pointerdown', doClose);
    this.scene.input.keyboard?.once('keydown-ESC', doClose);

    // Enhanced interaction (additive)
    attachUIInteraction(this.scene, btnClose, {
      colorTarget:      btnClose,
      hoverFill:        0x38bdf8,
      hoverFillAlpha:   0.28,
      defaultFill:      0x0e1726,
      defaultFillAlpha: 0.9,
      hoverStroke:      0x38bdf8,
      hoverStrokeWidth: 1.5,
      defaultStroke:    0x38bdf8,
      defaultStrokeWidth: 1,
      defaultStrokeAlpha: 0.8,
      soundType:        'cancel',
      hoverScale:       1.03,
      pressScale:       0.97,
      tooltip:          'Close dossier and return to mission start menu.',
      tooltipOffsetX:   24,
      tooltipOffsetY:   -38,
      tooltipDepth:     8100,
    });

    this.add([btnClose, btnCloseText]);
  }
}
