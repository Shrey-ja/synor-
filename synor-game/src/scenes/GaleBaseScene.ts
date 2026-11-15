/**
 * Gale Crater Base Scene (Act I Prologue & Act III Return)
 * - 16-bit Pixel-Art Stepped 7-Layer Parallax Backdrop (Mount Sharp / Aeolis Mons)
 * - High-detail procedural outpost structures + 6-wheel LREV + animated conduits
 * - Single unified health/telemetry readout (duplicate HUD removed)
 * - Live NASA DONKI, Mars Trek MOLA/SHARAD, and NASA OSDR Bio-Archive integrations
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { resourceEngine } from '../state/ResourceEngine';
import { MARS_SITES } from '../utils/MarsGeo';
import { soundFx } from '../utils/ProceduralAudio';

// ─────────────────────────────────────────────────────────────────────────────
// Layout, theme, depth
// ─────────────────────────────────────────────────────────────────────────────

const W = 1920;
const H = 1080;
const HORIZON_Y = 456;
const PX = 4; // 16-bit pixel-art step size (4px grid)
const WALK = { minX: 90, maxX: 1830, minY: 565, maxY: 935 };
const WALK_SPEED = 270;

// Set to true if you also want to hide the top DOM bar (#top-bar / .telemetry-bar)
const HIDE_TOP_HTML_TELEMETRY_BAR = false;

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

// Depths start at 20 so any background slot at depth 0..10 cannot cover parallax or buildings
const DEPTH = {
  sky: 20,
  stars: 21,
  sun: 22,
  craterRimFar: 23,
  mountSharp: 24,
  mesaMid: 25,
  ridgeNear: 26,
  haze: 27,
  ground: 28,
  craters: 29,
  rocks: 30,
  conduits: 31,
  pad: 33,
  dust: 1100,
  markers: 1200,
  hud: 2000,
  dialog: 3000,
  toast: 4000,
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

interface BaseNode {
  id: string;
  name: string;
  subLabel: string;
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

interface NodeView {
  marker: Phaser.GameObjects.Container;
  outerHex: Gfx;
  ring: Phaser.GameObjects.Arc;
  pulseRing: Phaser.GameObjects.Arc;
  bang: Phaser.GameObjects.Text;
  check: Gfx;
  labelBg: Gfx;
  label: Phaser.GameObjects.Text;
  subText: Phaser.GameObjects.Text;
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
// Type-safe Polygon & Pixel-Art Stepped Geometry Helpers
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

/**1. HABITAT CORE BULKHEAD — Geodesic dome, airlock tunnel, O2 spheres, thermal louvers */
function drawHabitat(g: Gfx) {
  g.fillStyle(0x000000, 0.38).fillEllipse(6, 8, 310, 42);

  // Side spherical O2 / N2 high-pressure storage tanks (left)
  g.fillStyle(0x334155).fillRect(-138, -22, 34, 20);
  g.fillStyle(0xcbd5e1).fillCircle(-132, -32, 14).fillCircle(-112, -32, 14);
  g.lineStyle(2, 0x0f172a).strokeCircle(-132, -32, 14).strokeCircle(-112, -32, 14);
  g.lineStyle(2, COLOR.cyan).lineBetween(-138, -32, -104, -32);

  // Side radiator louver bank (right)
  g.fillStyle(0x1e293b).fillRoundedRect(102, -48, 38, 44, 4);
  g.lineStyle(2, 0x0f172a).strokeRoundedRect(102, -48, 38, 44, 4);
  g.lineStyle(1.5, 0x38bdf8, 0.65);
  for (let y = -42; y <= -12; y += 6) g.lineBetween(106, y, 136, y);

  // Reinforced titanium foundation skirt
  g.fillStyle(0x334155).fillRoundedRect(-114, -16, 228, 18, 4);
  g.lineStyle(2, 0x0f172a).strokeRoundedRect(-114, -16, 228, 18, 4);
  for (let x = -100; x <= 100; x += 25) {
    g.fillStyle(0x94a3b8).fillRect(x - 2, -9, 4, 4);
  }

  // Main composite pressurized dome
  const dome = arcPoints(0, -14, 110, 102, Math.PI, Math.PI * 2);
  g.fillStyle(0xe2e8f0);
  fillPoly(g, dome, true);

  // Dome shading band (lower rim)
  const rimShade = arcPoints(0, -14, 110, 34, Math.PI, Math.PI * 2);
  g.fillStyle(0xcbd5e1, 0.75);
  fillPoly(g, rimShade, true);
  g.lineStyle(3, 0x0f172a);
  strokePoly(g, dome, true);

  // Geodesic structural ribs & latitude rings
  g.lineStyle(1.5, 0x94a3b8, 0.85);
  for (const k of [-82, -55, -28, 0, 28, 55, 82]) {
    const topY = -14 - 102 * Math.sqrt(Math.max(0, 1 - (k / 110) ** 2));
    g.lineBetween(k, -14, k * 0.65, topY);
  }
  g.lineBetween(-96, -54, 96, -54);
  g.lineBetween(-74, -84, 74, -84);

  // Upper solar-thermal cap
  const cap = arcPoints(0, -96, 48, 20, Math.PI, Math.PI * 2);
  g.fillStyle(0x475569);
  fillPoly(g, cap, true);
  g.lineStyle(2, COLOR.cyan, 0.85);
  strokePoly(g, cap, true);

  // Illuminated crew viewports with specular glint
  for (const k of [-74, -46, 46, 74]) {
    g.fillStyle(0x0f172a).fillRect(k - 12, -72, 24, 14);
    g.fillStyle(0xfbbf24, 0.95).fillRect(k - 10, -70, 20, 10);
    g.fillStyle(0xfef3c7, 0.9).fillRect(k - 8, -69, 6, 3);
  }

  // Forward protruding airlock module & docking collar
  g.fillStyle(0x1e293b).fillRoundedRect(-26, -54, 52, 54, 4);
  g.lineStyle(2.5, 0x0f172a).strokeRoundedRect(-26, -54, 52, 54, 4);
  g.fillStyle(0x0f172a).fillRect(-18, -44, 36, 42);
  g.lineStyle(2, COLOR.cyan).strokeRect(-18, -44, 36, 42);
  g.fillStyle(COLOR.cyan, 0.85).fillRect(-6, -34, 12, 10);
  g.fillStyle(COLOR.green).fillRect(-14, -50, 4, 4);
  g.fillStyle(COLOR.amber).fillRect(10, -50, 4, 4);

  // Access ramp
  const ramp: Pt[] = [
    { x: -20, y: 0 }, { x: 20, y: 0 }, { x: 28, y: 12 }, { x: -28, y: 12 }
  ];
  g.fillStyle(0x475569);
  fillPoly(g, ramp, true);
  g.lineStyle(2, 0x0f172a);
  strokePoly(g, ramp, true);

  // Telemetry mast & beacon
  g.lineStyle(3, 0xcbd5e1).lineBetween(0, -116, 0, -152);
  g.lineStyle(2, 0x94a3b8).lineBetween(-10, -138, 10, -138).lineBetween(-6, -146, 6, -146);
  g.fillStyle(COLOR.red, 0.35).fillCircle(0, -154, 9);
  g.fillStyle(COLOR.red).fillRect(-3, -157, 6, 6);
}

/** 2. SOLAR & KILOPOWER BUS — Stirling fission tower + 5 articulated PV arrays */
function drawSolarYard(g: Gfx) {
  g.fillStyle(0x000000, 0.35).fillEllipse(-10, 6, 370, 32);

  // Kilopower KRUSTY Fission Reactor Assembly (left)
  g.fillStyle(0x1e293b).fillRect(-184, -18, 44, 18);
  g.lineStyle(2, COLOR.amber).strokeRect(-184, -18, 44, 18);
  g.fillStyle(0x334155).fillRect(-170, -120, 16, 102);
  g.lineStyle(2, 0x0f172a).strokeRect(-170, -120, 16, 102);

  g.lineStyle(2, 0x94a3b8);
  for (let y = -110; y < -24; y += 11) {
    g.lineBetween(-184, y, -140, y);
  }

  const umbrella: Pt[] = [
    { x: -196, y: -120 }, { x: -162, y: -136 }, { x: -128, y: -120 }
  ];
  g.fillStyle(0x475569);
  fillPoly(g, umbrella, true);
  g.lineStyle(2, 0xcbd5e1);
  strokePoly(g, umbrella, true);

  g.fillStyle(COLOR.amber, 0.3).fillCircle(-162, -65, 22);
  g.fillStyle(COLOR.amber, 0.95).fillRect(-166, -74, 8, 18);
  g.fillStyle(0xfef08a).fillRect(-165, -140, 6, 6);

  // Power Conditioning & Transformer Junction Box
  g.fillStyle(0x0f172a).fillRect(-132, -38, 28, 38);
  g.lineStyle(2, COLOR.cyan).strokeRect(-132, -38, 28, 38);
  g.fillStyle(COLOR.green).fillRect(-120, -30, 4, 4);

  // 5 Dual-Axis Sun-Tracking Photovoltaic Arrays
  for (let i = 0; i < 5; i++) {
    const x = -92 + i * 58;
    g.fillStyle(0x334155).fillRect(x + 20, -28, 8, 28);
    g.lineStyle(2, 0x94a3b8).lineBetween(x + 14, -12, x + 22, -32);
    g.fillStyle(0x475569).fillRect(x + 14, -6, 20, 6);

    g.fillStyle(0x0f172a).fillRect(x - 3, -85, 54, 58);
    g.fillStyle(0x1e3a8a).fillRect(x, -82, 48, 52);

    g.lineStyle(1, 0x3b82f6, 0.75);
    for (let cx = x + 12; cx < x + 48; cx += 12) g.lineBetween(cx, -82, cx, -30);
    for (let cy = -69; cy < -30; cy += 13) g.lineBetween(x, cy, x + 48, cy);

    g.lineStyle(2, 0x93c5fd, 0.45).lineBetween(x + 4, -78, x + 22, -34);
    g.lineStyle(2, 0x60a5fa, 0.95).strokeRect(x - 2, -84, 52, 56);
  }
}

/** 3. ECLSS LIFE SUPPORT RACK — Sabatier reactor, dual CO2 scrubbers, O2 COPVs */
function drawEclss(g: Gfx) {
  g.fillStyle(0x000000, 0.36).fillEllipse(4, 6, 230, 30);

  g.fillStyle(0x1e293b).fillRect(-96, -12, 196, 12);
  g.lineStyle(2, 0x0f172a).strokeRect(-96, -12, 196, 12);

  g.fillStyle(0x334155).fillRect(-88, -112, 68, 100);
  g.lineStyle(2, COLOR.cyan).strokeRect(-88, -112, 68, 100);
  g.fillStyle(0x0f172a).fillRect(-80, -102, 52, 26);

  g.lineStyle(2, COLOR.green)
    .lineBetween(-76, -88, -66, -94)
    .lineBetween(-66, -94, -56, -84)
    .lineBetween(-56, -84, -44, -92)
    .lineBetween(-44, -92, -32, -88);

  g.lineStyle(1.5, 0x94a3b8);
  for (let y = -68; y <= -42; y += 6) g.lineBetween(-78, y, -30, y);

  [COLOR.green, COLOR.green, COLOR.cyan, COLOR.amber].forEach((c, i) => {
    g.fillStyle(c).fillRect(-76 + i * 12, -28, 5, 5);
  });

  for (const cx of [-6, 18]) {
    g.fillStyle(0x64748b).fillRect(cx, -96, 20, 84);
    g.lineStyle(2, 0x0f172a).strokeRect(cx, -96, 20, 84);
    g.fillStyle(COLOR.cyanDeep, 0.9).fillRect(cx + 3, -72, 14, 24);
  }

  g.fillStyle(0xe2e8f0).fillRoundedRect(48, -82, 44, 70, 12);
  g.fillStyle(0x334155).fillRect(48, -60, 44, 26);
  g.lineStyle(2, 0x0f172a).strokeRoundedRect(48, -82, 44, 70, 12);

  g.fillStyle(0x0f172a).fillCircle(70, -68, 6);
  g.lineStyle(1.5, COLOR.green).strokeCircle(70, -68, 6);

  g.lineStyle(4, COLOR.cyan, 0.95)
    .lineBetween(-20, -54, -6, -54)
    .lineBetween(38, -54, 48, -54)
    .lineBetween(4, -96, 4, -108)
    .lineBetween(4, -108, 70, -108)
    .lineBetween(70, -108, 70, -82);
  g.fillStyle(COLOR.red).fillRect(34, -112, 8, 8);
}

/** 4. HYDRO-LOOP DISTILLATION — Illuminated water tank, sight glass, SHARAD ice drill head */
function drawHydro(g: Gfx) {
  g.fillStyle(0x000000, 0.36).fillEllipse(10, 6, 220, 28);

  g.fillStyle(0x1e293b).fillRect(-64, -10, 174, 10);

  g.fillStyle(0x0369a1).fillRect(-50, -98, 96, 88);
  g.fillStyle(0x0284c7).fillRect(-34, -98, 64, 88);
  g.lineStyle(2.5, 0x0f172a).strokeRect(-50, -98, 96, 88);

  g.fillStyle(0x38bdf8).fillEllipse(-2, -98, 96, 22);
  g.lineStyle(2, 0xbae6fd).strokeEllipse(-2, -98, 96, 22);

  g.lineStyle(1.5, 0x7dd3fc, 0.75);
  for (const y of [-76, -54, -32]) g.lineBetween(-50, y, 46, y);

  // Glowing Vertical Water-Level Sight Glass
  g.fillStyle(0x050a14).fillRect(-38, -84, 12, 62);
  g.fillStyle(0x22d3ee, 0.95).fillRect(-36, -68, 8, 44);
  g.lineStyle(1.5, 0xffffff, 0.85).strokeRect(-38, -84, 12, 62);

  g.fillStyle(COLOR.panel).fillCircle(8, -54, 15);
  g.lineStyle(2, COLOR.green).strokeCircle(8, -54, 15);
  g.lineStyle(2, COLOR.green).lineBetween(8, -54, 16, -60);

  // SHARAD Subsurface Ice Wellhead & Vapor Compression Pump
  g.fillStyle(0x334155).fillRect(58, -48, 46, 38);
  g.lineStyle(2, COLOR.cyan).strokeRect(58, -48, 46, 38);
  g.fillStyle(0x64748b).fillRect(74, -76, 14, 76);
  g.lineStyle(2, COLOR.amber).lineBetween(74, -70, 88, -62).lineBetween(74, -58, 88, -50);
  g.lineStyle(4, COLOR.cyan).lineBetween(46, -28, 58, -28);
}

/** 5. REGOLITH STORM BUNKER — Sintered regolith dome, radiation blast door, trefoil sign */
function drawBunker(g: Gfx) {
  g.fillStyle(0x000000, 0.38).fillEllipse(0, 8, 310, 34);

  const mound = arcPoints(0, 0, 132, 92, Math.PI, Math.PI * 2);
  g.fillStyle(0x5b2a0f);
  fillPoly(g, mound, true);

  const innerMound = arcPoints(0, 0, 118, 76, Math.PI, Math.PI * 2);
  g.fillStyle(0x6c3212, 0.9);
  fillPoly(g, innerMound, true);

  g.lineStyle(3, 0x2a0f04);
  strokePoly(g, mound, true);

  g.lineStyle(1.5, 0x3f1808, 0.75);
  for (const y of [-22, -42, -62]) {
    const halfW = Math.sqrt(Math.max(0, 1 - (y / 92) ** 2)) * 122;
    g.lineBetween(-halfW, y, halfW, y);
  }

  g.fillStyle(0x1e293b).fillRect(-36, -60, 72, 60);
  g.lineStyle(2.5, 0x0f172a).strokeRect(-36, -60, 72, 60);

  for (let i = 0; i < 8; i++) {
    g.fillStyle(i % 2 ? COLOR.amber : 0x0f172a).fillRect(-32 + i * 8, -68, 8, 8);
  }

  g.fillStyle(0x0f172a).fillRect(-26, -50, 52, 50);
  g.lineStyle(2, COLOR.amber).strokeRect(-26, -50, 52, 50);
  g.fillStyle(COLOR.cyan, 0.85).fillRect(-14, -38, 28, 6);
  g.lineStyle(2, 0xcbd5e1).strokeCircle(12, -20, 6);
  g.fillStyle(COLOR.amber).fillRect(-16, -24, 8, 8);

  g.lineStyle(2.5, 0x94a3b8).lineBetween(96, -24, 96, -86);
  g.fillStyle(COLOR.amber).fillRect(92, -92, 8, 8);
}

/** 6. HIGH-GAIN EARTH DISH — 34m-style DSN parabolic antenna, back-truss, quad-feed horn */
function drawDish(g: Gfx) {
  g.fillStyle(0x000000, 0.36).fillEllipse(0, 6, 180, 24);

  g.fillStyle(0x334155).fillRect(-44, -20, 88, 20);
  g.lineStyle(2, COLOR.cyan, 0.8).strokeRect(-44, -20, 88, 20);
  g.fillStyle(COLOR.green).fillRect(-32, -12, 5, 5);
  g.fillStyle(COLOR.cyan).fillRect(-20, -12, 5, 5);

  const yoke: Pt[] = [
    { x: -22, y: -20 }, { x: 22, y: -20 }, { x: 12, y: -96 }, { x: -12, y: -96 }
  ];
  g.fillStyle(0x475569);
  fillPoly(g, yoke, true);
  g.lineStyle(2, 0x0f172a);
  strokePoly(g, yoke, true);

  g.fillStyle(0x1e293b).fillCircle(0, -98, 12);
  g.lineStyle(2, COLOR.cyan).strokeCircle(0, -98, 12);

  const rot = -0.55;
  const bowl = arcPoints(0, -114, 72, 30, 0, Math.PI, rot);
  g.fillStyle(0xe2e8f0);
  fillPoly(g, bowl, true);
  g.lineStyle(2.5, 0x0f172a);
  strokePoly(g, bowl, true);

  const innerBowl = arcPoints(0, -114, 46, 18, 0, Math.PI, rot);
  g.lineStyle(1.5, 0x94a3b8, 0.8);
  strokePoly(g, innerBowl, false);

  const tip = { x: Math.sin(-rot) * 78, y: -114 - Math.cos(-rot) * 78 };
  g.lineStyle(2, 0xcbd5e1)
    .lineBetween(-34, -102, tip.x, tip.y)
    .lineBetween(34, -132, tip.x, tip.y)
    .lineBetween(0, -114, tip.x, tip.y);
  g.fillStyle(0x1e293b).fillCircle(tip.x, tip.y, 7);
  g.fillStyle(COLOR.cyan).fillRect(tip.x - 3, tip.y - 3, 6, 6);
}

/** 7. PARKED 6-WHEEL LREV PRESSURIZED ROVER */
function drawRover(g: Gfx) {
  g.fillStyle(0x000000, 0.42).fillEllipse(0, 8, 220, 24);

  g.fillStyle(0x1e293b).fillRect(-76, -28, 152, 14);
  g.lineStyle(3, 0x94a3b8)
    .lineBetween(-56, -14, -28, -22)
    .lineBetween(-28, -22, 4, -14)
    .lineBetween(4, -22, 56, -14);

  g.fillStyle(0xe2e8f0).fillRect(-70, -58, 136, 34);
  g.lineStyle(2.5, 0x0f172a).strokeRect(-70, -58, 136, 34);

  g.fillStyle(0xcbd5e1).fillRect(-72, -76, 68, 24);
  g.lineStyle(2, 0x0f172a).strokeRect(-72, -76, 68, 24);
  g.fillStyle(0xf59e0b, 0.92).fillRect(-68, -72, 34, 16);
  g.fillStyle(0xfef3c7, 0.75).fillRect(-64, -70, 12, 4);

  g.fillStyle(0x334155).fillRect(66, -54, 18, 24);
  g.lineStyle(2, COLOR.amber).strokeRect(66, -54, 18, 24);

  g.fillStyle(0x1e3a8a).fillRect(0, -64, 52, 6);
  g.lineStyle(3, 0xcbd5e1).lineBetween(-18, -76, -18, -104);
  g.fillStyle(0x0f172a).fillRect(-26, -110, 16, 8);
  g.fillStyle(COLOR.cyan).fillRect(-20, -108, 4, 4);

  for (const x of [-56, 0, 56]) {
    g.fillStyle(0x0f172a).fillCircle(x, -12, 16);
    g.lineStyle(2.5, 0x64748b).strokeCircle(x, -12, 16);
    g.fillStyle(COLOR.cyan).fillRect(x - 3, -15, 6, 6);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene Class
// ─────────────────────────────────────────────────────────────────────────────

export class GaleBaseScene extends Phaser.Scene {
  private nodes: BaseNode[] = [];
  private nodeViews = new Map<string, NodeView>();
  private parallaxLayers: ParallaxLayer[] = [];

  private astronaut!: Phaser.GameObjects.Container;
  private astroSprite?: Phaser.GameObjects.Sprite;
  private pulseGfx?: Gfx;

  private dialog?: Phaser.GameObjects.Container;
  private toastText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private traverseBtn?: Phaser.GameObjects.Container;

  private statusBanner!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private donkiHudText?: Phaser.GameObjects.Text;

  private camOffsetX = 0;
  private camOffsetY = 0;
  private leaving = false;

  constructor() {
    super({ key: 'GaleBaseScene' });
  }

  init() {
    this.nodeViews.clear();
    this.parallaxLayers = [];
    this.dialog = undefined;
    this.toastText = undefined;
    this.hintText = undefined;
    this.traverseBtn = undefined;
    this.astroSprite = undefined;
    this.pulseGfx = undefined;
    this.donkiHudText = undefined;
    this.camOffsetX = 0;
    this.camOffsetY = 0;
    this.leaving = false;
  }

  create() {
    this.cameras.main.fadeIn(450, 5, 10, 20);
    this.nodes = this.buildNodeDefs();

    if (HIDE_TOP_HTML_TELEMETRY_BAR) {
      const topBar = document.querySelector('header, #top-bar, .telemetry-bar') as HTMLElement | null;
      if (topBar) topBar.style.display = 'none';
    }

    // Always draw our 16-bit Pixel-Art Parallax & High-Detail Outpost Structures
    this.createProceduralGaleBase();

    this.nodes.forEach(n => this.createNodeMarker(n));
    this.createAstronautCharacter();
    this.createMissionHeader();
    this.createNasaTelemetryHud();
    this.createHint();

    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (this.dialog || over.length > 0) return;
        if (pointer.worldY < WALK.minY - 60 || pointer.worldY > WALK.maxY + 20) return;
        this.pingAt(pointer.worldX, pointer.worldY);
        this.walkAstronautTo(pointer.worldX, pointer.worldY);
        this.dismissHint();
      }
    );

    this.input.keyboard?.on('keydown-ESC', () => this.closeDialog());

    if (gameState.currentChapter === 'act_3_gale_return') {
      this.createAct3Upgrades();
    }
  }

  /**
   * 16-bit Pixel-Snapped Parallax Camera Update Loop
   */
  update(time: number, _delta: number) {
    const ptr = this.input.activePointer;
    const ptrNormX = ((ptr.x || W / 2) - W / 2) / (W / 2);
    const ptrNormY = ((ptr.y || H / 2) - H / 2) / (H / 2);
    const astroNormX = this.astronaut ? (this.astronaut.x - W / 2) / (W / 2) : 0;

    // Earlier pixel-art parallax feel: strong horizontal depth driven by astronaut & cursor
    const targetX = (astroNormX * 0.65 + ptrNormX * 0.35) * 64;
    const targetY = ptrNormY * 16;

    this.camOffsetX = Phaser.Math.Linear(this.camOffsetX, targetX, 0.08);
    this.camOffsetY = Phaser.Math.Linear(this.camOffsetY, targetY, 0.08);

    for (const layer of this.parallaxLayers) {
      // Snap parallax offsets to 2px pixel grid to prevent sub-pixel shimmering
      layer.target.x = snap(layer.baseX - this.camOffsetX * layer.factorX, 2);
      layer.target.y = snap(layer.baseY - this.camOffsetY * layer.factorY, 2);
    }

    if (this.pulseGfx) {
      this.pulseGfx.clear();
      const hub = this.nodes[0];
      const phase = (time * 0.00045) % 1;

      for (let i = 1; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const done = this.isDone(n.id);
        const t = (phase + i * 0.17) % 1;
        const px = snap(Phaser.Math.Linear(n.x, hub.x, t), 2);
        const py = snap(Phaser.Math.Linear(n.y + 4, hub.y + 4, t), 2);
        const col = done ? COLOR.green : COLOR.cyan;
        this.pulseGfx.fillStyle(col, 0.9).fillRect(px - 3, py - 3, 6, 6);
        this.pulseGfx.fillStyle(col, 0.25).fillRect(px - 7, py - 7, 14, 14);
      }

      const dish = this.nodes[5];
      const rfPhase = (time * 0.0012) % 1;
      const rfRadius = 10 + rfPhase * 48;
      this.pulseGfx
        .lineStyle(2, this.isDone(dish.id) ? COLOR.green : COLOR.cyan, 1 - rfPhase)
        .strokeCircle(dish.x + 42, dish.y - 180 - rfPhase * 22, rfRadius);
    }
  }

  // ───────────────────────────── Node Definitions ─────────────────────────────

  private buildNodeDefs(): BaseNode[] {
    const gale = getGaleTelemetry();
    return [
      {
        id: 'hab_core',
        name: 'Habitat Core Bulkhead',
        subLabel: '101.3 kPa NORM-OXIC DOME',
        x: 960, y: 565, markerDy: 175,
        desc: `Run 101.3 kPa pressure integrity cycle & airlock seal verification at Gale Crater (${gale.elevationMeters}m MOLA).`,
        effect: '+5% AIR RESERVE',
        osdrId: 'OSD-168',
        osdrKeyword: 'hypoxia',
        osdrNote: 'Maintains normoxic 101.3 kPa cabin pressure to prevent hypoxic cognitive latency.',
        draw: drawHabitat,
        onCommission: () => {
          gameState.resources.airReserve = Math.min(100, gameState.resources.airReserve + 5);
          gameState.addLog('HABITAT CORE: Atmospheric pressure verified at 101.3 kPa. Bulkheads sealed.', 'system');
        },
      },
      {
        id: 'solar_yard',
        name: 'Solar & Kilopower Bus',
        subLabel: '10kWe FISSION + PV ARRAY',
        x: 390, y: 600, markerDy: 155,
        desc: `Couple photovoltaic field arrays (${Math.round(gale.solarIrradianceFactor * 100)}% Mars Trek irradiance) & Kilopower bus to battery bank.`,
        effect: '+15% POWER',
        osdrId: 'OSD-242',
        osdrKeyword: 'thermoregulation',
        osdrNote: 'Prevents habitat thermal drops that elevate crew metabolic caloric burn by 22%.',
        draw: drawSolarYard,
        onCommission: () => {
          gameState.resources.power = Math.min(100, gameState.resources.power + 15);
          gameState.addLog('POWER BUS: 8x Photovoltaic trackers synchronized. Battery charging nominal.', 'system');
        },
      },
      {
        id: 'eclss_rack',
        name: 'ECLSS Life Support Rack',
        subLabel: 'SABATIER + ZEOLITE SCRUB',
        x: 685, y: 775, markerDy: 145,
        desc: 'Prime water electrolysis O2 generator and solid amine CO2 scrubbers.',
        effect: 'CO2 SCRUBBED TO 450 PPM',
        osdrId: 'OSD-168',
        osdrKeyword: 'hypercapnia',
        osdrNote: 'Scrubs cabin CO2 below 600 ppm threshold to prevent hypercapnic motor impairment.',
        draw: drawEclss,
        onCommission: () => {
          gameState.hazards.co2Ppm = 450;
          gameState.addLog('ECLSS RACK: Sabatier reactor and CO2 scrubbers operating at 99.4% efficiency.', 'system');
        },
      },
      {
        id: 'hydro_loop',
        name: 'Hydro-Loop Distillation',
        subLabel: `SHARAD ICE (${gale.subsurfaceIceDepthM}m DEPTH)`,
        x: 1235, y: 775, markerDy: 145,
        desc: `Initialize closed-loop graywater distillation & SHARAD subsurface ice recovery (${gale.subsurfaceIceDepthM}m depth).`,
        effect: '+10% WATER RESERVE',
        osdrId: 'OSD-115',
        osdrKeyword: 'metabolism',
        osdrNote: 'Sustains crew hydration and perimeter water-wall hydrogen radiation shielding.',
        draw: drawHydro,
        onCommission: () => {
          gameState.resources.waterReserve = Math.min(100, gameState.resources.waterReserve + 10);
          gameState.addLog('HYDRO-LOOP: Graywater multi-stage filtration online. 93% water recovery achieved.', 'system');
        },
      },
      {
        id: 'rad_bunker',
        name: 'Regolith Storm Bunker',
        subLabel: '1.5m SINTERED GCR SHIELD',
        x: 1540, y: 600, markerDy: 135,
        desc: `Deploy robotic dozers across ${gale.slopeDeg}° MOLA slope to heap 1.5m regolith over shelter.`,
        effect: 'SHELTER PROTECTION 95%',
        osdrId: 'OSD-379',
        osdrKeyword: 'radiation',
        osdrNote: 'Attenuates DONKI solar particle events & GCRs to prevent DNA double-strand breaks.',
        draw: drawBunker,
        onCommission: () => {
          gameState.resources.shelterProtection = 95;
          gameState.addLog('STORM BUNKER: 1.5m Martian regolith shielding completed. Galactic Cosmic Ray dose reduced.', 'system');
        },
      },
      {
        id: 'high_gain',
        name: 'High-Gain Earth Dish',
        subLabel: '34m DSN GOLDSTONE RELAY',
        x: 1735, y: 755, markerDy: 220,
        desc: 'Align high-gain parabolic reflector toward Deep Space Network Goldstone relay.',
        effect: 'DSN LOCK // ACT II ORDERS',
        osdrId: 'OSD-48',
        osdrKeyword: 'circadian',
        osdrNote: 'Maintains Earth telemetry sync & live NASA DONKI space weather warning feed.',
        draw: drawDish,
        onCommission: () => {
          gameState.dsnLocked = true;
          gameState.addLog('HIGH-GAIN ANTENNA: 34m DSN lock acquired. Act II orders received from Houston.', 'capcom');
        },
      },
    ];
  }

  private isDone(id: string) {
    return gameState.galeCommissionedNodes.includes(id);
  }

  // ───────────────────────────── 16-Bit Pixel-Art Parallax Backdrop ─────────────────────────────

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

  private paintBands(x: number, y: number, w: number, h: number, from: number, to: number, steps: number, depth: number) {
    const a = Phaser.Display.Color.IntegerToColor(from);
    const b = Phaser.Display.Color.IntegerToColor(to);
    const g = this.add.graphics().setDepth(depth);
    const bandH = Math.ceil(h / steps);
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, steps - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(x, y + i * bandH, w, bandH + 1);

      // 16-bit pixel dithering strips along band seams
      if (i > 0 && i % 2 === 0) {
        const prev = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, steps - 1, i - 1);
        g.fillStyle(Phaser.Display.Color.GetColor(prev.r, prev.g, prev.b), 0.55);
        for (let dx = x; dx < x + w; dx += PX * 4) {
          g.fillRect(dx, y + i * bandH, PX * 2, PX);
        }
      }
    }
    return g;
  }

  /**
   * Renders a 16-bit pixel-stepped Martian mountain/mesa ridge using PX (4px) columns
   */
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

  private createProceduralGaleBase() {
    // Layer 0: 16-bit Dithered Martian Sky Gradient
    this.paintBands(-120, -30, W + 240, HORIZON_Y + 40, 0x261009, 0xe09453, 18, DEPTH.sky);

    // Layer 1: Pixel-Art Stars & Phobos Moonlet (Parallax 0.08)
    const stars = this.add.graphics().setDepth(DEPTH.stars);
    const starRnd = new Phaser.Math.RandomDataGenerator(['gale-px-stars']);
    for (let i = 0; i < 48; i++) {
      const sx = snap(starRnd.between(-60, W + 60));
      const sy = snap(starRnd.between(12, 220));
      const size = i % 5 === 0 ? PX : 2;
      stars.fillStyle(0xfef3c7, starRnd.realInRange(0.25, 0.7)).fillRect(sx, sy, size, size);
    }
    this.addParallaxLayer(stars, 0.08, 0.04);

    // Layer 2: Pixel-Stepped Martian Sun & Solar Corona (Parallax 0.16)
    const sun = this.add.graphics().setDepth(DEPTH.sun);
    for (const [r, col, a] of [
      [140, 0xfde68a, 0.07],
      [92, 0xfde68a, 0.14],
      [52, 0xfef08a, 0.28],
      [24, 0xfffbeb, 0.95],
    ] as Array<[number, number, number]>) {
      for (let dy = -r; dy <= r; dy += PX) {
        const halfW = snap(Math.sqrt(Math.max(0, r * r - dy * dy)));
        sun.fillStyle(col, a).fillRect(1620 - halfW, 210 + dy, halfW * 2, PX);
      }
    }
    this.addParallaxLayer(sun, 0.16, 0.08);

    // Layer 3: Far Gale Crater Rim Silhouette — Pixel-Stepped (Parallax 0.28)
    const craterRim = this.add.graphics().setDepth(DEPTH.craterRimFar);
    this.steppedRidge(
      craterRim,
      HORIZON_Y + 24,
      [
        [-120, 388], [80, 342], [280, 368], [510, 326], [760, 352],
        [1180, 340], [1440, 308], [1700, 336], [2040, 368],
      ],
      0xb46436,
      0xd98a56,
      0.65
    );
    this.addParallaxLayer(craterRim, 0.28, 0.12);

    // Layer 4: Aeolis Mons (Mount Sharp) — Terraced 16-Bit Peak + Strata (Parallax 0.48)
    const mtSharp = this.add.graphics().setDepth(DEPTH.mountSharp);
    this.steppedRidge(
      mtSharp,
      HORIZON_Y + 24,
      [
        [-120, 418], [140, 372], [380, 392], [600, 288], [780, 216],
        [960, 148], [1130, 212], [1320, 284], [1540, 336], [1760, 306], [2040, 392],
      ],
      0x96401e,
      0xc86d3c,
      0.96
    );
    // Horizontal pixel-stepped sedimentary strata terraces on Mount Sharp
    mtSharp.fillStyle(0xb85d30, 0.55);
    mtSharp.fillRect(720, 240, 480, PX);
    mtSharp.fillRect(610, 292, 690, PX);
    mtSharp.fillRect(460, 344, 1020, PX);
    this.addParallaxLayer(mtSharp, 0.48, 0.2);

    // Layer 5: Mid-Ground Hematite Buttes & Stepped Mesas (Parallax 0.72)
    const mesaMid = this.add.graphics().setDepth(DEPTH.mesaMid);
    this.steppedRidge(
      mesaMid,
      HORIZON_Y + 24,
      [
        [-120, 436], [180, 396], [340, 396], [460, 424], [710, 384],
        [890, 384], [1040, 412], [1340, 388], [1520, 388], [1660, 418], [2040, 400],
      ],
      0x782d11,
      0x9e421d,
      0.98
    );
    this.addParallaxLayer(mesaMid, 0.72, 0.3);

    // Layer 6: Near Bagnold Basalt Foothills (Parallax 0.92)
    const nearRidge = this.add.graphics().setDepth(DEPTH.ridgeNear);
    this.steppedRidge(
      nearRidge,
      HORIZON_Y + 28,
      [
        [-120, 452], [260, 424], [580, 446], [910, 428],
        [1280, 448], [1590, 422], [2040, 444],
      ],
      0x541d09,
      0x782d11,
      1
    );
    this.addParallaxLayer(nearRidge, 0.92, 0.4);

    // Horizon Dust Haze Bands
    const haze = this.add.graphics().setDepth(DEPTH.haze);
    for (let i = 0; i < 6; i++) {
      const hh = 12 * (i + 1);
      haze.fillStyle(0xf4be86, 0.06).fillRect(-100, HORIZON_Y - hh + 12, W + 200, hh);
    }

    // Foreground Martian Regolith Ground Plane
    this.paintBands(0, HORIZON_Y, W, H - HORIZON_Y, 0x9c4620, 0x3b1507, 18, DEPTH.ground);

    // Pixel-Art Craters & Basalt Boulders on the Ground
    const craters = this.add.graphics().setDepth(DEPTH.craters);
    const craterList = [
      { x: 220, y: 540, rx: 52, ry: 18 },
      { x: 640, y: 520, rx: 44, ry: 15 },
      { x: 1320, y: 535, rx: 48, ry: 16 },
      { x: 260, y: 840, rx: 64, ry: 22 },
      { x: 1460, y: 860, rx: 58, ry: 20 },
    ];
    for (const c of craterList) {
      craters.fillStyle(0x6e2b11, 0.85).fillEllipse(c.x, c.y, c.rx * 2.1, c.ry * 2.1);
      craters.fillStyle(0x3b1507, 0.92).fillEllipse(c.x, c.y + 2, c.rx * 1.6, c.ry * 1.4);
    }

    const rnd = new Phaser.Math.RandomDataGenerator(['gale-crater-v4']);
    const rocks = this.add.graphics().setDepth(DEPTH.rocks);
    for (let i = 0; i < 85; i++) {
      const rx = snap(rnd.between(24, W - 24));
      const ry = snap(rnd.between(HORIZON_Y + 24, H - 28));
      const w = snap(rnd.between(6, 18), 2);
      const h = snap(rnd.between(4, 10), 2);
      rocks.fillStyle(0x210b03, 0.45).fillRect(rx + 2, ry + 2, w, h);
      rocks.fillStyle(0x692b12, 0.85).fillRect(rx, ry, w, h);
      rocks.fillStyle(0x9a4622, 0.7).fillRect(rx, ry, w, 2);
    }

    // Umbilical Power & Fluid Conduits + Footpaths radiating from Habitat Core
    const conduits = this.add.graphics().setDepth(DEPTH.conduits);
    const hub = this.nodes[0];
    for (const n of this.nodes.slice(1)) {
      this.drawConduitAndPath(conduits, { x: hub.x, y: hub.y + 4 }, { x: n.x, y: n.y + 4 });
    }
    this.pulseGfx = this.add.graphics().setDepth(DEPTH.conduits + 1);

    // Sintered Landing & Rover Maintenance Pad + Parked LREV
    const pad = this.add.graphics({ x: W / 2, y: 880 }).setDepth(DEPTH.pad);
    pad.fillStyle(0x0f172a, 0.9).fillEllipse(0, 0, 500, 126);
    pad.lineStyle(2.5, COLOR.slate).strokeEllipse(0, 0, 500, 126);
    pad.lineStyle(1.5, COLOR.cyan, 0.45).strokeEllipse(0, 0, 390, 92);
    for (const a of [0.4, 2.74, 3.54, 5.88]) {
      pad.fillStyle(COLOR.amber, 0.95).fillRect(Math.cos(a) * 235 - 3, Math.sin(a) * 58 - 3, 6, 6);
    }
    const rover = this.add.graphics({ x: W / 2, y: 880 }).setDepth(880);
    drawRover(rover);

    // Draw all 6 high-detail structures depth-sorted by Y
    for (const n of this.nodes) {
      const g = this.add.graphics({ x: n.x, y: n.y }).setDepth(n.y);
      n.draw(g);
    }

    this.createDust();
  }

  private drawConduitAndPath(g: Gfx, a: Pt, b: Pt) {
    const steps = Math.floor(Phaser.Math.Distance.BetweenPoints(a, b) / 22);
    g.fillStyle(0xfcd9b6, 0.14);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      g.fillRect(
        snap(Phaser.Math.Linear(a.x, b.x, t)) - 6,
        snap(Phaser.Math.Linear(a.y + 52, b.y + 52, t)) - 2,
        12,
        4
      );
    }
    g.lineStyle(4, 0x1e293b, 0.9).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(1.5, COLOR.cyan, 0.4).lineBetween(a.x, a.y, b.x, b.y);
  }

  private createDust() {
    const rnd = new Phaser.Math.RandomDataGenerator(['gale-dust']);
    for (let i = 0; i < 28; i++) {
      const duration = rnd.between(14000, 26000);
      const mote = this.add
        .rectangle(rnd.between(0, W - 500), rnd.between(HORIZON_Y, H - 80), PX, PX, 0xfcd9b6, 0)
        .setDepth(DEPTH.dust);
      this.tweens.add({ targets: mote, x: mote.x + rnd.between(300, 500), duration, repeat: -1 });
      this.tweens.add({ targets: mote, alpha: 0.38, duration: duration / 2, yoyo: true, repeat: -1 });
    }
  }

  // ───────────────────────────── Astronaut ─────────────────────────────

  private createAstronautCharacter() {
    const shadow = this.add.ellipse(0, 0, 46, 14, 0x000000, 0.38);
    let body: Phaser.GameObjects.GameObject;

    if (this.textures.exists('astronaut_walk')) {
      this.astroSprite = this.add.sprite(0, 0, 'astronaut_walk', 0).setOrigin(0.5, 1).setScale(1.2);
      body = this.astroSprite;
      this.setAstronautAnim('idle');
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x64748b).fillRect(-20, -54, 14, 34);
      g.fillStyle(0xe2e8f0).fillRect(-11, -22, 10, 22).fillRect(3, -22, 10, 22);
      g.fillStyle(0xf8fafc).fillRect(-13, -54, 28, 34);
      g.lineStyle(1.5, COLOR.cyan).strokeRect(-6, -46, 14, 10);
      g.fillStyle(0xf8fafc).fillCircle(1, -66, 14);
      g.fillStyle(0xf59e0b, 0.9).fillEllipse(6, -66, 16, 12);
      body = g;
    }

    this.astronaut = this.add.container(W / 2, 720, [shadow, body]).setDepth(720);
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

    if (dist < 6) {
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
    const ping = this.add.ellipse(x, y, 18, 8, COLOR.cyan, 0)
      .setStrokeStyle(2, COLOR.cyan)
      .setDepth(DEPTH.markers - 1);
    this.tweens.add({
      targets: ping, scale: 3, alpha: 0, duration: 450, ease: 'Cubic.easeOut',
      onComplete: () => ping.destroy(),
    });
  }

  // ───────────────────────────── Layered Node Beacons ─────────────────────────────

  private createNodeMarker(n: BaseNode) {
    const mx = n.x;
    const my = n.y - n.markerDy;

    const stem = this.add.graphics();
    stem.lineStyle(1.5, COLOR.cyan, 0.4).lineBetween(0, 26, 0, n.markerDy - 52);

    const pulseRing = this.add.circle(0, 0, 24, COLOR.cyan, 0).setStrokeStyle(2, COLOR.cyan, 0.9);
    const outerHex = this.add.graphics();
    const ring = this.add.circle(0, 0, 21, COLOR.cyanDeep, 0.55).setStrokeStyle(2, COLOR.cyan);
    const bang = this.add.text(0, 0, '!', {
      fontFamily: FONT_HEAD, fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    const check = this.add.graphics();
    check.lineStyle(3, COLOR.green).beginPath().moveTo(-7, 0).lineTo(-2, 6).lineTo(8, -6).strokePath();

    const label = this.add.text(0, 38, n.name.toUpperCase(), {
      fontFamily: FONT_MONO, fontSize: '11px', color: hex(COLOR.cyan),
    }).setOrigin(0.5);
    const subText = this.add.text(0, 52, n.subLabel, {
      fontFamily: FONT_MONO, fontSize: '9px', color: '#94a3b8',
    }).setOrigin(0.5);

    const pillW = Math.max(label.width, subText.width) + 22;
    const labelBg = this.add.graphics();
    labelBg.fillStyle(COLOR.ink, 0.92).fillRoundedRect(-pillW / 2, 27, pillW, 34, 4);
    labelBg.lineStyle(1, COLOR.cyan, 0.6).strokeRoundedRect(-pillW / 2, 27, pillW, 34, 4);

    const marker = this.add
      .container(mx, my, [stem, pulseRing, outerHex, ring, bang, check, labelBg, label, subText])
      .setDepth(DEPTH.markers);

    const zone = this.add
      .zone(mx, my + 18, Math.max(90, pillW), 96)
      .setDepth(DEPTH.markers)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      this.tweens.killTweensOf(marker);
      this.tweens.add({ targets: marker, scale: 1.12, duration: 120 });
      soundFx.playClick(900);
    });
    zone.on('pointerout', () => {
      this.tweens.killTweensOf(marker);
      this.tweens.add({ targets: marker, scale: 1, duration: 120 });
    });
    zone.on('pointerdown', () => {
      soundFx.playClick(this.isDone(n.id) ? 600 : 1100);
      this.dismissHint();
      this.approachNode(n);
    });

    this.tweens.add({
      targets: pulseRing, scale: 2.15, alpha: { from: 0.8, to: 0 },
      duration: 1600, repeat: -1, ease: 'Sine.easeOut',
    });

    this.nodeViews.set(n.id, { marker, outerHex, ring, pulseRing, bang, check, labelBg, label, subText });
    this.refreshNodeView(n.id);
  }

  private refreshNodeView(id: string) {
    const v = this.nodeViews.get(id);
    if (!v) return;
    const done = this.isDone(id);
    const col = done ? COLOR.green : COLOR.cyan;

    v.ring
      .setFillStyle(done ? COLOR.greenDeep : COLOR.cyanDeep, 0.55)
      .setStrokeStyle(2, col);
    v.bang.setVisible(!done);
    v.check.setVisible(done);
    v.label.setColor(hex(col));

    v.outerHex.clear();
    v.outerHex.lineStyle(1.5, col, 0.45).strokeCircle(0, 0, 26);

    if (done) {
      this.tweens.killTweensOf(v.pulseRing);
      v.pulseRing.setVisible(false);
    } else {
      v.pulseRing.setVisible(true);
    }
  }

  private approachNode(n: BaseNode) {
    this.walkAstronautTo(n.x, n.y + 64, () => this.openNodeDialog(n));
  }

  private burstAt(x: number, y: number, color = COLOR.green) {
    for (let i = 0; i < 2; i++) {
      const r = this.add.circle(x, y, 22, color, 0).setStrokeStyle(3, color).setDepth(DEPTH.markers + 1);
      this.tweens.add({
        targets: r, scale: 3.2 + i, alpha: 0, duration: 700 + i * 200, delay: i * 120,
        ease: 'Cubic.easeOut', onComplete: () => r.destroy(),
      });
    }
  }

  // ───────────────────────────── Layered UI Helper ─────────────────────────────

  private createLayeredPanel(w: number, h: number, accent: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);

    const shadow = this.add.rectangle(0, 6, w + 8, h + 8, 0x000000, 0.55);
    const outerGlow = this.add.rectangle(0, 0, w + 4, h + 4, accent, 0.08);
    const bg = this.add.rectangle(0, 0, w, h, COLOR.panel, 0.92).setStrokeStyle(1.5, accent, 0.65);
    const topBar = this.add.rectangle(0, -h / 2 + 2, w, 4, accent, 0.95);

    const deco = this.add.graphics();
    deco.lineStyle(1, accent, 0.04);
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

  // ───────────────────────────── Layered Node Dialog + NASA OSDR ─────────────────────────────

  private openNodeDialog(node: BaseNode) {
    this.closeDialog();

    const done = this.isDone(node.id);
    const accent = done ? COLOR.green : COLOR.cyan;
    const PW = 680;
    const PH = 440;

    const root = this.add.container(0, 0).setDepth(DEPTH.dialog);
    this.dialog = root;

    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x02060d, 0.72).setInteractive();
    shade.on('pointerdown', () => this.closeDialog());

    const panel = this.add.container(W / 2, H / 2);
    const chassis = this.createLayeredPanel(PW, PH, accent);
    const hitBlocker = this.add.rectangle(0, 0, PW, PH, 0x000000, 0.001).setInteractive();

    const subHeader = this.add.text(-PW / 2 + 30, -188, `SUBSYSTEM TELEMETRY // ${node.subLabel}`, {
      fontFamily: FONT_MONO, fontSize: '11px', color: '#64748b',
    }).setOrigin(0, 0.5);

    const title = this.add.text(-PW / 2 + 30, -162, node.name.toUpperCase(), {
      fontFamily: FONT_HEAD, fontSize: '18px', color: hex(accent),
    }).setOrigin(0, 0.5);

    const tag = this.add.text(PW / 2 - 68, -162, done ? 'OPERATIONAL' : 'OFFLINE', {
      fontFamily: FONT_MONO, fontSize: '12px', color: hex(COLOR.ink),
      backgroundColor: hex(done ? COLOR.green : COLOR.amber), padding: { x: 8, y: 3 },
    }).setOrigin(1, 0.5);

    const divider = this.add.rectangle(0, -136, PW - 60, 1, accent, 0.35);

    const desc = this.add.text(-PW / 2 + 30, -120, node.desc, {
      fontFamily: FONT_BODY, fontSize: '18px', color: '#cbd5e1',
      wordWrap: { width: PW - 60 }, lineSpacing: 3,
    }).setOrigin(0, 0);

    // Inset Well 1: NASA OSDR Biomedical Science Brief
    const osdrBox = this.add.rectangle(0, -32, PW - 60, 68, COLOR.panelInner).setStrokeStyle(1, COLOR.green, 0.55);
    const osdrLeftBar = this.add.rectangle(-PW / 2 + 32, -32, 4, 68, COLOR.green);
    const osdrLabel = this.add.text(-PW / 2 + 46, -52, `🧬 NASA OSDR BIOMEDICAL ARCHIVE [${node.osdrId}]`, {
      fontFamily: FONT_MONO, fontSize: '11px', color: hex(COLOR.green),
    }).setOrigin(0, 0.5);
    const osdrBody = this.add.text(-PW / 2 + 46, -22, node.osdrNote, {
      fontFamily: FONT_BODY, fontSize: '14px', color: '#e2e8f0',
      wordWrap: { width: PW - 96 },
    }).setOrigin(0, 0.5);

    fetch(`https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(node.osdrKeyword)}&size=1`)
      .then(r => r.json())
      .then(json => {
        const hit = json?.hits?.hits?.[0]?._source;
        if (hit && hit['Study Title'] && osdrLabel.active) {
          const liveId = hit['Accession'] || node.osdrId;
          osdrLabel.setText(`🧬 NASA OSDR LIVE BIO-ARCHIVE [${liveId}]`);
        }
      })
      .catch(() => {});

    // Inset Well 2: On Commission Outcome
    const box = this.add.rectangle(0, 48, PW - 60, 58, COLOR.panelInner).setStrokeStyle(1, accent, 0.45);
    const boxLeftBar = this.add.rectangle(-PW / 2 + 32, 48, 4, 58, accent);
    const effectLabel = this.add.text(-PW / 2 + 46, 32, 'SYSTEM COMMISSIONING EFFECT', {
      fontFamily: FONT_MONO, fontSize: '11px', color: '#64748b',
    }).setOrigin(0, 0.5);
    const effectText = this.add.text(-PW / 2 + 46, 56, node.effect, {
      fontFamily: FONT_HEAD, fontSize: '15px', color: hex(accent),
    }).setOrigin(0, 0.5);

    const btn = this.add.rectangle(0, 132, 320, 46, done ? 0x1e293b : COLOR.cyanDeep)
      .setStrokeStyle(1.5, done ? COLOR.slate : COLOR.cyan);
    const btnText = this.add.text(0, 132, done ? 'NODE OPERATIONAL' : 'COMMISSION SUBSYSTEM', {
      fontFamily: FONT_HEAD, fontSize: '13px', color: done ? '#94a3b8' : '#ffffff',
    }).setOrigin(0.5);

    if (!done) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(0x0ea5e9));
      btn.on('pointerout', () => btn.setFillStyle(COLOR.cyanDeep));
      btn.on('pointerdown', () => {
        soundFx.playTelemetryChirp();
        this.closeDialog();
        this.commissionNode(node);
      });
    }

    const hint = this.add.text(0, 184, 'ESC or click outside to close', {
      fontFamily: FONT_MONO, fontSize: '10px', color: '#475569',
    }).setOrigin(0.5);

    const cx = PW / 2 - 26;
    const cy = -162;
    const x = this.add.graphics();
    x.lineStyle(2, 0x94a3b8).lineBetween(cx - 7, cy - 7, cx + 7, cy + 7).lineBetween(cx + 7, cy - 7, cx - 7, cy + 7);
    const closeZone = this.add.zone(cx, cy, 36, 36).setInteractive({ useHandCursor: true });
    closeZone.on('pointerdown', () => this.closeDialog());

    panel.add([
      chassis, hitBlocker, subHeader, title, tag, divider, desc,
      osdrBox, osdrLeftBar, osdrLabel, osdrBody,
      box, boxLeftBar, effectLabel, effectText, btn, btnText, hint, x, closeZone,
    ]);
    root.add([shade, panel]);

    shade.setAlpha(0);
    panel.setScale(0.92).setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 160 });
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private closeDialog() {
    if (!this.dialog) return;
    const d = this.dialog;
    this.dialog = undefined;
    d.destroy();
  }

  private commissionNode(node: BaseNode) {
    if (this.isDone(node.id)) return;

    gameState.galeCommissionedNodes.push(node.id);
    node.onCommission();
    gameState.save();

    this.refreshNodeView(node.id);
    this.burstAt(node.x, node.y - node.markerDy);
    this.updateStatusBanner();
    this.toast(`${node.name.toUpperCase()} ONLINE  //  ${node.effect}`);
  }

  // ───────────────────────────── Layered HUD Panels (Single Unified Readout) ─────────────────────────────

  private createMissionHeader() {
    const isAct3 = gameState.currentChapter === 'act_3_gale_return';
    const headerTitle = isAct3
      ? 'ACT III: GALE CRATER — INGESTING ARCADIA DATA & RE-OUTFITTING LREV'
      : 'ACT I: PROLOGUE — GALE CRATER BASE COMMISSIONING';

    const header = this.add.container(W / 2, 92).setDepth(DEPTH.hud);
    const chassis = this.createLayeredPanel(980, 64, COLOR.cyan);

    const hText = this.add.text(0, -13, headerTitle, {
      fontFamily: FONT_HEAD, fontSize: '15px', color: hex(COLOR.cyan), letterSpacing: 2,
    }).setOrigin(0.5);

    this.statusBanner = this.add.text(0, 7, '', {
      fontFamily: FONT_MONO, fontSize: '12px', color: '#94a3b8',
    }).setOrigin(0.5);

    const track = this.add.rectangle(-476, 25, 952, 4, 0x1e293b).setOrigin(0, 0.5);
    this.progressFill = this.add.rectangle(-476, 25, 952, 4, COLOR.cyan).setOrigin(0, 0.5);
    this.progressFill.scaleX = 0.001;

    header.add([chassis, hText, this.statusBanner, track, this.progressFill]);
    this.updateStatusBanner();
  }

  private updateStatusBanner() {
    const total = this.nodes.length;
    const done = this.nodes.filter(n => this.isDone(n.id)).length;
    const allDone = done >= total;
    const notAct3 = gameState.currentChapter !== 'act_3_gale_return';

    if (allDone) {
      this.statusBanner
        .setText('ALL GALE SYSTEMS NOMINAL' + (notAct3 ? ' // EXPEDITION TRAVERSE ROUTE UNLOCKED' : ''))
        .setColor(hex(COLOR.green));
    } else {
      this.statusBanner
        .setText(`BASE READINESS: ${done}/${total} NODES COMMISSIONED`)
        .setColor('#94a3b8');
    }

    this.progressFill.setFillStyle(allDone ? COLOR.green : COLOR.cyan);
    this.tweens.add({
      targets: this.progressFill, scaleX: Math.max(done / total, 0.001),
      duration: 500, ease: 'Cubic.easeOut',
    });

    if (allDone && notAct3) this.showTraverseButton();
  }

  private createNasaTelemetryHud() {
    const w = 356;
    const h = 152;
    const root = this.add.container(W - 30 - w / 2, 60 + h / 2).setDepth(DEPTH.hud);

    const gale = getGaleTelemetry();

    const chassis = this.createLayeredPanel(w, h, COLOR.cyan);
    root.add(chassis);

    root.add(this.add.text(-w / 2 + 16, -h / 2 + 18, 'NASA LIVE TELEMETRY', {
      fontFamily: FONT_HEAD, fontSize: '12px', color: hex(COLOR.cyan), letterSpacing: 1.5,
    }).setOrigin(0, 0.5));

    const badge = this.add.text(w / 2 - 16, -h / 2 + 18, gale.isLive ? 'DONKI LIVE' : 'DONKI SYNC', {
      fontFamily: FONT_MONO, fontSize: '9px', color: hex(COLOR.ink),
      backgroundColor: hex(gale.isLive ? COLOR.green : COLOR.amber), padding: { x: 5, y: 2 },
    }).setOrigin(1, 0.5);
    root.add(badge);

    root.add(this.add.rectangle(0, 12, w - 28, h - 52, COLOR.panelInner).setStrokeStyle(1, 0x1e293b));

    this.donkiHudText = this.add.text(
      -w / 2 + 24,
      -26,
      `DONKI FLARE : Class ${gale.flareClass} (${gale.radiationMultiplier}x Flux)\n` +
      `MARS TREK   : ${gale.lat}°N, ${gale.lon}°E (Gale)\n` +
      `MOLA ELEV   : ${gale.elevationMeters}m  |  SLOPE: ${gale.slopeDeg}°\n` +
      `SHARAD ICE  : ${gale.subsurfaceIceDepthM}m Subsurface Slab`,
      {
        fontFamily: FONT_MONO,
        fontSize: '11px',
        color: '#cbd5e1',
        lineSpacing: 6,
      }
    );

    root.add(this.donkiHudText);
  }

  private createHint() {
    this.hintText = this.add.text(30, 1000, 'Click terrain to walk  //  Click any subsystem beacon to inspect NASA OSDR & commission', {
      fontFamily: FONT_MONO, fontSize: '12px', color: '#cbd5e1',
      backgroundColor: hex(COLOR.ink), padding: { x: 10, y: 5 },
    }).setOrigin(0, 0.5).setDepth(DEPTH.hud).setAlpha(0.88);
  }

  private dismissHint() {
    const t = this.hintText;
    if (!t) return;
    this.hintText = undefined;
    this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() });
  }

  private toast(message: string, color = COLOR.green) {
    this.toastText?.destroy();
    const t = this.add.text(W / 2, 176, message, {
      fontFamily: FONT_MONO, fontSize: '14px', color: hex(color), align: 'center',
      backgroundColor: hex(COLOR.ink), padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(DEPTH.toast).setAlpha(0);
    this.toastText = t;

    this.tweens.add({
      targets: t, alpha: 1, y: 164, duration: 220, hold: 1900, yoyo: true,
      onComplete: () => {
        t.destroy();
        if (this.toastText === t) this.toastText = undefined;
      },
    });
  }

  // ───────────────────────────── Scene Transitions ─────────────────────────────

  private goTo(sceneKey: string) {
    if (this.leaving) return;
    this.leaving = true;
    this.closeDialog();
    this.cameras.main.fadeOut(400, 5, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(sceneKey);
    });
  }

  private showTraverseButton() {
    if (this.traverseBtn) return;

    const c = this.add.container(W / 2, 980).setDepth(DEPTH.hud).setAlpha(0);
    const glow = this.add.rectangle(-60, 0, 434, 58, COLOR.cyan, 0.22);
    const bg = this.add.rectangle(-60, 0, 410, 46, COLOR.cyanDeep)
      .setStrokeStyle(2, COLOR.cyan)
      .setInteractive({ useHandCursor: true });
    const brackets = this.add.graphics();
    brackets.x = -60;
    this.bracket(brackets, 420, 54, 10, COLOR.cyan);

    const txt = this.add.text(-60, 0, 'LAUNCH MARS TREK TRAVERSE PLANNER ➔', {
      fontFamily: FONT_HEAD, fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5);

    const resetBg = this.add.rectangle(220, 0, 110, 46, COLOR.panel)
      .setStrokeStyle(1, COLOR.slate)
      .setInteractive({ useHandCursor: true });
    const resetTxt = this.add.text(220, 0, '↺ RESET', {
      fontFamily: FONT_MONO, fontSize: '12px', color: '#94a3b8',
    }).setOrigin(0.5);

    c.add([glow, bg, brackets, txt, resetBg, resetTxt]);
    this.traverseBtn = c;

    this.tweens.add({ targets: c, y: 945, alpha: 1, duration: 450, ease: 'Back.easeOut' });
    this.tweens.add({ targets: glow, alpha: 0.08, duration: 900, yoyo: true, repeat: -1, delay: 500 });

    bg.on('pointerover', () => bg.setFillStyle(0x0ea5e9));
    bg.on('pointerout', () => bg.setFillStyle(COLOR.cyanDeep));
    bg.on('pointerdown', () => {
      soundFx.playClick(1200);
      gameState.currentChapter = 'act_2_arcadia';
      gameState.save();
      this.goTo('ExpeditionMapScene');
    });

    resetBg.on('pointerover', () => resetBg.setStrokeStyle(1, COLOR.cyan));
    resetBg.on('pointerout', () => resetBg.setStrokeStyle(1, COLOR.slate));
    resetBg.on('pointerdown', () => {
      soundFx.playClick(800);
      gameState.galeCommissionedNodes = [];
      gameState.currentChapter = 'act_1_prologue';
      gameState.save();
      this.traverseBtn?.destroy();
      this.traverseBtn = undefined;
      this.nodes.forEach(n => this.refreshNodeView(n.id));
      this.updateStatusBanner();
      this.toast('GALE BASE NODES RESET FOR COMMISSIONING', COLOR.cyan);
    });
  }

  private createAct3Upgrades() {
    const cont = this.add.container(W / 2, 945).setDepth(DEPTH.hud);
    const chassis = this.createLayeredPanel(900, 68, COLOR.green);

    const txt = this.add.text(-420, 0, 'ACT III: UPLOAD ARCADIA WATER DATA & PREP JEZERO EXPEDITION', {
      fontFamily: FONT_HEAD, fontSize: '12px', color: hex(COLOR.green), wordWrap: { width: 560 },
    }).setOrigin(0, 0.5);

    const btn = this.add.rectangle(320, 0, 220, 38, COLOR.greenDeep)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(320, 0, 'SYNTHESIZE & PROCEED', {
      fontFamily: FONT_HEAD, fontSize: '11px', color: hex(COLOR.ink),
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(COLOR.green));
    btn.on('pointerout', () => btn.setFillStyle(COLOR.greenDeep));
    btn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      gameState.arcadiaWaterFiltered = true;
      gameState.resources.airReserve = 100;
      gameState.resources.power = 100;
      gameState.resources.waterReserve = 100;
      gameState.currentChapter = 'act_4_jezero';
      gameState.addLog('ACT III COMPLETE: Nanofiltration membranes synthesized. LREV fully refueled for Jezero Crater.', 'science');
      gameState.save();
      this.goTo('ExpeditionMapScene');
    });

    cont.add([chassis, txt, btn, btnTxt]);
  }
}