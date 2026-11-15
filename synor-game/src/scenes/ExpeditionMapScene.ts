/**
 * Interactive NASA Mars Trek Traverse Planner Scene — v3 Parallax & High-Detail Edition
 * Simulates multi-week autonomous LREV rover expeditions across real Martian coordinates.
 * Features:
 *  - Multi-layer orbital starfield & planetary limb parallax backdrop
 *  - High-detail MOLA graticule map, radar sweep, and toggleable SHARAD/DONKI overlays
 *  - Articulated top-down 6-wheel LREV token with directional heading & headlight cone
 *  - Live MOLA Topographic Elevation Cross-Section Chart with real-time rover playhead
 *  - Live NASA Mars Trek WMTS tile loader, DONKI solar storm transit dose, & OSDR bio-brief
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { resourceEngine } from '../state/ResourceEngine';
import {
  MARS_SITES,
  CARGO_DEPOTS,
  projectMarsToCanvas,
  calculateTraverseDistanceKm,
  getTraverseWaypoints,
  MarsCoord,
  TraverseWaypoint,
} from '../utils/MarsGeo';
import { ProceduralGraphics } from '../utils/ProceduralGraphics';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';

// ─────────────────────────────────────────────────────────────────────────────
// Layout, Theme & Depth Constants
// ─────────────────────────────────────────────────────────────────────────────

const W = 1920;
const H = 1080;

const FONT_HEAD = 'Orbitron, sans-serif';
const FONT_MONO = 'Share Tech Mono, monospace';
const FONT_BODY = 'Rajdhani, sans-serif';

const COLOR = {
  panel: 0x060c17,
  panelInner: 0x0a1526,
  ink: 0x040811,
  cyan: 0x38bdf8,
  cyanDeep: 0x0284c7,
  green: 0x34d399,
  greenDeep: 0x10b981,
  amber: 0xf59e0b,
  red: 0xef4444,
  slate: 0x475569,
  steel: 0x94a3b8,
};

const DEPTH = {
  spaceBg: 0,
  starsFar: 1,
  starsNear: 2,
  planetLimb: 3,
  orbitalGrid: 4,
  mapChassis: 10,
  mapImage: 12,
  mapOverlayMode: 14,
  mapGraticule: 16,
  mapLandmarks: 18,
  mapRoute: 20,
  mapPins: 25,
  mapRover: 30,
  mapScanline: 32,
  mapFrame: 35,
  hud: 200,
  toast: 400,
};

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

type Gfx = Phaser.GameObjects.Graphics;
type MapOverlayMode = 'MOLA_TOPO' | 'SHARAD_ICE' | 'DONKI_RAD';

const point = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

interface ParallaxLayer {
  target: Phaser.GameObjects.GameObject & { x: number; y: number };
  baseX: number;
  baseY: number;
  factorX: number;
  factorY: number;
}

export class ExpeditionMapScene extends Phaser.Scene {
  // Map viewport bounds (sits cleanly between top/bottom global bars and right control tower)
  private mapOriginX = 42;
  private mapOriginY = 136;
  private mapWidth = 1356;
  private mapHeight = 648;

  private parallaxLayers: ParallaxLayer[] = [];
  private camOffsetX = 0;
  private camOffsetY = 0;

  private waypoints: TraverseWaypoint[] = [];
  private currentOriginSite!: MarsCoord;
  private currentTargetSite!: MarsCoord;
  private inspectedCoord!: MarsCoord;
  private totalDistanceKm = 0;

  private isTraversing = false;
  private traverseCompleted = false;
  private currentWaypointIdx = 0;
  private activeOverlayMode: MapOverlayMode = 'MOLA_TOPO';

  // Dynamic Scene Objects
  private roverToken!: Phaser.GameObjects.Container;
  private roverPingRing!: Phaser.GameObjects.Arc;
  private scanLineGfx!: Gfx;
  private modeOverlayGfx!: Gfx;
  private routePulseGfx!: Gfx;
  private elevationPlayheadGfx!: Gfx;

  // Dynamic UI Text & Elements
  private headerStatusText!: Phaser.GameObjects.Text;
  private headerProgressFill!: Phaser.GameObjects.Rectangle;
  private distanceText!: Phaser.GameObjects.Text;
  private liveCoordText!: Phaser.GameObjects.Text;
  private liveElevSlopeText!: Phaser.GameObjects.Text;
  private liveDonkiText!: Phaser.GameObjects.Text;
  private inspectTitleText!: Phaser.GameObjects.Text;
  private inspectBodyText!: Phaser.GameObjects.Text;
  private tilePreviewStatus!: Phaser.GameObjects.Text;
  private tilePreviewContainer!: Phaser.GameObjects.Container;
  private toastText?: Phaser.GameObjects.Text;

  // Elevation graph bounds
  private graphX = 68;
  private graphY = 842;
  private graphW = 790;
  private graphH = 122;

  constructor() {
    super({ key: 'ExpeditionMapScene' });
  }

  /**
   * Reset state every time the scene starts (Act II, Act III, Act IV)
   */
  init() {
    this.parallaxLayers = [];
    this.waypoints = [];
    this.isTraversing = false;
    this.traverseCompleted = false;
    this.currentWaypointIdx = 0;
    this.activeOverlayMode = 'MOLA_TOPO';
    this.camOffsetX = 0;
    this.camOffsetY = 0;
    this.toastText = undefined;
  }

  create() {
    audioManager.playMusic(this, 'music_game', { loop: true });
    this.cameras.main.fadeIn(450, 4, 8, 17);

    this.setupMissionRoute();
    this.createOrbitalParallaxBackdrop();

    // Generate Procedural MOLA map texture fallback
    ProceduralGraphics.generateMarsGlobalMap(this, 'mars_global_mola', this.mapWidth, this.mapHeight);

    this.createMapTable();
    this.createGeologicalLandmarks();
    this.createTraversePath();
    this.createSiteAndDepotMarkers();
    this.createRoverToken();

    this.createMissionHeader();
    this.createBottomElevationAndOsdrPanel();
    this.createTelemetrySidePanel();

    // Load live NASA Mars Trek WMTS tile for the target site
    this.loadMarsTrekPreviewTile(this.currentTargetSite);
  }

  update(time: number, _delta: number) {
    // 1. Multi-layer Parallax Tracking (Mouse + Active Rover Position)
    const ptr = this.input.activePointer;
    const ptrNormX = ((ptr.x || W / 2) - W / 2) / (W / 2);
    const ptrNormY = ((ptr.y || H / 2) - H / 2) / (H / 2);
    const roverNormX = this.roverToken
      ? (this.roverToken.x - (this.mapOriginX + this.mapWidth / 2)) / (this.mapWidth / 2)
      : 0;

    const targetX = (ptrNormX * 0.6 + roverNormX * 0.4) * 34;
    const targetY = ptrNormY * 18;

    this.camOffsetX = Phaser.Math.Linear(this.camOffsetX, targetX, 0.06);
    this.camOffsetY = Phaser.Math.Linear(this.camOffsetY, targetY, 0.06);

    for (const layer of this.parallaxLayers) {
      layer.target.x = layer.baseX - this.camOffsetX * layer.factorX;
      layer.target.y = layer.baseY - this.camOffsetY * layer.factorY;
    }

    // 2. Animated Orbital MOLA Laser Scan Sweep across the map
    if (this.scanLineGfx) {
      this.scanLineGfx.clear();
      const sweepX = this.mapOriginX + ((time * 0.09) % this.mapWidth);
      this.scanLineGfx.lineStyle(1.5, COLOR.cyan, 0.45);
      this.scanLineGfx.lineBetween(sweepX, this.mapOriginY, sweepX, this.mapOriginY + this.mapHeight);
      this.scanLineGfx.fillStyle(COLOR.cyan, 0.06);
      this.scanLineGfx.fillRect(Math.max(this.mapOriginX, sweepX - 28), this.mapOriginY, Math.min(28, sweepX - this.mapOriginX), this.mapHeight);
    }

    // 3. Animated Energy Beacons Flowing Along Great-Circle Route
    if (this.routePulseGfx && this.waypoints.length > 1) {
      this.routePulseGfx.clear();
      const phase = (time * 0.0006) % 1;
      const idxFloat = phase * (this.waypoints.length - 1);
      const i0 = Math.floor(idxFloat);
      const i1 = Math.min(this.waypoints.length - 1, i0 + 1);
      const frac = idxFloat - i0;

      const p1 = projectMarsToCanvas(this.waypoints[i0].lat, this.waypoints[i0].lon, this.mapWidth, this.mapHeight);
      const p2 = projectMarsToCanvas(this.waypoints[i1].lat, this.waypoints[i1].lon, this.mapWidth, this.mapHeight);

      if (Math.abs(p2.x - p1.x) < this.mapWidth / 2) {
        const px = this.mapOriginX + Phaser.Math.Linear(p1.x, p2.x, frac);
        const py = this.mapOriginY + Phaser.Math.Linear(p1.y, p2.y, frac);
        this.routePulseGfx.fillStyle(COLOR.cyan, 0.9).fillCircle(px, py, 3.5);
        this.routePulseGfx.fillStyle(COLOR.cyan, 0.25).fillCircle(px, py, 9);
      }
    }
  }

  // ───────────────────────────── Route & Telemetry Setup ─────────────────────────────

  private setupMissionRoute() {
    if (gameState.currentChapter === 'act_2_arcadia') {
      this.currentOriginSite = MARS_SITES.GALE_CRATER;
      this.currentTargetSite = MARS_SITES.ARCADIA_PLANITIA;
    } else if (gameState.currentChapter === 'act_3_gale_return') {
      this.currentOriginSite = MARS_SITES.ARCADIA_PLANITIA;
      this.currentTargetSite = MARS_SITES.GALE_CRATER;
    } else {
      this.currentOriginSite = MARS_SITES.GALE_CRATER;
      this.currentTargetSite = MARS_SITES.JEZERO_CRATER;
    }

    this.inspectedCoord = this.currentTargetSite;

    this.totalDistanceKm = calculateTraverseDistanceKm(
      this.currentOriginSite.lat,
      this.currentOriginSite.lon,
      this.currentTargetSite.lat,
      this.currentTargetSite.lon
    );

    this.waypoints = getTraverseWaypoints(this.currentOriginSite, this.currentTargetSite, 24);
  }

  // ───────────────────────────── Multi-Layer Orbital Parallax Backdrop ─────────────────────────────

  private addParallaxLayer(
    target: Phaser.GameObjects.GameObject & { x: number; y: number },
    factorX: number,
    factorY: number
  ) {
    this.parallaxLayers.push({
      target,
      baseX: target.x,
      baseY: target.y,
      factorX,
      factorY,
    });
  }

  private createOrbitalParallaxBackdrop() {
    // Deep Space Base
    this.add.rectangle(W / 2, H / 2, W, H, 0x030710).setDepth(DEPTH.spaceBg);

    // Layer 1: Far Starfield + Nebula Dust (Parallax 0.12)
    const starsFar = this.add.graphics().setDepth(DEPTH.starsFar);
    const rndFar = new Phaser.Math.RandomDataGenerator(['mars-orbit-far']);
    for (let i = 0; i < 110; i++) {
      const x = rndFar.between(-60, W + 60);
      const y = rndFar.between(-40, H + 40);
      starsFar.fillStyle(0xcbd5e1, rndFar.realInRange(0.15, 0.55)).fillCircle(x, y, rndFar.realInRange(0.6, 1.5));
    }
    this.addParallaxLayer(starsFar, 0.12, 0.12);

    // Layer 2: Near Bright Navigation Stars & Orbital Telemetry Crosshairs (Parallax 0.28)
    const starsNear = this.add.graphics().setDepth(DEPTH.starsNear);
    const rndNear = new Phaser.Math.RandomDataGenerator(['mars-orbit-near']);
    for (let i = 0; i < 35; i++) {
      const x = rndNear.between(-40, W + 40);
      const y = rndNear.between(-40, H + 40);
      starsNear.fillStyle(0x38bdf8, rndNear.realInRange(0.25, 0.65)).fillCircle(x, y, rndNear.realInRange(1.2, 2.2));
    }
    this.addParallaxLayer(starsNear, 0.28, 0.28);

    // Layer 3: Martian Planetary Atmosphere Limb Glow behind Map Table (Parallax 0.45)
    const limb = this.add.graphics().setDepth(DEPTH.planetLimb);
    limb.fillStyle(0x9a3412, 0.12).fillEllipse(720, 480, 1650, 920);
    limb.fillStyle(0xea580c, 0.07).fillEllipse(720, 480, 1460, 760);
    this.addParallaxLayer(limb, 0.45, 0.35);

    // Layer 4: Orbital Cartographic Background Grid (Parallax 0.65)
    const orbGrid = this.add.graphics().setDepth(DEPTH.orbitalGrid);
    orbGrid.lineStyle(1, COLOR.cyan, 0.04);
    for (let x = 0; x <= W; x += 96) orbGrid.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 96) orbGrid.lineBetween(0, y, W, y);
    this.addParallaxLayer(orbGrid, 0.65, 0.5);
  }

  // ───────────────────────────── Layered UI Helper ─────────────────────────────

  private createLayeredPanel(w: number, h: number, accent: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);

    const shadow = this.add.rectangle(0, 6, w + 8, h + 8, 0x000000, 0.55);
    const outerGlow = this.add.rectangle(0, 0, w + 4, h + 4, accent, 0.08);
    const bg = this.add.rectangle(0, 0, w, h, COLOR.panel, 0.94).setStrokeStyle(1.5, accent, 0.65);
    const topBar = this.add.rectangle(0, -h / 2 + 2, w, 4, accent, 0.95);

    const deco = this.add.graphics();
    deco.lineStyle(1, accent, 0.035);
    for (let y = -h / 2 + 12; y < h / 2 - 6; y += 8) {
      deco.lineBetween(-w / 2 + 6, y, w / 2 - 6, y);
    }
    this.bracket(deco, w + 10, h + 10, 12, accent);

    c.add([shadow, outerGlow, bg, topBar, deco]);
    return c;
  }

  private bracket(g: Gfx, w: number, h: number, s: number, color: number) {
    g.lineStyle(2, color, 0.9);
    const hw = w / 2;
    const hh = h / 2;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.beginPath()
        .moveTo(sx * hw, sy * (hh - s))
        .lineTo(sx * hw, sy * hh)
        .lineTo(sx * (hw - s), sy * hh)
        .strokePath();
    }
  }

  // ───────────────────────────── Main MOLA Map Table & Graticule ─────────────────────────────

  private createMapTable() {
    const cx = this.mapOriginX + this.mapWidth / 2;
    const cy = this.mapOriginY + this.mapHeight / 2;

    // Outer Layered Map Bezel
    const mapChassis = this.createLayeredPanel(this.mapWidth + 16, this.mapHeight + 16, COLOR.cyan);
    mapChassis.setPosition(cx, cy).setDepth(DEPTH.mapChassis);

    // Attach Blender Slot or Procedural MOLA Global Map
    attachBlenderSceneSlot(this, 'EXPEDITION_MAP', () => {
      const mapImg = this.add
        .image(cx, cy, 'mars_global_mola')
        .setDisplaySize(this.mapWidth, this.mapHeight)
        .setDepth(DEPTH.mapImage);
      return mapImg;
    });

    // Dynamic Layer Mode Overlay (MOLA Topo / SHARAD Ice / DONKI Rad)
    this.modeOverlayGfx = this.add.graphics().setDepth(DEPTH.mapOverlayMode);
    this.renderMapOverlayMode();

    // Equirectangular Lat/Lon Graticule Grid
    const grid = this.add.graphics().setDepth(DEPTH.mapGraticule);
    grid.lineStyle(1, COLOR.cyan, 0.16);

    // Latitude parallels (-60, -30, 0, +30, +60)
    const lats = [-60, -30, 0, 30, 60];
    lats.forEach(lat => {
      const pos = projectMarsToCanvas(lat, 0, this.mapWidth, this.mapHeight);
      const y = this.mapOriginY + pos.y;
      grid.lineStyle(lat === 0 ? 1.5 : 1, COLOR.cyan, lat === 0 ? 0.35 : 0.15);
      grid.lineBetween(this.mapOriginX, y, this.mapOriginX + this.mapWidth, y);

      this.add.text(this.mapOriginX + 8, y - 12, lat === 0 ? '0° EQUATOR (AREOID)' : `${lat > 0 ? '+' : ''}${lat}°`, {
        fontFamily: FONT_MONO, fontSize: '10px', color: lat === 0 ? hex(COLOR.cyan) : '#64748b',
      }).setDepth(DEPTH.mapGraticule + 1);
    });

    // Longitude meridians (-120, -60, 0, +60, +120)
    const lons = [-120, -60, 0, 60, 120];
    lons.forEach(lon => {
      const pos = projectMarsToCanvas(0, lon, this.mapWidth, this.mapHeight);
      const x = this.mapOriginX + pos.x;
      grid.lineStyle(lon === 0 ? 1.5 : 1, COLOR.cyan, lon === 0 ? 0.32 : 0.15);
      grid.lineBetween(x, this.mapOriginY, x, this.mapOriginY + this.mapHeight);

      this.add.text(x + 5, this.mapOriginY + this.mapHeight - 16, `${lon > 0 ? '+' : ''}${lon}°E`, {
        fontFamily: FONT_MONO, fontSize: '10px', color: '#64748b',
      }).setDepth(DEPTH.mapGraticule + 1);
    });

    // Crustal Dichotomy Boundary Line (approximate transition between northern lowlands & southern highlands)
    grid.lineStyle(1.5, COLOR.amber, 0.28);
    const dichotomyPts = [
      projectMarsToCanvas(35, -175, this.mapWidth, this.mapHeight),
      projectMarsToCanvas(22, -110, this.mapWidth, this.mapHeight),
      projectMarsToCanvas(12, -45, this.mapWidth, this.mapHeight),
      projectMarsToCanvas(28, 25, this.mapWidth, this.mapHeight),
      projectMarsToCanvas(5, 85, this.mapWidth, this.mapHeight),
      projectMarsToCanvas(-6, 138, this.mapWidth, this.mapHeight),
      projectMarsToCanvas(18, 175, this.mapWidth, this.mapHeight),
    ];
    for (let i = 0; i < dichotomyPts.length - 1; i++) {
      grid.lineBetween(
        this.mapOriginX + dichotomyPts[i].x,
        this.mapOriginY + dichotomyPts[i].y,
        this.mapOriginX + dichotomyPts[i + 1].x,
        this.mapOriginY + dichotomyPts[i + 1].y
      );
    }

    // Animated Orbital Laser Sweep Line
    this.scanLineGfx = this.add.graphics().setDepth(DEPTH.mapScanline);

    // Interactive Map Click -> Sample any Martian coordinate with Mars Trek math
    const mapZone = this.add
      .zone(cx, cy, this.mapWidth, this.mapHeight)
      .setDepth(DEPTH.mapImage + 1)
      .setInteractive({ useHandCursor: true });

    mapZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.mapOriginX;
      const localY = pointer.y - this.mapOriginY;
      const lon = Number(((localX / this.mapWidth) * 360 - 180).toFixed(1));
      const lat = Number((90 - (localY / this.mapHeight) * 180).toFixed(1));

      // Ping effect on map
      const ping = this.add.circle(pointer.x, pointer.y, 6, COLOR.cyan, 0)
        .setStrokeStyle(2, COLOR.cyan)
        .setDepth(DEPTH.mapPins);
      this.tweens.add({
        targets: ping, scale: 4, alpha: 0, duration: 500,
        onComplete: () => ping.destroy(),
      });

      soundFx.playClick(950);
      this.toast(`MARS TREK SURVEY PROBE: ${lat}°N, ${lon}°E`, COLOR.cyan);
    });
  }

  /**
   * Renders toggleable NASA data layers across the MOLA map (MOLA Topo, SHARAD Ice, DONKI Rad)
   */
  private renderMapOverlayMode() {
    if (!this.modeOverlayGfx) return;
    this.modeOverlayGfx.clear();

    if (this.activeOverlayMode === 'SHARAD_ICE') {
      // Highlight Northern Lowlands & Arcadia Planitia shallow subsurface water-ice sheet (>35°N and <-40°S)
      const northH = (55 / 180) * this.mapHeight;
      this.modeOverlayGfx.fillStyle(0x38bdf8, 0.18);
      this.modeOverlayGfx.fillRect(this.mapOriginX, this.mapOriginY, this.mapWidth, northH);
      this.modeOverlayGfx.lineStyle(2, COLOR.cyan, 0.65);
      this.modeOverlayGfx.lineBetween(this.mapOriginX, this.mapOriginY + northH, this.mapOriginX + this.mapWidth, this.mapOriginY + northH);

      this.modeOverlayGfx.fillStyle(0x38bdf8, 0.14);
      this.modeOverlayGfx.fillRect(this.mapOriginX, this.mapOriginY + this.mapHeight - northH * 0.8, this.mapWidth, northH * 0.8);
    } else if (this.activeOverlayMode === 'DONKI_RAD') {
      // Highlight high-altitude unshielded solar particle flux zones
      this.modeOverlayGfx.fillStyle(COLOR.amber, 0.12);
      this.modeOverlayGfx.fillRect(this.mapOriginX, this.mapOriginY + this.mapHeight * 0.35, this.mapWidth, this.mapHeight * 0.65);
      this.modeOverlayGfx.lineStyle(1.5, COLOR.red, 0.45);
      for (let y = this.mapOriginY + 80; y < this.mapOriginY + this.mapHeight; y += 70) {
        this.modeOverlayGfx.lineBetween(this.mapOriginX, y, this.mapOriginX + this.mapWidth, y);
      }
    }
  }

  /**
   * Draws wireframe topographic rings for major Martian geological features from Mars Trek
   */
  private createGeologicalLandmarks() {
    const g = this.add.graphics().setDepth(DEPTH.mapLandmarks);
    const landmarks = [
      { name: 'OLYMPUS MONS (+21.2km)', lat: 18.65, lon: -133.8, r: 34 },
      { name: 'VALLES MARINERIS (-7km)', lat: -14.0, lon: -59.2, r: 46 },
      { name: 'HELLAS BASIN (-7.1km)', lat: -42.4, lon: 70.5, r: 52 },
      { name: 'ELYSIUM MONS (+14.0km)', lat: 25.0, lon: 147.2, r: 24 },
    ];

    landmarks.forEach(lm => {
      const pos = projectMarsToCanvas(lm.lat, lm.lon, this.mapWidth, this.mapHeight);
      const cx = this.mapOriginX + pos.x;
      const cy = this.mapOriginY + pos.y;

      g.lineStyle(1, 0xfcd9b6, 0.28).strokeCircle(cx, cy, lm.r);
      g.lineStyle(1, 0xfcd9b6, 0.16).strokeCircle(cx, cy, lm.r * 0.65);
      g.lineBetween(cx - 5, cy, cx + 5, cy).lineBetween(cx, cy - 5, cx, cy + 5);

      this.add.text(cx, cy + lm.r + 8, lm.name, {
        fontFamily: FONT_MONO, fontSize: '9px', color: '#94a3b8',
      }).setOrigin(0.5).setAlpha(0.65).setDepth(DEPTH.mapLandmarks);
    });
  }

  // ───────────────────────────── Interactive Site & Depot Markers ─────────────────────────────

  private createSiteAndDepotMarkers() {
    // 1. Primary NASA Mission Sites (Gale, Arcadia, Jezero)
    Object.values(MARS_SITES).forEach(site => {
      const pos = projectMarsToCanvas(site.lat, site.lon, this.mapWidth, this.mapHeight);
      const cx = this.mapOriginX + pos.x;
      const cy = this.mapOriginY + pos.y;

      const isTarget = site.name === this.currentTargetSite.name;
      const isOrigin = site.name === this.currentOriginSite.name;
      const col = isTarget ? COLOR.red : isOrigin ? COLOR.green : COLOR.amber;

      const cont = this.add.container(cx, cy).setDepth(DEPTH.mapPins);

      // Outer targeting reticle
      const reticle = this.add.graphics();
      reticle.lineStyle(1.5, col, 0.85).strokeCircle(0, 0, 15);
      reticle.lineBetween(-20, 0, -11, 0).lineBetween(11, 0, 20, 0);
      reticle.lineBetween(0, -20, 0, -11).lineBetween(0, 11, 0, 20);

      const pulse = this.add.circle(0, 0, 14, col, 0).setStrokeStyle(2, col, 0.9);
      const core = this.add.circle(0, 0, 6, col, 1).setStrokeStyle(1.5, 0xffffff);

      const roleTag = isTarget ? ' [TARGET]' : isOrigin ? ' [ORIGIN]' : ' [SITE]';
      const lbl = this.add.text(0, -26, `${site.name.toUpperCase()}${roleTag}`, {
        fontFamily: FONT_MONO, fontSize: '11px', color: hex(col),
        backgroundColor: hex(COLOR.ink), padding: { x: 6, y: 2 },
      }).setOrigin(0.5);

      const subLbl = this.add.text(0, 24, `MOLA: ${site.elevationMeters}m | ICE: ${site.subsurfaceIceDepthM}m`, {
        fontFamily: FONT_MONO, fontSize: '9px', color: '#cbd5e1',
        backgroundColor: hex(COLOR.ink), padding: { x: 4, y: 1 },
      }).setOrigin(0.5);

      cont.add([reticle, pulse, core, lbl, subLbl]);

      if (isTarget || isOrigin) {
        this.tweens.add({
          targets: pulse, scale: 2.2, alpha: 0, duration: 1400, repeat: -1, ease: 'Sine.easeOut',
        });
      }

      const hit = this.add.zone(cx, cy, 140, 68).setDepth(DEPTH.mapPins + 1).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        soundFx.playClick(900);
        cont.setScale(1.1);
        this.inspectSiteOrDepot(site);
      });
      hit.on('pointerout', () => cont.setScale(1.0));
      hit.on('pointerdown', () => {
        soundFx.playTelemetryChirp();
        this.inspectSiteOrDepot(site);
        this.loadMarsTrekPreviewTile(site);
      });
    });

    // 2. Pre-Positioned NASA Autonomous Cargo Depots
    CARGO_DEPOTS.forEach(depot => {
      const pos = projectMarsToCanvas(depot.lat, depot.lon, this.mapWidth, this.mapHeight);
      const cx = this.mapOriginX + pos.x;
      const cy = this.mapOriginY + pos.y;

      const g = this.add.graphics({ x: cx, y: cy }).setDepth(DEPTH.mapPins);
      // Diamond/Hexagon supply beacon
      g.fillStyle(COLOR.panel, 0.95).fillRect(-7, -7, 14, 14);
      g.lineStyle(2, COLOR.cyan).strokeRect(-7, -7, 14, 14);
      g.fillStyle(COLOR.cyan).fillCircle(0, 0, 3);

      const txt = this.add.text(cx, cy + 16, depot.name, {
        fontFamily: FONT_MONO, fontSize: '9px', color: hex(COLOR.cyan),
        backgroundColor: hex(COLOR.ink), padding: { x: 4, y: 1 },
      }).setOrigin(0.5).setDepth(DEPTH.mapPins);

      const hit = this.add.zone(cx, cy, 110, 42).setDepth(DEPTH.mapPins + 1).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        soundFx.playClick(850);
        txt.setColor('#ffffff');
        this.inspectSiteOrDepot(depot);
      });
      hit.on('pointerout', () => txt.setColor(hex(COLOR.cyan)));
      hit.on('pointerdown', () => {
        soundFx.playClick(1050);
        this.inspectSiteOrDepot(depot);
        this.loadMarsTrekPreviewTile(depot);
      });
    });
  }

  // ───────────────────────────── Great-Circle Route & Detailed LREV Token ─────────────────────────────

  private createTraversePath() {
    const g = this.add.graphics().setDepth(DEPTH.mapRoute);

    // Outer glow corridor + inner dashed/waypoint path
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const p1 = projectMarsToCanvas(this.waypoints[i].lat, this.waypoints[i].lon, this.mapWidth, this.mapHeight);
      const p2 = projectMarsToCanvas(this.waypoints[i + 1].lat, this.waypoints[i + 1].lon, this.mapWidth, this.mapHeight);

      if (Math.abs(p2.x - p1.x) < this.mapWidth / 2) {
        const x1 = this.mapOriginX + p1.x;
        const y1 = this.mapOriginY + p1.y;
        const x2 = this.mapOriginX + p2.x;
        const y2 = this.mapOriginY + p2.y;

        g.lineStyle(6, COLOR.cyan, 0.15).lineBetween(x1, y1, x2, y2);
        g.lineStyle(2, COLOR.cyan, 0.85).lineBetween(x1, y1, x2, y2);
        g.fillStyle(0xffffff, 0.85).fillCircle(x1, y1, 2.2);
      }
    }

    this.routePulseGfx = this.add.graphics().setDepth(DEPTH.mapRoute + 1);
  }

  /**
   * Builds a high-detail top-down articulated 6-wheel LREV rover token with headlights & radar ring
   */
  private createRoverToken() {
    const startPos = projectMarsToCanvas(this.currentOriginSite.lat, this.currentOriginSite.lon, this.mapWidth, this.mapHeight);
    const rx = this.mapOriginX + startPos.x;
    const ry = this.mapOriginY + startPos.y;

    this.roverPingRing = this.add.circle(0, 0, 16, COLOR.cyan, 0).setStrokeStyle(1.5, COLOR.cyan, 0.85);

    const g = this.add.graphics();
    // Forward LiDAR / Headlight sweep cone (points right along +X in local space)
    g.fillStyle(0xfef08a, 0.18).fillPoints([
      point(10, -3), point(44, -16), point(44, 16), point(10, 3)
    ], true);

    // 6 Outrigger Titanium Wheels
    g.fillStyle(0x0f172a);
    for (const wx of [-9, 0, 9]) {
      g.fillRect(wx - 3, -11, 6, 3);
      g.fillRect(wx - 3, 8, 6, 3);
    }

    // Pressurized LREV Chassis Body
    g.fillStyle(0xe2e8f0).fillRoundedRect(-12, -7, 24, 14, 4);
    g.lineStyle(1.5, COLOR.cyanDeep).strokeRoundedRect(-12, -7, 24, 14, 4);
    // Gold Cockpit Canopy & Solar Roof Deck
    g.fillStyle(COLOR.amber).fillRoundedRect(3, -5, 7, 10, 2);
    g.fillStyle(0x1e3a8a).fillRect(-9, -4, 10, 8);

    this.roverToken = this.add.container(rx, ry, [this.roverPingRing, g]).setDepth(DEPTH.mapRover);

    // Aim rover toward first waypoint
    if (this.waypoints.length > 1) {
      const p1 = projectMarsToCanvas(this.waypoints[1].lat, this.waypoints[1].lon, this.mapWidth, this.mapHeight);
      const angle = Phaser.Math.Angle.Between(startPos.x, startPos.y, p1.x, p1.y);
      g.setRotation(angle);
    }

    this.tweens.add({
      targets: this.roverPingRing, scale: 2.3, alpha: 0, duration: 1100, repeat: -1, ease: 'Sine.easeOut',
    });
  }

  // ───────────────────────────── Top Mission Header & Mode Toggles ─────────────────────────────

  private createMissionHeader() {
    const headerW = 1356;
    const headerH = 60;
    const cx = this.mapOriginX + headerW / 2;
    const cy = 88;

    const header = this.add.container(cx, cy).setDepth(DEPTH.hud);
    const chassis = this.createLayeredPanel(headerW, headerH, COLOR.cyan);

    const title = this.add.text(-headerW / 2 + 22, -11, 'NASA MARS TREK // GLOBAL MOLA TRAVERSE NAVIGATION', {
      fontFamily: FONT_HEAD, fontSize: '15px', color: hex(COLOR.cyan), letterSpacing: 1.5,
    }).setOrigin(0, 0.5);

    this.headerStatusText = this.add.text(
      -headerW / 2 + 22,
      11,
      `ROUTE: ${this.currentOriginSite.name.toUpperCase()}  ➔  ${this.currentTargetSite.name.toUpperCase()}  (${this.totalDistanceKm} KM GREAT-CIRCLE)`,
      {
        fontFamily: FONT_MONO, fontSize: '11px', color: '#cbd5e1',
      }
    ).setOrigin(0, 0.5);

    // Layer Mode Toggle Buttons on the right side of the header
    const modes: Array<{ id: MapOverlayMode; label: string }> = [
      { id: 'MOLA_TOPO', label: 'MOLA TOPO' },
      { id: 'SHARAD_ICE', label: 'SHARAD ICE' },
      { id: 'DONKI_RAD', label: 'DONKI FLUX' },
    ];

    const modeButtons: Array<{ id: MapOverlayMode; bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text }> = [];

    modes.forEach((m, idx) => {
      const bx = headerW / 2 - 330 + idx * 112;
      const bg = this.add.rectangle(bx, -2, 104, 28, m.id === this.activeOverlayMode ? COLOR.cyanDeep : COLOR.panelInner)
        .setStrokeStyle(1, COLOR.cyan, 0.8)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx, -2, m.label, {
        fontFamily: FONT_MONO, fontSize: '10px', color: '#ffffff',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        soundFx.playClick(1050);
        this.activeOverlayMode = m.id;
        modeButtons.forEach(b => b.bg.setFillStyle(b.id === this.activeOverlayMode ? COLOR.cyanDeep : COLOR.panelInner));
        this.renderMapOverlayMode();
        this.toast(`MARS TREK LAYER OVERLAY: ${m.label} ACTIVE`, COLOR.cyan);
      });

      modeButtons.push({ id: m.id, bg, txt });
      header.add([bg, txt]);
    });

    const track = this.add.rectangle(-headerW / 2 + 12, 26, headerW - 24, 3, 0x1e293b).setOrigin(0, 0.5);
    this.headerProgressFill = this.add.rectangle(-headerW / 2 + 12, 26, headerW - 24, 3, COLOR.cyan).setOrigin(0, 0.5);
    this.headerProgressFill.scaleX = 0.001;

    header.add([chassis, title, this.headerStatusText, track, this.headerProgressFill]);
  }

  // ───────────────────────────── Bottom MOLA Elevation Profile & OSDR Brief Panel ─────────────────────────────

  private createBottomElevationAndOsdrPanel() {
    const pw = 1356;
    const ph = 196;
    const cx = this.mapOriginX + pw / 2;
    const cy = 902;

    const root = this.add.container(cx, cy).setDepth(DEPTH.hud);
    const chassis = this.createLayeredPanel(pw, ph, COLOR.cyan);
    root.add(chassis);

    // Left Section: MOLA Topographic Cross-Section Graph
    const graphBox = this.add.rectangle(-250, 6, 820, 148, COLOR.panelInner).setStrokeStyle(1, 0x1e293b);
    const graphTitle = this.add.text(-648, -80, 'MARS TREK MOLA // TOPOGRAPHIC ELEVATION PROFILE & SLOPE HAZARD', {
      fontFamily: FONT_HEAD, fontSize: '11px', color: hex(COLOR.cyan), letterSpacing: 1,
    }).setOrigin(0, 0.5);
    root.add([graphBox, graphTitle]);

    // Draw elevation profile polygon in world space
    const g = this.add.graphics().setDepth(DEPTH.hud + 1);
    const gx = this.graphX;
    const gy = this.graphY;
    const gw = this.graphW;
    const gh = this.graphH;

    // Horizontal reference elevation grid lines (-1500m, -3000m, -4500m)
    g.lineStyle(1, 0x1e293b, 0.9);
    [-1500, -3000, -4500].forEach((elev, idx) => {
      const ly = gy + 14 + idx * 46;
      g.lineBetween(gx, ly, gx + gw, ly);
      this.add.text(gx + 4, ly - 11, `${elev}m`, {
        fontFamily: FONT_MONO, fontSize: '9px', color: '#64748b',
      }).setDepth(DEPTH.hud + 2);
    });

    // Plot Waypoint Elevations
    const minElev = -5200;
    const maxElev = -1200;
    const polyPts: Phaser.Math.Vector2[] = [];

    this.waypoints.forEach((wp, i) => {
      const px = gx + (i / (this.waypoints.length - 1)) * gw;
      const norm = Phaser.Math.Clamp((wp.elevationMeters - minElev) / (maxElev - minElev), 0.05, 0.95);
      const py = gy + gh - norm * gh;
      polyPts.push(point(px, py));
    });

    // Fill under elevation curve
    const fillPts = [...polyPts, point(gx + gw, gy + gh), point(gx, gy + gh)];
    g.fillStyle(COLOR.cyanDeep, 0.28).fillPoints(fillPts, true);
    g.lineStyle(2.5, COLOR.cyan, 0.95).strokePoints(polyPts, false);

    // Waypoint nodes along the curve
    polyPts.forEach((pt, i) => {
      const slope = this.waypoints[i].slopeDeg;
      const dotCol = slope > 10 ? COLOR.amber : COLOR.cyan;
      g.fillStyle(dotCol, 1).fillCircle(pt.x, pt.y, i === 0 || i === polyPts.length - 1 ? 4.5 : 2.5);
    });

    this.elevationPlayheadGfx = this.add.graphics().setDepth(DEPTH.hud + 3);
    this.updateElevationPlayhead(0);

    // Right Section of Bottom Panel: Interactive Site/Depot Inspector + NASA OSDR Transit Brief
    const inspectBox = this.add.rectangle(412, 6, 480, 148, COLOR.panelInner).setStrokeStyle(1, COLOR.green, 0.45);
    const inspectHeader = this.add.text(184, -80, 'SECTOR & NASA OSDR BIOMEDICAL TELEMETRY', {
      fontFamily: FONT_HEAD, fontSize: '11px', color: hex(COLOR.green), letterSpacing: 1,
    }).setOrigin(0, 0.5);

    this.inspectTitleText = this.add.text(186, -48, '', {
      fontFamily: FONT_HEAD, fontSize: '13px', color: '#ffffff',
    }).setOrigin(0, 0.5);

    this.inspectBodyText = this.add.text(186, -24, '', {
      fontFamily: FONT_MONO, fontSize: '11px', color: '#cbd5e1',
      lineSpacing: 5, wordWrap: { width: 450 },
    }).setOrigin(0, 0);

    root.add([inspectBox, inspectHeader, this.inspectTitleText, this.inspectBodyText]);
    this.inspectSiteOrDepot(this.currentTargetSite);
  }

  private updateElevationPlayhead(waypointIdx: number) {
    if (!this.elevationPlayheadGfx || this.waypoints.length === 0) return;
    this.elevationPlayheadGfx.clear();

    const frac = waypointIdx / Math.max(1, this.waypoints.length - 1);
    const px = this.graphX + frac * this.graphW;

    this.elevationPlayheadGfx.lineStyle(2, COLOR.green, 0.95);
    this.elevationPlayheadGfx.lineBetween(px, this.graphY, px, this.graphY + this.graphH);
    this.elevationPlayheadGfx.fillStyle(COLOR.green, 1).fillTriangle(px - 5, this.graphY, px + 5, this.graphY, px, this.graphY + 7);
  }

  private inspectSiteOrDepot(coord: MarsCoord) {
    this.inspectedCoord = coord;
    if (!this.inspectTitleText || !this.inspectBodyText) return;

    const elev = coord.elevationMeters ?? -3200;
    const slope = coord.slopeDeg ?? 4.5;
    const ice = coord.subsurfaceIceDepthM ?? 10.0;

    this.inspectTitleText.setText(`${coord.name.toUpperCase()} (${coord.lat}°N, ${coord.lon}°E)`);
    this.inspectBodyText.setText(
      `MOLA ELEV: ${elev}m  |  SLOPE: ${slope}°  |  SHARAD ICE: ${ice}m\n` +
      `INFO: ${coord.description || 'NASA Autonomous Supply Beacon'}\n` +
      `🧬 OSDR [OSD-570 / OSD-379]: Long-duration LREV traverse requires\n` +
      `   scheduled depot stops to mitigate GCR dose & muscle atrophy.`
    );
  }

  // ───────────────────────────── Right Flight Plan & NASA Telemetry Tower ─────────────────────────────

  private createTelemetrySidePanel() {
    const pw = 456;
    const ph = 942;
    const panelX = 1652;
    const panelY = 529;

    const root = this.add.container(panelX, panelY).setDepth(DEPTH.hud);
    const chassis = this.createLayeredPanel(pw, ph, COLOR.cyan);
    root.add(chassis);

    const donki = resourceEngine.donkiWeather;

    // Header
    root.add(this.add.text(-pw / 2 + 22, -ph / 2 + 24, 'LREV TRAVERSE FLIGHT PLAN', {
      fontFamily: FONT_HEAD, fontSize: '15px', color: hex(COLOR.cyan), letterSpacing: 1.5,
    }).setOrigin(0, 0.5));

    const badge = this.add.text(pw / 2 - 22, -ph / 2 + 24, donki.isLive ? 'TELEMETRY LIVE' : 'ARCHIVE SYNC', {
      fontFamily: FONT_MONO, fontSize: '10px', color: hex(COLOR.ink),
      backgroundColor: hex(donki.isLive ? COLOR.green : COLOR.amber), padding: { x: 6, y: 2 },
    }).setOrigin(1, 0.5);
    root.add(badge);

    // 1. Live NASA Mars Trek WMTS Satellite Tile Preview Frame
    const tileWellY = -335;
    root.add(this.add.rectangle(0, tileWellY, pw - 40, 168, COLOR.panelInner).setStrokeStyle(1, COLOR.cyan, 0.45));
    root.add(this.add.text(-pw / 2 + 32, tileWellY - 68, 'NASA MARS TREK // WMTS ORBITAL SATELLITE IMAGERY', {
      fontFamily: FONT_MONO, fontSize: '10px', color: hex(COLOR.cyan),
    }).setOrigin(0, 0.5));

    this.tilePreviewContainer = this.add.container(-pw / 2 + 92, tileWellY + 8);
    // Procedural fallback radar preview inside the tile frame
    const fallbackTile = this.add.graphics();
    fallbackTile.fillStyle(0x7c2d12, 0.85).fillRect(-56, -52, 112, 104);
    fallbackTile.lineStyle(1, COLOR.cyan, 0.4).strokeRect(-56, -52, 112, 104);
    fallbackTile.lineBetween(-56, 0, 56, 0).lineBetween(0, -52, 0, 52);
    this.tilePreviewContainer.add(fallbackTile);

    this.tilePreviewStatus = this.add.text(
      -pw / 2 + 162,
      tileWellY - 36,
      `SECTOR: ${this.currentTargetSite.name}\n` +
      `COORDS: ${this.currentTargetSite.lat}°N, ${this.currentTargetSite.lon}°E\n` +
      `MOLA ELEV: ${this.currentTargetSite.elevationMeters}m\n` +
      `SHARAD ICE: ${this.currentTargetSite.subsurfaceIceDepthM}m\n` +
      `LAYER: Viking MDIM 2.1 WMTS`,
      {
        fontFamily: FONT_MONO, fontSize: '11px', color: '#cbd5e1', lineSpacing: 5,
      }
    );
    root.add([this.tilePreviewContainer, this.tilePreviewStatus]);

    // 2. Origin & Destination Route Cards
    const routeY = -170;
    root.add(this.add.rectangle(0, routeY, pw - 40, 126, COLOR.panelInner).setStrokeStyle(1, 0x1e293b));
    root.add(this.add.rectangle(-pw / 2 + 22, routeY - 30, 4, 48, COLOR.green));
    root.add(this.add.rectangle(-pw / 2 + 22, routeY + 30, 4, 48, COLOR.red));

    root.add(this.add.text(-pw / 2 + 36, routeY - 42, 'DEPARTURE ORIGIN', {
      fontFamily: FONT_MONO, fontSize: '10px', color: '#64748b',
    }).setOrigin(0, 0.5));
    root.add(this.add.text(-pw / 2 + 36, routeY - 22, `${this.currentOriginSite.name} (${this.currentOriginSite.elevationMeters}m)`, {
      fontFamily: FONT_HEAD, fontSize: '13px', color: hex(COLOR.green),
    }).setOrigin(0, 0.5));

    root.add(this.add.text(-pw / 2 + 36, routeY + 18, 'TARGET DESTINATION', {
      fontFamily: FONT_MONO, fontSize: '10px', color: '#64748b',
    }).setOrigin(0, 0.5));
    root.add(this.add.text(-pw / 2 + 36, routeY + 38, `${this.currentTargetSite.name} (${this.currentTargetSite.elevationMeters}m)`, {
      fontFamily: FONT_HEAD, fontSize: '13px', color: hex(COLOR.red),
    }).setOrigin(0, 0.5));

    // 3. Real-Time LREV Traverse Telemetry Well
    const telemY = 12;
    root.add(this.add.rectangle(0, telemY, pw - 40, 206, COLOR.panelInner).setStrokeStyle(1, 0x1e293b));
    root.add(this.add.text(-pw / 2 + 32, telemY - 82, 'LIVE LREV NAVIGATION & DONKI DOSIMETRY', {
      fontFamily: FONT_MONO, fontSize: '10px', color: hex(COLOR.cyan),
    }).setOrigin(0, 0.5));

    this.distanceText = this.add.text(-pw / 2 + 32, telemY - 50, `REMAINING GREAT-CIRCLE: ${this.totalDistanceKm} km`, {
      fontFamily: FONT_HEAD, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0, 0.5);

    this.liveCoordText = this.add.text(
      -pw / 2 + 32,
      telemY - 18,
      `LREV POS   : ${this.currentOriginSite.lat.toFixed(1)}°N, ${this.currentOriginSite.lon.toFixed(1)}°E (WP 0/${this.waypoints.length})`,
      { fontFamily: FONT_MONO, fontSize: '11px', color: hex(COLOR.cyan) }
    ).setOrigin(0, 0.5);

    this.liveElevSlopeText = this.add.text(
      -pw / 2 + 32,
      telemY + 10,
      `MOLA TERRAIN: ${this.currentOriginSite.elevationMeters}m Elev  |  Slope: ${this.currentOriginSite.slopeDeg}°  |  Drain: 1.00x`,
      { fontFamily: FONT_MONO, fontSize: '11px', color: '#cbd5e1' }
    ).setOrigin(0, 0.5);

    this.liveDonkiText = this.add.text(
      -pw / 2 + 32,
      telemY + 42,
      `DONKI SOLAR : Class ${donki.flareClass} (${donki.radiationMultiplier}x Flux)\n` +
      `CUMULATIVE RAD: ${gameState.hazards.radiationDoseMsv.toFixed(2)} mSv  |  DEPOTS: 4 Active`,
      { fontFamily: FONT_MONO, fontSize: '11px', color: hex(COLOR.amber), lineSpacing: 6 }
    ).setOrigin(0, 0);

    root.add([this.distanceText, this.liveCoordText, this.liveElevSlopeText, this.liveDonkiText]);

    // 4. Primary Traverse Execution Button
    const btnY = 195;
    const glow = this.add.rectangle(0, btnY, pw - 48, 62, COLOR.cyan, 0.18);
    const btnBg = this.add.rectangle(0, btnY, pw - 56, 52, COLOR.cyanDeep)
      .setStrokeStyle(2, COLOR.cyan)
      .setInteractive({ useHandCursor: true });
    const btnBrackets = this.add.graphics();
    btnBrackets.y = btnY;
    this.bracket(btnBrackets, pw - 46, 60, 10, COLOR.cyan);

    const btnTxt = this.add.text(0, btnY, 'COMMENCE LREV TRAVERSE ➔', {
      fontFamily: FONT_HEAD, fontSize: '14px', color: '#ffffff', letterSpacing: 1,
    }).setOrigin(0.5);

    this.tweens.add({ targets: glow, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 });

    btnBg.on('pointerover', () => {
      if (!this.isTraversing) btnBg.setFillStyle(0x0ea5e9);
    });
    btnBg.on('pointerout', () => {
      if (!this.isTraversing && !this.traverseCompleted) btnBg.setFillStyle(COLOR.cyanDeep);
    });
    btnBg.on('pointerdown', () => {
      this.commenceTraverse(btnBg, btnTxt, glow);
    });

    // Secondary Button: Return to Gale Outpost View
    const backBtn = this.add.rectangle(0, 270, pw - 56, 38, COLOR.panelInner)
      .setStrokeStyle(1, COLOR.slate)
      .setInteractive({ useHandCursor: true });
    const backTxt = this.add.text(0, 270, '← INSPECT GALE CRATER BASE', {
      fontFamily: FONT_MONO, fontSize: '11px', color: '#94a3b8',
    }).setOrigin(0.5);

    backBtn.on('pointerover', () => backBtn.setStrokeStyle(1, COLOR.cyan));
    backBtn.on('pointerout', () => backBtn.setStrokeStyle(1, COLOR.slate));
    backBtn.on('pointerdown', () => {
      if (this.isTraversing) return;
      soundFx.playClick(850);
      this.scene.start('GaleBaseScene');
    });

    root.add([glow, btnBg, btnBrackets, btnTxt, backBtn, backTxt]);
  }

  /**
   * Dynamically loads a real NASA Mars Trek WMTS satellite image tile into the preview box
   */
  private loadMarsTrekPreviewTile(coord: MarsCoord) {
    if (!this.tilePreviewStatus) return;

    this.tilePreviewStatus.setText(
      `SECTOR: ${coord.name}\n` +
      `COORDS: ${coord.lat}°N, ${coord.lon}°E\n` +
      `MOLA ELEV: ${coord.elevationMeters ?? -3200}m\n` +
      `SHARAD ICE: ${coord.subsurfaceIceDepthM ?? 10}m\n` +
      `WMTS TILE: SYNCING NASA TREK...`
    );

    const tileUrl = coord.wmtsColorTileUrl;
    if (!tileUrl) return;

    const texKey = `wmts_tile_${coord.lat}_${coord.lon}`;
    if (this.textures.exists(texKey)) {
      this.mountTileSprite(texKey, coord);
      return;
    }

    this.load.image(texKey, tileUrl);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.scene && this.textures.exists(texKey)) {
        this.mountTileSprite(texKey, coord);
      }
    });
    this.load.start();
  }

  private mountTileSprite(texKey: string, coord: MarsCoord) {
    if (!this.tilePreviewContainer || !this.tilePreviewContainer.scene) return;
    const img = this.add.image(0, 0, texKey).setDisplaySize(112, 104);
    const border = this.add.rectangle(0, 0, 112, 104).setStrokeStyle(1.5, COLOR.cyan);
    this.tilePreviewContainer.add([img, border]);

    this.tilePreviewStatus?.setText(
      `SECTOR: ${coord.name}\n` +
      `COORDS: ${coord.lat}°N, ${coord.lon}°E\n` +
      `MOLA ELEV: ${coord.elevationMeters ?? -3200}m\n` +
      `SHARAD ICE: ${coord.subsurfaceIceDepthM ?? 10}m\n` +
      `WMTS TILE: LIVE VIKING MDIM2.1`
    );
  }

  // ───────────────────────────── Traverse Simulation Loop ─────────────────────────────

  private commenceTraverse(
    btnBg: Phaser.GameObjects.Rectangle,
    btnTxt: Phaser.GameObjects.Text,
    glow: Phaser.GameObjects.Rectangle
  ) {
    if (this.isTraversing) return;
    this.isTraversing = true;
    soundFx.playTelemetryChirp();

    btnBg.setFillStyle(0x1e293b);
    btnTxt.setText('AUTONOMOUS LREV IN TRANSIT...');

    const donki = resourceEngine.donkiWeather;
    let idx = 0;

    this.time.addEvent({
      delay: 135,
      repeat: this.waypoints.length - 1,
      callback: () => {
        const wp = this.waypoints[idx];
        this.currentWaypointIdx = idx;

        const canvasCoords = projectMarsToCanvas(wp.lat, wp.lon, this.mapWidth, this.mapHeight);
        const targetX = this.mapOriginX + canvasCoords.x;
        const targetY = this.mapOriginY + canvasCoords.y;

        // Rotate LREV token toward travel direction
        if (idx < this.waypoints.length - 1) {
          const nextWp = this.waypoints[idx + 1];
          const nextCanvas = projectMarsToCanvas(nextWp.lat, nextWp.lon, this.mapWidth, this.mapHeight);
          const angle = Phaser.Math.Angle.Between(canvasCoords.x, canvasCoords.y, nextCanvas.x, nextCanvas.y);
          const roverGfx = this.roverToken.list[1] as Phaser.GameObjects.Graphics;
          if (roverGfx) roverGfx.setRotation(angle);
        }

        // Leave breadcrumb dot on map
        this.add.circle(this.roverToken.x, this.roverToken.y, 2.5, COLOR.green, 0.85).setDepth(DEPTH.mapRoute + 2);

        this.roverToken.setPosition(targetX, targetY);
        this.updateElevationPlayhead(idx);
        this.headerProgressFill.scaleX = Math.max(0.01, wp.fraction);

        // Apply slight real-time DONKI transit radiation & slope power drain
        const stepRad = 0.015 * donki.radiationMultiplier;
        gameState.hazards.radiationDoseMsv += stepRad;

        const remDistance = Math.round(this.totalDistanceKm * (1 - wp.fraction));
        this.distanceText.setText(`REMAINING GREAT-CIRCLE: ${remDistance} km`);
        this.liveCoordText.setText(
          `LREV POS   : ${wp.lat.toFixed(1)}°N, ${wp.lon.toFixed(1)}°E (WP ${idx + 1}/${this.waypoints.length})`
        );
        this.liveElevSlopeText.setText(
          `MOLA TERRAIN: ${wp.elevationMeters}m Elev  |  Slope: ${wp.slopeDeg}°  |  Drain: ${wp.energyDrainMultiplier}x`
        );
        this.liveDonkiText.setText(
          `DONKI SOLAR : Class ${donki.flareClass} (${donki.radiationMultiplier}x Flux)\n` +
          `CUMULATIVE RAD: ${gameState.hazards.radiationDoseMsv.toFixed(2)} mSv  |  DEPOTS: RESUPPLIED`
        );

        soundFx.playClick(580 + idx * 35);
        idx++;

        if (idx >= this.waypoints.length) {
          this.onTraverseComplete(btnBg, btnTxt, glow);
        }
      },
    });
  }

  private onTraverseComplete(
    btnBg: Phaser.GameObjects.Rectangle,
    btnTxt: Phaser.GameObjects.Text,
    glow: Phaser.GameObjects.Rectangle
  ) {
    this.isTraversing = false;
    this.traverseCompleted = true;
    soundFx.playTelemetryChirp();

    this.headerStatusText
      .setText(`ARRIVED AT ${this.currentTargetSite.name.toUpperCase()} // ALL WAYPOINTS VERIFIED`)
      .setColor(hex(COLOR.green));
    this.headerProgressFill.setFillStyle(COLOR.green);

    glow.setFillStyle(COLOR.green, 0.25);
    btnBg.setFillStyle(COLOR.greenDeep).setStrokeStyle(2, COLOR.green);
    btnTxt.setText('ARRIVED: DEPLOY INTO SECTOR ➔');

    this.toast(`LREV ARRIVED AT ${this.currentTargetSite.name.toUpperCase()}`, COLOR.green);

    btnBg.off('pointerdown');
    btnBg.on('pointerdown', () => {
      audioManager.playSfx(this, 'sfx_ui_confirm', { volume: 0.85 });
      this.cameras.main.fadeOut(400, 4, 8, 17);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (gameState.currentChapter === 'act_2_arcadia') {
          this.scene.start('ArcadiaFieldScene');
        } else if (gameState.currentChapter === 'act_3_gale_return') {
          this.scene.start('GaleBaseScene');
        } else {
          this.scene.start('JezeroFieldScene');
        }
      });
    });
  }

  private toast(message: string, color = COLOR.green) {
    this.toastText?.destroy();
    const t = this.add.text(this.mapOriginX + this.mapWidth / 2, 168, message, {
      fontFamily: FONT_MONO, fontSize: '13px', color: hex(color),
      backgroundColor: hex(COLOR.ink), padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setDepth(DEPTH.toast).setAlpha(0);
    this.toastText = t;

    this.tweens.add({
      targets: t, alpha: 1, y: 158, duration: 200, hold: 1600, yoyo: true,
      onComplete: () => {
        t.destroy();
        if (this.toastText === t) this.toastText = undefined;
      },
    });
  }
}