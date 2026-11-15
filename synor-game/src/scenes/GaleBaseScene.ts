/**
 * Gale Crater Base Scene (Act I Prologue & Act III Return)
 * - Unstuck Modal Architecture (works with Mouse Click, ENTER, SPACE, and ESC)
 * - Full WASD / Arrow Key movement + Click-to-Walk + [E / SPACE] Interact + [M] Orbital Map
 * - 16-Bit Stepped Martian Parallax + Isometric Outpost Modules & Ares Rocket Lander
 * - Live NASA DONKI Space Weather, Mars Trek MOLA/SHARAD, and NASA OSDR Bio-Archive
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { resourceEngine } from '../state/ResourceEngine';
import { MARS_SITES } from '../utils/MarsGeo';
import { attachBlenderSceneSlot } from '../utils/BlenderSceneBridge';
import { soundFx } from '../utils/ProceduralAudio';
import { uiSfx } from '../utils/UISoundFX';
import { attachUIInteraction } from '../utils/UIInteraction';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Theme
// ─────────────────────────────────────────────────────────────────────────────

const W = 1920;
const H = 1080;
const HORIZON_Y = 340;
const PX = 4;
const WALK = { minX: 110, maxX: 1810, minY: 390, maxY: 920 };
const WALK_SPEED = 260;
const INTERACT_RADIUS = 155;

const FONT_HEAD = 'Orbitron, sans-serif';
const FONT_MONO = 'Share Tech Mono, monospace';
const FONT_BODY = 'Rajdhani, sans-serif';

const COLOR = {
  panel: 0x060d1a,
  panelInner: 0x0a1628,
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
  sky: 10,
  stars: 11,
  sun: 12,
  craterRimFar: 13,
  mountSharp: 14,
  mesaMid: 15,
  ridgeNear: 16,
  haze: 17,
  ground: 18,
  craters: 19,
  conduits: 21,
  dust: 1100,
  markers: 1200,
  hud: 2000,
  dialogShade: 5000,
  dialogPanel: 5010,
  dialogButtons: 5020,
  toast: 6000,
};

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const snap = (v: number, step = PX) => Math.round(v / step) * step;

type Pt = { x: number; y: number };
type Gfx = Phaser.GameObjects.Graphics;

interface ParallaxLayer {
  target: Phaser.GameObjects.GameObject & { x: number; y: number };
  baseX: number;
  baseY: number;
  factorX: number;
  factorY: number;
}

interface OutpostModule {
  id: string;
  category: string;
  name: string;
  x: number;
  y: number;
  markerDy: number;
  desc: string;
  effect: string;
  osdrId: string;
  osdrKeyword: string;
  osdrNote: string;
  draw: (g: Gfx) => void;
  onCommission: () => void;
}

interface ModuleView {
  marker: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  pulseRing: Phaser.GameObjects.Arc;
  iconTxt: Phaser.GameObjects.Text;
  labelTxt: Phaser.GameObjects.Text;
  promptRing: Phaser.GameObjects.Arc;
}

function getGaleTelemetry() {
  const rawSite = (MARS_SITES.GALE_CRATER || {}) as Record<string, any>;
  const rawDonki = ((resourceEngine as Record<string, any>).donkiWeather || {}) as Record<string, any>;

  return {
    lat: typeof rawSite.lat === 'number' ? rawSite.lat : -5.4,
    lon: typeof rawSite.lon === 'number' ? rawSite.lon : 137.8,
    elevationMeters: typeof rawSite.elevationMeters === 'number' ? rawSite.elevationMeters : -4500,
    slopeDeg: typeof rawSite.slopeDeg === 'number' ? rawSite.slopeDeg : 6.2,
    subsurfaceIceDepthM: typeof rawSite.subsurfaceIceDepthM === 'number' ? rawSite.subsurfaceIceDepthM : 18.5,
    solarIrradianceFactor: typeof rawSite.solarIrradianceFactor === 'number' ? rawSite.solarIrradianceFactor : 0.98,
    flareClass: typeof rawDonki.flareClass === 'string' ? rawDonki.flareClass : 'M3.8',
    radiationMultiplier: typeof rawDonki.radiationMultiplier === 'number' ? rawDonki.radiationMultiplier : 1.85,
    isLive: Boolean(rawDonki.isLive),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-Safe Polygon Helpers (Avoids Phaser.Geom.Point TS errors)
// ─────────────────────────────────────────────────────────────────────────────

function fillPoly(g: Gfx, pts: Pt[], close = true): Gfx {
  if (pts.length === 0) return g;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i].x, pts[i].y);
  }
  if (close) g.closePath();
  g.fillPath();
  return g;
}

function strokePoly(g: Gfx, pts: Pt[], close = true): Gfx {
  if (pts.length === 0) return g;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i].x, pts[i].y);
  }
  if (close) g.closePath();
  g.strokePath();
  return g;
}

function arcPoints(
  cx: number, cy: number, rx: number, ry: number,
  a0: number, a1: number, rot = 0, steps = 28
): Pt[] {
  const pts: Pt[] = [];
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    pts.push({
      x: snap(cx + px * cos - py * sin, 2),
      y: snap(cy + px * sin + py * cos, 2),
    });
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Isometric 16-Bit Outpost Structure Renderers
// ─────────────────────────────────────────────────────────────────────────────

/** 1. CENTRAL HABITAT STATION (Top-Left Isometric Pressurized Module) */
function drawCentralHabitat(g: Gfx) {
  g.fillStyle(0x000000, 0.4).fillEllipse(0, 8, 280, 90);

  // Isometric foundation plinth
  const base: Pt[] = [
    { x: -120, y: 0 }, { x: 0, y: 46 }, { x: 120, y: 0 }, { x: 0, y: -46 }
  ];
  g.fillStyle(0x334155);
  fillPoly(g, base, true);
  g.lineStyle(2, 0x0f172a);
  strokePoly(g, base, true);

  // Main isometric habitat hull
  g.fillStyle(0xcbd5e1).fillRoundedRect(-104, -78, 208, 78, 14);
  g.fillStyle(0x94a3b8).fillRoundedRect(-104, -38, 208, 38, 8);
  g.lineStyle(2.5, 0x0f172a).strokeRoundedRect(-104, -78, 208, 78, 14);

  // Roof solar panel skylight & thermal unit
  const roof: Pt[] = [
    { x: -64, y: -74 }, { x: 0, y: -96 }, { x: 64, y: -74 }, { x: 0, y: -52 }
  ];
  g.fillStyle(0x1e3a8a);
  fillPoly(g, roof, true);
  g.lineStyle(2, COLOR.cyan);
  strokePoly(g, roof, true);

  // Illuminated side viewports
  for (const vx of [-72, -42, 42, 72]) {
    g.fillStyle(0x0f172a).fillRect(vx - 10, -52, 20, 14);
    g.fillStyle(0xfbbf24, 0.9).fillRect(vx - 8, -50, 16, 10);
  }

  // Pressurized airlock door & isometric entry stairs
  g.fillStyle(0x1e293b).fillRect(-22, -56, 44, 52);
  g.lineStyle(2, COLOR.cyan).strokeRect(-22, -56, 44, 52);
  g.fillStyle(COLOR.cyan, 0.7).fillRect(-10, -44, 20, 14);

  const stairs: Pt[] = [
    { x: -24, y: -4 }, { x: 24, y: -4 }, { x: 38, y: 34 }, { x: -38, y: 34 }
  ];
  g.fillStyle(0x475569);
  fillPoly(g, stairs, true);
  g.lineStyle(2, 0x94a3b8);
  strokePoly(g, stairs, true);
  for (let sy = 2; sy <= 28; sy += 7) {
    g.lineBetween(-26, sy, 26, sy);
  }
}

/** 2. LREV ROVER GARAGE & KILOPOWER BAY (Top-Center Hangar) */
function drawRoverGarage(g: Gfx) {
  g.fillStyle(0x000000, 0.4).fillEllipse(0, 6, 260, 82);

  // Hangar arch & blast bay
  g.fillStyle(0x475569).fillRoundedRect(-96, -74, 192, 74, 10);
  g.lineStyle(2.5, 0x0f172a).strokeRoundedRect(-96, -74, 192, 74, 10);

  // Open garage bay interior & ramp
  g.fillStyle(0x0f172a).fillRect(-48, -54, 96, 54);
  g.lineStyle(2, COLOR.amber).strokeRect(-48, -54, 96, 54);

  const ramp: Pt[] = [
    { x: -48, y: 0 }, { x: 48, y: 0 }, { x: 68, y: 36 }, { x: -68, y: 36 }
  ];
  g.fillStyle(0x334155);
  fillPoly(g, ramp, true);
  g.lineStyle(2, 0x64748b);
  strokePoly(g, ramp, true);

  // Kilopower Stirling Fission Mast & Solar Wing on right
  g.fillStyle(0x334155).fillRect(112, -98, 14, 98);
  g.fillStyle(COLOR.amber, 0.9).fillCircle(119, -104, 10);
  g.fillStyle(0x1e3a8a).fillRect(-76, -90, 152, 14);
  g.lineStyle(1.5, COLOR.cyan).strokeRect(-76, -90, 152, 14);
}

/** 3. ARES DESCENT ROCKET LANDER (Center-Right Tall Vertical Methalox Lander) */
function drawAresLander(g: Gfx) {
  // Scorched landing pad & blast crater shadow
  g.fillStyle(0x2a0f04, 0.75).fillEllipse(0, 12, 220, 74);
  g.lineStyle(2, 0x7c2d12, 0.8).strokeEllipse(0, 12, 200, 64);

  // 4 Deployable carbon-composite landing legs
  g.lineStyle(5, 0x334155)
    .lineBetween(-36, -42, -74, 14)
    .lineBetween(36, -42, 74, 14)
    .lineBetween(-18, -32, -42, 24)
    .lineBetween(18, -32, 42, 24);
  for (const [fx, fy] of [[-74, 14], [74, 14], [-42, 24], [42, 24]]) {
    g.fillStyle(0x475569).fillEllipse(fx, fy, 24, 10);
  }

  // Lower Propulsion Skirt & Methalox Thruster Bells
  g.fillStyle(0x1e293b).fillRect(-40, -56, 80, 36);
  g.lineStyle(2, 0x0f172a).strokeRect(-40, -56, 80, 36);

  // Main Cylindrical fuselage
  g.fillStyle(0xe2e8f0).fillRect(-40, -156, 80, 102);
  g.fillStyle(0xcbd5e1).fillRect(10, -156, 30, 102);
  g.lineStyle(2.5, 0x0f172a).strokeRect(-40, -156, 80, 102);

  // Orange thermal tile band & NASA/ARES markings
  g.fillStyle(0xc2410c).fillRect(-40, -156, 80, 14);
  g.fillStyle(0x0f172a).fillRect(-26, -124, 18, 28);
  g.fillStyle(COLOR.cyan, 0.85).fillRect(10, -120, 16, 12);

  // Conical Nose Fairing & Red Tip Cap
  const cone: Pt[] = [
    { x: -40, y: -156 }, { x: 0, y: -228 }, { x: 40, y: -156 }
  ];
  g.fillStyle(0xf8fafc);
  fillPoly(g, cone, true);
  g.lineStyle(2.5, 0x0f172a);
  strokePoly(g, cone, true);

  const noseTip: Pt[] = [
    { x: -15, y: -200 }, { x: 0, y: -228 }, { x: 15, y: -200 }
  ];
  g.fillStyle(0xc2410c);
  fillPoly(g, noseTip, true);

  // Side External O2 / Methalox Fuel Cylinders
  for (const tx of [-72, 62]) {
    g.fillStyle(0x0284c7).fillRoundedRect(tx, -64, 24, 58, 6);
    g.lineStyle(2, 0x0f172a).strokeRoundedRect(tx, -64, 24, 58, 6);
    g.fillStyle(0xe2e8f0).fillRect(tx + 2, -42, 20, 10);
  }
}

/** 4. SUBSURFACE SCIENCE MODULE & DRILL RIG (Bottom-Left Lab + Parabolic Dish) */
function drawScienceDrillRig(g: Gfx) {
  g.fillStyle(0x000000, 0.42).fillEllipse(0, 10, 290, 94);

  // Main Lab Hull
  g.fillStyle(0xcbd5e1).fillRoundedRect(-110, -82, 220, 82, 12);
  g.fillStyle(0x94a3b8).fillRoundedRect(-110, -38, 220, 38, 8);
  g.lineStyle(2.5, 0x0f172a).strokeRoundedRect(-110, -82, 220, 82, 12);

  // Side SHARAD Drill Tower & Cryo-Tank (left)
  g.fillStyle(0x0284c7).fillRoundedRect(-142, -62, 32, 54, 6);
  g.lineStyle(2, COLOR.cyan).strokeRoundedRect(-142, -62, 32, 54, 6);

  // Roof Parabolic Telemetry Dish & Mast
  g.lineStyle(5, 0x475569).lineBetween(-24, -82, -24, -128);
  const dish = arcPoints(-24, -138, 44, 22, 0, Math.PI, -0.45);
  g.fillStyle(0xe2e8f0);
  fillPoly(g, dish, true);
  g.lineStyle(2, 0x0f172a);
  strokePoly(g, dish, true);
  g.lineStyle(2, COLOR.cyan).lineBetween(-24, -138, -2, -162);
  g.fillStyle(COLOR.amber).fillCircle(-2, -162, 4);

  // Right Roof Ventilation & Drill Derrick
  g.fillStyle(0x475569).fillRect(32, -110, 38, 28);
  g.lineStyle(2, 0x0f172a).strokeRect(32, -110, 38, 28);

  // Lab Entry Door & Stairs
  g.fillStyle(0x0f172a).fillRect(-36, -54, 42, 50);
  g.lineStyle(2, COLOR.cyan).strokeRect(-36, -54, 42, 50);
  const stairs: Pt[] = [
    { x: -38, y: -4 }, { x: 8, y: -4 }, { x: -4, y: 36 }, { x: -52, y: 36 }
  ];
  g.fillStyle(0x475569);
  fillPoly(g, stairs, true);
  g.lineStyle(2, 0x94a3b8);
  strokePoly(g, stairs, true);
}

/** 5. REGOLITH STORM BUNKER & RADIATION VAULT (Bottom-Right Shielded Dome) */
function drawRegolithBunker(g: Gfx) {
  g.fillStyle(0x000000, 0.42).fillEllipse(0, 8, 270, 84);

  // Sintered Martian regolith berm
  const mound = arcPoints(0, 4, 124, 82, Math.PI, Math.PI * 2);
  g.fillStyle(0x5b2a0f);
  fillPoly(g, mound, true);
  const inner = arcPoints(0, 4, 108, 66, Math.PI, Math.PI * 2);
  g.fillStyle(0x7c3a16, 0.9);
  fillPoly(g, inner, true);
  g.lineStyle(2.5, 0x2a0f04);
  strokePoly(g, mound, true);

  // Armored blast portal & hazard chevrons
  g.fillStyle(0x1e293b).fillRect(-34, -54, 68, 56);
  g.lineStyle(2, COLOR.amber).strokeRect(-34, -54, 68, 56);
  for (let i = 0; i < 8; i++) {
    g.fillStyle(i % 2 ? COLOR.amber : 0x0f172a).fillRect(-32 + i * 8, -62, 8, 8);
  }
  g.fillStyle(COLOR.cyan, 0.85).fillRect(-14, -36, 28, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene Class
// ─────────────────────────────────────────────────────────────────────────────

export class GaleBaseScene extends Phaser.Scene {
  private modules: OutpostModule[] = [];
  private moduleViews = new Map<string, ModuleView>();
  private parallaxLayers: ParallaxLayer[] = [];

  private astronaut!: Phaser.GameObjects.Container;
  private astroSprite?: Phaser.GameObjects.Sprite;
  private pulseGfx?: Gfx;

  // Input keys
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    M: Phaser.Input.Keyboard.Key;
  };

  // Modal & UI state
  private modalElements: Phaser.GameObjects.GameObject[] = [];
  private isModalOpen = false;
  private modalCooldownUntil = 0;
  private windowKeyHandler?: (e: KeyboardEvent) => void;

  private statusBanner!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private donkiHudText?: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Text;
  private traverseBtn?: Phaser.GameObjects.Container;
  private nearestModule?: OutpostModule;

  private camOffsetX = 0;
  private camOffsetY = 0;
  private leaving = false;

  constructor() {
    super({ key: 'GaleBaseScene' });
  }

  init() {
    this.moduleViews.clear();
    this.parallaxLayers = [];
    this.modalElements = [];
    this.isModalOpen = false;
    this.modalCooldownUntil = 0;
    this.toastText = undefined;
    this.traverseBtn = undefined;
    this.astroSprite = undefined;
    this.pulseGfx = undefined;
    this.donkiHudText = undefined;
    this.nearestModule = undefined;
    this.camOffsetX = 0;
    this.camOffsetY = 0;
    this.leaving = false;
    this.removeWindowKeyListener();
  }

  create() {
    gameState.currentLocation = 'gale';
    gameState.save();
    // Keep main camera pinned at (0,0) so screen-space UI hitboxes never drift
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.fadeIn(400, 5, 10, 20);

    // Prevent 0% power soft-lock on Act I boot
    if (gameState.resources.power <= 0) {
      gameState.resources.power = 65;
    }

    this.modules = this.buildModuleDefs();

    // Attach optional Blender backdrop, then always layer our 16-bit parallax + outpost modules
    attachBlenderSceneSlot(this, 'GALE_BASE', () => {});
    this.createProceduralOutpostWorld();

    this.modules.forEach(m => this.createModuleMarker(m));
    this.createAstronautCharacter();
    this.createTopMissionHeader();
    this.createNasaTelemetryHud();
    this.createBottomControlBar();
    this.setupKeyboardControls();

    // Click terrain to walk astronaut
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (this.isModalOpen || over.length > 0) return;
        if (pointer.y < WALK.minY - 40 || pointer.y > WALK.maxY + 20) return;
        this.pingAt(pointer.x, pointer.y);
        this.walkAstronautTo(pointer.x, pointer.y);
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeWindowKeyListener();
    });

    if (gameState.currentChapter === 'act_3_gale_return') {
      this.createAct3Upgrades();
    }
  }

  // ───────────────────────────── Update Loop (WASD + Parallax + Proximity) ─────────────────────────────

  update(time: number, delta: number) {
    // 1. Handle WASD / Arrow Key Astronaut Walking when modal is closed
    if (!this.isModalOpen && this.astronaut && this.wasd && this.cursors) {
      let vx = 0;
      let vy = 0;
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

      if (vx !== 0 || vy !== 0) {
        // Cancel any active click-to-walk tween when player uses keyboard
        this.tweens.killTweensOf(this.astronaut);
        const len = Math.hypot(vx, vy);
        const step = (WALK_SPEED * delta) / 1000;
        this.astronaut.x = Phaser.Math.Clamp(this.astronaut.x + (vx / len) * step, WALK.minX, WALK.maxX);
        this.astronaut.y = Phaser.Math.Clamp(this.astronaut.y + (vy / len) * step, WALK.minY, WALK.maxY);
        this.astronaut.setDepth(this.astronaut.y);
        if (vx !== 0) this.astronaut.scaleX = vx < 0 ? -1 : 1;
        this.setAstronautAnim('walk');
      } else if (!this.tweens.isTweening(this.astronaut)) {
        this.setAstronautAnim('idle');
      }

      // Check [E] or [SPACE] to interact with nearest module
      if (
        time > this.modalCooldownUntil &&
        (Phaser.Input.Keyboard.JustDown(this.wasd.E) || Phaser.Input.Keyboard.JustDown(this.wasd.SPACE))
      ) {
        if (this.nearestModule) {
          soundFx.playClick(1100);
          this.openModuleModal(this.nearestModule);
        } else {
          this.toast('MOVE CLOSER TO AN OUTPOST MODULE TO INTERACT', COLOR.amber);
        }
      }

      // Check [M] for Mars Travel Map
      if (Phaser.Input.Keyboard.JustDown(this.wasd.M)) {
        this.openOrbitalMap();
      }
    }

    // 2. Highlight nearest module within interaction radius
    this.updateNearestModuleHighlight();

    // 3. 16-Bit Pixel-Snapped Parallax Update
    const ptr = this.input.activePointer;
    const ptrNormX = ((ptr.x || W / 2) - W / 2) / (W / 2);
    const ptrNormY = ((ptr.y || H / 2) - H / 2) / (H / 2);
    const astroNormX = this.astronaut ? (this.astronaut.x - W / 2) / (W / 2) : 0;

    const targetX = (astroNormX * 0.65 + ptrNormX * 0.35) * 60;
    const targetY = ptrNormY * 14;

    this.camOffsetX = Phaser.Math.Linear(this.camOffsetX, targetX, 0.08);
    this.camOffsetY = Phaser.Math.Linear(this.camOffsetY, targetY, 0.08);

    for (const layer of this.parallaxLayers) {
      layer.target.x = snap(layer.baseX - this.camOffsetX * layer.factorX, 2);
      layer.target.y = snap(layer.baseY - this.camOffsetY * layer.factorY, 2);
    }

    // 4. Conduit Energy Pulses
    if (this.pulseGfx && this.modules.length > 1) {
      this.pulseGfx.clear();
      const hub = this.modules[0];
      const phase = (time * 0.00045) % 1;

      for (let i = 1; i < this.modules.length; i++) {
        const m = this.modules[i];
        const done = this.isDone(m.id);
        const t = (phase + i * 0.19) % 1;
        const px = snap(Phaser.Math.Linear(m.x, hub.x, t), 2);
        const py = snap(Phaser.Math.Linear(m.y, hub.y, t), 2);
        const col = done ? COLOR.green : COLOR.cyan;
        this.pulseGfx.fillStyle(col, 0.9).fillRect(px - 3, py - 3, 6, 6);
        this.pulseGfx.fillStyle(col, 0.25).fillRect(px - 7, py - 7, 14, 14);
      }
    }
  }

  private setupKeyboardControls() {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      M: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M),
    };
  }

  // ───────────────────────────── 5 Outpost Modules (Matching Screenshot) ─────────────────────────────

  private buildModuleDefs(): OutpostModule[] {
    const gale = getGaleTelemetry();
    return [
      {
        id: 'hab_station',
        category: 'CREW QUARTERS & ECLSS',
        name: 'Central Habitat Station',
        x: 340,
        y: 440,
        markerDy: 120,
        desc: `Pressurized normoxic crew habitat at Gale Crater (${gale.elevationMeters}m MOLA). Run 101.3 kPa bulkhead seal verification and Sabatier CO2 scrubbers.`,
        effect: '+10% AIR  //  CO2 SCRUBBED TO 450 PPM',
        osdrId: 'OSD-168',
        osdrKeyword: 'hypoxia',
        osdrNote: 'Maintains normoxic 101.3 kPa cabin pressure to prevent hypoxic cognitive latency.',
        draw: drawCentralHabitat,
        onCommission: () => {
          gameState.resources.airReserve = Math.min(100, gameState.resources.airReserve + 10);
          gameState.hazards.co2Ppm = 450;
          gameState.addLog('CENTRAL HABITAT: 101.3 kPa normoxic seal verified. ECLSS CO2 scrubbed to 450 ppm.', 'system');
        },
      },
      {
        id: 'rover_garage',
        category: 'GARAGE & KILOPOWER BUS',
        name: 'LREV Garage & Kilopower Array',
        x: 820,
        y: 390,
        markerDy: 120,
        desc: `Couple 10 kWe Kilopower Stirling fission core and photovoltaic arrays (${Math.round(gale.solarIrradianceFactor * 100)}% Mars Trek irradiance) to main habitat power bus.`,
        effect: '+30% POWER  //  +15% THERMAL STABILITY',
        osdrId: 'OSD-242',
        osdrKeyword: 'thermoregulation',
        osdrNote: 'Prevents habitat thermal drops that elevate crew metabolic caloric burn by 22%.',
        draw: drawRoverGarage,
        onCommission: () => {
          gameState.resources.power = Math.min(100, Math.max(55, gameState.resources.power + 30));
          gameState.resources.thermalStability = Math.min(100, gameState.resources.thermalStability + 15);
          gameState.addLog('KILOPOWER BUS: Fission core & solar trackers online. Habitat power bus nominal.', 'system');
        },
      },
      {
        id: 'ares_lander',
        category: 'LANDING PLATFORM',
        name: 'Ares Descent Rocket Lander',
        x: 1220,
        y: 520,
        markerDy: 250,
        desc: 'The single-stage Ares lander and primary cargo platform that brought you through atmospheric entry to Gale Crater. Inspect methalox descent fuel cells and telemetry avionics.',
        effect: '+25% POWER  //  AVIONICS & FUEL CELLS LINKED',
        osdrId: 'OSD-48',
        osdrKeyword: 'circadian',
        osdrNote: 'Stabilizes post-landing vestibular & circadian telemetry synchronization for surface EVA.',
        draw: drawAresLander,
        onCommission: () => {
          gameState.resources.power = Math.min(100, Math.max(50, gameState.resources.power + 25));
          gameState.dsnLocked = true;
          gameState.addLog('ARES LANDER: Methalox fuel-cell umbilical & DSN avionics coupled to outpost grid.', 'capcom');
        },
      },
      {
        id: 'science_drill',
        category: 'SHARAD ICE & ASTROBIOLOGY',
        name: 'Subsurface Science Module & Drill Rig',
        x: 340,
        y: 820,
        markerDy: 175,
        desc: `Initialize SHARAD subsurface ice auger (${gale.subsurfaceIceDepthM}m depth) and closed-loop graywater distillation to fill perimeter water-wall radiation shields.`,
        effect: '+15% WATER RESERVE  //  HYDRO-SHIELD PRIMED',
        osdrId: 'OSD-115',
        osdrKeyword: 'metabolism',
        osdrNote: 'Sustains closed-loop crew hydration and hydrogen-dense perimeter radiation shielding.',
        draw: drawScienceDrillRig,
        onCommission: () => {
          gameState.resources.waterReserve = Math.min(100, gameState.resources.waterReserve + 15);
          gameState.addLog('SCIENCE & DRILL RIG: SHARAD subsurface ice extractor online. 93% water recovery.', 'science');
        },
      },
      {
        id: 'storm_bunker',
        category: 'RADIATION VAULT & SHIELDING',
        name: 'Regolith Storm Bunker',
        x: 1540,
        y: 780,
        markerDy: 115,
        desc: `Deploy autonomous dozers across ${gale.slopeDeg}° MOLA slope to heap 1.5m sintered regolith over the storm vault against NASA DONKI solar particle events.`,
        effect: 'SHELTER PROTECTION 95%  //  GCR ATTENUATED',
        osdrId: 'OSD-379',
        osdrKeyword: 'radiation',
        osdrNote: 'Attenuates DONKI solar particle events & GCRs to prevent DNA double-strand breaks.',
        draw: drawRegolithBunker,
        onCommission: () => {
          gameState.resources.shelterProtection = 95;
          gameState.addLog('STORM BUNKER: 1.5m Martian regolith shielding completed. GCR & SPE dose attenuated.', 'system');
        },
      },
    ];
  }

  private isDone(id: string) {
    return gameState.galeCommissionedNodes.includes(id);
  }

  // ───────────────────────────── Unstuck Modal Implementation ─────────────────────────────

  private openModuleModal(mod: OutpostModule) {
    if (this.isModalOpen || this.time.now < this.modalCooldownUntil) return;

    this.isModalOpen = true;
    if (this.astronaut) {
      this.tweens.killTweensOf(this.astronaut);
      this.setAstronautAnim('idle');
    }

    const done = this.isDone(mod.id);
    const gale = getGaleTelemetry();
    const PW = 720;
    const PH = 440;
    const CX = W / 2;
    const CY = H / 2;

    // 1. Full-screen dim blocker (direct scene object, no container scroll offset)
    const shade = this.add
      .rectangle(CX, CY, W, H, 0x02060d, 0.76)
      .setDepth(DEPTH.dialogShade)
      .setInteractive();

    shade.on('pointerdown', () => {
      soundFx.playClick(700);
      this.closeModuleModal();
    });

    // 2. Modal Chassis Panel (stops click propagation so clicking inside panel doesn't close it)
    const panelBg = this.add
      .rectangle(CX, CY, PW, PH, COLOR.panel, 0.98)
      .setStrokeStyle(2, done ? COLOR.green : COLOR.cyan)
      .setDepth(DEPTH.dialogPanel)
      .setInteractive();

    panelBg.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
      }
    );

    const topAccent = this.add
      .rectangle(CX, CY - PH / 2 + 3, PW, 6, done ? COLOR.green : COLOR.cyan)
      .setDepth(DEPTH.dialogPanel + 1);

    // 3. Category & Title (Matching Screenshot Layout)
    const catTxt = this.add
      .text(CX, CY - 172, `[ ${mod.category} ]`, {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: hex(COLOR.amber),
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.dialogPanel + 1);

    const titleTxt = this.add
      .text(CX, CY - 136, mod.name.toUpperCase(), {
        fontFamily: FONT_HEAD,
        fontSize: '22px',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.dialogPanel + 1);

    const descTxt = this.add
      .text(CX, CY - 78, mod.desc, {
        fontFamily: FONT_BODY,
        fontSize: '17px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: PW - 90 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.dialogPanel + 1);

    // 4. NASA OSDR + DONKI + Mars Trek Science Brief Box
    const osdrBg = this.add
      .rectangle(CX, CY + 4, PW - 80, 68, COLOR.panelInner)
      .setStrokeStyle(1, COLOR.green, 0.6)
      .setDepth(DEPTH.dialogPanel + 1);

    const osdrHeader = this.add
      .text(
        CX - (PW - 80) / 2 + 14,
        CY - 16,
        `🧬 NASA OSDR [${mod.osdrId}]  //  DONKI FLARE: ${gale.flareClass} (${gale.radiationMultiplier}x)  //  EFFECT: ${mod.effect}`,
        {
          fontFamily: FONT_MONO,
          fontSize: '10px',
          color: hex(COLOR.green),
        }
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.dialogPanel + 2);

    const osdrNoteTxt = this.add
      .text(CX - (PW - 80) / 2 + 14, CY + 12, mod.osdrNote, {
        fontFamily: FONT_BODY,
        fontSize: '14px',
        color: '#e2e8f0',
        wordWrap: { width: PW - 110 },
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.dialogPanel + 2);

    // Live OSDR API query
    fetch(`https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(mod.osdrKeyword)}&size=1`)
      .then(r => r.json())
      .then(json => {
        const hit = json?.hits?.hits?.[0]?._source;
        if (hit && hit['Accession'] && osdrHeader.active) {
          osdrHeader.setText(
            `🧬 NASA OSDR LIVE [${hit['Accession']}]  //  DONKI: ${gale.flareClass}  //  ${mod.effect}`
          );
        }
      })
      .catch(() => {});

    // 5. COMMISSION MODULE [ENTER] Button
    const commBtn = this.add
      .rectangle(CX, CY + 92, 330, 46, done ? COLOR.greenDeep : COLOR.cyanDeep)
      .setStrokeStyle(1.5, done ? COLOR.green : COLOR.cyan)
      .setDepth(DEPTH.dialogButtons)
      .setInteractive({ useHandCursor: true });

    const commTxt = this.add
      .text(CX, CY + 92, done ? 'MODULE OPERATIONAL [ENTER]' : 'COMMISSION MODULE [ENTER]', {
        fontFamily: FONT_HEAD,
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.dialogButtons + 1);

    // 6. EXIT [ESC] Button
    const exitBtn = this.add
      .rectangle(CX, CY + 154, 180, 36, 0x0f172a)
      .setStrokeStyle(1, COLOR.slate)
      .setDepth(DEPTH.dialogButtons)
      .setInteractive({ useHandCursor: true });

    const exitTxt = this.add
      .text(CX, CY + 154, 'EXIT [ESC]', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.dialogButtons + 1);

    // 7. Top-Right [X] Button
    const closeBtn = this.add
      .rectangle(CX + PW / 2 - 34, CY - PH / 2 + 34, 34, 34, 0x1e293b)
      .setStrokeStyle(1.5, COLOR.amber)
      .setDepth(DEPTH.dialogButtons)
      .setInteractive({ useHandCursor: true });

    const closeTxt = this.add
      .text(CX + PW / 2 - 34, CY - PH / 2 + 34, '✕', {
        fontFamily: FONT_MONO,
        fontSize: '16px',
        color: hex(COLOR.amber),
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.dialogButtons + 1);

    // Action Handlers
    const triggerCommission = () => {
      soundFx.playTelemetryChirp();
      this.commissionModule(mod);
      this.closeModuleModal();
    };

    const triggerClose = () => {
      soundFx.playClick(700);
      this.closeModuleModal();
    };

    commBtn.on('pointerover', () => commBtn.setFillStyle(done ? COLOR.green : 0x0ea5e9));
    commBtn.on('pointerout', () => commBtn.setFillStyle(done ? COLOR.greenDeep : COLOR.cyanDeep));
    commBtn.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        triggerCommission();
      }
    );

    // Enhanced commission button interaction (additive)
    attachUIInteraction(this, commBtn, {
      colorTarget:    commBtn,
      hoverFill:      done ? COLOR.green : 0x0ea5e9,
      defaultFill:    done ? COLOR.greenDeep : COLOR.cyanDeep,
      hoverStroke:    done ? COLOR.green : COLOR.cyan,
      hoverStrokeWidth: 2,
      defaultStroke:  done ? COLOR.green : COLOR.cyan,
      defaultStrokeWidth: 1.5,
      soundType:      done ? 'telemetry' : 'confirm',
      hoverScale:     1.03,
      pressScale:     0.97,
      tooltip:        done ? 'Module already commissioned.' : `Commission module: ${mod.effect}`,
      tooltipOffsetX: 24,
      tooltipOffsetY: -38,
      tooltipDepth:   DEPTH.dialogButtons + 20,
    });

    exitBtn.on('pointerover', () => exitBtn.setStrokeStyle(1.5, COLOR.cyan));
    exitBtn.on('pointerout', () => exitBtn.setStrokeStyle(1, COLOR.slate));
    exitBtn.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        triggerClose();
      }
    );

    // Enhanced exit button interaction (additive)
    attachUIInteraction(this, exitBtn, {
      colorTarget:    exitBtn,
      hoverStroke:    COLOR.cyan,
      hoverStrokeWidth: 1.5,
      defaultStroke:  COLOR.slate,
      defaultStrokeWidth: 1,
      soundType:      'cancel',
      hoverScale:     1.03,
      pressScale:     0.97,
      tooltip:        'Close module panel and return to Gale Base.',
      tooltipOffsetX: 24,
      tooltipOffsetY: -34,
      tooltipDepth:   DEPTH.dialogButtons + 20,
    });

    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x334155));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x1e293b));
    closeBtn.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        triggerClose();
      }
    );

    // Enhanced close [X] button interaction (additive)
    attachUIInteraction(this, closeBtn, {
      colorTarget:    closeBtn,
      hoverFill:      0x334155,
      defaultFill:    0x1e293b,
      hoverStroke:    COLOR.amber,
      hoverStrokeWidth: 2,
      defaultStroke:  COLOR.amber,
      defaultStrokeWidth: 1.5,
      soundType:      'cancel',
      hoverScale:     1.06,
      pressScale:     0.94,
      tooltipDepth:   DEPTH.dialogButtons + 20,
    });

    // Native Window Keydown Handler (Guarantees ENTER and ESC always work)
    this.removeWindowKeyListener();
    this.windowKeyHandler = (e: KeyboardEvent) => {
      if (!this.isModalOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        triggerClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        triggerCommission();
      }
    };
    window.addEventListener('keydown', this.windowKeyHandler, true);

    this.modalElements = [
      shade,
      panelBg,
      topAccent,
      catTxt,
      titleTxt,
      descTxt,
      osdrBg,
      osdrHeader,
      osdrNoteTxt,
      commBtn,
      commTxt,
      exitBtn,
      exitTxt,
      closeBtn,
      closeTxt,
    ];
  }

  private removeWindowKeyListener() {
    if (this.windowKeyHandler) {
      window.removeEventListener('keydown', this.windowKeyHandler, true);
      this.windowKeyHandler = undefined;
    }
  }

  private closeModuleModal() {
    this.isModalOpen = false;
    this.modalCooldownUntil = this.time.now + 400;
    this.removeWindowKeyListener();

    for (const el of this.modalElements) {
      el.destroy();
    }
    this.modalElements = [];
  }

  private commissionModule(mod: OutpostModule) {
    if (!this.isDone(mod.id)) {
      gameState.galeCommissionedNodes.push(mod.id);
      if (gameState.resources.power <= 0) {
        gameState.resources.power = 55;
      }
      mod.onCommission();
      gameState.save();
      gameState.notifyChange?.('commission');
    }

    this.refreshModuleView(mod.id);
    this.burstAt(mod.x, mod.y - mod.markerDy);
    this.updateStatusBanner();
    this.toast(`${mod.name.toUpperCase()} COMMISSIONED  //  ${mod.effect}`, COLOR.green);
  }

  // ───────────────────────────── 16-Bit Parallax Backdrop & Outpost World ─────────────────────────────

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

  private paintBands(
    x: number, y: number, w: number, h: number,
    from: number, to: number, steps: number, depth: number
  ) {
    const a = Phaser.Display.Color.IntegerToColor(from);
    const b = Phaser.Display.Color.IntegerToColor(to);
    const g = this.add.graphics().setDepth(depth);
    const bandH = Math.ceil(h / steps);
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, steps - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(x, y + i * bandH, w, bandH + 1);
    }
    return g;
  }

  private steppedRidge(
    g: Gfx,
    baseY: number,
    pts: Array<[number, number]>,
    fillColor: number,
    rimHighlightColor: number,
    alpha = 1
  ) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      for (let x = x0; x < x1; x += PX) {
        const t = (x - x0) / Math.max(1, x1 - x0);
        const topY = snap(Phaser.Math.Linear(y0, y1, t), PX);
        g.fillStyle(fillColor, alpha).fillRect(x, topY, PX + 1, baseY - topY);
        g.fillStyle(rimHighlightColor, alpha).fillRect(x, topY, PX + 1, PX);
      }
    }
  }

  private createProceduralOutpostWorld() {
    // 1. Martian Sky Gradient
    this.paintBands(-120, -20, W + 240, HORIZON_Y + 30, 0x261009, 0xd98a4e, 16, DEPTH.sky);

    // 2. Pixel Stars (Parallax 0.08)
    const stars = this.add.graphics().setDepth(DEPTH.stars);
    const starRnd = new Phaser.Math.RandomDataGenerator(['gale-stars-v5']);
    for (let i = 0; i < 42; i++) {
      const sx = snap(starRnd.between(-60, W + 60));
      const sy = snap(starRnd.between(10, 170));
      stars.fillStyle(0xfef3c7, starRnd.realInRange(0.25, 0.7)).fillRect(sx, sy, PX, PX);
    }
    this.addParallaxLayer(stars, 0.08, 0.04);

    // 3. Pixel-Stepped Martian Sun (Parallax 0.16)
    const sun = this.add.graphics().setDepth(DEPTH.sun);
    for (const [r, col, a] of [
      [110, 0xfde68a, 0.08],
      [70, 0xfde68a, 0.16],
      [22, 0xfffbeb, 0.92],
    ] as Array<[number, number, number]>) {
      for (let dy = -r; dy <= r; dy += PX) {
        const halfW = snap(Math.sqrt(Math.max(0, r * r - dy * dy)));
        sun.fillStyle(col, a).fillRect(1560 - halfW, 155 + dy, halfW * 2, PX);
      }
    }
    this.addParallaxLayer(sun, 0.16, 0.08);

    // 4. Far Gale Crater Rim (Parallax 0.28)
    const craterRim = this.add.graphics().setDepth(DEPTH.craterRimFar);
    this.steppedRidge(
      craterRim,
      HORIZON_Y + 20,
      [
        [-120, 290], [120, 250], [340, 275], [560, 240], [820, 265],
        [1200, 255], [1480, 230], [1740, 255], [2040, 280],
      ],
      0xb46436,
      0xd98a56,
      0.65
    );
    this.addParallaxLayer(craterRim, 0.28, 0.12);

    // 5. Aeolis Mons / Mount Sharp Terraced Peak (Parallax 0.48)
    const mtSharp = this.add.graphics().setDepth(DEPTH.mountSharp);
    this.steppedRidge(
      mtSharp,
      HORIZON_Y + 20,
      [
        [-120, 315], [160, 280], [410, 295], [640, 210], [820, 155],
        [960, 115], [1120, 160], [1320, 215], [1560, 265], [1780, 245], [2040, 300],
      ],
      0x96401e,
      0xc86d3c,
      0.96
    );
    this.addParallaxLayer(mtSharp, 0.48, 0.2);

    // 6. Mid-Ground Hematite Mesas (Parallax 0.72)
    const mesaMid = this.add.graphics().setDepth(DEPTH.mesaMid);
    this.steppedRidge(
      mesaMid,
      HORIZON_Y + 20,
      [
        [-120, 326], [200, 298], [460, 316], [740, 288],
        [1040, 310], [1360, 292], [1640, 314], [2040, 302],
      ],
      0x782d11,
      0x9e421d,
      0.98
    );
    this.addParallaxLayer(mesaMid, 0.72, 0.3);

    // 7. Near Bagnold Basalt Ridge (Parallax 0.92)
    const nearRidge = this.add.graphics().setDepth(DEPTH.ridgeNear);
    this.steppedRidge(
      nearRidge,
      HORIZON_Y + 24,
      [
        [-120, 338], [280, 318], [600, 334], [920, 320],
        [1300, 336], [1610, 318], [2040, 332],
      ],
      0x541d09,
      0x782d11,
      1
    );
    this.addParallaxLayer(nearRidge, 0.92, 0.4);

    // Foreground Martian Terrain Plane
    this.paintBands(0, HORIZON_Y, W, H - HORIZON_Y, 0x8f3916, 0x3b1507, 20, DEPTH.ground);

    // Shallow Impact Craters & Regolith Boulders
    const craters = this.add.graphics().setDepth(DEPTH.craters);
    for (const c of [
      { x: 640, y: 580, rx: 56, ry: 22 },
      { x: 1580, y: 790, rx: 78, ry: 36 },
      { x: 980, y: 840, rx: 62, ry: 24 },
    ]) {
      craters.fillStyle(0x5c200b, 0.85).fillEllipse(c.x, c.y, c.rx * 2.1, c.ry * 2.1);
      craters.fillStyle(0x361105, 0.92).fillEllipse(c.x, c.y + 2, c.rx * 1.6, c.ry * 1.4);
    }

    // Umbilical Conduits Connecting Outpost Modules
    const conduits = this.add.graphics().setDepth(DEPTH.conduits);
    const hub = this.modules[0];
    for (const m of this.modules.slice(1)) {
      conduits.lineStyle(4, 0x1e293b, 0.85).lineBetween(hub.x, hub.y, m.x, m.y);
      conduits.lineStyle(1.5, COLOR.cyan, 0.35).lineBetween(hub.x, hub.y, m.x, m.y);
    }
    this.pulseGfx = this.add.graphics().setDepth(DEPTH.conduits + 1);

    // Render all 5 Outpost Structures depth-sorted by Y
    for (const m of this.modules) {
      const g = this.add.graphics({ x: m.x, y: m.y }).setDepth(m.y);
      m.draw(g);
    }
  }

  // ───────────────────────────── Module Beacons & Interaction Rings ─────────────────────────────

  private createModuleMarker(m: OutpostModule) {
    // Ground interaction radius ring
    const promptRing = this.add
      .circle(m.x, m.y + 18, 46, COLOR.cyan, 0.08)
      .setStrokeStyle(1.5, COLOR.cyan, 0.45)
      .setDepth(DEPTH.conduits + 2);

    const mx = m.x;
    const my = m.y - m.markerDy;

    const pulseRing = this.add.circle(0, 0, 20, COLOR.cyan, 0).setStrokeStyle(2, COLOR.cyan, 0.85);
    const ring = this.add.circle(0, 0, 18, COLOR.cyanDeep, 0.65).setStrokeStyle(2, COLOR.cyan);
    const iconTxt = this.add
      .text(0, 0, '!', {
        fontFamily: FONT_HEAD,
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const labelTxt = this.add
      .text(m.x, m.y + 54, m.name.toUpperCase(), {
        fontFamily: FONT_MONO,
        fontSize: '11px',
        color: hex(COLOR.cyan),
        backgroundColor: hex(COLOR.ink),
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.markers);

    const marker = this.add.container(mx, my, [pulseRing, ring, iconTxt]).setDepth(DEPTH.markers);

    // Generous click zone covering structure + beacon + label
    const hitZone = this.add
      .zone(m.x, m.y - m.markerDy / 2, 220, m.markerDy + 90)
      .setDepth(DEPTH.markers + 1)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      this.tweens.add({ targets: marker, scale: 1.15, duration: 120 });
      soundFx.playClick(900);
    });
    hitZone.on('pointerout', () => {
      this.tweens.add({ targets: marker, scale: 1.0, duration: 120 });
    });
    hitZone.on('pointerdown', () => {
      if (this.isModalOpen || this.time.now < this.modalCooldownUntil) return;
      soundFx.playClick(1100);
      this.walkAstronautTo(m.x, Math.min(WALK.maxY, m.y + 48), () => {
        this.openModuleModal(m);
      });
    });

    this.tweens.add({
      targets: pulseRing,
      scale: 2.1,
      alpha: { from: 0.8, to: 0 },
      duration: 1500,
      repeat: -1,
      ease: 'Sine.easeOut',
    });

    this.moduleViews.set(m.id, { marker, ring, pulseRing, iconTxt, labelTxt, promptRing });
    this.refreshModuleView(m.id);
  }

  private refreshModuleView(id: string) {
    const v = this.moduleViews.get(id);
    if (!v) return;
    const done = this.isDone(id);
    const col = done ? COLOR.green : COLOR.cyan;

    v.ring.setFillStyle(done ? COLOR.greenDeep : COLOR.cyanDeep, 0.7).setStrokeStyle(2, col);
    v.iconTxt.setText(done ? '✓' : '!').setColor(done ? hex(COLOR.green) : '#ffffff');
    v.labelTxt.setColor(hex(col));
    v.promptRing.setStrokeStyle(1.5, col, 0.5);

    if (done) {
      this.tweens.killTweensOf(v.pulseRing);
      v.pulseRing.setVisible(false);
    } else {
      v.pulseRing.setVisible(true);
    }
  }

  private updateNearestModuleHighlight() {
    if (!this.astronaut) return;
    let closest: OutpostModule | undefined;
    let minDist = INTERACT_RADIUS;

    for (const m of this.modules) {
      const d = Phaser.Math.Distance.Between(this.astronaut.x, this.astronaut.y, m.x, m.y + 24);
      if (d < minDist) {
        minDist = d;
        closest = m;
      }
    }

    this.nearestModule = closest;
    for (const m of this.modules) {
      const v = this.moduleViews.get(m.id);
      if (!v) continue;
      const isNear = closest?.id === m.id;
      v.promptRing.setScale(isNear ? 1.25 : 1.0);
      v.promptRing.setAlpha(isNear ? 0.95 : 0.35);
    }
  }

  // ───────────────────────────── Astronaut ─────────────────────────────

  private createAstronautCharacter() {
    const shadow = this.add.ellipse(0, 0, 44, 14, 0x000000, 0.42);
    let body: Phaser.GameObjects.GameObject;

    if (this.textures.exists('astronaut_walk')) {
      this.astroSprite = this.add.sprite(0, 0, 'astronaut_walk', 0).setOrigin(0.5, 1).setScale(1.2);
      body = this.astroSprite;
      this.setAstronautAnim('idle');
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x64748b).fillRect(-18, -52, 12, 32);
      g.fillStyle(0xe2e8f0).fillRect(-10, -20, 9, 20).fillRect(3, -20, 9, 20);
      g.fillStyle(0xf8fafc).fillRect(-12, -52, 26, 32);
      g.fillStyle(0xf8fafc).fillCircle(1, -64, 13);
      g.fillStyle(0xf59e0b, 0.95).fillEllipse(5, -64, 15, 11);
      body = g;
    }

    this.astronaut = this.add.container(980, 640, [shadow, body]).setDepth(640);
  }

  private setAstronautAnim(kind: 'idle' | 'walk') {
    const key = kind === 'idle' ? 'astro_idle_anim' : 'astro_walk_anim';
    if (this.astroSprite && this.anims.exists(key)) {
      this.astroSprite.play(key, true);
    }
  }

  private walkAstronautTo(targetX: number, targetY: number, onArrival?: () => void) {
    const a = this.astronaut;
    const x = Phaser.Math.Clamp(targetX, WALK.minX, WALK.maxX);
    const y = Phaser.Math.Clamp(targetY, WALK.minY, WALK.maxY);
    const dist = Phaser.Math.Distance.Between(a.x, a.y, x, y);

    this.tweens.killTweensOf(a);

    if (dist < 8) {
      onArrival?.();
      return;
    }

    if (Math.abs(x - a.x) > 2) a.scaleX = x < a.x ? -1 : 1;
    this.setAstronautAnim('walk');

    this.tweens.add({
      targets: a,
      x,
      y,
      duration: (dist / WALK_SPEED) * 1000,
      ease: 'Linear',
      onUpdate: () => a.setDepth(a.y),
      onComplete: () => {
        a.setDepth(a.y);
        this.setAstronautAnim('idle');
        onArrival?.();
      },
    });
  }

  private pingAt(x: number, y: number) {
    const ping = this.add
      .ellipse(x, y, 18, 8, COLOR.cyan, 0)
      .setStrokeStyle(2, COLOR.cyan)
      .setDepth(DEPTH.markers - 1);
    this.tweens.add({
      targets: ping,
      scale: 3,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.easeOut',
      onComplete: () => ping.destroy(),
    });
  }

  private burstAt(x: number, y: number, color = COLOR.green) {
    for (let i = 0; i < 2; i++) {
      const r = this.add.circle(x, y, 22, color, 0).setStrokeStyle(3, color).setDepth(DEPTH.markers + 2);
      this.tweens.add({
        targets: r,
        scale: 3.2 + i,
        alpha: 0,
        duration: 650 + i * 180,
        delay: i * 110,
        ease: 'Cubic.easeOut',
        onComplete: () => r.destroy(),
      });
    }
  }

  // ───────────────────────────── Top Header, [M] Map Button & NASA HUD ─────────────────────────────

  private createTopMissionHeader() {
    const isAct3 = gameState.currentChapter === 'act_3_gale_return';
    const headerTitle = isAct3
      ? 'ACT III: GALE CRATER — INGESTING ARCADIA DATA & RE-OUTFITTING LREV'
      : 'ACT I: GALE CRATER OUTPOST // COLONIZATION BASE COMMISSIONING';

    const header = this.add.container(W / 2, 68).setDepth(DEPTH.hud);
    const bg = this.add.rectangle(0, 0, 920, 52, COLOR.panel, 0.92).setStrokeStyle(1.5, COLOR.cyan, 0.6);

    const hText = this.add
      .text(0, -10, headerTitle, {
        fontFamily: FONT_HEAD,
        fontSize: '14px',
        color: hex(COLOR.cyan),
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.statusBanner = this.add
      .text(0, 10, '', {
        fontFamily: FONT_MONO,
        fontSize: '11px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    const track = this.add.rectangle(-440, 22, 880, 3, 0x1e293b).setOrigin(0, 0.5);
    this.progressFill = this.add.rectangle(-440, 22, 880, 3, COLOR.cyan).setOrigin(0, 0.5);
    this.progressFill.scaleX = 0.001;

    header.add([bg, hText, this.statusBanner, track, this.progressFill]);

    // Top-Right [M] ORBITAL MAP Button (Matches Screenshot)
    const mapBtn = this.add
      .rectangle(W - 135, 68, 210, 40, COLOR.panel, 0.92)
      .setStrokeStyle(1.5, COLOR.cyan, 0.8)
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true });

    const mapTxt = this.add
      .text(W - 135, 68, '🛰️ [M] ORBITAL MAP', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: hex(COLOR.cyan),
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);

    mapBtn.on('pointerover', () => mapBtn.setFillStyle(COLOR.cyanDeep, 0.6));
    mapBtn.on('pointerout', () => mapBtn.setFillStyle(COLOR.panel, 0.92));
    mapBtn.on('pointerdown', () => this.openOrbitalMap());
    void mapTxt;

    // Enhanced map button interaction (additive)
    attachUIInteraction(this, mapBtn, {
      colorTarget:    mapBtn,
      hoverFill:      COLOR.cyanDeep,
      hoverFillAlpha: 0.7,
      hoverStroke:    COLOR.cyan,
      hoverStrokeWidth: 2,
      defaultFill:    COLOR.panel,
      defaultFillAlpha: 0.92,
      defaultStroke:  COLOR.cyan,
      defaultStrokeWidth: 1.5,
      defaultStrokeAlpha: 0.8,
      soundType:      'telemetry',
      hoverScale:     1.04,
      pressScale:     0.96,
      tooltip:        'Open NASA ARES-V Orbital Reconnaissance Map for fast travel [M].',
      tooltipOffsetX: -240,
      tooltipOffsetY: 34,
      tooltipDepth:   DEPTH.hud + 50,
    });

    this.updateStatusBanner();
  }

  private updateStatusBanner() {
    const total = this.modules.length;
    const done = this.modules.filter(m => this.isDone(m.id)).length;
    const allDone = done >= total;
    const notAct3 = gameState.currentChapter !== 'act_3_gale_return';

    if (allDone) {
      this.statusBanner
        .setText('ALL GALE MODULES COMMISSIONED // MARS TREK TRAVERSE UNLOCKED')
        .setColor(hex(COLOR.green));
    } else {
      this.statusBanner
        .setText(`BASE READINESS: ${done}/${total} MODULES COMMISSIONED`)
        .setColor('#94a3b8');
    }

    this.progressFill.setFillStyle(allDone ? COLOR.green : COLOR.cyan);
    this.tweens.add({
      targets: this.progressFill,
      scaleX: Math.max(done / total, 0.001),
      duration: 450,
      ease: 'Cubic.easeOut',
    });

    if (allDone && notAct3) {
      this.showTraverseButton();
    }
  }

  private createNasaTelemetryHud() {
    const w = 340;
    const h = 118;
    const x = W - w / 2 - 30;
    const y = 160;

    const gale = getGaleTelemetry();
    const cont = this.add.container(x, y).setDepth(DEPTH.hud);
    const bg = this.add.rectangle(0, 0, w, h, COLOR.panel, 0.88).setStrokeStyle(1, COLOR.cyan, 0.5);

    const title = this.add
      .text(-w / 2 + 14, -h / 2 + 16, 'NASA LIVE TELEMETRY // GALE', {
        fontFamily: FONT_HEAD,
        fontSize: '11px',
        color: hex(COLOR.cyan),
      })
      .setOrigin(0, 0.5);

    this.donkiHudText = this.add.text(
      -w / 2 + 14,
      -h / 2 + 36,
      `DONKI FLARE : Class ${gale.flareClass} (${gale.radiationMultiplier}x Flux)\n` +
        `MARS TREK   : ${gale.lat}°N, ${gale.lon}°E (${gale.elevationMeters}m)\n` +
        `SHARAD ICE  : ${gale.subsurfaceIceDepthM}m  |  SLOPE: ${gale.slopeDeg}°`,
      {
        fontFamily: FONT_MONO,
        fontSize: '11px',
        color: '#cbd5e1',
        lineSpacing: 5,
      }
    );

    cont.add([bg, title, this.donkiHudText]);
  }

  private createBottomControlBar() {
    const bar = this.add.container(W / 2, 1018).setDepth(DEPTH.hud);
    const bg = this.add.rectangle(0, 0, 740, 34, COLOR.ink, 0.92).setStrokeStyle(1, COLOR.slate, 0.6);
    const txt = this.add
      .text(0, 0, '[WASD / ARROWS] EXPLORE   •   [E / SPACE] INTERACT   •   [M] MARS TRAVEL MAP', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: hex(COLOR.cyan),
      })
      .setOrigin(0.5);
    bar.add([bg, txt]);
  }

  // ───────────────────────────── Scene Transitions ─────────────────────────────

  private openOrbitalMap() {
    if (this.leaving) return;
    soundFx.playClick(1200);
    if (gameState.currentChapter === 'act_1_prologue') {
      gameState.currentChapter = 'act_2_arcadia';
      gameState.save();
    }
    this.goTo('ExpeditionMapScene');
  }

  private goTo(sceneKey: string) {
    if (this.leaving) return;
    this.leaving = true;
    this.closeModuleModal();
    this.cameras.main.fadeOut(350, 5, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(sceneKey);
    });
  }

  private showTraverseButton() {
    if (this.traverseBtn) return;

    const c = this.add.container(W / 2, 955).setDepth(DEPTH.hud);
    const bg = this.add
      .rectangle(-65, 0, 410, 44, COLOR.cyanDeep)
      .setStrokeStyle(2, COLOR.cyan)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(-65, 0, 'LAUNCH MARS TREK TRAVERSE PLANNER ➔', {
        fontFamily: FONT_HEAD,
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const resetBg = this.add
      .rectangle(210, 0, 110, 44, COLOR.panel)
      .setStrokeStyle(1, COLOR.slate)
      .setInteractive({ useHandCursor: true });
    const resetTxt = this.add
      .text(210, 0, '↺ RESET', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    c.add([bg, txt, resetBg, resetTxt]);
    this.traverseBtn = c;

    bg.on('pointerdown', () => this.openOrbitalMap());

    // Enhanced traverse planner button interaction (additive)
    attachUIInteraction(this, bg, {
      colorTarget:    bg,
      hoverFill:      COLOR.cyan,
      hoverFillAlpha: 1,
      defaultFill:    COLOR.cyanDeep,
      hoverStroke:    COLOR.cyan,
      hoverStrokeWidth: 2.5,
      defaultStroke:  COLOR.cyan,
      defaultStrokeWidth: 2,
      soundType:      'telemetry',
      hoverScale:     1.03,
      pressScale:     0.97,
      tooltip:        'Open Mars Trek Traverse Planner to plan your next expedition route.',
      tooltipOffsetX: 24,
      tooltipOffsetY: -40,
      tooltipDepth:   DEPTH.hud + 50,
    });

    resetBg.on('pointerdown', () => {
      soundFx.playClick(800);
      gameState.galeCommissionedNodes = [];
      gameState.currentChapter = 'act_1_prologue';
      gameState.save();
      this.traverseBtn?.destroy();
      this.traverseBtn = undefined;
      this.modules.forEach(m => this.refreshModuleView(m.id));
      this.updateStatusBanner();
      this.toast('OUTPOST MODULES RESET TO 0/5', COLOR.cyan);
    });

    // Enhanced reset button interaction (additive)
    attachUIInteraction(this, resetBg, {
      colorTarget:    resetBg,
      hoverFill:      COLOR.slate,
      defaultFill:    COLOR.panel,
      hoverStroke:    COLOR.steel,
      hoverStrokeWidth: 1.5,
      defaultStroke:  COLOR.slate,
      defaultStrokeWidth: 1,
      soundType:      'warning',
      hoverScale:     1.04,
      pressScale:     0.96,
      tooltip:        'Reset all 5 outpost modules. Progress will be lost.',
      tooltipOffsetX: -160,
      tooltipOffsetY: -40,
      tooltipDepth:   DEPTH.hud + 50,
    });
  }

  private createAct3Upgrades() {
    const cont = this.add.container(W / 2, 955).setDepth(DEPTH.hud);
    const bg = this.add.rectangle(0, 0, 860, 56, COLOR.panel, 0.95).setStrokeStyle(2, COLOR.green);
    const txt = this.add
      .text(-400, 0, 'ACT III: UPLOAD ARCADIA WATER DATA & PREP JEZERO EXPEDITION', {
        fontFamily: FONT_HEAD,
        fontSize: '12px',
        color: hex(COLOR.green),
      })
      .setOrigin(0, 0.5);

    const btn = this.add
      .rectangle(300, 0, 210, 36, COLOR.greenDeep)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add
      .text(300, 0, 'SYNTHESIZE & PROCEED', {
        fontFamily: FONT_HEAD,
        fontSize: '11px',
        color: hex(COLOR.ink),
      })
      .setOrigin(0.5);

    btn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      gameState.arcadiaWaterFiltered = true;
      gameState.resources.airReserve = 100;
      gameState.resources.power = 100;
      gameState.resources.waterReserve = 100;
      gameState.currentChapter = 'act_4_jezero';
      gameState.save();
      this.goTo('ExpeditionMapScene');
    });

    cont.add([bg, txt, btn, btnTxt]);
  }

  private toast(message: string, color = COLOR.green) {
    this.toastText?.destroy();
    const t = this.add
      .text(W / 2, 130, message, {
        fontFamily: FONT_MONO,
        fontSize: '13px',
        color: hex(color),
        backgroundColor: hex(COLOR.ink),
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.toast);
    this.toastText = t;

    this.tweens.add({
      targets: t,
      alpha: { from: 1, to: 0 },
      y: 118,
      delay: 1800,
      duration: 300,
      onComplete: () => {
        t.destroy();
        if (this.toastText === t) this.toastText = undefined;
      },
    });
  }
}