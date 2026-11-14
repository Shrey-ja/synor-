/**
 * Dynamic Epilogue & Endings Scene
 * Evaluates mission survival, astrobiology preservation, and telemetry
 * across Ending A (Humanity Endures), Ending B (The Price of Discovery),
 * or Ending C (Beyond the Signal).
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndingScene' });
  }

  create() {
    // Determine ending outcome
    const res = gameState.resources;
    const haz = gameState.hazards;

    let endingCode: 'A' | 'B' | 'C' = 'A';
    let endingTitle = '';
    let narrative = '';
    let color = '#34d399';

    if (res.airReserve <= 0 || res.waterReserve <= 0 || res.thermalStability <= 0 || haz.co2Ppm >= 5000 || haz.radiationDoseMsv > 250) {
      endingCode = 'C';
      endingTitle = 'ENDING C: SYNOR — BEYOND THE SIGNAL';
      narrative = 'When the solar plasma clears on Day 14 and the Deep Space Network turns its dishes toward Mars, the Jezero Field Station remains silent. The habitat buffers were breached, life support failed in the dust storm, and SYNOR-1 never checked in. The ancient biosignatures and hard-won datasets remain untouched in the silence of Mars.';
      color = '#ef4444';
    } else if (gameState.sciencePreservedPercent < 75 || !gameState.biosignatureSampleTube || gameState.jezeroBranchChoice === 'retreat_gale') {
      endingCode = 'B';
      endingTitle = 'ENDING B: SYNOR — THE PRICE OF DISCOVERY';
      narrative = 'SYNOR-1 survived. The radio crackles to life on Day 14, and Houston erupts into applause as your voice breaks through the static. Yet survival came at a steep cost: the cryo-vault was unpowered to save habitat heating, or critical cores had to be abandoned to race back. Human life endured, but Mars kept its greatest secret.';
      color = '#f59e0b';
    } else {
      endingCode = 'A';
      endingTitle = 'ENDING A: SYNOR — HUMANITY ENDURES';
      narrative = 'A total triumph of hard science and human resilience. Against catastrophic dust storms, brutal cold, radiation spikes, and fourteen days of solitary silence, SYNOR-1 kept the station alive and safeguarded 100% of the Arcadia water and Jezero astrobiology cores. The recovery lander is en route. Mars is no longer a graveyard—it is our stepping stone.';
      color = '#38bdf8';
    }

    soundFx.playTelemetryChirp();

    // Attach Blender Slot or Procedural Dawn Backdrop
    attachBlenderSceneSlot(this, 'ENDING_SCENE', () => {
      this.createProceduralEndingBackdrop(color);
    });

    this.createEndingCard(endingTitle, narrative, color, endingCode);
  }

  private createProceduralEndingBackdrop(themeColor: string) {
    // Cinematic dawn clearing through dust haze
    this.add.rectangle(960, 540, 1920, 1080, 0x050a14);

    // Glowing morning sun piercing the dust horizon
    const sunGlow = this.add.circle(960, 680, 240, 0xf59e0b, 0.25);
    const sunCore = this.add.circle(960, 680, 80, 0xfef08a, 0.7);

    // Horizon mountain silhouette
    this.add.triangle(960, 800, 100, 920, 960, 640, 1820, 920, 0x1c1917);
    this.add.rectangle(960, 960, 1920, 240, 0x0c0a09);
  }

  private createEndingCard(title: string, narrative: string, color: string, code: 'A' | 'B' | 'C') {
    const card = this.add.container(960, 510);
    const bg = this.add.rectangle(0, 0, 960, 640, 0x070e1c, 0.96)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.9);

    const banner = this.add.text(0, -260, `[MISSION CONCLUSION // DEBRIEF ARCHIVE]`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: color,
      letterSpacing: 2
    }).setOrigin(0.5);

    const tText = this.add.text(0, -210, title, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const narrativeBox = this.add.text(0, -90, narrative, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '16px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 840 },
      lineSpacing: 6
    }).setOrigin(0.5);

    // Final Statistics Box
    const statsY = 80;
    const statsBox = this.add.rectangle(0, statsY, 840, 140, 0x0f172a, 0.8)
      .setStrokeStyle(1, 0x334155);

    const s1 = `ARCEDIA WATER DATA: ${gameState.arcadiaWaterFiltered ? 'SYNTHESIZED (100%)' : 'INCOMPLETE'}`;
    const s2 = `JEZERO BIOSIGNATURE: ${gameState.biosignatureSampleTube ? 'SECURED IN CRYO' : 'ABANDONED'}`;
    const s3 = `SCIENCE INTEGRITY PRESERVED: ${Math.round(gameState.sciencePreservedPercent)}%`;
    const s4 = `CUMULATIVE RADIATION DOSE: ${gameState.hazards.radiationDoseMsv.toFixed(1)} mSv`;
    const s5 = `FINAL CO2 CONCENTRATION: ${Math.round(gameState.hazards.co2Ppm)} ppm`;

    const statsText = this.add.text(0, statsY, `${s1}  |  ${s2}\n${s3}\n${s4}  |  ${s5}`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#38bdf8',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);

    // Restart Button
    const restartBtn = this.add.rectangle(0, 240, 260, 44, 0x0284c7)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const btnTxt = this.add.text(0, 240, 'RESTART EXPEDITION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '13px',
      color: '#ffffff'
    }).setOrigin(0.5);

    restartBtn.on('pointerdown', () => {
      soundFx.playClick(1100);
      gameState.resetToPrologue();
      this.scene.stop('HUDScene');
      this.scene.start('StartMenuScene');
    });

    card.add([bg, banner, tText, narrativeBox, statsBox, statsText, restartBtn, btnTxt]);
  }
}

