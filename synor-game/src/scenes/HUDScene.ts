/**
 * Persistent Telemetry HUD Scene
 * Renders diegetic mission control gauges, CO2/radiation meters,
 * airlock control button, comms audio/text log feed, and audio settings shortcut.
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { resourceEngine } from '../state/ResourceEngine';
import { AudioSettingsModal } from '../ui/AudioSettingsModal';
import { soundFx } from '../utils/ProceduralAudio';
import { uiSfx } from '../utils/UISoundFX';
import { attachUIInteraction } from '../utils/UIInteraction';

export class HUDScene extends Phaser.Scene {
  private barsContainer!: Phaser.GameObjects.Container;
  private logContainer!: Phaser.GameObjects.Container;
  private logText!: Phaser.GameObjects.Text;
  private logVisible: boolean = false;
  private evaBtnText!: Phaser.GameObjects.Text;
  private evaBtn!: Phaser.GameObjects.Rectangle;
  private readonly onStateChange = () => this.updateTelemetry();

  constructor() {
    super({ key: 'HUDScene' });
  }

  create() {
    this.createTopTelemetryBar();
    this.createBottomCommsBar();

    // Ensure HUD is rendered above all world scenes
    this.scene.bringToTop();

    // Initial update now that all bars and buttons are fully initialized
    this.updateTelemetry();

    // Listen for state changes
    gameState.removeEventListener('change', this.onStateChange);
    gameState.addEventListener('change', this.onStateChange);
    this.events.once('shutdown', this.handleShutdown, this);

    // Start background simulation
    resourceEngine.startSimulation();
  }

  private handleShutdown() {
    gameState.removeEventListener('change', this.onStateChange);
    resourceEngine.stopSimulation();
  }

  private createTopTelemetryBar() {
    const topBar = this.add.rectangle(960, 24, 1920, 48, 0x050a14, 0.9)
      .setStrokeStyle(1, 0x1e293b);

    // Astronaut Avatar Portrait
    if (this.textures.exists('astronaut_portrait')) {
      this.add.image(30, 24, 'astronaut_portrait')
        .setDisplaySize(28, 36);
      this.add.rectangle(30, 24, 30, 38)
        .setStrokeStyle(1, 0x38bdf8, 0.7);
    }

    // Title / Sol Badge
    const title = this.add.text(58, 24, 'SYNOR-1 // MISSION TELEMETRY', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0, 0.5);

    // Telemetry Indicators Container
    this.barsContainer = this.add.container(0, 0);

    // Audio Settings Shortcut Button
    const audioBtn = this.add.rectangle(1850, 24, 100, 30, 0x1e293b, 0.8)
      .setStrokeStyle(1, 0x38bdf8, 0.8)
      .setInteractive({ useHandCursor: true });

    const audioBtnText = this.add.text(1850, 24, 'AUDIO BUS', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    audioBtn.on('pointerdown', () => {
      soundFx.playClick(1000);
      new AudioSettingsModal(this);
    });

    audioBtn.on('pointerover', () => audioBtn.setFillStyle(0x38bdf8, 0.25));
    audioBtn.on('pointerout', () => audioBtn.setFillStyle(0x1e293b, 0.8));

    // Enhanced interaction (additive)
    attachUIInteraction(this, audioBtn, {
      colorTarget:      audioBtn,
      hoverFill:        0x38bdf8,
      hoverFillAlpha:   0.3,
      defaultFill:      0x1e293b,
      defaultFillAlpha: 0.8,
      hoverStroke:      0x38bdf8,
      hoverStrokeWidth: 1.5,
      defaultStroke:    0x38bdf8,
      defaultStrokeWidth: 1,
      defaultStrokeAlpha: 0.8,
      soundType:        'telemetry',
      hoverScale:       1.04,
      pressScale:       0.96,
      tooltip:          'Open audio calibration panel (Master / Music / SFX gain buses).',
      tooltipOffsetX:   -180,
      tooltipOffsetY:   28,
      tooltipDepth:     8000,
    });
  }

  private createBottomCommsBar() {
    // Bottom dock
    const botBar = this.add.rectangle(960, 1056, 1920, 48, 0x050a14, 0.92)
      .setStrokeStyle(1, 0x1e293b);

    // Comms Log Toggle
    const commsBtn = this.add.rectangle(120, 1056, 180, 32, 0x0f172a, 0.9)
      .setStrokeStyle(1, 0x38bdf8)
      .setInteractive({ useHandCursor: true });

    const commsBtnText = this.add.text(120, 1056, 'COMMS ARCHIVE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    // EVA Airlock Toggle Button
    this.evaBtn = this.add.rectangle(320, 1056, 180, 32, 0x1e293b, 0.9)
      .setStrokeStyle(1, 0x10b981)
      .setInteractive({ useHandCursor: true });

    this.evaBtnText = this.add.text(320, 1056, 'CYCLE AIRLOCK [EVA]', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#10b981'
    }).setOrigin(0.5);

    this.evaBtn.on('pointerdown', () => {
      resourceEngine.cycleAirlock();
      this.updateTelemetry();
    });

    // Expandable Log Drawer
    this.logContainer = this.add.container(20, 720);
    this.logContainer.setVisible(false);

    const logBg = this.add.rectangle(460, 140, 920, 280, 0x030712, 0.96)
      .setStrokeStyle(1, 0x38bdf8, 0.6)
      .setOrigin(0.5);

    const logHeader = this.add.text(20, 15, 'CAPCOM & FLIGHT TELEMETRY LOG BUFFER', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8'
    });

    this.logText = this.add.text(20, 45, '', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#94a3b8',
      wordWrap: { width: 880 }
    });

    this.logContainer.add([logBg, logHeader, this.logText]);

    if (this.textures.exists('astronaut_portrait')) {
      const commsAvatar = this.add.image(860, 65, 'astronaut_portrait')
        .setDisplaySize(54, 76);
      const commsBorder = this.add.rectangle(860, 65, 58, 80)
        .setStrokeStyle(1, 0x38bdf8, 0.8);
      this.logContainer.add([commsAvatar, commsBorder]);
    }

    commsBtn.on('pointerdown', () => {
      this.logVisible = !this.logVisible;
      this.logContainer.setVisible(this.logVisible);
      soundFx.playClick(850);
      this.refreshLogFeed();
    });

    // Enhanced interaction (additive)
    attachUIInteraction(this, commsBtn, {
      colorTarget:      commsBtn,
      hoverFill:        0x38bdf8,
      hoverFillAlpha:   0.2,
      defaultFill:      0x0f172a,
      defaultFillAlpha: 0.9,
      hoverStroke:      0x38bdf8,
      hoverStrokeWidth: 1.5,
      defaultStroke:    0x38bdf8,
      defaultStrokeWidth: 1,
      soundType:        'confirm',
      hoverScale:       1.04,
      pressScale:       0.96,
      tooltip:          'View CAPCOM & flight telemetry comms log buffer.',
      tooltipOffsetX:   24,
      tooltipOffsetY:   -34,
      tooltipDepth:     8000,
    });

    // EVA button enhanced interaction (additive)
    attachUIInteraction(this, this.evaBtn, {
      colorTarget:      this.evaBtn,
      hoverFill:        0x10b981,
      hoverFillAlpha:   0.2,
      defaultFill:      0x1e293b,
      defaultFillAlpha: 0.9,
      hoverStroke:      0x10b981,
      hoverStrokeWidth: 1.5,
      defaultStroke:    0x10b981,
      defaultStrokeWidth: 1,
      soundType:        'confirm',
      hoverScale:       1.04,
      pressScale:       0.96,
      tooltip:          'Cycle the habitat airlock. Consumes 3% air reserve to pressurize EVA seal.',
      tooltipOffsetX:   24,
      tooltipOffsetY:   -34,
      tooltipDepth:     8000,
    });

    // Live Feed Preview Text in Bottom Bar
    this.bottomPreview = this.add.text(440, 1056, 'TRANSMISSION READY.', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#38bdf8'
    }).setOrigin(0, 0.5);
  }

  private bottomPreview!: Phaser.GameObjects.Text;

  public updateTelemetry() {
    this.barsContainer.removeAll(true);

    const res = gameState.resources;
    const haz = gameState.hazards;
    const breakers = gameState.breakers;

    const metrics = [
      { label: 'AIR', val: Math.round(res.airReserve), unit: '%', alert: res.airReserve < 20 },
      { label: 'H2O', val: Math.round(res.waterReserve), unit: '%', alert: res.waterReserve < 20 },
      { label: 'PWR', val: Math.round(res.power), unit: '%', alert: res.power < 20 },
      { label: 'FOOD', val: Math.round(res.food), unit: '%', alert: res.food < 20 },
      { label: 'THERM', val: Math.round(res.thermalStability), unit: '%', alert: res.thermalStability < 30 },
      { label: 'SHIELD', val: Math.round(res.shelterProtection * (res.waterReserve / 100)), unit: '%', alert: false },
      { label: 'CO2', val: Math.round(haz.co2Ppm), unit: 'ppm', alert: haz.co2Ppm > 3000 },
      { label: 'RAD', val: haz.radiationDoseMsv.toFixed(1), unit: 'mSv', alert: haz.radiationDoseMsv > 80 },
      { label: 'SUIT', val: Math.round(gameState.suitBattery), unit: '%', alert: gameState.suitBattery < 20 },
      { label: 'ICE', val: Math.round(gameState.waterIceReserve), unit: '%', alert: false },
      { label: 'LOC', val: gameState.currentLocation.toUpperCase(), unit: '', alert: false }
    ];

    let startX = 300;
    const itemWidth = 110;

    metrics.forEach((m, idx) => {
      const x = startX + idx * itemWidth;
      const color = m.alert ? '#ef4444' : '#38bdf8';

      const lbl = this.add.text(x, 15, m.label, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '11px',
        color: '#94a3b8'
      }).setOrigin(0, 0.5);

      const val = this.add.text(x, 32, `${m.val}${m.unit}`, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '13px',
        color: color
      }).setOrigin(0, 0.5);

      this.barsContainer.add([lbl, val]);
    });

    // Suit status if in EVA
    if (gameState.evaActive) {
      const evaBox = this.add.rectangle(1340, 24, 240, 32, 0xef4444, 0.2)
        .setStrokeStyle(1, 0xef4444);
      const evaText = this.add.text(1340, 24, `EVA ACTIVE | O2: ${Math.round(gameState.suitO2)}% | BAT: ${Math.round(gameState.suitBattery)}%`, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: '#f87171'
      }).setOrigin(0.5);
      this.barsContainer.add([evaBox, evaText]);

      if (this.evaBtn && this.evaBtnText) {
        this.evaBtn.setStrokeStyle(1, 0xef4444);
        this.evaBtnText.setText('RE-ENTER AIRLOCK [HAB]');
        this.evaBtnText.setColor('#ef4444');
      }
    } else {
      if (this.evaBtn && this.evaBtnText) {
        this.evaBtn.setStrokeStyle(1, 0x10b981);
        this.evaBtnText.setText('CYCLE AIRLOCK [EVA]');
        this.evaBtnText.setColor('#10b981');
      }
    }

    // Update bottom preview with latest log
    if (this.bottomPreview && gameState.logs.length > 0) {
      const latest = gameState.logs[0];
      this.bottomPreview.setText(`[${latest.timestamp}] ${latest.text.substring(0, 110)}`);
    }

    if (this.logVisible) {
      this.refreshLogFeed();
    }
  }

  private refreshLogFeed() {
    const textLines = gameState.logs.slice(0, 10).map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`);
    this.logText.setText(textLines.join('\n\n'));
  }
}

