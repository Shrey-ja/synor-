/**
 * Interactive NASA Mars Trek Traverse Planner Scene
 * Simulates multi-week autonomous LREV rover expeditions across real Martian coordinates.
 * Features Great-Circle pathing, cargo depots, zoomable MOLA map, distance telemetry,
 * and continuous in-game background music.
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import {
  MARS_SITES,
  CARGO_DEPOTS,
  projectMarsToCanvas,
  calculateTraverseDistanceKm,
  getTraverseWaypoints,
  MarsCoord
} from '../utils/MarsGeo';
import { ProceduralGraphics } from '../utils/ProceduralGraphics';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';

export class ExpeditionMapScene extends Phaser.Scene {
  private mapWidth = 1400;
  private mapHeight = 700;
  private mapOriginX = 260;
  private mapOriginY = 160;

  private roverSprite!: Phaser.GameObjects.Arc;
  private isTraversing = false;

  private currentTargetSite!: MarsCoord;
  private currentOriginSite!: MarsCoord;
  private totalDistanceKm = 0;
  private distanceText!: Phaser.GameObjects.Text;
  private actionButtonContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'ExpeditionMapScene' });
  }

  create() {
    audioManager.playMusic(this, 'music_game', { loop: true });

    // Generate Procedural fallback map canvas
    ProceduralGraphics.generateMarsGlobalMap(this, 'mars_global_mola', this.mapWidth, this.mapHeight);

    // Attach Blender Slot or Procedural Map
    attachBlenderSceneSlot(this, 'EXPEDITION_MAP', () => {
      this.add.image(this.mapOriginX + this.mapWidth / 2, this.mapOriginY + this.mapHeight / 2, 'mars_global_mola');
    });

    this.setupMissionRoute();
    this.createMapOverlay();
    this.createSiteMarkers();
    this.createTraversePath();
    this.createTelemetrySidePanel();
  }

  private setupMissionRoute() {
    if (gameState.currentChapter === 'act_2_arcadia') {
      this.currentOriginSite = MARS_SITES.GALE_CRATER;
      this.currentTargetSite = MARS_SITES.ARCADIA_PLANITIA;
    } else if (gameState.currentChapter === 'act_3_gale_return') {
      this.currentOriginSite = MARS_SITES.ARCADIA_PLANITIA;
      this.currentTargetSite = MARS_SITES.GALE_CRATER;
    } else {
      // Act IV Jezero sortie
      this.currentOriginSite = MARS_SITES.GALE_CRATER;
      this.currentTargetSite = MARS_SITES.JEZERO_CRATER;
    }

    this.totalDistanceKm = calculateTraverseDistanceKm(
      this.currentOriginSite.lat,
      this.currentOriginSite.lon,
      this.currentTargetSite.lat,
      this.currentTargetSite.lon
    );
  }

  private createMapOverlay() {
    // Border frame
    this.add.rectangle(
      this.mapOriginX + this.mapWidth / 2,
      this.mapOriginY + this.mapHeight / 2,
      this.mapWidth,
      this.mapHeight
    ).setStrokeStyle(2, 0x38bdf8, 0.7);

    // Title banner
    this.add.text(this.mapOriginX + 20, this.mapOriginY - 30, 'NASA MARS TREK // GLOBAL TRAVERSE NAVIGATION (EQUIDISTANT CYLINDRICAL)', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '13px',
      color: '#38bdf8'
    });
  }

  private createSiteMarkers() {
    // Render Origin, Destination, and other key sites
    Object.values(MARS_SITES).forEach(site => {
      const pos = projectMarsToCanvas(site.lat, site.lon, this.mapWidth, this.mapHeight);
      const canvasX = this.mapOriginX + pos.x;
      const canvasY = this.mapOriginY + pos.y;

      const isTarget = site.name === this.currentTargetSite.name;
      const isOrigin = site.name === this.currentOriginSite.name;
      const color = isTarget ? 0xef4444 : (isOrigin ? 0x10b981 : 0xf59e0b);

      const pin = this.add.circle(canvasX, canvasY, isTarget || isOrigin ? 8 : 5, color, 0.9)
        .setStrokeStyle(2, 0xffffff);

      this.add.text(canvasX, canvasY - 14, site.name.toUpperCase(), {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: isTarget ? '#ef4444' : (isOrigin ? '#10b981' : '#f59e0b'),
        backgroundColor: '#050a14'
      }).setOrigin(0.5);

      if (isTarget) {
        this.tweens.add({
          targets: pin,
          scale: { from: 1, to: 1.8 },
          alpha: { from: 1, to: 0.3 },
          duration: 900,
          repeat: -1,
          yoyo: true
        });
      }
    });

    // Pre-positioned NASA Autonomous Cargo Depots
    CARGO_DEPOTS.forEach(depot => {
      const pos = projectMarsToCanvas(depot.lat, depot.lon, this.mapWidth, this.mapHeight);
      const canvasX = this.mapOriginX + pos.x;
      const canvasY = this.mapOriginY + pos.y;

      this.add.rectangle(canvasX, canvasY, 8, 8, 0x38bdf8)
        .setStrokeStyle(1, 0xffffff);

      this.add.text(canvasX, canvasY + 10, depot.name, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '9px',
        color: '#94a3b8'
      }).setOrigin(0.5);
    });
  }

  private createTraversePath() {
    const waypoints = getTraverseWaypoints(this.currentOriginSite, this.currentTargetSite, 16);
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x38bdf8, 0.7);

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = projectMarsToCanvas(waypoints[i].lat, waypoints[i].lon, this.mapWidth, this.mapHeight);
      const p2 = projectMarsToCanvas(waypoints[i + 1].lat, waypoints[i + 1].lon, this.mapWidth, this.mapHeight);

      // Avoid wrapping lines if crossing longitude boundary
      if (Math.abs(p2.x - p1.x) < this.mapWidth / 2) {
        graphics.beginPath();
        graphics.moveTo(this.mapOriginX + p1.x, this.mapOriginY + p1.y);
        graphics.lineTo(this.mapOriginX + p2.x, this.mapOriginY + p2.y);
        graphics.stroke();
      }
    }

    // Rover Marker Position
    const startPos = projectMarsToCanvas(this.currentOriginSite.lat, this.currentOriginSite.lon, this.mapWidth, this.mapHeight);
    this.roverSprite = this.add.circle(this.mapOriginX + startPos.x, this.mapOriginY + startPos.y, 9, 0xffffff, 1)
      .setStrokeStyle(2, 0x0284c7);
  }

  private createTelemetrySidePanel() {
    const panelX = 1750;
    const panelY = 510;

    this.add.rectangle(panelX, panelY, 280, 700, 0x050a14, 0.95)
      .setStrokeStyle(1, 0x1e293b);

    this.add.text(panelX, 200, 'TRAVERSE FLIGHT PLAN', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '13px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    this.add.text(panelX - 120, 240, `ORIGIN: ${this.currentOriginSite.name}`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#94a3b8',
      wordWrap: { width: 240 }
    });

    this.add.text(panelX - 120, 300, `DESTINATION:\n${this.currentTargetSite.name}`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#ef4444',
      wordWrap: { width: 240 }
    });

    this.distanceText = this.add.text(panelX - 120, 380, `SPHERICAL DISTANCE:\n${this.totalDistanceKm} km`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '13px',
      color: '#38bdf8'
    });

    this.add.text(panelX - 120, 440, `AUTONOMOUS CARGO DEPOTS:\nPasses 2 pre-positioned supply beacons.`, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '12px',
      color: '#cbd5e1',
      wordWrap: { width: 240 }
    });

    // Traverse Action Button
    this.actionButtonContainer = this.add.container(panelX, 580);
    const btnBg = this.add.rectangle(0, 0, 240, 48, 0x0284c7)
      .setStrokeStyle(1, 0x38bdf8)
      .setInteractive({ useHandCursor: true });

    const btnTxt = this.add.text(0, 0, 'COMMENCE TRAVERSE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x0369a1);
      audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.4 });
    });

    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x0284c7);
    });

    btnBg.on('pointerdown', () => {
      audioManager.playSfx(this, 'sfx_ui_click', { volume: 0.7 });
      this.commenceTraverse(btnBg, btnTxt);
    });

    this.actionButtonContainer.add([btnBg, btnTxt]);
  }

  private commenceTraverse(btnBg: Phaser.GameObjects.Rectangle, btnTxt: Phaser.GameObjects.Text) {
    if (this.isTraversing) return;
    this.isTraversing = true;
    soundFx.playTelemetryChirp();

    btnBg.setFillStyle(0x1e293b);
    btnTxt.setText('TRAVERSING MARS...');

    const waypoints = getTraverseWaypoints(this.currentOriginSite, this.currentTargetSite, 24);

    let idx = 0;
    this.time.addEvent({
      delay: 120,
      repeat: waypoints.length - 1,
      callback: () => {
        const wp = waypoints[idx];
        const canvasCoords = projectMarsToCanvas(wp.lat, wp.lon, this.mapWidth, this.mapHeight);
        this.roverSprite.x = this.mapOriginX + canvasCoords.x;
        this.roverSprite.y = this.mapOriginY + canvasCoords.y;

        const remDistance = Math.round(this.totalDistanceKm * (1 - wp.fraction));
        this.distanceText.setText(`SPHERICAL DISTANCE:\n${remDistance} km remaining`);

        // Sound blip
        soundFx.playClick(600 + idx * 40);
        idx++;

        if (idx >= waypoints.length) {
          this.onTraverseComplete(btnBg, btnTxt);
        }
      }
    });
  }

  private onTraverseComplete(btnBg: Phaser.GameObjects.Rectangle, btnTxt: Phaser.GameObjects.Text) {
    audioManager.playSfx(this, 'sfx_ui_confirm', { volume: 0.85 });
    btnBg.setFillStyle(0x10b981);
    btnTxt.setText('ARRIVED: ENTER FIELD');

    btnBg.off('pointerdown');
    btnBg.on('pointerdown', () => {
      audioManager.playSfx(this, 'sfx_ui_click', { volume: 0.8 });
      if (gameState.currentChapter === 'act_2_arcadia') {
        this.scene.start('ArcadiaFieldScene');
      } else if (gameState.currentChapter === 'act_3_gale_return') {
        this.scene.start('GaleBaseScene');
      } else {
        // Act IV Jezero
        this.scene.start('JezeroFieldScene');
      }
    });
  }
}
