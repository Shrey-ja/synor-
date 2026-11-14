/**
 * Gale Crater Base Scene (Act I Prologue & Act III Return)
 * Station commissioning nodes: Habitat Core, Solar Yard, ECLSS, Hydro-Loop,
 * Regolith Bunker, and High-Gain Earth Dish.
 * Includes Act III Arcadia telemetry ingestion & rover overhaul.
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';

export class GaleBaseScene extends Phaser.Scene {
  private statusBanner!: Phaser.GameObjects.Text;
  private actionDialogContainer!: Phaser.GameObjects.Container;
  private astronautSprite!: Phaser.GameObjects.Sprite;
  private isAstronautWalking = false;

  constructor() {
    super({ key: 'GaleBaseScene' });
  }

  create() {
    // Attach Blender Slot or Procedural Base Backdrop
    attachBlenderSceneSlot(this, 'GALE_BASE', () => {
      this.createProceduralGaleBase();
    });

    this.createInteractiveNodes();
    this.createAstronautCharacter();
    this.createMissionHeader();

    // Click ground to walk astronaut
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // If clicking lower terrain area, walk there
      if (pointer.y > 450 && pointer.y < 950 && !this.actionDialogContainer) {
        this.walkAstronautTo(pointer.x, pointer.y);
      }
    });

    // Check if entering for Act III return
    if (gameState.currentChapter === 'act_3_gale_return') {
      this.createAct3Upgrades();
    }
  }

  private createAstronautCharacter() {
    if (this.textures.exists('astronaut_walk')) {
      this.astronautSprite = this.add.sprite(960, 620, 'astronaut_walk', 0)
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
    const duration = (dist / 140) * 1000; // Realistic walking pace

    this.astronautSprite.setFlipX(targetX < this.astronautSprite.x);
    this.astronautSprite.play('astro_walk_anim');
    this.isAstronautWalking = true;

    this.tweens.killTweensOf(this.astronautSprite);
    this.tweens.add({
      targets: this.astronautSprite,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.isAstronautWalking = false;
        this.astronautSprite.play('astro_idle_anim');
        if (onArrival) onArrival();
      }
    });
  }

  private createProceduralGaleBase() {
    // Ochre Martian Terrain & Foothills of Aeolis Mons (Mount Sharp)
    const sky = this.add.rectangle(960, 240, 1920, 480, 0xb45309, 0.45);
    const ground = this.add.rectangle(960, 780, 1920, 600, 0x7c2d12);

    // Layered Aeolis Mons mountain silhouettes
    const mountain = this.add.triangle(960, 480, 200, 520, 960, 180, 1720, 520, 0x9a3412);
    mountain.setAlpha(0.65);

    // Rover parked on landing pad
    const pad = this.add.ellipse(960, 840, 520, 180, 0x1e293b, 0.8)
      .setStrokeStyle(2, 0x475569);

    // Draw procedural outpost buildings
    // Habitat Core Dome & Tunnel
    this.add.ellipse(960, 480, 240, 140, 0xe2e8f0, 0.95)
      .setStrokeStyle(3, 0x94a3b8);
    this.add.rectangle(960, 510, 80, 40, 0x475569);

    // Solar panels yard
    for (let p = 0; p < 4; p++) {
      this.add.rectangle(350 + p * 50, 420, 36, 60, 0x1e3a8a)
        .setStrokeStyle(1, 0x60a5fa);
    }

    // Kilopower Fission Radiator
    this.add.rectangle(420, 340, 24, 70, 0x334155);
    this.add.circle(420, 310, 14, 0xf59e0b, 0.4);

    // ECLSS & Hydro Tanks
    this.add.rectangle(740, 680, 70, 90, 0x475569)
      .setStrokeStyle(2, 0x38bdf8);
    this.add.rectangle(1180, 680, 70, 90, 0x0284c7)
      .setStrokeStyle(2, 0x38bdf8);

    // Regolith Storm Bunker
    this.add.ellipse(1480, 440, 240, 140, 0x451a03)
      .setStrokeStyle(2, 0x78350f);

    // High Gain Dish Antenna
    this.add.line(1580, 240, 0, 50, 0, 0, 0x94a3b8).setLineWidth(4);
    this.add.arc(1580, 200, 35, 200, 340, false, 0xe2e8f0).setStrokeStyle(3, 0xffffff);
  }

  private createMissionHeader() {
    const isAct3 = gameState.currentChapter === 'act_3_gale_return';
    const headerTitle = isAct3
      ? 'ACT III: GALE CRATER — INGESTING ARCADIA DATA & RE-OUTFITTING LREV'
      : 'ACT I: PROLOGUE — GALE CRATER BASE COMMISSIONING';

    const header = this.add.container(960, 90);
    const hBg = this.add.rectangle(0, 0, 980, 54, 0x070d18, 0.88)
      .setStrokeStyle(1, 0x38bdf8, 0.5);

    const hText = this.add.text(0, -10, headerTitle, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '15px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.statusBanner = this.add.text(0, 14, '', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    header.add([hBg, hText, this.statusBanner]);
    this.updateStatusBanner();
  }

  private createInteractiveNodes() {
    const nodes = [
      {
        id: 'hab_core',
        name: 'Habitat Core Bulkhead',
        x: 960,
        y: 480,
        desc: 'Run 101.3 kPa pressure integrity cycle & airlock seal verification.',
        onCommission: () => {
          gameState.resources.airReserve = Math.min(100, gameState.resources.airReserve + 5);
          gameState.addLog('HABITAT CORE: Atmospheric pressure verified at 101.3 kPa. Bulkheads sealed.', 'system');
        }
      },
      {
        id: 'solar_yard',
        name: 'Solar & Kilopower Bus',
        x: 420,
        y: 420,
        desc: 'Couple photovoltaic field arrays to main battery storage bank.',
        onCommission: () => {
          gameState.resources.power = Math.min(100, gameState.resources.power + 15);
          gameState.addLog('POWER BUS: 8x Photovoltaic trackers synchronized. Battery charging nominal.', 'system');
        }
      },
      {
        id: 'eclss_rack',
        name: 'ECLSS Life Support Rack',
        x: 740,
        y: 680,
        desc: 'Prime water electrolysis O2 generator and solid amine CO2 scrubbers.',
        onCommission: () => {
          gameState.hazards.co2Ppm = 450;
          gameState.addLog('ECLSS RACK: Sabatier reactor and CO2 scrubbers operating at 99.4% efficiency.', 'system');
        }
      },
      {
        id: 'hydro_loop',
        name: 'Hydro-Loop Distillation',
        x: 1180,
        y: 680,
        desc: 'Initialize closed-loop graywater distillation and vapor recovery pumps.',
        onCommission: () => {
          gameState.resources.waterReserve = Math.min(100, gameState.resources.waterReserve + 10);
          gameState.addLog('HYDRO-LOOP: Graywater multi-stage filtration online. 93% water recovery achieved.', 'system');
        }
      },
      {
        id: 'rad_bunker',
        name: 'Regolith Storm Bunker',
        x: 1480,
        y: 440,
        desc: 'Deploy autonomous robotic dozers to heap 1.5m regolith over storm shelter.',
        onCommission: () => {
          gameState.resources.shelterProtection = 95;
          gameState.addLog('STORM BUNKER: 1.5m Martian regolith shielding completed. Galactic Cosmic Ray dose reduced.', 'system');
        }
      },
      {
        id: 'high_gain',
        name: 'High-Gain Earth Dish',
        x: 1580,
        y: 220,
        desc: 'Align high-gain parabolic reflector toward Deep Space Network Goldstone relay.',
        onCommission: () => {
          gameState.dsnLocked = true;
          gameState.addLog('HIGH-GAIN ANTENNA: 34m DSN lock acquired. Act II orders received from Houston.', 'capcom');
        }
      }
    ];

    nodes.forEach(n => {
      const isDone = gameState.galeCommissionedNodes.includes(n.id);

      const marker = this.add.container(n.x, n.y);
      const ring = this.add.circle(0, 0, 22, isDone ? 0x10b981 : 0x0284c7, 0.4)
        .setStrokeStyle(2, isDone ? 0x34d399 : 0x38bdf8);

      const iconText = this.add.text(0, 0, isDone ? '✓' : '!', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '14px',
        color: isDone ? '#34d399' : '#ffffff'
      }).setOrigin(0.5);

      const lbl = this.add.text(0, 32, n.name, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: isDone ? '#34d399' : '#38bdf8',
        backgroundColor: '#050a14'
      }).setOrigin(0.5);

      marker.add([ring, iconText, lbl]);

      ring.setInteractive({ useHandCursor: true });
      ring.on('pointerdown', () => {
        soundFx.playClick(isDone ? 600 : 1100);
        this.openNodeDialog(n);
      });

      ring.on('pointerover', () => {
        ring.setScale(1.2);
        soundFx.playClick(900);
      });

      ring.on('pointerout', () => {
        ring.setScale(1.0);
      });
    });
  }

  private openNodeDialog(node: { id: string; name: string; desc: string; onCommission: () => void }) {
    if (this.actionDialogContainer) {
      this.actionDialogContainer.destroy();
    }

    const isDone = gameState.galeCommissionedNodes.includes(node.id);

    this.actionDialogContainer = this.add.container(960, 680);
    const bg = this.add.rectangle(0, 0, 580, 200, 0x070e1c, 0.96)
      .setStrokeStyle(2, isDone ? 0x10b981 : 0x38bdf8);

    const title = this.add.text(0, -65, `NODE: ${node.name.toUpperCase()}`, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '15px',
      color: isDone ? '#34d399' : '#38bdf8'
    }).setOrigin(0.5);

    const desc = this.add.text(0, -25, node.desc, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '14px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 500 }
    }).setOrigin(0.5);

    const btn = this.add.rectangle(0, 45, 240, 36, isDone ? 0x1e293b : 0x0284c7)
      .setStrokeStyle(1, isDone ? 0x475569 : 0x38bdf8)
      .setInteractive({ useHandCursor: !isDone });

    const btnText = this.add.text(0, 45, isDone ? 'NODE OPERATIONAL' : 'COMMISSION NODE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: isDone ? '#94a3b8' : '#ffffff'
    }).setOrigin(0.5);

    if (!isDone) {
      btn.on('pointerdown', () => {
        soundFx.playTelemetryChirp();
        gameState.galeCommissionedNodes.push(node.id);
        node.onCommission();
        this.actionDialogContainer.destroy();
        this.scene.restart();
      });
    }

    // Close button
    const closeBtn = this.add.text(260, -85, '✕', {
      fontSize: '18px',
      color: '#94a3b8'
    }).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.actionDialogContainer.destroy();
    });

    this.actionDialogContainer.add([bg, title, desc, btn, btnText, closeBtn]);
  }

  private updateStatusBanner() {
    const total = 6;
    const done = gameState.galeCommissionedNodes.length;
    this.statusBanner.setText(`BASE READINESS: ${done}/${total} NODES COMMISSIONED`);

    if (done === total && gameState.currentChapter === 'act_1_prologue') {
      this.statusBanner.setText('ALL GALE SYSTEMS NOMINAL // EXPEDITION TRAVERSE ROUTE UNLOCKED');
      this.statusBanner.setColor('#34d399');

      // Add Button to open NASA Mars Trek Traverse Planner
      const navBtn = this.add.rectangle(960, 960, 380, 44, 0x0284c7)
        .setStrokeStyle(2, 0x38bdf8)
        .setInteractive({ useHandCursor: true });

      const navText = this.add.text(960, 960, 'LAUNCH MARS TREK TRAVERSE PLANNER', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '13px',
        color: '#ffffff'
      }).setOrigin(0.5);

      navBtn.on('pointerdown', () => {
        soundFx.playClick(1200);
        gameState.currentChapter = 'act_2_arcadia';
        gameState.save();
        this.scene.start('ExpeditionMapScene');
      });
    }
  }

  private createAct3Upgrades() {
    // Act III Return Stations UI
    const upgCont = this.add.container(960, 940);
    const upgBg = this.add.rectangle(0, 0, 720, 64, 0x050c18, 0.95)
      .setStrokeStyle(2, 0x10b981);

    const txt = this.add.text(-220, 0, 'ACT III: UPLOAD ARCADIA WATER DATA & PREP JEZERO EXPEDITION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#34d399'
    }).setOrigin(0, 0.5);

    const actionBtn = this.add.rectangle(240, 0, 200, 36, 0x10b981)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const actionBtnTxt = this.add.text(240, 0, 'SYNTHESIZE & PROCEED', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#050a14'
    }).setOrigin(0.5);

    actionBtn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      gameState.arcadiaWaterFiltered = true;
      gameState.resources.airReserve = 100;
      gameState.resources.power = 100;
      gameState.resources.waterReserve = 100;
      gameState.currentChapter = 'act_4_jezero';
      gameState.addLog('ACT III COMPLETE: Nanofiltration membranes synthesized. LREV fully refueled for Jezero Crater.', 'science');
      gameState.save();
      this.scene.start('ExpeditionMapScene');
    });

    upgCont.add([upgBg, txt, actionBtn, actionBtnTxt]);
  }
}

