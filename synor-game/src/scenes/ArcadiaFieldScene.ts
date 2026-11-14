/**
 * Arcadia Planitia Field Science Scene (Act II)
 * 4 Interactive Hard-Science Mini-Games:
 * 1. Subsurface Ice 6x6 Polygonal GPR Grid Scan
 * 2. Percussive Rotary Cryo-Drilling (Depth Trade-Off)
 * 3. MREU Thermal Sublimation & Perchlorate Discovery
 * 4. Regolith Bearing & Compaction ISRU Assessment
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';

export class ArcadiaFieldScene extends Phaser.Scene {
  private activePanelContainer!: Phaser.GameObjects.Container;
  private expStatusText!: Phaser.GameObjects.Text;
  private astronautSprite!: Phaser.GameObjects.Sprite;

  // Grid scan state
  private gridScannedCount = 0;
  private readonly targetScans = 6;

  constructor() {
    super({ key: 'ArcadiaFieldScene' });
  }

  create() {
    // Attach Blender Slot or Procedural Arcadia Cryo Backdrop
    attachBlenderSceneSlot(this, 'ARCADIA_FIELD', () => {
      this.createProceduralArcadiaBackdrop();
    });

    this.createHeader();
    this.createScienceWorkstations();
    this.createAstronautCharacter();
  }

  private createAstronautCharacter() {
    if (this.textures.exists('astronaut_walk')) {
      this.astronautSprite = this.add.sprite(320, 680, 'astronaut_walk', 0)
        .setScale(1.2)
        .setDepth(50);
      this.astronautSprite.play('astro_idle_anim');
    }
  }

  private walkAstronautTo(targetX: number, targetY: number, onArrival?: () => void) {
    if (!this.astronautSprite) {
      if (onArrival) onArrival();
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.astronautSprite.x, this.astronautSprite.y, targetX, targetY);
    const duration = (dist / 140) * 1000;

    this.astronautSprite.setFlipX(targetX < this.astronautSprite.x);
    this.astronautSprite.play('astro_walk_anim');

    this.tweens.killTweensOf(this.astronautSprite);
    this.tweens.add({
      targets: this.astronautSprite,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.astronautSprite.play('astro_idle_anim');
        if (onArrival) onArrival();
      }
    });
  }

  private createProceduralArcadiaBackdrop() {
    // Pale northern Martian sky
    this.add.rectangle(960, 240, 1920, 480, 0xd97706, 0.35);
    // Flat cryo-plains
    this.add.rectangle(960, 780, 1920, 600, 0x92400e);

    // Procedural polygonal patterned ground fissures (ice wedges)
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xe2e8f0, 0.4);

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = 200 + col * 200 + (row % 2) * 80;
        const cy = 560 + row * 90;
        graphics.strokeCircle(cx, cy, 65);
      }
    }

    // LREV Rover in midground
    this.add.ellipse(1180, 720, 240, 90, 0x1e293b, 0.8)
      .setStrokeStyle(2, 0x64748b);
  }

  private createHeader() {
    const header = this.add.container(960, 90);
    const bg = this.add.rectangle(0, 0, 1080, 54, 0x050a14, 0.9)
      .setStrokeStyle(1, 0x38bdf8, 0.5);

    const title = this.add.text(0, -10, 'ACT II: ARCADIA PLANITIA — SUBSURFACE ICE & REGOLITH ISRU', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.expStatusText = this.add.text(0, 14, '', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    header.add([bg, title, this.expStatusText]);
    this.updateStatus();
  }

  private createScienceWorkstations() {
    const experiments = [
      {
        id: 'exp_arcadia_gpr',
        title: 'EXP A: GPR ICE SCAN',
        sub: '6x6 Ground Radar Survey',
        x: 480,
        y: 420,
        run: () => this.runGprMiniGame()
      },
      {
        id: 'exp_arcadia_core',
        title: 'EXP B: ICE CORING',
        sub: 'Rotary Drill Depth Trade-off',
        x: 820,
        y: 420,
        run: () => this.runCoringMiniGame()
      },
      {
        id: 'exp_arcadia_mreu',
        title: 'EXP C: MREU EXTRACTION',
        sub: 'Thermal Sublimation & Salts',
        x: 1160,
        y: 420,
        run: () => this.runMreuMiniGame()
      },
      {
        id: 'exp_arcadia_regolith',
        title: 'EXP D: ISRU BEARING',
        sub: 'Soil Compaction Assessment',
        x: 1500,
        y: 420,
        run: () => this.runRegolithMiniGame()
      }
    ];

    experiments.forEach(e => {
      const isDone = gameState.arcadiaCompletedExperiments.includes(e.id);

      const cont = this.add.container(e.x, e.y);
      const box = this.add.rectangle(0, 0, 240, 110, 0x0a101d, 0.92)
        .setStrokeStyle(2, isDone ? 0x10b981 : 0x0284c7)
        .setInteractive({ useHandCursor: true });

      const checkMark = this.add.text(-90, -30, isDone ? '✓' : '●', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '16px',
        color: isDone ? '#34d399' : '#38bdf8'
      });

      const tText = this.add.text(0, -15, e.title, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '12px',
        color: isDone ? '#34d399' : '#38bdf8'
      }).setOrigin(0.5);

      const sText = this.add.text(0, 15, e.sub, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '12px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      const status = this.add.text(0, 36, isDone ? '[DATA SECURED]' : '[CLICK TO COMMENCE]', {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: isDone ? '#10b981' : '#f59e0b'
      }).setOrigin(0.5);

      box.on('pointerdown', () => {
        soundFx.playClick(1000);
        this.walkAstronautTo(e.x, 560, () => {
          e.run();
        });
      });

      box.on('pointerover', () => {
        box.setFillStyle(0x1e293b, 0.95);
        soundFx.playClick(850);
      });

      box.on('pointerout', () => {
        box.setFillStyle(0x0a101d, 0.92);
      });

      cont.add([box, checkMark, tText, sText, status]);
    });
  }

  // --- Experiment A: GPR 6x6 Grid Scan ---
  private runGprMiniGame() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 760, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -140, 'GROUND-PENETRATING RADAR (GPR) POLYGONAL ICE SCANNER', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const inst = this.add.text(0, -115, 'Scan cells to identify high-dielectric subsurface pure ice slabs (Need 4 ice signatures):', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '13px',
      color: '#cbd5e1'
    }).setOrigin(0.5);

    this.activePanelContainer.add([bg, title, inst]);

    const gridSize = 6;
    const cellSize = 34;
    const startX = -((gridSize * (cellSize + 6)) / 2) + 20;
    const startY = -80;

    let foundIce = 0;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const x = startX + c * (cellSize + 6);
        const y = startY + r * (cellSize + 6);

        const isIce = (r + c * 2) % 3 === 0;

        const cell = this.add.rectangle(x, y, cellSize, cellSize, 0x1e293b)
          .setStrokeStyle(1, 0x475569)
          .setInteractive({ useHandCursor: true });

        cell.on('pointerdown', () => {
          soundFx.playClick(isIce ? 1400 : 700);
          cell.disableInteractive();

          if (isIce) {
            cell.setFillStyle(0x38bdf8);
            foundIce++;
            if (foundIce >= 4 && !gameState.arcadiaCompletedExperiments.includes('exp_arcadia_gpr')) {
              gameState.arcadiaCompletedExperiments.push('exp_arcadia_gpr');
              gameState.addLog('GPR SCAN COMPLETE: 1.2m pure slab ice layer mapped under polygonal regolith.', 'science');
              this.updateStatus();
              this.time.delayedCall(800, () => this.runGprMiniGame());
            }
          } else {
            cell.setFillStyle(0x78350f);
          }
        });

        this.activePanelContainer.add(cell);
      }
    }

    this.addCloseButton();
  }

  // --- Experiment B: Ice Core Extraction Depth Selection ---
  private runCoringMiniGame() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 780, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -135, 'PRCD ROTARY CRYO-DRILL // EXTRACTION DEPTH SELECTION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    this.activePanelContainer.add([bg, title]);

    const drillOptions = [
      { depth: 'SHALLOW (0.5m)', pwr: '15% Power', yield: '35% Ice Yield', dust: '42% Basalt Dust', deep: false },
      { depth: 'MID-DEPTH (1.5m)', pwr: '28% Power', yield: '68% Ice Yield', dust: '22% Basalt Dust', deep: false },
      { depth: 'DEEP CORE (3.2m)', pwr: '45% Power', yield: '96% Ice Yield', dust: '6% Basalt Dust', deep: true }
    ];

    drillOptions.forEach((opt, idx) => {
      const cx = -240 + idx * 240;
      const cy = 0;

      const optBg = this.add.rectangle(cx, cy, 210, 180, 0x0f172a)
        .setStrokeStyle(1, 0x0284c7)
        .setInteractive({ useHandCursor: true });

      const dTxt = this.add.text(cx, cy - 60, opt.depth, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '12px',
        color: '#38bdf8'
      }).setOrigin(0.5);

      const pTxt = this.add.text(cx, cy - 20, `${opt.pwr}\n${opt.yield}\n${opt.dust}`, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '13px',
        color: '#cbd5e1',
        align: 'center'
      }).setOrigin(0.5);

      const btn = this.add.rectangle(cx, cy + 50, 160, 32, 0x0284c7)
        .setStrokeStyle(1, 0xffffff);
      const bTxt = this.add.text(cx, cy + 50, 'COMMENCE DRILL', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '10px',
        color: '#ffffff'
      }).setOrigin(0.5);

      optBg.on('pointerdown', () => {
        soundFx.playTelemetryChirp();
        gameState.resources.power = Math.max(10, gameState.resources.power - (opt.deep ? 35 : 18));
        if (!gameState.arcadiaCompletedExperiments.includes('exp_arcadia_core')) {
          gameState.arcadiaCompletedExperiments.push('exp_arcadia_core');
          gameState.addLog(`CRYO-CORE EXTRACTED: ${opt.depth} drill completed. Stratified ice core secured.`, 'science');
          this.updateStatus();
          this.time.delayedCall(600, () => this.runCoringMiniGame());
        }
      });

      this.activePanelContainer.add([optBg, dTxt, pTxt, btn, bTxt]);
    });

    this.addCloseButton();
  }

  // --- Experiment C: MREU Sublimation & Perchlorates Discovery ---
  private runMreuMiniGame() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 780, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -135, 'MREU THERMAL VAPOR CAPTURE & WATER PURITY ANALYSIS', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const desc = this.add.text(0, -60, 'Sublimate ice-bearing regolith slurry at 120°C in vacuum chamber.\nCRITICAL SCIENTIFIC FINDING: Extracted water carries 0.72 wt% Magnesium/Calcium Perchlorates.\nWater is toxic without multi-stage ion exchange membranes (Unlocks Act III synthesis)!', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '13px',
      color: '#f59e0b',
      align: 'center',
      wordWrap: { width: 720 }
    }).setOrigin(0.5);

    const testBtn = this.add.rectangle(0, 50, 280, 42, 0x0284c7)
      .setStrokeStyle(1, 0x38bdf8)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(0, 50, 'EXECUTE SUBLIMATION CYCLE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    testBtn.on('pointerdown', () => {
      soundFx.playAirlockHiss();
      if (!gameState.arcadiaCompletedExperiments.includes('exp_arcadia_mreu')) {
        gameState.arcadiaCompletedExperiments.push('exp_arcadia_mreu');
        gameState.addLog('MREU ANALYSIS COMPLETE: Toxic perchlorates detected. Water purification protocol logged for Gale return.', 'science');
        this.updateStatus();
        this.time.delayedCall(600, () => this.runMreuMiniGame());
      }
    });

    this.activePanelContainer.add([bg, title, desc, testBtn, btnText]);
    this.addCloseButton();
  }

  // --- Experiment D: Regolith Geomechanics Assessment ---
  private runRegolithMiniGame() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 780, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -135, 'REGOLITH BEARING CAPACITY & ISRU LAUNCH PAD GEOTECHNICS', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const stats = this.add.text(0, -40, 'Dynamic Cone Penetrometer Measurements:\n• Cohesion: 1.45 kPa (Exceeds 1.2 nominal threshold)\n• Friction Angle: 37.2° (High angular basalt grains)\n• Ultimate Bearing Capacity: 240 kPa (Verified for heavy rocket landing legs)', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#34d399',
      align: 'center'
    }).setOrigin(0.5);

    const logBtn = this.add.rectangle(0, 60, 280, 42, 0x10b981)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const bText = this.add.text(0, 60, 'RATIFY LANDING SITE STABILITY', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#050a14'
    }).setOrigin(0.5);

    logBtn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      if (!gameState.arcadiaCompletedExperiments.includes('exp_arcadia_regolith')) {
        gameState.arcadiaCompletedExperiments.push('exp_arcadia_regolith');
        gameState.addLog('REGOLITH STABILITY RATIFIED: Arcadia sector qualified for future Mars Cargo Landers.', 'science');
        this.updateStatus();
        this.time.delayedCall(600, () => this.runRegolithMiniGame());
      }
    });

    this.activePanelContainer.add([bg, title, stats, logBtn, bText]);
    this.addCloseButton();
  }

  private addCloseButton() {
    const closeBtn = this.add.text(350, -145, '✕', {
      fontSize: '20px',
      color: '#94a3b8'
    }).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeActivePanel());
    this.activePanelContainer.add(closeBtn);
  }

  private closeActivePanel() {
    if (this.activePanelContainer) {
      this.activePanelContainer.destroy();
    }
  }

  private updateStatus() {
    const done = gameState.arcadiaCompletedExperiments.length;
    this.expStatusText.setText(`SCIENCE PROGRESS: ${done}/4 EXPERIMENTS EXECUTED`);

    if (done >= 4) {
      this.expStatusText.setText('ALL ARCADIA EXPERIMENTS COMPLETE // READY TO RETURN TO GALE CRATER');
      this.expStatusText.setColor('#34d399');

      // Add Return to Gale Button
      const returnBtn = this.add.rectangle(960, 960, 380, 44, 0x10b981)
        .setStrokeStyle(1, 0xffffff)
        .setInteractive({ useHandCursor: true });

      const returnTxt = this.add.text(960, 960, 'COMMENCE 4,180 KM RETURN TO GALE', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '13px',
        color: '#050a14'
      }).setOrigin(0.5);

      returnBtn.on('pointerdown', () => {
        soundFx.playTelemetryChirp();
        gameState.currentChapter = 'act_3_gale_return';
        gameState.save();
        this.scene.start('ExpeditionMapScene');
      });
    }
  }
}

