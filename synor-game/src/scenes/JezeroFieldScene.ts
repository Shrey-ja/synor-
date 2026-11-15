/**
 * Jezero Crater Field Science Scene (Act IV)
 * Ancient Delta Astrobiology, Laser Strata Scanning, Raman Spectroscopy,
 * Biosignature Sample Tube Sealing, and the Critical Branching Dilemma.
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { DecisionModal } from '../ui/DecisionModal';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';

export class JezeroFieldScene extends Phaser.Scene {
  private activePanelContainer!: Phaser.GameObjects.Container;
  private expStatusText!: Phaser.GameObjects.Text;
  private astronautSprite!: Phaser.GameObjects.Sprite;

  constructor() {
    super({ key: 'JezeroFieldScene' });
  }

  create() {
    audioManager.playMusic(this, 'music_game', { loop: true });

    // Attach Blender Slot or Procedural Delta Backdrop
    attachBlenderSceneSlot(this, 'JEZERO_FIELD', () => {
      this.createProceduralJezeroBackdrop();
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

  private createProceduralJezeroBackdrop() {
    // Atmospheric dusty sky
    this.add.rectangle(960, 240, 1920, 480, 0xca8a04, 0.35);
    // Dark brown/ochre Jezero crater floor
    this.add.rectangle(960, 780, 1920, 600, 0x78350f);

    // Stratified sedimentary delta cliff face (Kodiak Butte scarp)
    const deltaScarp = this.add.polygon(
      600,
      480,
      [0, 200, 150, 60, 400, 30, 600, 120, 750, 240],
      0x9a3412
    );
    deltaScarp.setStrokeStyle(2, 0xd97706);

    // River channel cut in midground
    const channel = this.add.ellipse(1200, 620, 480, 80, 0x451a03)
      .setStrokeStyle(1, 0x78350f);
  }

  private createHeader() {
    const header = this.add.container(960, 90);
    const bg = this.add.rectangle(0, 0, 1080, 54, 0x050a14, 0.9)
      .setStrokeStyle(1, 0x38bdf8, 0.5);

    const title = this.add.text(0, -10, 'ACT IV: JEZERO CRATER DELTA — PALEO-LAKE ASTROBIOLOGY', {
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
        id: 'exp_jezero_delta',
        title: 'EXP A: DELTA LiDAR SCAN',
        sub: 'Fluvial Strata Reconstruction',
        x: 480,
        y: 420,
        run: () => this.runDeltaScan()
      },
      {
        id: 'exp_jezero_mineral',
        title: 'EXP B: RAMAN / XRF SPECTRO',
        sub: 'Smectite Clays & Carbonates',
        x: 820,
        y: 420,
        run: () => this.runRamanSpectroscopy()
      },
      {
        id: 'exp_jezero_bio',
        title: 'EXP C: BIOSIGNATURE TUBE',
        sub: 'Organic Mudstone Encapsulation',
        x: 1160,
        y: 420,
        run: () => this.runBiosignatureExtraction()
      },
      {
        id: 'exp_jezero_weather',
        title: 'EXP D: MEDA WEATHER MAST',
        sub: 'Atmospheric Opacity & Wind',
        x: 1500,
        y: 420,
        run: () => this.runWeatherStation()
      }
    ];

    experiments.forEach(e => {
      const isDone = gameState.jezeroCompletedExperiments.includes(e.id);

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

  // --- Experiment A: LiDAR Delta Strata Mapping ---
  private runDeltaScan() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 780, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -135, 'LiDAR DELTA TOPOGRAPHIC & SEDIMENT STRATA RECONSTRUCTION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const desc = this.add.text(0, -40, 'Reconstructing Western Delta bottomsets and prodelta mudstones.\nLiDAR sweeps reveal 3.6 billion-year-old river channels with fine-grain lacustrine silts.\nSilts possess prime chemical conditions for microbial preservation.', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '14px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5);

    const btn = this.add.rectangle(0, 60, 260, 40, 0x0284c7)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const btnTxt = this.add.text(0, 60, 'STORE LiDAR STRATA ARCHIVE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5);

    btn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      if (!gameState.jezeroCompletedExperiments.includes('exp_jezero_delta')) {
        gameState.jezeroCompletedExperiments.push('exp_jezero_delta');
        gameState.addLog('LiDAR SCAN COMPLETE: Delta bathymetry mapped. High-preservation clay targets identified.', 'science');
        this.updateStatus();
        this.time.delayedCall(600, () => this.runDeltaScan());
      }
    });

    this.activePanelContainer.add([bg, title, desc, btn, btnTxt]);
    this.addCloseButton();
  }

  // --- Experiment B: Raman & XRF Spectroscopy ---
  private runRamanSpectroscopy() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 780, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -135, 'ULTRA-DEEP UV RAMAN & MICRO-XRF SPECTRAL PROFILE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const specText = this.add.text(0, -40, 'Peak 1: Fe/Mg-Smectite Clay Minerals (Hydrated phyllosilicates) [CONF: 98%]\nPeak 2: Magnesite & Calcium Carbonates (Neutral aqueous pH environment) [CONF: 94%]\nPeak 3: Reduced Organic Aromatic Carbon Rings [CONF: 91%]', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#34d399',
      align: 'center'
    }).setOrigin(0.5);

    const btn = this.add.rectangle(0, 60, 260, 40, 0x0284c7)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const btnTxt = this.add.text(0, 60, 'CATALOG SPECTRAL DATASET', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5);

    btn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      if (!gameState.jezeroCompletedExperiments.includes('exp_jezero_mineral')) {
        gameState.jezeroCompletedExperiments.push('exp_jezero_mineral');
        gameState.addLog('RAMAN SPECTROMETRY LOGGED: Carbonates and smectites confirm neutral water conditions.', 'science');
        this.updateStatus();
        this.time.delayedCall(600, () => this.runRamanSpectroscopy());
      }
    });

    this.activePanelContainer.add([bg, title, specText, btn, btnTxt]);
    this.addCloseButton();
  }

  // --- Experiment C: Biosignature Extraction ---
  private runBiosignatureExtraction() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 780, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -135, 'HERMETIC TITANIUM SAMPLE TUBE CORE SEALING', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const desc = this.add.text(0, -40, 'Extracting fine-grained organic mudstone core sample #SY-09.\nSealing within ultra-pure gold-lined titanium hermetic sleeve.\nThis core represents the primary astrobiological discovery of the entire mission!', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '14px',
      color: '#f59e0b',
      align: 'center'
    }).setOrigin(0.5);

    const sealBtn = this.add.rectangle(0, 60, 280, 42, 0x10b981)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const sTxt = this.add.text(0, 60, 'SEAL TUBE #SY-09 & STORE IN CRYO', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#050a14'
    }).setOrigin(0.5);

    sealBtn.on('pointerdown', () => {
      soundFx.playAirlockHiss();
      gameState.biosignatureSampleTube = true;
      if (!gameState.jezeroCompletedExperiments.includes('exp_jezero_bio')) {
        gameState.jezeroCompletedExperiments.push('exp_jezero_bio');
        gameState.addLog('CRITICAL DISCOVERY: Sample tube #SY-09 sealed. High-potential biosignatures secured.', 'science');
        this.updateStatus();
        this.time.delayedCall(600, () => this.runBiosignatureExtraction());
      }
    });

    this.activePanelContainer.add([bg, title, desc, sealBtn, sTxt]);
    this.addCloseButton();
  }

  // --- Experiment D: MEDA Weather Station ---
  private runWeatherStation() {
    this.closeActivePanel();
    this.activePanelContainer = this.add.container(960, 720);

    const bg = this.add.rectangle(0, 0, 780, 340, 0x050c18, 0.97)
      .setStrokeStyle(2, 0x38bdf8);

    const title = this.add.text(0, -135, 'MEDA METEOROLOGICAL & DUST MONITORING DEPLOYMENT', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const readings = this.add.text(0, -40, 'Current Atmospheric Readings at Jezero Scarp:\n• Pressure: 610 Pa\n• Surface Temp: -64°C\n• Wind: 18.4 m/s (GUSTS RISING)\n• Dust Opacity (Tau): 1.42 — ALARM: CONTINENT-SCALE DUST FRONT INCOMING!', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#ef4444',
      align: 'center'
    }).setOrigin(0.5);

    const deployBtn = this.add.rectangle(0, 60, 260, 40, 0x0284c7)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const btnTxt = this.add.text(0, 60, 'LOCK WEATHER TELEMETRY', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5);

    deployBtn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      if (!gameState.jezeroCompletedExperiments.includes('exp_jezero_weather')) {
        gameState.jezeroCompletedExperiments.push('exp_jezero_weather');
        gameState.addLog('WEATHER TELEMETRY LOCKED: Severe regional dust storm confirmed tracking toward Jezero.', 'warning');
        this.updateStatus();
        this.time.delayedCall(600, () => this.runWeatherStation());
      }
    });

    this.activePanelContainer.add([bg, title, readings, deployBtn, btnTxt]);
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
    const done = gameState.jezeroCompletedExperiments.length;
    this.expStatusText.setText(`SCIENCE PROGRESS: ${done}/4 EXPERIMENTS EXECUTED`);

    if (done >= 4) {
      this.expStatusText.setText('CRITICAL ADVISORY: DRIVETRAIN DEFICIT DETECTED // DECISION REQUIRED');
      this.expStatusText.setColor('#ef4444');

      // Add Critical Dilemma Trigger Button
      const decisionBtn = this.add.rectangle(960, 960, 440, 48, 0xef4444)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true });

      const dTxt = this.add.text(960, 960, 'OPEN CRITICAL MISSION DECISION', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '13px',
        color: '#ffffff'
      }).setOrigin(0.5);

      decisionBtn.on('pointerdown', () => {
        this.triggerCriticalDecision();
      });
    }
  }

  private triggerCriticalDecision() {
    new DecisionModal(this, {
      title: 'CRITICAL MISSION BRANCHING: THE DUST & THE DRIVE',
      summary: 'LREV diagnostic confirms high mechanical strain in the planetary drive pinion. An apocalyptic regional dust front is closing in. Solar conjunction begins in 36 hours.',
      hazardLevel: 'CANON EVENT',
      choices: [
        {
          text: 'OPTION A: ABORT CORE & RETREAT TO GALE',
          detail: 'Discard final deep-strata core. Turn LREV south and race the dust front back to Gale Crater before radio blackout.',
          consequences: ['Cautious branch', 'Samples abandoned', 'Avoids conjunction stranding'],
          onSelect: () => {
            gameState.jezeroBranchChoice = 'retreat_gale';
            gameState.currentChapter = 'ending';
            gameState.addLog('RETREAT EXECUTED: SYNOR-1 departed Jezero early. Samples left on the outcrop.', 'warning');
            gameState.save();
            this.scene.start('EndingScene');
          }
        },
        {
          text: 'OPTION B: SECURE CANON CORE (SOLAR CONJUNCTION)',
          detail: 'Torque the drill to hermetically seal core tube #SY-09. Drivetrain pinion fractures! Stranded at Jezero Field Shelter for 14-Day Solar Conjunction.',
          consequences: ['Canon narrative', 'Biosignatures saved', '14-Day Conjunction survival'],
          onSelect: () => {
            gameState.jezeroBranchChoice = 'conjunction_survival';
            gameState.initConjunctionValues();
            gameState.addLog('DRIVETRAIN FRACTURED: Rover immobilized. Retreating into Jezero Field Shelter. Conjunction active.', 'alert');
            gameState.save();
            this.scene.start('JezeroShelterScene');
          }
        }
      ]
    });
  }
}

