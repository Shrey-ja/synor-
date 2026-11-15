/**
 * Sci-Fi Trade-Off Decision Modal
 * Renders immediate and delayed risks, resource impacts, and branching choices.
 * Original clean UI styling with audio manager integration.
 */

import Phaser from 'phaser';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';
import { uiSfx } from '../utils/UISoundFX';
import { attachUIInteraction } from '../utils/UIInteraction';

export interface DecisionChoice {
  text: string;
  detail: string;
  consequences?: string[];
  powerDelta?: number;
  o2Cost?: number;
  radiationDose?: number;
  thermalDelta?: number;
  foodDelta?: number;
  waterDelta?: number;
  onSelect: () => void;
}

export interface DecisionData {
  title: string;
  summary: string;
  hazardLevel?: 'NOMINAL' | 'ELEVATED' | 'CRITICAL' | 'CANON EVENT';
  choices: DecisionChoice[];
}

export class DecisionModal extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, data: DecisionData) {
    super(scene, 960, 540);
    audioManager.playSfx(scene, 'sfx_ui_modal_open', { volume: 0.75 });
    this.createModal(data);
    scene.add.existing(this);
    this.setDepth(300);
  }

  private createModal(data: DecisionData) {
    soundFx.playAlarmTone();

    // Dark backdrop blocker
    const blocker = this.scene.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.8)
      .setInteractive()
      .setOrigin(0.5);
    this.add(blocker);

    // Modal frame
    const frameWidth = 840;
    const frameHeight = 540;
    const panel = this.scene.add.rectangle(0, 0, frameWidth, frameHeight, 0x070b14, 0.96)
      .setStrokeStyle(2, data.hazardLevel === 'CRITICAL' ? 0xef4444 : 0x38bdf8, 0.9)
      .setOrigin(0.5);
    this.add(panel);

    // Hazard Banner
    const hazardColor = data.hazardLevel === 'CRITICAL' ? '#ef4444' : '#38bdf8';
    const banner = this.scene.add.text(0, -220, `[MISSION ADVISORY: ${data.hazardLevel || 'DECISION REQUIRED'}]`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '13px',
      color: hazardColor,
      letterSpacing: 2
    }).setOrigin(0.5);
    this.add(banner);

    // Title
    const title = this.scene.add.text(0, -185, data.title, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '22px',
      color: '#f8fafc',
      align: 'center'
    }).setOrigin(0.5);
    this.add(title);

    // Summary Box
    const summaryBox = this.scene.add.text(0, -120, data.summary, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '16px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 720 }
    }).setOrigin(0.5);
    this.add(summaryBox);

    // Render Choice Cards
    const numChoices = data.choices.length;
    const cardWidth = Math.min(360, (760 - (numChoices - 1) * 20) / numChoices);
    const startX = -((numChoices - 1) * (cardWidth + 20)) / 2;

    data.choices.forEach((choice, index) => {
      const cx = startX + index * (cardWidth + 20);
      const cy = 60;
      const cardHeight = 220;

      const cardBg = this.scene.add.rectangle(cx, cy, cardWidth, cardHeight, 0x0f172a, 0.9)
        .setStrokeStyle(1, 0x475569)
        .setInteractive({ useHandCursor: true });

      const choiceTitle = this.scene.add.text(cx, cy - 80, choice.text, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '14px',
        color: '#38bdf8',
        align: 'center',
        wordWrap: { width: cardWidth - 24 }
      }).setOrigin(0.5);

      const choiceDetail = this.scene.add.text(cx, cy - 20, choice.detail, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '13px',
        color: '#94a3b8',
        align: 'center',
        wordWrap: { width: cardWidth - 24 }
      }).setOrigin(0.5);

      // Consequence metrics
      let metricStr = '';
      if (choice.powerDelta) metricStr += `Power: ${choice.powerDelta > 0 ? '+' : ''}${choice.powerDelta}%  `;
      if (choice.o2Cost) metricStr += `O2 Cost: -${choice.o2Cost}%  `;
      if (choice.radiationDose) metricStr += `Rad: +${choice.radiationDose}mSv  `;
      if (choice.thermalDelta) metricStr += `Thermal: ${choice.thermalDelta > 0 ? '+' : ''}${choice.thermalDelta}%  `;
      if (choice.foodDelta) metricStr += `Food: ${choice.foodDelta > 0 ? '+' : ''}${choice.foodDelta}%  `;
      if (choice.waterDelta) metricStr += `H2O: ${choice.waterDelta > 0 ? '+' : ''}${choice.waterDelta}%  `;

      const metricText = this.scene.add.text(cx, cy + 40, metricStr, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: '#f59e0b',
        align: 'center'
      }).setOrigin(0.5);

      // Execute Button inside card
      const btn = this.scene.add.rectangle(cx, cy + 80, cardWidth - 40, 32, 0x1e293b)
        .setStrokeStyle(1, 0x38bdf8)
        .setInteractive({ useHandCursor: true });

      const btnText = this.scene.add.text(cx, cy + 80, 'CONFIRM ACTION', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: '#38bdf8'
      }).setOrigin(0.5);

      const triggerAction = () => {
        audioManager.playSfx(this.scene, 'sfx_ui_confirm', { volume: 0.8 });
        this.destroy();
        choice.onSelect();
      };

      btn.on('pointerdown', triggerAction);
      cardBg.on('pointerdown', triggerAction);

      cardBg.on('pointerover', () => {
        cardBg.setStrokeStyle(2, 0x38bdf8);
        cardBg.setFillStyle(0x1e293b, 0.95);
        audioManager.playSfx(this.scene, 'sfx_ui_hover', { volume: 0.4 });
      });

      cardBg.on('pointerout', () => {
        cardBg.setStrokeStyle(1, 0x475569);
        cardBg.setFillStyle(0x0f172a, 0.9);
      });

      // Build a compact tooltip showing choice consequences
      const tipLines: string[] = [choice.detail];
      if (choice.consequences && choice.consequences.length > 0) {
        tipLines.push('=> ' + choice.consequences.join('  |  '));
      }
      const tipText = tipLines.join('  //  ');

      // Enhanced interaction for card background (additive)
      attachUIInteraction(this.scene, cardBg, {
        colorTarget:      cardBg,
        hoverFill:        0x1e293b,
        hoverFillAlpha:   0.95,
        hoverStroke:      0x38bdf8,
        hoverStrokeWidth: 2,
        defaultFill:      0x0f172a,
        defaultFillAlpha: 0.9,
        defaultStroke:    0x475569,
        defaultStrokeWidth: 1,
        soundType:        'telemetry',
        hoverScale:       1.025,
        pressScale:       0.975,
        tooltip:          tipText,
        tooltipOffsetX:   24,
        tooltipOffsetY:   -40,
        tooltipDepth:     8200,
      });

      // Enhanced interaction for CONFIRM button (additive)
      attachUIInteraction(this.scene, btn, {
        colorTarget:      btn,
        hoverFill:        0x38bdf8,
        hoverFillAlpha:   0.3,
        defaultFill:      0x1e293b,
        defaultFillAlpha: 1,
        hoverStroke:      0x38bdf8,
        hoverStrokeWidth: 1.5,
        defaultStroke:    0x38bdf8,
        defaultStrokeWidth: 1,
        soundType:        'confirm',
        hoverScale:       1.04,
        pressScale:       0.96,
      });

      this.add([cardBg, choiceTitle, choiceDetail, metricText, btn, btnText]);
    });
  }
}
