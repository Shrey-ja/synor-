/**
 * Jezero Field Shelter Scene (Act V: 14-Day Solar Conjunction)
 * The Core Hard-Science Survival Simulation:
 * - 14-Day Event Schedule from conjunction.json
 * - Interactive Power Breaker Grid Load-Balancing
 * - Water-Tank Radiation Storm Bunker
 * - Cryogenic Biosignature Sample Preservation Dilemma
 * - Earth Radio Blackout & DSN Signal Recovery on Day 14
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { DecisionModal } from '../ui/DecisionModal';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';
import { transitionToScene, fadeSceneIn } from '../utils/SceneTransition';

interface ConjunctionChoice {
  text: string;
  detail: string;
  powerDelta?: number;
  co2Delta?: number;
  o2Cost?: number;
  radiationDose?: number;
  thermalDelta?: number;
  foodDelta?: number;
  waterDelta?: number;
  evaRequired?: boolean;
  endingTrigger?: boolean;
}

interface ConjunctionEventDay {
  day: number;
  title: string;
  summary: string;
  event: string;
  choices: ConjunctionChoice[];
}

export class JezeroShelterScene extends Phaser.Scene {
  private conjunctionData: ConjunctionEventDay[] = [];
  private dayIndicatorText!: Phaser.GameObjects.Text;
  private breakerWattageText!: Phaser.GameObjects.Text;
  private breakerSwitches: Record<string, { rect: Phaser.GameObjects.Rectangle; stateTxt: Phaser.GameObjects.Text }> = {};
  private cryoStatusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'JezeroShelterScene' });
  }

  create() {
    gameState.currentLocation = 'jezero_shelter';
    gameState.save();
    audioManager.playMusic(this, 'music_game', { loop: true });
    fadeSceneIn(this);

    // Load conjunction data from cache
    const cachedData = this.cache.json.get('conjunction_data');
    if (cachedData && cachedData.conjunctionDays) {
      this.conjunctionData = cachedData.conjunctionDays;
    }

    // Attach Blender Slot or Procedural Shelter Interior
    attachBlenderSceneSlot(this, 'JEZERO_SHELTER', () => {
      this.createProceduralShelterBackdrop();
    });

    this.createHeader();
    this.createPowerBreakerPanel();
    this.createWaterShieldingVisualizer();
    this.createCryoSampleVault();
    this.createStructuralSystems();
    this.createShelterStations();
    this.createDayProgressionHUD();

    // Check if initial conjunction day event needs to be triggered
    this.time.delayedCall(1200, () => {
      this.promptCurrentDayEvent();
    });
  }

  private createStructuralSystems() {
    const panel = this.add.container(1680, 300);
    const bg = this.add.rectangle(0, 0, 390, 230, 0x070e1c, 0.95)
      .setStrokeStyle(2, 0x38bdf8);
    const title = this.add.text(0, -95, 'OUTPOST STRUCTURE STATUS', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0.5);
    panel.add([bg, title]);

    const components: { key: keyof typeof gameState.shelterUpgrades; label: string; y: number }[] = [
      { key: 'dome', label: 'DOME PRESSURE SHELL', y: -55 },
      { key: 'rimshade', label: 'RIMSHADE THERMAL BAFFLE', y: -20 },
      { key: 'cap', label: 'HABITAT CAP SEAL', y: 15 },
      { key: 'radiationUmbrella', label: 'RADIATION UMBRELLA', y: 50 }
    ];
    components.forEach(component => {
      const state = gameState.shelterUpgrades[component.key];
      const row = this.add.rectangle(0, component.y, 330, 26, state ? 0x064e3b : 0x1e293b, 0.9)
        .setStrokeStyle(1, state ? 0x34d399 : 0x475569)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(0, component.y, `${component.label} // ${state ? 'ONLINE' : 'COMMISSION'}`, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: state ? '#34d399' : '#cbd5e1'
      }).setOrigin(0.5);
      row.on('pointerdown', () => {
        gameState.shelterUpgrades[component.key] = true;
        gameState.resources.shelterProtection = Math.min(100, gameState.resources.shelterProtection + 5);
        gameState.save();
        row.setFillStyle(0x064e3b, 0.9);
        row.setStrokeStyle(1, 0x34d399);
        text.setText(`${component.label} // ONLINE`);
        text.setColor('#34d399');
      });
      panel.add([row, text]);
    });
  }

  private createShelterStations() {
    const panel = this.add.container(1680, 690);
    const bg = this.add.rectangle(0, 0, 390, 250, 0x070e1c, 0.95)
      .setStrokeStyle(2, 0x0284c7);
    const title = this.add.text(0, -105, 'SHELTER SERVICE STATIONS', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0.5);
    panel.add([bg, title]);

    const addStation = (label: string, y: number, action: () => void) => {
      const station = this.add.rectangle(0, y, 320, 38, 0x0f172a, 0.95)
        .setStrokeStyle(1, 0x38bdf8)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(0, y, label, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: '#cbd5e1'
      }).setOrigin(0.5);
      station.on('pointerdown', action);
      panel.add([station, text]);
    };

    addStation('RECHARGE SUIT // O2 + POWER', -60, () => {
      gameState.suitO2 = 100;
      gameState.suitBattery = 100;
      gameState.resources.power = Math.max(0, gameState.resources.power - 3);
      gameState.addLog('SHELTER STATION: EVA suit O2 and battery recharged.', 'system');
      gameState.notifyChange('suit_recharged');
    });
    addStation('ANALYZE JEZERO CORE SAMPLES', 0, () => {
      gameState.addLog(`CORE LAB: ${gameState.regolithSamples} Jezero regolith samples available for analysis.`, 'science');
      gameState.notifyChange('core_analysis');
    });
    addStation('REVIEW SHELTER TELEMETRY', 60, () => {
      gameState.addLog(`SHELTER TELEMETRY: ${Math.round(gameState.resources.shelterProtection)}% protection, ${Math.round(gameState.resources.waterReserve)}% water reserve.`, 'system');
      gameState.notifyChange('shelter_review');
    });
  }

  private createProceduralShelterBackdrop() {
    // Interior pressurized cabin walls (dark titanium composites)
    this.add.rectangle(960, 540, 1920, 1080, 0x050912);

    // Reinforced Observation Viewport showing raging dust storm
    const windowFrame = this.add.rectangle(880, 200, 460, 180, 0x0f172a)
      .setStrokeStyle(3, 0x334155);

    // Outside dust storm red-amber haze
    const stormSky = this.add.rectangle(880, 200, 440, 160, 0x7c2d12, 0.9);

    // Swirling dust particles inside window view
    for (let p = 0; p < 30; p++) {
      const px = 680 + Math.random() * 400;
      const py = 130 + Math.random() * 140;
      const particle = this.add.circle(px, py, 2, 0xf59e0b, 0.6);
      this.tweens.add({
        targets: particle,
        x: px + 180,
        y: py + Phaser.Math.Between(-30, 30),
        alpha: { from: 0.8, to: 0.1 },
        duration: Phaser.Math.Between(800, 1500),
        repeat: -1,
        ease: 'Linear'
      });
    }

    // Window label
    this.add.text(880, 130, 'EXTERNAL VIEWPORT // REGIONAL DUST STORM', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '10px',
      color: '#f59e0b'
    }).setOrigin(0.5);

    // Emergency red/amber cabin strip light
    const emergencyLight = this.add.rectangle(960, 30, 1800, 4, 0xef4444, 0.8);
    this.tweens.add({
      targets: emergencyLight,
      alpha: { from: 0.8, to: 0.3 },
      duration: 1600,
      yoyo: true,
      repeat: -1
    });
  }

  private createHeader() {
    const header = this.add.container(960, 75);
    const bg = this.add.rectangle(0, 0, 1100, 50, 0x030712, 0.94)
      .setStrokeStyle(2, 0xef4444, 0.8);

    const title = this.add.text(0, -10, 'ACT V: JEZERO FIELD SHELTER — SOLAR CONJUNCTION MODE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#ef4444',
      letterSpacing: 2
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, 12, 'EARTH RADIO UPLINK INTERRUPTED BY CORONAL PLASMA // 14 SOLS OF SILENCE', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#cbd5e1'
    }).setOrigin(0.5);

    header.add([bg, title, subtitle]);
  }

  private createPowerBreakerPanel() {
    const panel = this.add.container(360, 520);
    const bg = this.add.rectangle(0, 0, 340, 440, 0x070e1c, 0.95)
      .setStrokeStyle(2, 0x0284c7);

    const title = this.add.text(0, -190, 'POWER LOAD-BALANCING BUS', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '13px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const { used, max } = gameState.getBreakerWattage();
    this.breakerWattageText = this.add.text(0, -165, `NET BUS LOAD: ${used}W / ${max}W`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: used > max ? '#ef4444' : '#34d399'
    }).setOrigin(0.5);

    panel.add([bg, title, this.breakerWattageText]);

    const breakersList: { key: keyof typeof gameState.breakers; name: string; watt: number; y: number }[] = [
      { key: 'lifeSupport', name: 'ECLSS O2/CO2 SCRUBBERS', watt: 30, y: -110 },
      { key: 'thermalHeating', name: 'CABIN THERMAL HEATING', watt: 25, y: -45 },
      { key: 'waterFiltration', name: 'HYDRO RECYCLING UNIT', watt: 20, y: 20 },
      { key: 'sampleCryo', name: 'SAMPLE CRYO-VAULT', watt: 20, y: 85 },
      { key: 'commsGreenhouse', name: 'COMMS & GREENHOUSE', watt: 15, y: 150 }
    ];

    breakersList.forEach(b => {
      const isOn = gameState.breakers[b.key];

      const bBox = this.add.rectangle(0, b.y, 300, 52, 0x0f172a)
        .setStrokeStyle(1, isOn ? 0x10b981 : 0xef4444)
        .setInteractive({ useHandCursor: true });

      const nameTxt = this.add.text(-130, b.y - 10, b.name, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '12px',
        color: '#f8fafc'
      });

      const wattTxt = this.add.text(-130, b.y + 8, `${b.watt}W DRAW`, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: '#94a3b8'
      });

      const stateTxt = this.add.text(100, b.y, isOn ? 'ONLINE' : 'OFFLINE', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: isOn ? '#34d399' : '#ef4444'
      }).setOrigin(0.5);

      this.breakerSwitches[b.key] = { rect: bBox, stateTxt };

      bBox.on('pointerdown', () => {
        const newState = gameState.toggleBreaker(b.key);
        soundFx.playClick(newState ? 1200 : 600);
        this.updateBreakersUI();
      });

      panel.add([bBox, nameTxt, wattTxt, stateTxt]);
    });
  }

  private updateBreakersUI() {
    const { used, max } = gameState.getBreakerWattage();
    this.breakerWattageText.setText(`NET BUS LOAD: ${used}W / ${max}W`);
    this.breakerWattageText.setColor(used > max ? '#ef4444' : '#34d399');

    (Object.keys(this.breakerSwitches) as (keyof typeof gameState.breakers)[]).forEach(key => {
      const item = this.breakerSwitches[key];
      const isOn = gameState.breakers[key];
      item.rect.setStrokeStyle(1, isOn ? 0x10b981 : 0xef4444);
      item.stateTxt.setText(isOn ? 'ONLINE' : 'OFFLINE');
      item.stateTxt.setColor(isOn ? '#34d399' : '#ef4444');
    });

    // Update Cryo text
    if (!gameState.breakers.sampleCryo) {
      this.cryoStatusText.setText('CRYO-STORAGE: UNPOWERED [SAMPLES THAWING]');
      this.cryoStatusText.setColor('#ef4444');
    } else {
      this.cryoStatusText.setText(`CRYO-STORAGE: -80°C NOMINAL [${Math.round(gameState.sciencePreservedPercent)}% INTEGRITY]`);
      this.cryoStatusText.setColor('#34d399');
    }
  }

  private createWaterShieldingVisualizer() {
    const bunker = this.add.container(880, 520);
    const bg = this.add.rectangle(0, 0, 360, 440, 0x070e1c, 0.95)
      .setStrokeStyle(2, 0x0284c7);

    const title = this.add.text(0, -190, 'WATER-SHIELDED STORM BUNKER', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const desc = this.add.text(0, -150, 'Stored habitat water tanks surround storm refuge,\nabsorbing secondary neutron and SPE cosmic rays.', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '12px',
      color: '#94a3b8',
      align: 'center'
    }).setOrigin(0.5);

    // Water bladder graphic
    const waterLevelRatio = gameState.resources.waterReserve / 100;
    const waterBar = this.add.rectangle(0, -10, 240, 160 * waterLevelRatio, 0x0284c7, 0.7)
      .setStrokeStyle(2, 0x38bdf8);

    const effShielding = Math.round(gameState.resources.shelterProtection * waterLevelRatio);
    const shieldStats = this.add.text(0, 120, `EFFECTIVE HYDRO-SHIELDING: ${effShielding}%\nCUMULATIVE DOSE: ${gameState.hazards.radiationDoseMsv.toFixed(1)} mSv`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: effShielding > 50 ? '#34d399' : '#ef4444',
      align: 'center'
    }).setOrigin(0.5);

    bunker.add([bg, title, desc, waterBar, shieldStats]);
  }

  private createCryoSampleVault() {
    const vault = this.add.container(1420, 520);
    const bg = this.add.rectangle(0, 0, 360, 440, 0x070e1c, 0.95)
      .setStrokeStyle(2, 0x0284c7);

    const title = this.add.text(0, -190, 'ASTROBIOLOGY CRYO-VAULT', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const tubeIcon = this.add.rectangle(0, -50, 60, 160, 0xd4af37, 0.8)
      .setStrokeStyle(3, 0xffffff);

    const tubeLbl = this.add.text(0, -50, 'JEZERO\n#SY-09', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '10px',
      color: '#050a14',
      align: 'center'
    }).setOrigin(0.5);

    this.cryoStatusText = this.add.text(0, 70, `CRYO-STORAGE: -80°C NOMINAL [${Math.round(gameState.sciencePreservedPercent)}% INTEGRITY]`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#34d399',
      align: 'center',
      wordWrap: { width: 320 }
    }).setOrigin(0.5);

    const tip = this.add.text(0, 140, 'Core Dilemma: Shutting off cryo-vault saves 20W power\nfor life-support, but degrades ancient biosignatures.', {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '12px',
      color: '#f59e0b',
      align: 'center',
      wordWrap: { width: 320 }
    }).setOrigin(0.5);

    vault.add([bg, title, tubeIcon, tubeLbl, this.cryoStatusText, tip]);
  }

  private createDayProgressionHUD() {
    const hud = this.add.container(960, 950);
    const bg = this.add.rectangle(0, 0, 780, 54, 0x030712, 0.95)
      .setStrokeStyle(2, 0x38bdf8);

    this.dayIndicatorText = this.add.text(-220, 0, `SOLAR CONJUNCTION: DAY ${gameState.conjunctionDay} / 14`, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0, 0.5);

    const advBtn = this.add.rectangle(240, 0, 220, 38, 0x0284c7)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const advTxt = this.add.text(240, 0, 'ADVANCE TO NEXT SOL', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5);

    advBtn.on('pointerdown', () => {
      this.advanceConjunctionSol();
    });

    hud.add([bg, this.dayIndicatorText, advBtn, advTxt]);
  }

  private advanceConjunctionSol() {
    soundFx.playTelemetryChirp();

    if (gameState.conjunctionDay < 14) {
      gameState.conjunctionDay++;
      this.dayIndicatorText.setText(`SOLAR CONJUNCTION: DAY ${gameState.conjunctionDay} / 14`);
      gameState.addLog(`SOLAR CONJUNCTION: Sol ${gameState.conjunctionDay} commenced.`, 'system');
      gameState.save();
      this.promptCurrentDayEvent();
    } else {
      // Day 14 Signal Recovery!
      soundFx.playTelemetryChirp();
      gameState.dsnLocked = true;
      gameState.currentChapter = 'ending';
      gameState.save();
      transitionToScene(this, 'EndingScene');
    }
  }

  private promptCurrentDayEvent() {
    const dayEvent = this.conjunctionData.find(d => d.day === gameState.conjunctionDay);
    if (!dayEvent) return;

    new DecisionModal(this, {
      title: `DAY ${dayEvent.day}: ${dayEvent.title.toUpperCase()}`,
      summary: `${dayEvent.summary}\n\n[EVENT]: ${dayEvent.event}`,
      hazardLevel: dayEvent.day === 6 ? 'CRITICAL' : 'ELEVATED',
      choices: dayEvent.choices.map(c => ({
        text: c.text,
        detail: c.detail,
        powerDelta: c.powerDelta,
        o2Cost: c.o2Cost,
        radiationDose: c.radiationDose,
        thermalDelta: c.thermalDelta,
        onSelect: () => {
          this.applyChoiceEffects(c);
        }
      }))
    });
  }

  private applyChoiceEffects(choice: ConjunctionChoice) {
    if (choice.powerDelta) {
      gameState.resources.power = Math.max(0, Math.min(100, gameState.resources.power + choice.powerDelta));
    }
    if (choice.co2Delta) {
      gameState.hazards.co2Ppm = Math.max(400, gameState.hazards.co2Ppm + choice.co2Delta);
    }
    if (choice.radiationDose) {
      gameState.hazards.radiationDoseMsv += choice.radiationDose;
    }
    if (choice.thermalDelta) {
      gameState.resources.thermalStability = Math.max(0, Math.min(100, gameState.resources.thermalStability + choice.thermalDelta));
    }
    if (choice.waterDelta) {
      gameState.resources.waterReserve = Math.max(0, Math.min(100, gameState.resources.waterReserve + choice.waterDelta));
    }
    if (choice.evaRequired) {
      soundFx.playAirlockHiss();
      gameState.addLog(`EVA EXECUTED: Performed exterior mission in dust storm.`, 'warning');
    }
    if (choice.endingTrigger) {
      transitionToScene(this, 'EndingScene');
    }
    this.updateBreakersUI();
  }
}

