/**
 * Jezero Crater Field Science Scene (Act IV)
 * Ancient Delta Astrobiology, Laser Strata Scanning, Raman Spectroscopy,
 * Biosignature Sample Tube Sealing, and the Critical Branching Dilemma.
 *
 * UI-ONLY REVISION. Game state, experiment completion rules, movement physics,
 * speed zones, battery drain, scene transitions and the DecisionModal payload are
 * unchanged. What changed: the backdrop, the experiment site layout, the station
 * tags, the field props, the rover, the HUD chrome and a new plan-view field map.
 *
 * Field layout (west -> east), loosely based on Jezero geography:
 *   - Western delta front: a long, hazy, flat-topped scarp with topset / foreset /
 *     bottomset bands. Kodiak butte, an isolated remnant of that fan, stands in
 *     front of it (EXP A works at its foot).
 *   - Dry paleo-channel (Neretva Vallis) cutting the crater floor. EXP C sits on its
 *     bank, dressed like the Bright Angel / Cheyava Falls outcrop (reddish mudstone,
 *     white veins, leopard spots).
 *   - Consolidated bench (back) vs. soft silt basin (front); the contact is drawn at
 *     y = 650, the same line update() uses for the 0.92x / 0.72x speed zones.
 * The scene is a stylised transect, not a survey map.
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { DecisionModal } from '../ui/DecisionModal';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';
import { transitionToScene, fadeSceneIn } from '../utils/SceneTransition';

// ----------------------------------------------------------------------------
// Layout constants (UI only)
// ----------------------------------------------------------------------------
const SCENE_W = 1920;
const HORIZON_Y = 470;
const SILT_LINE_Y = 650; // matches the speed-zone split in update()
const ROVER_POS = { x: 1430, y: 735 };
const AIRLOCK_POS = { x: 1740, y: 755 };
const EXPERIMENT_IDS = [
  'exp_jezero_delta',
  'exp_jezero_mineral',
  'exp_jezero_bio',
  'exp_jezero_weather'
];

// Plan-view field map (bottom-left HUD panel)
const MINI = { x: 28, y: 916, w: 380, h: 100, mapX: 10, mapY: 30, mapW: 360, mapH: 60, yMin: 420, yMax: 900 };

type Pt = [number, number];

// ----------------------------------------------------------------------------
// Small drawing helpers
// ----------------------------------------------------------------------------
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const lerpColor = (a: number, b: number, t: number): number => {
  const k = Phaser.Math.Clamp(t, 0, 1);
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
  const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
  const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
  return (r << 16) | (g << 8) | bl;
};

const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

const fillPoly = (g: Phaser.GameObjects.Graphics, pts: Pt[]) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillPath();
};

const strokePolyline = (g: Phaser.GameObjects.Graphics, pts: Pt[]) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokePath();
};

const toMini = (x: number, y: number) => ({
  x: MINI.mapX + (x / SCENE_W) * MINI.mapW,
  y: MINI.mapY + Phaser.Math.Clamp((y - MINI.yMin) / (MINI.yMax - MINI.yMin), 0, 1) * MINI.mapH
});

interface JezeroStationCardRef {
  id: string;
  x: number;
  y: number;
  box: Phaser.GameObjects.Rectangle;
  accent: Phaser.GameObjects.Rectangle;
  checkMark: Phaser.GameObjects.Text;
  tText: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  beaconRing: Phaser.GameObjects.Arc;
  meta: {
    terrain: string;
    elev: string;
    slope: string;
    bioIndex: number;
    hazard: string;
  };
}

interface DustDriftParticle {
  sprite: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
}

export class JezeroFieldScene extends Phaser.Scene {
  private activePanelContainer!: Phaser.GameObjects.Container;
  private expStatusText!: Phaser.GameObjects.Text;
  private astronautSprite!: Phaser.GameObjects.Sprite;
  private roverContainer!: Phaser.GameObjects.Container;
  private shelterPrompt!: Phaser.GameObjects.Text;
  private shelterDoorFrame!: Phaser.GameObjects.Rectangle;
  private shelterStatusLight!: Phaser.GameObjects.Arc;
  private bottomTelemetryText!: Phaser.GameObjects.Text;

  // Live Terrain Indicator HUD
  private terrainReadoutText!: Phaser.GameObjects.Text;
  private terrainBadgeText!: Phaser.GameObjects.Text;
  private bioBarFill!: Phaser.GameObjects.Rectangle;

  // Parallax & storm atmosphere
  private craterRimLayer!: Phaser.GameObjects.Graphics;
  private deltaScarpContainer!: Phaser.GameObjects.Container;
  private stormTintOverlay!: Phaser.GameObjects.Rectangle;
  private dustParticles: DustDriftParticle[] = [];

  // UI Station tracking & Decision Button guard
  private stationCards: JezeroStationCardRef[] = [];
  private decisionBtnContainer?: Phaser.GameObjects.Container;

  // HUD additions (UI only)
  private progressPips: Array<{ id: string; rect: Phaser.GameObjects.Rectangle }> = [];
  private miniMapAstro?: Phaser.GameObjects.Arc;
  private miniMapAirlock?: Phaser.GameObjects.Rectangle;
  private miniMapDots = new Map<string, Phaser.GameObjects.Arc>();

  private movementKeys?: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
  };
  private velocity = new Phaser.Math.Vector2();
  private stepCooldown = 0;

  constructor() {
    super({ key: 'JezeroFieldScene' });
  }

  create() {
    this.stationCards = [];
    this.dustParticles = [];
    this.decisionBtnContainer = undefined;
    this.progressPips = [];
    this.miniMapDots = new Map();
    this.miniMapAstro = undefined;
    this.miniMapAirlock = undefined;

    gameState.currentLocation = 'jezero';
    gameState.save();
    audioManager.playMusic(this, 'music_game', { loop: true });
    fadeSceneIn(this);

    // Attach Blender Slot or Upgraded Procedural Delta Backdrop
    attachBlenderSceneSlot(this, 'JEZERO_FIELD', () => {
      this.createProceduralJezeroBackdrop();
    });

    this.createAmbientDustParticles();
    this.createHeader();
    this.createTerrainIndicatorBar();
    this.createScienceWorkstations();
    this.createSamplingNodes();
    this.createShelterAirlock();
    this.createAstronautCharacter();
    this.createFieldMovement();
    this.createFieldMiniMap();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tweens.killAll();
      this.dustParticles = [];
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const stormActive = gameState.jezeroCompletedExperiments.includes('exp_jezero_weather');
    const windSpeedMult = stormActive ? 2.35 : 1.0;

    // 1. Update wind-driven Martian dust particles
    for (const p of this.dustParticles) {
      p.sprite.x -= p.vx * windSpeedMult * dt;
      p.sprite.y += p.vy * dt;
      if (p.sprite.x < -20) p.sprite.x = 1940;
      if (p.sprite.y > 1050) p.sprite.y = 300;
    }

    // 2. Parallax shift linked to astronaut X coordinate
    if (this.astronautSprite && this.craterRimLayer && this.deltaScarpContainer) {
      const normX = (this.astronautSprite.x - 960) / 960;
      this.craterRimLayer.x = -normX * 20;
      this.deltaScarpContainer.x = -normX * 38;
    }

    if (!this.astronautSprite || !this.movementKeys) return;

    const axisX = Number(this.movementKeys.right.isDown) - Number(this.movementKeys.left.isDown);
    const axisY = Number(this.movementKeys.down.isDown) - Number(this.movementKeys.up.isDown);
    const moving = axisX !== 0 || axisY !== 0;

    if (!moving) {
      // Smooth deceleration on rocky/silt regolith
      this.velocity.scale(0.82);
      if (this.velocity.lengthSq() > 4) {
        this.astronautSprite.x = Phaser.Math.Clamp(this.astronautSprite.x + this.velocity.x * dt, 80, 1820);
        this.astronautSprite.y = Phaser.Math.Clamp(this.astronautSprite.y + this.velocity.y * dt, 420, 900);
      } else {
        this.velocity.set(0, 0);
      }
      this.astronautSprite.play('astro_idle_anim', true);
      return;
    }

    const terrainMultiplier = this.astronautSprite.y > 650 ? 0.72 : 0.92;
    const speed = 180 * terrainMultiplier;
    const target = new Phaser.Math.Vector2(axisX, axisY).normalize().scale(speed);
    this.velocity.x = Phaser.Math.Linear(this.velocity.x, target.x, 0.18);
    this.velocity.y = Phaser.Math.Linear(this.velocity.y, target.y, 0.18);
    this.astronautSprite.x = Phaser.Math.Clamp(this.astronautSprite.x + this.velocity.x * dt, 80, 1820);
    this.astronautSprite.y = Phaser.Math.Clamp(this.astronautSprite.y + this.velocity.y * dt, 420, 900);
    this.astronautSprite.setFlipX(this.velocity.x < 0);
    this.astronautSprite.play('astro_walk_anim', true);

    // Ochre dust footstep puffs
    this.stepCooldown -= dt;
    if (this.stepCooldown <= 0) {
      this.stepCooldown = 0.22;
      const puff = this.add.circle(this.astronautSprite.x, this.astronautSprite.y + 24, 4, 0xd97706, 0.5).setDepth(48);
      this.tweens.add({
        targets: puff,
        alpha: 0,
        scale: 2.2,
        y: puff.y - 8,
        duration: 360,
        onComplete: () => puff.destroy()
      });
    }

    gameState.suitBattery = Math.max(0, gameState.suitBattery - dt * (0.25 + (1 - terrainMultiplier) * 0.8));

    const zoneLabel = this.astronautSprite.y > 650 ? 'SOFT LACUSTRINE SILT (0.72x SPEED)' : 'CONSOLIDATED DELTA SCARP (0.92x SPEED)';
    this.bottomTelemetryText?.setText(
      `TERRAIN GRADE: ${zoneLabel} // SUIT BATTERY: ${Math.round(gameState.suitBattery)}% // CORES: ${gameState.regolithSamples}`
    );

    this.updateProximityTerrainTelemetry();
    gameState.notifyChange('jezero_movement');
  }

  private updateProximityTerrainTelemetry() {
    let closest: JezeroStationCardRef | undefined;
    let minDist = 260;

    for (const st of this.stationCards) {
      const d = Phaser.Math.Distance.Between(this.astronautSprite.x, this.astronautSprite.y, st.x, st.y + 90);
      if (d < minDist) {
        minDist = d;
        closest = st;
      }
    }

    if (closest) {
      this.setTerrainIndicatorData(
        this.astronautSprite.x,
        closest.meta.terrain,
        closest.meta.elev,
        closest.meta.slope,
        closest.meta.bioIndex,
        closest.meta.hazard
      );
    }
  }

  // ============================================================================
  // HUD helpers
  // ============================================================================
  private addCornerBrackets(
    parent: Phaser.GameObjects.Container,
    w: number,
    h: number,
    color: number,
    len = 12,
    alpha = 0.9
  ) {
    const g = this.add.graphics();
    g.lineStyle(2, color, alpha);
    const hw = w / 2;
    const hh = h / 2;
    ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>).forEach(([sx, sy]) => {
      g.beginPath();
      g.moveTo(sx * hw, sy * (hh - len));
      g.lineTo(sx * hw, sy * hh);
      g.lineTo(sx * (hw - len), sy * hh);
      g.strokePath();
    });
    parent.add(g);
  }

  private createFieldMovement() {
    this.movementKeys = {
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    };

    this.buildRover();
  }

  /**
   * STRATA-01 // LREV, redrawn after Perseverance's architecture: six-wheel
   * rocker-bogie suspension (three wheels visible side-on), boxy body with thermal
   * blanketing, rear-mounted RTG with cooling fins, mast-top camera head with the
   * SuperCam laser aperture, high/low-gain antennas, and a folded arm carrying a
   * two-instrument turret at the front.
   */
  private buildRover() {
    this.roverContainer = this.add.container(ROVER_POS.x, ROVER_POS.y).setDepth(45);

    const shadow = this.add.ellipse(0, 44, 260, 34, 0x050a14, 0.5);

    // Rocker-bogie links
    const susp = this.add.graphics();
    susp.lineStyle(5, 0x8b919b, 1);
    susp.lineBetween(-4, 6, 84, 32);
    susp.lineBetween(-4, 6, -44, 24);
    susp.lineBetween(-44, 24, -86, 32);
    susp.lineBetween(-44, 24, -2, 32);
    susp.fillStyle(0x4b5160, 1);
    susp.fillCircle(-4, 6, 4);
    susp.fillCircle(-44, 24, 3.5);

    // Wheels: machined aluminium rim, dark cleats
    const wheelParts: Phaser.GameObjects.GameObject[] = [];
    [-86, -2, 84].forEach(wx => {
      const rim = this.add.circle(wx, 32, 17, 0x9aa0a8).setStrokeStyle(3, 0x1f2430);
      const cleats = this.add.graphics();
      cleats.lineStyle(2, 0x1f2430, 1);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        cleats.lineBetween(wx + Math.cos(a) * 11, 32 + Math.sin(a) * 11, wx + Math.cos(a) * 16, 32 + Math.sin(a) * 16);
      }
      const hub = this.add.circle(wx, 32, 5, 0x2b303b);
      wheelParts.push(rim, cleats, hub);
    });

    // RTG with fins, mounted at the rear
    const rtg = this.add.rectangle(-102, -20, 38, 16, 0x2f343c).setStrokeStyle(1, 0xfbbf24);
    const rtgFins = this.add.graphics();
    rtgFins.lineStyle(1, 0x7b8494, 0.8);
    for (let fx = -118; fx <= -86; fx += 6) rtgFins.lineBetween(fx, -27, fx, -13);
    const rtgStrut = this.add.rectangle(-84, -18, 10, 6, 0x4b5160);

    // Body
    const body = this.add.rectangle(0, -14, 176, 42, 0xd3d6db).setStrokeStyle(2, 0x6b7280);
    const blanket = this.add.rectangle(-30, -12, 86, 24, 0xb8892a, 0.9).setStrokeStyle(1, 0x7c5a14);
    const deck = this.add.rectangle(0, -39, 164, 9, 0xaeb3bb).setStrokeStyle(1, 0x6b7280);
    const stripe = this.add.rectangle(0, 4, 176, 4, 0xf59e0b);
    const plate = this.add.rectangle(30, -14, 100, 15, 0x0f172a).setStrokeStyle(1, 0xfbbf24);
    const label = this.add.text(30, -14, 'STRATA-01 // LREV', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '9px',
      color: '#fbbf24'
    }).setOrigin(0.5);

    // Antennas
    const lga = this.add.rectangle(-70, -56, 3, 18, 0xe5e7eb);
    const hgaStalk = this.add.rectangle(-44, -46, 2, 8, 0xe5e7eb);
    const hgaDish = this.add.ellipse(-44, -52, 30, 8, 0xe5e7eb).setStrokeStyle(1, 0x6b7280);

    // Mast + camera head + SuperCam aperture
    const mast = this.add.rectangle(30, -62, 5, 38, 0xe5e7eb);
    const head = this.add.rectangle(38, -86, 38, 18, 0x2b3038).setStrokeStyle(1, 0xe5e7eb);
    const eyeA = this.add.circle(27, -86, 3.5, 0x111827).setStrokeStyle(1, 0x38bdf8);
    const eyeB = this.add.circle(36, -86, 3.5, 0x111827).setStrokeStyle(1, 0x38bdf8);
    const laserPort = this.add.circle(50, -86, 4, 0x111827).setStrokeStyle(1, 0xef4444);
    const laserDot = this.add.circle(50, -86, 1.8, 0xef4444);

    // Folded arm and instrument turret
    const arm = this.add.graphics();
    arm.lineStyle(5, 0xe5e7eb, 1);
    arm.lineBetween(76, -24, 104, -12);
    arm.lineBetween(104, -12, 110, 8);
    const elbow = this.add.circle(104, -12, 4, 0x2b3038);
    const turret = this.add.circle(112, 12, 10, 0x1f2430).setStrokeStyle(2, 0xfbbf24);
    const instA = this.add.circle(108, 10, 2.5, 0xa855f7);
    const instB = this.add.circle(116, 10, 2.5, 0x38bdf8);

    this.roverContainer.add([
      shadow,
      susp,
      ...wheelParts,
      rtgStrut,
      rtg,
      rtgFins,
      body,
      blanket,
      deck,
      stripe,
      plate,
      label,
      lga,
      hgaStalk,
      hgaDish,
      mast,
      head,
      eyeA,
      eyeB,
      laserPort,
      laserDot,
      arm,
      elbow,
      turret,
      instA,
      instB
    ]);
  }

  private createAstronautCharacter() {
    if (this.textures.exists('astronaut_walk')) {
      this.astronautSprite = this.add.sprite(320, 680, 'astronaut_walk', 0)
        .setScale(1.2)
        .setDepth(50);
      this.astronautSprite.play('astro_idle_anim');
    } else {
      const fallback = this.add.circle(320, 680, 18, 0xf59e0b).setDepth(50);
      this.astronautSprite = fallback as unknown as Phaser.GameObjects.Sprite;
    }
  }

  private walkAstronautTo(
    targetX: number,
    targetY: number,
    meta?: JezeroStationCardRef['meta'],
    onArrival?: () => void
  ) {
    if (meta) {
      this.setTerrainIndicatorData(targetX, meta.terrain, meta.elev, meta.slope, meta.bioIndex, meta.hazard);
    }

    if (!this.astronautSprite || typeof this.astronautSprite.play !== 'function') {
      if (onArrival) onArrival();
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.astronautSprite.x, this.astronautSprite.y, targetX, targetY);
    const duration = Math.max(250, (dist / 145) * 1000);

    this.astronautSprite.setFlipX(targetX < this.astronautSprite.x);
    this.astronautSprite.play('astro_walk_anim');

    this.tweens.killTweensOf(this.astronautSprite);
    this.tweens.add({
      targets: this.astronautSprite,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.astronautSprite.play('astro_idle_anim');
        if (onArrival) onArrival();
      }
    });
  }

  // ============================================================================
  // BACKDROP (procedural)
  // ============================================================================
  private createProceduralJezeroBackdrop() {
    this.drawMartianSky();
    this.drawCraterRimAndRidges();
    this.drawCraterFloor();
    this.drawDeltaScarpLayers();
    this.drawHorizonHaze();
    this.drawNeretvaChannel();
    this.scatterRegolith();
    this.createDustDevils();

    // Dynamic regional dust storm tint overlay
    const isStormLocked = gameState.jezeroCompletedExperiments.includes('exp_jezero_weather');
    this.stormTintOverlay = this.add.rectangle(960, 540, 1920, 1080, 0xb45309, isStormLocked ? 0.2 : 0.05).setDepth(30);

    this.bottomTelemetryText = this.add.text(
      960,
      1025,
      `TERRAIN GRADE: CONSOLIDATED DELTA SCARP (0.92x SPEED) // SUIT BATTERY: ${Math.round(gameState.suitBattery)}% // CORES: ${gameState.regolithSamples}`,
      {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: '#fde68a',
        backgroundColor: '#050a14cc',
        padding: { x: 14, y: 5 }
      }
    ).setOrigin(0.5).setDepth(60);
  }

  /** Dusty butterscotch sky: darker overhead, pale and hazy at the horizon, small pale sun. */
  private drawMartianSky() {
    const sky = this.add.graphics();
    const stops = [0x5a3826, 0x8d5b3b, 0xc3906a, 0xe3bd96];
    const bands = 26;
    const bandH = HORIZON_Y / bands;
    for (let i = 0; i < bands; i++) {
      const seg = (i / (bands - 1)) * (stops.length - 1);
      const k = Math.min(Math.floor(seg), stops.length - 2);
      sky.fillStyle(lerpColor(stops[k], stops[k + 1], seg - k), 1);
      sky.fillRect(0, i * bandH, SCENE_W, bandH + 1);
    }

    // Sun: small pale disc inside a butterscotch aureole
    const sx = 1500;
    const sy = 262;
    [[170, 0.04], [112, 0.07], [68, 0.11], [38, 0.2]].forEach(([r, a]) => {
      sky.fillStyle(0xf3d3a8, a);
      sky.fillCircle(sx, sy, r);
    });
    sky.fillStyle(0xfff1da, 0.95);
    sky.fillCircle(sx, sy, 13);
  }

  /** Far crater rim (parallax layer 1) plus low dark floor ridges breaking the horizon on the east side. */
  private drawCraterRimAndRidges() {
    this.craterRimLayer = this.add.graphics();
    const rim = this.craterRimLayer;

    const profile = (base: number, a1: number, f1: number, a2: number, f2: number, ph: number): Pt[] => {
      const pts: Pt[] = [];
      for (let x = -120; x <= SCENE_W + 120; x += 24) {
        pts.push([x, base + a1 * Math.sin(x * f1 + ph) + a2 * Math.sin(x * f2 + ph * 1.7)]);
      }
      return pts;
    };
    const closeToHorizon = (pts: Pt[]): Pt[] => [...pts, [SCENE_W + 120, HORIZON_Y + 6], [-120, HORIZON_Y + 6]];

    // Two hazy rim layers: farther = paler (aerial perspective)
    rim.fillStyle(0xb88c6c, 0.55);
    fillPoly(rim, closeToHorizon(profile(404, 16, 0.0045, 7, 0.017, 0.6)));
    rim.fillStyle(0x93664b, 0.8);
    fillPoly(rim, closeToHorizon(profile(436, 11, 0.006, 6, 0.021, 2.1)));

    // Low dark ridges of the crater floor (inspired by the Séítah unit)
    const ridges = this.add.graphics();
    const crest: Pt[] = [[1220, 472], [1300, 456], [1390, 449], [1500, 458], [1620, 451], [1740, 460], [1850, 452], [1940, 458]];
    ridges.fillStyle(0x3d2b21, 0.92);
    fillPoly(ridges, [...crest, [1940, 472]]);
    ridges.lineStyle(2, 0x9a7352, 0.5);
    strokePolyline(ridges, crest);
  }

  /** Crater floor: hazy at the horizon, richer up close; bench vs. soft silt basin contact at y = 650. */
  private drawCraterFloor() {
    const g = this.add.graphics();

    const benchSteps = 18;
    const benchH = (SILT_LINE_Y - HORIZON_Y) / benchSteps;
    for (let i = 0; i < benchSteps; i++) {
      g.fillStyle(lerpColor(0x9c7757, 0x5c3f2f, i / (benchSteps - 1)), 1);
      g.fillRect(0, HORIZON_Y + i * benchH, SCENE_W, benchH + 1);
    }

    const siltSteps = 24;
    const siltH = (1080 - SILT_LINE_Y) / siltSteps;
    for (let i = 0; i < siltSteps; i++) {
      g.fillStyle(lerpColor(0x84603f, 0x6a4733, i / (siltSteps - 1)), 1);
      g.fillRect(0, SILT_LINE_Y + i * siltH, SCENE_W, siltH + 1);
    }

    // Contact between consolidated bench and silt basin (ties to the 0.92x / 0.72x zones)
    g.fillStyle(0x2f1d14, 0.35);
    g.fillRect(0, SILT_LINE_Y - 2, SCENE_W, 3);
  }

  /**
   * Parallax layer 2: the Western delta front (long, hazy, flat-topped scarp with
   * topset / foreset / bottomset bands) and Kodiak butte, an isolated remnant of that
   * fan standing in front of it.
   */
  private drawDeltaScarpLayers() {
    this.deltaScarpContainer = this.add.container(0, 0);
    const rnd = makeRng(77);

    // ---- Western delta front (far) ----
    const wallTop = (x: number) => 334 + 9 * Math.sin(x * 0.011 + 1.1) + 5 * Math.sin(x * 0.043);
    const X0 = -100;
    const X1 = 1010;
    const wall = this.add.graphics();

    const band = (g: Phaser.GameObjects.Graphics, top: (x: number) => number, bottom: (x: number) => number) => {
      const pts: Pt[] = [];
      for (let x = X0; x <= X1; x += 20) pts.push([x, top(x)]);
      for (let x = X1; x >= X0; x -= 20) pts.push([x, bottom(x)]);
      fillPoly(g, pts);
    };

    wall.fillStyle(0x8d6e53, 1); // topset cap: flood-laid conglomerate and sandstone
    band(wall, wallTop, x => wallTop(x) + 20);
    wall.fillStyle(0x6f503c, 1); // foreset: inclined delta-front strata
    band(wall, x => wallTop(x) + 20, x => wallTop(x) + 96);
    wall.fillStyle(0x5a4030, 1); // bottomset: fine-grained lake-floor mudstone
    band(wall, x => wallTop(x) + 96, () => HORIZON_Y);

    // Inclined foreset bedding
    wall.lineStyle(1.5, 0xc09c78, 0.32);
    for (let x = X0; x < X1 - 140; x += 34) {
      wall.lineBetween(x, wallTop(x) + 24, x + 120, wallTop(x + 120) + 92);
      wall.lineBetween(x + 17, wallTop(x + 17) + 22, x + 137, wallTop(x + 137) + 88);
    }
    // Bottomset bedding follows the profile
    wall.lineStyle(1, 0x2f2018, 0.35);
    [106, 120].forEach(off => {
      const pts: Pt[] = [];
      for (let x = X0; x <= X1; x += 20) pts.push([x, wallTop(x) + off]);
      strokePolyline(wall, pts);
    });
    // Boulders capping the topset
    for (let x = X0; x < X1; x += 11) {
      wall.fillStyle(0x3a281d, 0.85);
      wall.fillCircle(x + rnd() * 8, wallTop(x) + 2 + rnd() * 9, 1.2 + rnd() * 2.2);
    }
    // Talus at the eastern toe of the scarp
    wall.fillStyle(0x8a6a4e, 0.95);
    fillPoly(wall, [[930, HORIZON_Y], [1010, wallTop(1010) + 36], [1104, HORIZON_Y]]);
    for (let i = 0; i < 16; i++) {
      wall.fillStyle(0x3a281d, 0.8);
      wall.fillCircle(950 + rnd() * 130, 440 + rnd() * 28, 1.5 + rnd() * 2.5);
    }

    // ---- Kodiak butte (near, darker) ----
    const butte = this.add.graphics();
    butte.fillStyle(0x4a3326, 1);
    fillPoly(butte, [[24, 470], [44, 424], [62, 398], [110, 392], [200, 391], [290, 394], [322, 403], [338, 432], [358, 470]]);
    butte.fillStyle(0x7b5b43, 1); // topset cap
    fillPoly(butte, [[62, 398], [110, 392], [200, 391], [290, 394], [322, 403], [327, 412], [52, 412]]);
    butte.fillStyle(0x5d4231, 1); // foreset
    fillPoly(butte, [[52, 412], [327, 412], [345, 446], [34, 446]]);
    butte.fillStyle(0x45301f, 1); // bottomset
    fillPoly(butte, [[34, 446], [345, 446], [358, 470], [24, 470]]);
    butte.lineStyle(1.5, 0xb48f6c, 0.38);
    for (let x = 56; x <= 290; x += 24) butte.lineBetween(x, 414, x + 48, 444);
    butte.lineStyle(1, 0x1f130c, 0.4);
    butte.lineBetween(38, 452, 344, 452);
    butte.lineBetween(34, 460, 346, 460);
    for (let x = 66; x < 318; x += 18) {
      butte.fillStyle(0x2f2018, 0.85);
      butte.fillCircle(x + rnd() * 6, 394 + rnd() * 8, 1.3 + rnd() * 1.8);
    }
    butte.fillStyle(0x1a0f0a, 0.22); // shaded east face
    fillPoly(butte, [[230, 392], [290, 394], [322, 403], [338, 432], [358, 470], [250, 470]]);
    butte.fillStyle(0x6b4d38, 0.9); // talus aprons
    fillPoly(butte, [[0, 470], [30, 452], [70, 470]]);
    fillPoly(butte, [[300, 470], [340, 450], [392, 470]]);

    // Landmark tags (move with the parallax layer)
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '9px',
      color: '#f3dcc0',
      backgroundColor: '#1a0f0acc',
      padding: { x: 5, y: 2 }
    };
    const lblDelta = this.add.text(560, 304, 'WESTERN DELTA FRONT', labelStyle).setOrigin(0.5);
    const lblKodiak = this.add.text(190, 372, 'KODIAK BUTTE', labelStyle).setOrigin(0.5);

    this.deltaScarpContainer.add([wall, butte, lblDelta, lblKodiak]);
  }

  /** Aerial perspective: pale haze straddling the horizon. */
  private drawHorizonHaze() {
    const haze = this.add.graphics();
    for (let y = HORIZON_Y - 70; y < HORIZON_Y + 70; y += 5) {
      const d = Math.abs(y - HORIZON_Y) / 70;
      haze.fillStyle(0xe8c8a6, (y < HORIZON_Y ? 0.2 : 0.3) * (1 - d));
      haze.fillRect(0, y, SCENE_W, 5);
    }
  }

  /** Dry paleo-channel (Neretva Vallis) widening toward the viewer. */
  private drawNeretvaChannel() {
    const ctrl: Pt[] = [[1060, 478], [1080, 540], [1135, 615], [1210, 700], [1255, 790], [1250, 880], [1235, 980], [1230, 1085]];
    const centerAt = (y: number): number => {
      for (let i = 0; i < ctrl.length - 1; i++) {
        const [x0, y0] = ctrl[i];
        const [x1, y1] = ctrl[i + 1];
        if (y >= y0 && y <= y1) return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
      }
      return ctrl[ctrl.length - 1][0];
    };
    const widthAt = (y: number) => 16 + (y - 478) * 0.4;

    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let y = 478; y <= 1085; y += 12) {
      const c = centerAt(y);
      const w = widthAt(y) / 2;
      left.push([c - w, y]);
      right.push([c + w, y]);
    }

    const g = this.add.graphics();
    g.fillStyle(0x9b7653, 0.85);
    fillPoly(g, [...left, ...right.slice().reverse()]);

    // Cut-bank shadow on the west bank, sunlit lip on the east bank
    g.lineStyle(3, 0x3a271c, 0.55);
    strokePolyline(g, left);
    g.lineStyle(2, 0xd3b08a, 0.45);
    strokePolyline(g, right);

    // Sand ripples across the channel floor
    g.lineStyle(1.5, 0xc2a07c, 0.3);
    for (let y = 520; y < 1070; y += 22) {
      const c = centerAt(y);
      const w = widthAt(y) * 0.35;
      const pts: Pt[] = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        pts.push([c - w + t * 2 * w, y + Math.sin(t * Math.PI) * 3]);
      }
      strokePolyline(g, pts);
    }

    const lblStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '9px',
      color: '#f3dcc0',
      backgroundColor: '#1a0f0acc',
      padding: { x: 5, y: 2 }
    };
    this.add.text(1096, 500, 'NERETVA VALLIS PALEO-CHANNEL', lblStyle).setOrigin(0, 0.5);
  }

  /** Dark angular rocks, pebbles and aeolian ripples; sparse rocks and ripples on the silt basin. */
  private scatterRegolith() {
    const rnd = makeRng(20210218);
    const g = this.add.graphics();

    const drawRock = (x: number, y: number, size: number) => {
      const n = 6;
      const pts: Pt[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
        const r = size * (0.7 + rnd() * 0.5);
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62]);
      }
      g.fillStyle(0x000000, 0.22); // shadow cast away from the sun (sun is to the right)
      g.fillEllipse(x - size * 0.45, y + size * 0.4, size * 2.2, size * 0.5);
      g.fillStyle(lerpColor(0x2a1f1a, 0x4d3b30, rnd()), 1);
      fillPoly(g, pts);
      g.fillStyle(0x8a6d57, 0.4); // sun-lit upper-right face
      fillPoly(g, [[x - size * 0.1, y - size * 0.5], [x + size * 0.75, y - size * 0.12], [x + size * 0.05, y + size * 0.05]]);
    };

    // Consolidated bench: many small-to-medium rocks, bigger toward the viewer
    for (let i = 0; i < 96; i++) {
      const y = HORIZON_Y + 10 + Math.pow(rnd(), 0.8) * 168;
      drawRock(rnd() * 1960 - 20, y, 2.5 + ((y - HORIZON_Y) / 180) * 10);
    }
    // Silt basin: fewer, larger rocks
    for (let i = 0; i < 22; i++) {
      const y = SILT_LINE_Y + 15 + rnd() * 340;
      drawRock(rnd() * 1960 - 20, y, 6 + ((y - SILT_LINE_Y) / 400) * 12);
    }
    // Pebbles
    for (let i = 0; i < 70; i++) {
      g.fillStyle(0x2f2219, 0.6);
      g.fillCircle(rnd() * SCENE_W, SILT_LINE_Y + 10 + rnd() * 350, 1.5 + rnd() * 1.5);
    }
    // Aeolian ripples in the silt
    for (let i = 0; i < 46; i++) {
      const cx = rnd() * 1800;
      const cy = SILT_LINE_Y + 25 + rnd() * 340;
      const len = 40 + rnd() * 70;
      const pts: Pt[] = [];
      const shade: Pt[] = [];
      for (let dx = 0; dx <= len; dx += 8) {
        const yy = cy + Math.sin(dx * 0.15) * 2;
        pts.push([cx + dx, yy]);
        shade.push([cx + dx, yy + 2]);
      }
      g.lineStyle(1.5, 0xb89674, 0.28);
      strokePolyline(g, pts);
      g.lineStyle(1.5, 0x3b271c, 0.2);
      strokePolyline(g, shade);
    }
  }

  /**
   * Jezero has the highest dust-devil abundance seen by any Mars surface mission, with
   * vortices that can exceed 100 m across. Three faint, drifting funnels sell the setting.
   */
  private createDustDevils() {
    const defs = [
      { x: 1010, y: 478, h: 84, w: 22, drift: 60, dur: 16000 },
      { x: 1700, y: 470, h: 118, w: 30, drift: -70, dur: 20000 },
      { x: 150, y: 472, h: 64, w: 16, drift: 40, dur: 13000 }
    ];
    defs.forEach(d => {
      const devil = this.add.container(d.x, d.y).setDepth(6);
      const segs = 9;
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const w = d.w * (0.35 + t * 1.15);
        const sway = Math.sin(i * 0.9) * d.w * 0.18;
        devil.add(this.add.ellipse(sway, -t * d.h, w, (d.h / segs) * 1.9, 0xd8b48e, 0.1 + (1 - t) * 0.08));
      }
      this.tweens.add({ targets: devil, x: d.x + d.drift, duration: d.dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: devil, scaleX: 1.12, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  private createAmbientDustParticles() {
    for (let i = 0; i < 38; i++) {
      const sprite = this.add.circle(
        Phaser.Math.Between(0, 1920),
        Phaser.Math.Between(300, 1020),
        Phaser.Math.FloatBetween(1.4, 3.0),
        0xfde68a,
        Phaser.Math.FloatBetween(0.18, 0.45)
      ).setDepth(35);

      this.dustParticles.push({
        sprite,
        vx: Phaser.Math.FloatBetween(55, 115),
        vy: Phaser.Math.FloatBetween(5, 16)
      });
    }
  }

  // ============================================================================
  // SAMPLING NODES
  // ============================================================================
  private createSamplingNodes() {
    [
      { x: 560, y: 700, label: 'CORE A (SMECTITE)' },
      { x: 900, y: 640, label: 'CORE B (CARBONATE)' },
      { x: 1330, y: 870, label: 'CORE C (SILTSTONE)' }
    ].forEach(node => {
      const pulse = this.add.circle(node.x, node.y, 19, 0xd97706, 0.25).setDepth(30);
      const marker = this.add.circle(node.x, node.y, 12, 0xf59e0b, 0.85)
        .setStrokeStyle(2, 0xfef3c7)
        .setDepth(31)
        .setInteractive({ useHandCursor: true });

      this.tweens.add({ targets: pulse, scale: 1.45, alpha: 0.05, duration: 1100, repeat: -1 });

      this.add.text(node.x, node.y + 24, node.label, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '9px',
        color: '#fef3c7',
        backgroundColor: '#1a0f0acc',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5).setDepth(31);

      marker.on('pointerdown', () => {
        soundFx.playClick(1200);
        gameState.regolithSamples++;
        gameState.addLog(`JEZERO CORE NODE ${node.label}: Regolith sample catalogued.`, 'science');
        this.bottomTelemetryText?.setText(
          `TERRAIN GRADE: SAMPLE SECURED // SUIT BATTERY: ${Math.round(gameState.suitBattery)}% // CORES: ${gameState.regolithSamples}`
        );
        gameState.notifyChange('jezero_sample_node');

        this.tweens.add({ targets: marker, scale: 1.8, alpha: 0.2, duration: 250, yoyo: true });
        for (let i = 0; i < 10; i++) {
          const particle = this.add.circle(node.x, node.y, 3, 0xfbbf24, 0.85).setDepth(55);
          this.tweens.add({
            targets: particle,
            x: node.x + Phaser.Math.Between(-35, 35),
            y: node.y + Phaser.Math.Between(-35, 35),
            alpha: 0,
            duration: 450,
            onComplete: () => particle.destroy()
          });
        }
      });
    });
  }

  // ============================================================================
  // AIRLOCK
  // ============================================================================
  private createShelterAirlock() {
    const isUnlocked = gameState.jezeroCompletedExperiments.length >= 4;
    const airlockCont = this.add.container(AIRLOCK_POS.x, AIRLOCK_POS.y).setDepth(44);

    const groundShadow = this.add.ellipse(0, 76, 230, 26, 0x000000, 0.35);
    const domeShell = this.add.arc(0, -45, 76, 180, 360, false, 0x1e293b, 0.95).setStrokeStyle(2, 0x64748b);
    this.shelterDoorFrame = this.add.rectangle(0, 10, 175, 115, 0x0f172a, 0.95)
      .setStrokeStyle(2, isUnlocked ? 0x10b981 : 0xf59e0b)
      .setInteractive({ useHandCursor: true });

    const hatchInner = this.add.rectangle(0, 16, 74, 82, 0x1e293b).setStrokeStyle(1, 0x475569);
    this.shelterStatusLight = this.add.circle(0, -34, 6, isUnlocked ? 0x10b981 : 0xf59e0b);

    const label = this.add.text(0, -10, 'JEZERO FIELD AIRLOCK', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '10px',
      color: '#e2e8f0',
      align: 'center'
    }).setOrigin(0.5);

    this.shelterPrompt = this.add.text(0, 86, isUnlocked ? '[AIRLOCK READY]' : '[4 EXPERIMENTS REQUIRED]', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '10px',
      color: isUnlocked ? '#34d399' : '#fbbf24',
      align: 'center'
    }).setOrigin(0.5);

    airlockCont.add([groundShadow, domeShell, this.shelterDoorFrame, hatchInner, this.shelterStatusLight, label, this.shelterPrompt]);

    this.shelterDoorFrame.on('pointerover', () => {
      const ready = gameState.jezeroCompletedExperiments.length >= 4;
      this.shelterPrompt.setText(ready ? 'CLICK TO ENTER SHELTER' : 'LOCKED: COMPLETE 4 SCIENCE TASKS');
    });

    this.shelterDoorFrame.on('pointerout', () => {
      const ready = gameState.jezeroCompletedExperiments.length >= 4;
      this.shelterPrompt.setText(ready ? '[AIRLOCK READY]' : '[4 EXPERIMENTS REQUIRED]');
    });

    this.shelterDoorFrame.on('pointerdown', () => {
      if (gameState.jezeroCompletedExperiments.length < 4) {
        soundFx.playClick(500);
        this.shelterPrompt.setText('COMPLETE ALL 4 SCIENCE TASKS FIRST');
        return;
      }
      soundFx.playAirlockHiss();
      gameState.currentLocation = 'jezero_shelter';
      gameState.save();
      transitionToScene(this, 'JezeroShelterScene');
    });
  }

  // ============================================================================
  // HUD
  // ============================================================================
  private createHeader() {
    const header = this.add.container(960, 82).setDepth(60);
    const bg = this.add.rectangle(0, 0, 1140, 54, 0x050a14, 0.92)
      .setStrokeStyle(1, 0x38bdf8, 0.6);

    const title = this.add.text(0, -10, 'ACT IV: JEZERO CRATER DELTA — PALEO-LAKE ASTROBIOLOGY', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.expStatusText = this.add.text(0, 13, '', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    header.add([bg, title, this.expStatusText]);
    this.addCornerBrackets(header, 1140, 54, 0x38bdf8);

    // One pip per experiment, in the same left-to-right order as the field stations
    this.progressPips = EXPERIMENT_IDS.map((id, i) => {
      const rect = this.add.rectangle(484 + i * 22, -10, 16, 6, 0x1e293b).setStrokeStyle(1, 0x475569);
      header.add(rect);
      return { id, rect };
    });

    this.updateStatus();
  }

  private createTerrainIndicatorBar() {
    const bar = this.add.container(960, 144).setDepth(60);
    const bg = this.add.rectangle(0, 0, 1140, 54, 0x071120, 0.9)
      .setStrokeStyle(1, 0xd97706, 0.75);

    const tagBox = this.add.rectangle(-445, 0, 210, 34, 0x451a03)
      .setStrokeStyle(1, 0xf59e0b);
    const tagTxt = this.add.text(-445, -6, 'TERRAIN INDICATOR', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '10px',
      color: '#fde68a'
    }).setOrigin(0.5);
    const coordTxt = this.add.text(-445, 8, '18.38°N // 77.58°E', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '9px',
      color: '#fed7aa'
    }).setOrigin(0.5);

    this.terrainReadoutText = this.add.text(-45, -9, '', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#e2e8f0'
    }).setOrigin(0.5);

    const bioLbl = this.add.text(-210, 11, 'BIOSIGNATURE PRESERVATION:', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '10px',
      color: '#94a3b8'
    }).setOrigin(0, 0.5);

    const bioBg = this.add.rectangle(45, 11, 150, 9, 0x1e293b).setStrokeStyle(1, 0x475569);
    this.bioBarFill = this.add.rectangle(-30, 11, 138, 7, 0x10b981).setOrigin(0, 0.5);

    this.terrainBadgeText = this.add.text(420, 0, '', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '10px',
      color: '#fde68a',
      backgroundColor: '#78350f',
      padding: { x: 10, y: 6 }
    }).setOrigin(0.5);

    bar.add([
      bg,
      tagBox,
      tagTxt,
      coordTxt,
      this.terrainReadoutText,
      bioLbl,
      bioBg,
      this.bioBarFill,
      this.terrainBadgeText
    ]);
    this.addCornerBrackets(bar, 1140, 54, 0xd97706);

    this.setTerrainIndicatorData(320, 'WESTERN DELTA FORESET SCARP', '-2,540m', '14.2°', 92, 'MODERATE // SCARP TALUS');
  }

  private setTerrainIndicatorData(
    xPos: number,
    terrainClass: string,
    elev: string,
    slope: string,
    bioPct: number,
    hazardText: string
  ) {
    if (!this.terrainReadoutText) return;
    const lon = (77.58 + (xPos - 960) * 0.0004).toFixed(3);
    const tau = gameState.jezeroCompletedExperiments.includes('exp_jezero_weather') ? '1.42 [STORM]' : '0.78';
    this.terrainReadoutText.setText(
      `ZONE: ${terrainClass}  |  MOLA: ${elev}  |  SLOPE: ${slope}  |  TAU: ${tau}  |  LON: ${lon}°E`
    );
    this.terrainBadgeText.setText(hazardText);
    this.bioBarFill.width = (150 * bioPct) / 100;
  }

  /**
   * Plan-view field map: where the four sites, rover and airlock sit across the
   * transect, with the astronaut tracked live. Registered as an UPDATE listener so
   * update() itself stays untouched.
   */
  private createFieldMiniMap() {
    const cont = this.add.container(MINI.x, MINI.y).setDepth(61);
    const bg = this.add.rectangle(0, 0, MINI.w, MINI.h, 0x050a14, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x475569);
    const title = this.add.text(MINI.mapX, 9, 'FIELD MAP // PLAN VIEW', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '9px',
      color: '#94a3b8'
    });

    const siltTop = toMini(0, SILT_LINE_Y).y;
    const bench = this.add.rectangle(MINI.mapX, MINI.mapY, MINI.mapW, siltTop - MINI.mapY, 0x2a1a12).setOrigin(0, 0);
    const silt = this.add.rectangle(MINI.mapX, siltTop, MINI.mapW, MINI.mapY + MINI.mapH - siltTop, 0x44301f).setOrigin(0, 0);
    const zoneStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '8px',
      color: '#8b95a5'
    };
    const benchLbl = this.add.text(MINI.mapX + MINI.mapW - 4, MINI.mapY + 3, 'BENCH 0.92x', zoneStyle).setOrigin(1, 0);
    const siltLbl = this.add.text(MINI.mapX + MINI.mapW - 4, siltTop + 3, 'SILT 0.72x', zoneStyle).setOrigin(1, 0);
    cont.add([bg, title, bench, silt, benchLbl, siltLbl]);

    // Rover + airlock
    const rp = toMini(ROVER_POS.x, ROVER_POS.y);
    const ap = toMini(AIRLOCK_POS.x, AIRLOCK_POS.y);
    const roverMark = this.add.rectangle(rp.x, rp.y, 9, 5, 0x64748b);
    const roverLbl = this.add.text(rp.x, rp.y - 12, 'ROVER', zoneStyle).setOrigin(0.5);
    const ready = gameState.jezeroCompletedExperiments.length >= 4;
    this.miniMapAirlock = this.add.rectangle(ap.x, ap.y, 8, 8, ready ? 0x10b981 : 0xf59e0b);
    const airlockLbl = this.add.text(ap.x, ap.y - 12, 'AIRLOCK', zoneStyle).setOrigin(0.5);
    cont.add([roverMark, roverLbl, this.miniMapAirlock, airlockLbl]);

    // Experiment sites
    this.stationCards.forEach((card, idx) => {
      const p = toMini(card.x, card.y + 115);
      const done = gameState.jezeroCompletedExperiments.includes(card.id);
      const dot = this.add.circle(p.x, p.y, 4.5, done ? 0x10b981 : card.accent.fillColor);
      const letter = this.add.text(p.x + 7, p.y - 6, String.fromCharCode(65 + idx), {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '10px',
        color: '#e2e8f0'
      });
      this.miniMapDots.set(card.id, dot);
      cont.add([dot, letter]);
    });

    // Astronaut marker
    this.miniMapAstro = this.add.circle(0, 0, 3.5, 0x67e8f9).setStrokeStyle(1, 0x0f172a);
    cont.add(this.miniMapAstro);

    this.updateFieldMiniMap();
    this.events.on(Phaser.Scenes.Events.UPDATE, this.updateFieldMiniMap, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, this.updateFieldMiniMap, this);
    });
  }

  private updateFieldMiniMap() {
    if (!this.miniMapAstro || !this.astronautSprite) return;
    const p = toMini(this.astronautSprite.x, this.astronautSprite.y);
    this.miniMapAstro.setPosition(p.x, p.y);
  }

  // ============================================================================
  // EXPERIMENT SITES
  // ============================================================================
  private createScienceWorkstations() {
    // Sites are spread west -> east and staggered in depth (card y = back/front),
    // instead of the old single row. Ground work area = card y + 115, astronaut stop = card y + 135.
    const experiments = [
      {
        id: 'exp_jezero_delta',
        title: 'EXP A: DELTA LiDAR SCAN',
        sub: 'Fluvial Strata Reconstruction',
        badge: 'TOPOGRAPHIC LiDAR',
        accent: 0x38bdf8,
        x: 440,
        y: 470,
        meta: {
          terrain: 'KODIAK BUTTE FORESET SCARP',
          elev: '-2,500m',
          slope: '18.6°',
          bioIndex: 90,
          hazard: 'STEEP SCARP // 18.6° GRADE'
        },
        run: () => this.runDeltaScan()
      },
      {
        id: 'exp_jezero_mineral',
        title: 'EXP B: RAMAN / XRF SPECTRO',
        sub: 'Smectite Clays & Carbonates',
        badge: 'UV SPECTROMETER',
        accent: 0xa855f7,
        x: 800,
        y: 410,
        meta: {
          terrain: 'HYDRATED PHYLLOSILICATE BENCH',
          elev: '-2,535m',
          slope: '11.4°',
          bioIndex: 96,
          hazard: 'NOMINAL // SMECTITE CLAYS'
        },
        run: () => this.runRamanSpectroscopy()
      },
      {
        id: 'exp_jezero_bio',
        title: 'EXP C: BIOSIGNATURE TUBE',
        sub: 'Organic Mudstone Encapsulation',
        badge: 'HERMETIC CORER',
        accent: 0x10b981,
        x: 1120,
        y: 640,
        meta: {
          terrain: 'NERETVA VALLIS CHANNEL EDGE',
          elev: '-2,548m',
          slope: '6.2°',
          bioIndex: 99,
          hazard: 'PRIME TARGET // CORE #SY-09'
        },
        run: () => this.runBiosignatureExtraction()
      },
      {
        id: 'exp_jezero_weather',
        title: 'EXP D: MEDA WEATHER MAST',
        sub: 'Atmospheric Opacity & Wind',
        badge: 'METEOROLOGY MAST',
        accent: 0xef4444,
        x: 1540,
        y: 455,
        meta: {
          terrain: 'EXPOSED AEOLIAN DELTA RIDGE',
          elev: '-2,522m',
          slope: '9.5°',
          bioIndex: 78,
          hazard: 'SEVERE // DUST FRONT TAU 1.42'
        },
        run: () => this.runWeatherStation()
      }
    ];

    experiments.forEach((e, idx) => {
      const isDone = gameState.jezeroCompletedExperiments.includes(e.id);
      const tone = isDone ? 0x10b981 : e.accent;
      const groundY = e.y + 115;

      // 1. Field equipment standing on the ground below each tag
      this.drawJezeroFieldProp(idx, e.x, groundY, e.accent);

      // 2. Work-area footprint (a flattened ring reads as a patch of ground)
      const beaconRing = this.add.circle(e.x, groundY + 14, 74, tone, 0.14)
        .setStrokeStyle(1.5, tone, 0.75)
        .setDepth(28);
      beaconRing.setScale(1, 0.3);

      // 3. Station tag
      const W = 260;
      const H = 66;
      const cont = this.add.container(e.x, e.y).setDepth(42);
      const box = this.add.rectangle(0, 0, W, H, 0x0a101d, 0.93)
        .setStrokeStyle(2, tone)
        .setInteractive({ useHandCursor: true });

      const accent = this.add.rectangle(-W / 2 + 3, 0, 6, H, tone);

      const tText = this.add.text(-W / 2 + 16, -20, e.title, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: isDone ? '#34d399' : hex(e.accent)
      }).setOrigin(0, 0.5);

      const checkMark = this.add.text(W / 2 - 12, -20, isDone ? '✓' : '●', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '14px',
        color: isDone ? '#34d399' : hex(e.accent)
      }).setOrigin(1, 0.5);

      const sText = this.add.text(-W / 2 + 16, -1, e.sub, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '13px',
        color: '#94a3b8'
      }).setOrigin(0, 0.5);

      const divider = this.add.rectangle(4, 10, W - 36, 1, 0x1e293b);

      const badgeTxt = this.add.text(-W / 2 + 16, 22, e.badge, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '9px',
        color: '#cbd5e1'
      }).setOrigin(0, 0.5);

      const status = this.add.text(W / 2 - 12, 22, isDone ? '[DATA SECURED]' : '[CLICK TO DEPLOY]', {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: isDone ? '#10b981' : '#f59e0b'
      }).setOrigin(1, 0.5);

      box.on('pointerdown', () => {
        soundFx.playClick(1000);
        this.walkAstronautTo(e.x, e.y + 135, e.meta, () => {
          e.run();
        });
      });

      box.on('pointerover', () => {
        box.setFillStyle(0x1e293b, 0.96);
        this.setTerrainIndicatorData(e.x, e.meta.terrain, e.meta.elev, e.meta.slope, e.meta.bioIndex, e.meta.hazard);
        soundFx.playClick(850);
      });

      box.on('pointerout', () => {
        box.setFillStyle(0x0a101d, 0.93);
      });

      cont.add([box, accent, tText, checkMark, sText, divider, badgeTxt, status]);
      this.stationCards.push({
        id: e.id,
        x: e.x,
        y: e.y,
        box,
        accent,
        checkMark,
        tText,
        status,
        beaconRing,
        meta: e.meta
      });
    });
  }

  /**
   * Field equipment for each site, scaled by depth (nearer = bigger) with a ground
   * shadow and a dotted tether up to the station tag.
   */
  private drawJezeroFieldProp(index: number, gx: number, gy: number, accent: number) {
    const s = Phaser.Math.Clamp(0.74 + (gy - 520) / 640, 0.74, 1.2);
    const propHeights = [44, 50, 34, 66];

    this.add.ellipse(gx, gy + 14, 104 * s, 18 * s, 0x000000, 0.34).setDepth(31);

    const tether = this.add.graphics().setDepth(29);
    const cardBottom = gy - 82;
    const propTop = gy - propHeights[index] * s - 4;
    tether.fillStyle(accent, 0.7);
    for (let yy = cardBottom + 5; yy < propTop - 8; yy += 7) tether.fillRect(gx - 1, yy, 2, 3);
    tether.fillCircle(gx, propTop - 4, 2.5);

    const prop = this.add.container(gx, gy).setDepth(32).setScale(s);

    if (index === 0) {
      // EXP A: tripod LiDAR scanner aimed west at Kodiak butte
      const beam = this.add.graphics();
      beam.fillStyle(0x38bdf8, 0.24);
      beam.fillTriangle(-13, -32, -150, -62, -150, -2);
      this.tweens.add({ targets: beam, alpha: 0.3, duration: 750, yoyo: true, repeat: -1 });

      const legs = this.add.graphics();
      legs.lineStyle(3, 0x94a3b8, 1);
      legs.lineBetween(0, -24, -26, 13);
      legs.lineBetween(0, -24, 26, 13);
      legs.lineStyle(2, 0x64748b, 1);
      legs.lineBetween(0, -24, 3, 14);
      const head = this.add.rectangle(0, -32, 24, 16, 0x0f172a).setStrokeStyle(2, 0x38bdf8);
      const lens = this.add.circle(-9, -32, 4, 0x38bdf8);
      const led = this.add.circle(8, -36, 2, 0x34d399);
      prop.add([beam, legs, head, lens, led]);
    } else if (index === 1) {
      // EXP B: UV Raman head on an articulated stand, pointed at a clay-bearing slab
      const slab = this.add.graphics();
      slab.fillStyle(0x8a6c54, 1);
      fillPoly(slab, [[-36, 12], [-32, -6], [-12, -15], [14, -13], [34, -4], [40, 12]]);
      slab.lineStyle(1, 0xd9b890, 0.7);
      slab.lineBetween(-31, -1, 36, 3);
      slab.lineBetween(-34, 6, 38, 9);

      const arm = this.add.graphics();
      arm.fillStyle(0x334155, 1);
      arm.fillRect(40, -6, 14, 18);
      arm.lineStyle(4, 0x94a3b8, 1);
      arm.lineBetween(47, -6, 40, -34);
      arm.lineBetween(40, -34, 6, -40);
      arm.fillStyle(0x64748b, 1);
      arm.fillCircle(40, -34, 3.5);

      const turret = this.add.circle(2, -40, 7, 0x1e1b3a).setStrokeStyle(2, 0xa855f7);
      const uvLine = this.add.rectangle(2, -24, 2, 24, 0xa855f7, 0.45);
      const uvSpot = this.add.circle(2, -11, 6, 0xa855f7, 0.8);
      this.tweens.add({ targets: uvSpot, scale: 1.5, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });
      prop.add([slab, arm, uvLine, turret, uvSpot]);
    } else if (index === 2) {
      // EXP C: reddish mudstone slab with white veins and leopard spots (Bright Angel-style),
      // plus the titanium sample tube in its rack
      const rock = this.add.graphics();
      rock.fillStyle(0x7a3b2e, 1);
      fillPoly(rock, [[-40, 8], [-30, -10], [-6, -18], [22, -14], [40, -2], [44, 10]]);
      rock.lineStyle(2, 0xf1ece4, 0.9);
      rock.lineBetween(-28, -4, -10, -12);
      rock.lineBetween(-10, -12, 8, -2);
      rock.lineBetween(8, -2, 30, 2);
      ([[-18, -2], [0, -8], [14, 2], [28, -4], [-4, 4]] as Array<[number, number]>).forEach(([sx, sy]) => {
        rock.fillStyle(0xe9dcc6, 1);
        rock.fillCircle(sx, sy, 2.2);
        rock.lineStyle(1, 0x2a1713, 0.9);
        rock.strokeCircle(sx, sy, 3.2);
      });

      const rack = this.add.rectangle(58, 6, 22, 8, 0x064e3b).setStrokeStyle(2, 0x10b981);
      const tube = this.add.rectangle(58, -14, 8, 32, 0xcbd5e1).setStrokeStyle(1, 0xffffff);
      const tubeBand = this.add.rectangle(58, -22, 8, 4, 0xfbbf24);
      prop.add([rock, rack, tube, tubeBand]);
    } else {
      // EXP D: MEDA-style weather mast with guy lines, anemometer cups and a dust sensor
      const guys = this.add.graphics();
      guys.lineStyle(1, 0x94a3b8, 0.5);
      guys.lineBetween(0, -40, -26, 10);
      guys.lineBetween(0, -40, 26, 10);
      const base = this.add.rectangle(0, 10, 40, 10, 0x334155).setStrokeStyle(1, 0x64748b);
      const mast = this.add.rectangle(0, -24, 5, 66, 0xcbd5e1);
      const crossbar = this.add.rectangle(0, -50, 38, 4, 0x94a3b8);
      const cupL = this.add.circle(-19, -50, 4, 0xe2e8f0);
      const cupR = this.add.circle(19, -50, 4, 0xe2e8f0);
      const sensorBox = this.add.rectangle(12, -20, 14, 10, 0x0f172a).setStrokeStyle(1, 0xef4444);
      const strobe = this.add.circle(0, -60, 5, 0xef4444);
      this.tweens.add({ targets: strobe, alpha: 0.15, duration: 420, yoyo: true, repeat: -1 });
      prop.add([guys, base, mast, crossbar, cupL, cupR, sensorBox, strobe]);
    }
  }

  private refreshStationCards() {
    for (const card of this.stationCards) {
      const isDone = gameState.jezeroCompletedExperiments.includes(card.id);
      if (isDone) {
        card.box.setStrokeStyle(2, 0x10b981);
        card.accent.setFillStyle(0x10b981);
        card.checkMark.setText('✓').setColor('#34d399');
        card.tText.setColor('#34d399');
        card.status.setText('[DATA SECURED]').setColor('#10b981');
        card.beaconRing.setFillStyle(0x10b981, 0.25).setStrokeStyle(1.5, 0x10b981, 0.75);
        this.miniMapDots.get(card.id)?.setFillStyle(0x10b981);
      }
    }

    for (const pip of this.progressPips) {
      const done = gameState.jezeroCompletedExperiments.includes(pip.id);
      pip.rect.setFillStyle(done ? 0x10b981 : 0x1e293b).setStrokeStyle(1, done ? 0x34d399 : 0x475569);
    }

    // Update Airlock status when all 4 complete
    if (gameState.jezeroCompletedExperiments.length >= 4 && this.shelterDoorFrame) {
      this.shelterDoorFrame.setStrokeStyle(2, 0x10b981);
      this.shelterStatusLight?.setFillStyle(0x10b981);
      this.shelterPrompt?.setText('[AIRLOCK READY]').setColor('#34d399');
      this.miniMapAirlock?.setFillStyle(0x10b981);
    }
  }

  private openExperimentModal(accentColor: number): Phaser.GameObjects.Container {
    this.closeActivePanel();
    const cont = this.add.container(960, 720).setDepth(100);
    const bg = this.add.rectangle(0, 0, 820, 360, 0x050c18, 0.97)
      .setStrokeStyle(2, accentColor);
    const topBar = this.add.rectangle(0, -176, 820, 6, accentColor);
    const innerFrame = this.add.rectangle(0, 2, 804, 342, 0x000000, 0)
      .setStrokeStyle(1, accentColor, 0.18);
    cont.add([bg, topBar, innerFrame]);
    this.addCornerBrackets(cont, 820, 360, accentColor, 16, 0.95);

    cont.setScale(0.94);
    cont.setAlpha(0);
    this.tweens.add({
      targets: cont,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut'
    });

    this.activePanelContainer = cont;
    return cont;
  }

  // ============================================================================
  // EXPERIMENT A: LiDAR 3-Strata Topographic & Bathymetric Reconstruction
  // ============================================================================
  private runDeltaScan() {
    const panel = this.openExperimentModal(0x38bdf8);
    const isDone = gameState.jezeroCompletedExperiments.includes('exp_jezero_delta');

    const title = this.add.text(0, -145, 'EXP A // LiDAR DELTA TOPOGRAPHIC & SEDIMENT STRATA RECONSTRUCTION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    const inst = this.add.text(
      0,
      -116,
      isDone
        ? 'BATHYMETRIC ARCHIVE COMPLETE: All 3 Western Delta sedimentary horizons mapped.'
        : 'Click each sedimentary horizon on the Kodiak Butte outcrop to reconstruct paleo-lake depth:',
      {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '14px',
        color: isDone ? '#34d399' : '#cbd5e1'
      }
    ).setOrigin(0.5);

    panel.add([title, inst]);

    const horizons = [
      {
        name: '1. TOPSET BED (CONGLOMERATE)',
        depth: 'Elev: ≈ -2,490m // Late-Stage High-Energy River Floodplain Cobbles',
        y: -55,
        color: 0xd97706
      },
      {
        name: '2. FORESET BED (CROSS-BEDDED SANDSTONE)',
        depth: 'Elev: -2,525m // Inclined Lake-Ward Delta Slope Deposits (Foresets)',
        y: 10,
        color: 0x0284c7
      },
      {
        name: '3. BOTTOMSET BED (LACUSTRINE MUDSTONE)',
        depth: 'Elev: -2,548m // Quiet Deep-Basin Silts — PRIME MICROBIAL HABITAT',
        y: 75,
        color: 0x10b981
      }
    ];

    let scannedLayers = isDone ? 3 : 0;

    horizons.forEach(h => {
      const rowBg = this.add.rectangle(-80, h.y, 560, 52, isDone ? 0x0f2942 : 0x0f172a)
        .setStrokeStyle(1, isDone ? 0x34d399 : h.color)
        .setInteractive({ useHandCursor: true });

      const hTitle = this.add.text(-340, h.y - 9, h.name, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: '#38bdf8'
      }).setOrigin(0, 0.5);

      const hSub = this.add.text(-340, h.y + 11, h.depth, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: '#cbd5e1'
      }).setOrigin(0, 0.5);

      const badge = this.add.text(285, h.y, isDone ? '[MAPPED ✓]' : '[PING LiDAR]', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: isDone ? '#34d399' : '#f59e0b',
        backgroundColor: '#091326',
        padding: { x: 12, y: 8 }
      }).setOrigin(0.5);

      rowBg.on('pointerdown', () => {
        if (isDone) return;
        rowBg.disableInteractive();
        soundFx.playClick(1300);
        rowBg.setFillStyle(0x0f2942);
        rowBg.setStrokeStyle(2, 0x34d399);
        badge.setText('[MAPPED ✓]').setColor('#34d399');

        scannedLayers++;
        if (scannedLayers >= 3 && !gameState.jezeroCompletedExperiments.includes('exp_jezero_delta')) {
          soundFx.playTelemetryChirp();
          gameState.jezeroCompletedExperiments.push('exp_jezero_delta');
          gameState.addLog('LiDAR SCAN COMPLETE: Delta bathymetry mapped. High-preservation clay targets identified.', 'science');
          this.updateStatus();
          this.time.delayedCall(500, () => this.runDeltaScan());
        }
      });

      panel.add([rowBg, hTitle, hSub, badge]);
    });

    this.addCloseButton();
  }

  // ============================================================================
  // EXPERIMENT B: UV Raman & Micro-XRF 3-Peak Spectral Profile Calibrator
  // ============================================================================
  private runRamanSpectroscopy() {
    const panel = this.openExperimentModal(0xa855f7);
    const isDone = gameState.jezeroCompletedExperiments.includes('exp_jezero_mineral');

    const title = this.add.text(0, -145, 'EXP B // ULTRA-DEEP UV RAMAN & MICRO-XRF SPECTRAL PROFILE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#c084fc'
    }).setOrigin(0.5);

    const sub = this.add.text(
      0,
      -116,
      isDone
        ? 'SPECTRAL DATASET CATALOGED: Smectite clays, carbonates, and aromatic organics confirmed.'
        : 'Excite each Raman wavenumber peak with the 248.6nm UV laser to verify mineral signatures:',
      {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '14px',
        color: isDone ? '#34d399' : '#cbd5e1'
      }
    ).setOrigin(0.5);

    panel.add([title, sub]);

    const peaks = [
      {
        title: 'PEAK 1 // 460 cm⁻¹',
        mineral: 'Fe/Mg-Smectite Clays',
        detail: 'Hydrated Phyllosilicates [CONF: 98%]',
        x: -245,
        barHeight: 110,
        color: 0x38bdf8
      },
      {
        title: 'PEAK 2 // 1085 cm⁻¹',
        mineral: 'Mg/Ca-Carbonates',
        detail: 'Neutral Aqueous pH [CONF: 94%]',
        x: 0,
        barHeight: 125,
        color: 0xa855f7
      },
      {
        title: 'PEAK 3 // 1600 cm⁻¹',
        mineral: 'G-Band Aromatic Carbon',
        detail: 'Reduced Organic Rings [CONF: 91%]',
        x: 245,
        barHeight: 96,
        color: 0x10b981
      }
    ];

    let calibratedCount = isDone ? 3 : 0;

    peaks.forEach(p => {
      const card = this.add.rectangle(p.x, 18, 225, 210, 0x0f172a)
        .setStrokeStyle(1, isDone ? 0x10b981 : p.color)
        .setInteractive({ useHandCursor: true });

      const pTitle = this.add.text(p.x, -68, p.title, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: '#e2e8f0'
      }).setOrigin(0.5);

      // Animated Spectral Peak Bar
      const specBar = this.add.rectangle(p.x, 42, 32, isDone ? p.barHeight : 18, p.color)
        .setOrigin(0.5, 1);

      const mText = this.add.text(p.x, 62, p.mineral, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: '#34d399'
      }).setOrigin(0.5);

      const dText = this.add.text(p.x, 82, p.detail, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      const statusTxt = this.add.text(p.x, 104, isDone ? '[LOCKED ✓]' : '[EXCITE UV LASER]', {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: isDone ? '#34d399' : '#f59e0b'
      }).setOrigin(0.5);

      card.on('pointerdown', () => {
        if (isDone) return;
        card.disableInteractive();
        soundFx.playClick(1350);

        this.tweens.add({
          targets: specBar,
          height: p.barHeight,
          duration: 320,
          ease: 'Back.easeOut'
        });

        card.setStrokeStyle(2, 0x10b981);
        statusTxt.setText('[LOCKED ✓]').setColor('#34d399');

        calibratedCount++;
        if (calibratedCount >= 3 && !gameState.jezeroCompletedExperiments.includes('exp_jezero_mineral')) {
          soundFx.playTelemetryChirp();
          gameState.jezeroCompletedExperiments.push('exp_jezero_mineral');
          gameState.addLog('RAMAN SPECTROMETRY LOGGED: Carbonates and smectites confirm neutral water conditions.', 'science');
          this.updateStatus();
          this.time.delayedCall(550, () => this.runRamanSpectroscopy());
        }
      });

      panel.add([card, pTitle, specBar, mText, dText, statusTxt]);
    });

    this.addCloseButton();
  }

  // ============================================================================
  // EXPERIMENT C: 3-Stage Hermetic Titanium Sample Tube #SY-09 Encapsulation
  // ============================================================================
  private runBiosignatureExtraction() {
    const panel = this.openExperimentModal(0x10b981);
    const isDone = gameState.jezeroCompletedExperiments.includes('exp_jezero_bio');

    const title = this.add.text(0, -145, 'EXP C // HERMETIC TITANIUM SAMPLE TUBE #SY-09 CORE SEALING', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#10b981'
    }).setOrigin(0.5);

    let step = isDone ? 3 : 0;
    const stepLabels = [
      'STEP 1/3: CORE ORGANIC MUDSTONE #SY-09',
      'STEP 2/3: INSERT GOLD-LINED TITANIUM SLEEVE',
      'STEP 3/3: TORQUE HERMETIC CRYO-SEAL',
      'TUBE #SY-09 HERMETICALLY SEALED & STORED'
    ];

    const diagramBox = this.add.rectangle(0, -25, 680, 145, 0x09191f)
      .setStrokeStyle(1, 0x10b981);

    // Visual Core & Titanium Sleeve Assembly
    const mudstoneCore = this.add.rectangle(-90, -25, 140, 28, 0x78350f)
      .setStrokeStyle(2, 0xf59e0b);
    const titaniumSleeve = this.add.rectangle(isDone ? -90 : 110, -25, 162, 38, 0xfbbf24, 0.85)
      .setStrokeStyle(2, 0xffffff);
    const cryoCap = this.add.rectangle(isDone ? -175 : -230, -25, 22, 42, 0x10b981)
      .setStrokeStyle(1, 0xffffff);

    const statusReadout = this.add.text(
      0,
      25,
      isDone
        ? 'CORE #SY-09 STATUS: HERMETIC VACUUM LOCK VERIFIED (PRIMARY MISSION BIOSIGNATURE)'
        : 'CORE #SY-09 STATUS: EXPOSED LACUSTRINE MUDSTONE — EXECUTE 3-STAGE ENCAPSULATION',
      {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: isDone ? '#34d399' : '#f59e0b'
      }
    ).setOrigin(0.5);

    const sealBtn = this.add.rectangle(0, 105, 360, 44, 0x10b981)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const sTxt = this.add.text(0, 105, stepLabels[step], {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#050a14'
    }).setOrigin(0.5);

    sealBtn.on('pointerdown', () => {
      if (isDone) return;
      step++;
      soundFx.playAirlockHiss();

      if (step === 1) {
        this.tweens.add({ targets: mudstoneCore, scaleX: 1.08, yoyo: true, duration: 180 });
        statusReadout.setText('STAGE 1 COMPLETE: 6cm intact organic mudstone cylinder extracted.');
        sTxt.setText(stepLabels[1]);
      } else if (step === 2) {
        this.tweens.add({ targets: titaniumSleeve, x: -90, duration: 350, ease: 'Cubic.easeOut' });
        statusReadout.setText('STAGE 2 COMPLETE: Core inserted into ultra-pure gold-lined titanium sleeve.');
        sTxt.setText(stepLabels[2]);
      } else if (step >= 3) {
        sealBtn.disableInteractive();
        this.tweens.add({
          targets: cryoCap,
          x: -175,
          duration: 300,
          ease: 'Back.easeOut',
          onComplete: () => {
            soundFx.playTelemetryChirp();
            gameState.biosignatureSampleTube = true;
            if (!gameState.jezeroCompletedExperiments.includes('exp_jezero_bio')) {
              gameState.jezeroCompletedExperiments.push('exp_jezero_bio');
              gameState.addLog('CRITICAL DISCOVERY: Sample tube #SY-09 sealed. High-potential biosignatures secured.', 'science');
            }
            this.updateStatus();
            this.time.delayedCall(450, () => this.runBiosignatureExtraction());
          }
        });
      }
    });

    panel.add([title, diagramBox, mudstoneCore, titaniumSleeve, cryoCap, statusReadout, sealBtn, sTxt]);
    this.addCloseButton();
  }

  // ============================================================================
  // EXPERIMENT D: MEDA Meteorological Array & Regional Dust Front Detection
  // ============================================================================
  private runWeatherStation() {
    const panel = this.openExperimentModal(0xef4444);
    const isDone = gameState.jezeroCompletedExperiments.includes('exp_jezero_weather');

    const title = this.add.text(0, -145, 'EXP D // MEDA METEOROLOGICAL & DUST OPACITY TELEMETRY', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '14px',
      color: '#ef4444'
    }).setOrigin(0.5);

    const readingsBox = this.add.rectangle(0, -22, 700, 165, 0x1a0b0e)
      .setStrokeStyle(1, 0xef4444);

    const readings = this.add.text(
      0,
      -22,
      'Current Atmospheric Readings at Jezero Western Scarp:\n• Barometric Pressure: ~720 Pa (Falling — dust front)\n• Surface Ambient Temp: -64°C\n• Anemometer Wind Vector: 18.4 m/s ESE (GUSTS RISING)\n• Dust Devils: frequent vortices, 100+ m across\n• Optical Depth (Tau): 1.42 — ALARM: CONTINENT-SCALE DUST FRONT INCOMING!',
      {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '12px',
        color: '#f87171',
        align: 'center',
        lineSpacing: 7
      }
    ).setOrigin(0.5);

    const deployBtn = this.add.rectangle(0, 105, 340, 44, isDone ? 0x10b981 : 0xef4444)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const btnTxt = this.add.text(
      0,
      105,
      isDone ? 'STORM TELEMETRY LOCKED [TAU 1.42]' : 'LOCK MEDA STORM TELEMETRY & SOUND ALARM',
      {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: isDone ? '#050a14' : '#ffffff'
      }
    ).setOrigin(0.5);

    deployBtn.on('pointerdown', () => {
      if (isDone) return;
      deployBtn.disableInteractive();
      soundFx.playTelemetryChirp();

      if (!gameState.jezeroCompletedExperiments.includes('exp_jezero_weather')) {
        gameState.jezeroCompletedExperiments.push('exp_jezero_weather');
        gameState.addLog('WEATHER TELEMETRY LOCKED: Severe regional dust storm confirmed tracking toward Jezero.', 'warning');
      }

      if (this.stormTintOverlay) {
        this.tweens.add({ targets: this.stormTintOverlay, fillAlpha: 0.22, duration: 1000 });
      }

      this.updateStatus();
      this.time.delayedCall(500, () => this.runWeatherStation());
    });

    panel.add([title, readingsBox, readings, deployBtn, btnTxt]);
    this.addCloseButton();
  }

  private addCloseButton() {
    const closeBtn = this.add.text(380, -155, '✕', {
      fontSize: '20px',
      color: '#94a3b8'
    }).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      soundFx.playClick(700);
      this.closeActivePanel();
    });
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
    this.refreshStationCards();

    if (done >= 4) {
      this.expStatusText.setText('CRITICAL ADVISORY: DRIVETRAIN DEFICIT DETECTED // DECISION REQUIRED');
      this.expStatusText.setColor('#ef4444');

      // Guard so the Critical Decision button is only created once
      if (!this.decisionBtnContainer) {
        this.decisionBtnContainer = this.add.container(960, 960).setDepth(80);

        const decisionBtn = this.add.rectangle(0, 0, 440, 48, 0xef4444)
          .setStrokeStyle(2, 0xffffff)
          .setInteractive({ useHandCursor: true });

        const dTxt = this.add.text(0, 0, 'OPEN CRITICAL MISSION DECISION', {
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '13px',
          color: '#ffffff'
        }).setOrigin(0.5);

        this.decisionBtnContainer.add([decisionBtn, dTxt]);

        this.tweens.add({
          targets: this.decisionBtnContainer,
          scale: 1.04,
          duration: 650,
          yoyo: true,
          repeat: -1
        });

        decisionBtn.on('pointerdown', () => {
          this.triggerCriticalDecision();
        });
      }
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
            transitionToScene(this, 'EndingScene');
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
            gameState.currentLocation = 'jezero_shelter';
            transitionToScene(this, 'JezeroShelterScene');
          }
        }
      ]
    });
  }
}