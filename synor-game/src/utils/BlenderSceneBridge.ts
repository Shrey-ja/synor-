/**
 * Blender Scene Integration & 3D Render Slot Bridge
 * Provides designated spaces, viewport calibration, and fallback rendering
 * for 3D assets/scenes modeled in Blender.
 */

import Phaser from 'phaser';

export interface BlenderSceneSlot {
  id: string;
  sceneName: string;
  expectedFilename: string;
  aspectRatio: string; // e.g. "16:9 (1920x1080)"
  cameraSpecs: string;
  lightingSpecs: string;
  hotspots: {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  }[];
}

export const BLENDER_SCENE_SLOTS: Record<string, BlenderSceneSlot> = {
  START_MENU: {
    id: 'start_menu',
    sceneName: 'StartMenuScene',
    expectedFilename: 'menu_background.png',
    aspectRatio: '1920x1080',
    cameraSpecs: 'Focal Length 35mm, Orbit view of Mars limb with atmospheric rim glow, distant outpost beacon',
    lightingSpecs: 'Low-angle sun rim light with deep shadow terminator',
    hotspots: [
      { id: 'mars_limb', label: 'Mars Horizon', x: 960, y: 750, width: 1400, height: 400, description: 'Martian curved limb' },
      { id: 'beacon_outpost', label: 'Mars Research Outpost', x: 1280, y: 580, width: 120, height: 80, description: 'Pulsing beacon station' }
    ]
  },
  GALE_BASE: {
    id: 'gale_base',
    sceneName: 'GaleBaseScene',
    expectedFilename: 'gale_base.png',
    aspectRatio: '1920x1080',
    cameraSpecs: 'Isometric / High 3/4 Perspective (elevation 30°, azimuth 45°), viewing base modules at Aeolis Mons foot',
    lightingSpecs: 'Dusty ochre daylight (4800K), harsh Martian shadows, solar glint on panel arrays',
    hotspots: [
      { id: 'hab_core', label: 'Habitat Core & Air Lock', x: 960, y: 480, width: 260, height: 180, description: 'Pressurized living cylinder' },
      { id: 'solar_yard', label: 'Solar & Kilopower Yard', x: 420, y: 420, width: 280, height: 160, description: 'Photovoltaic trackers and radiator vanes' },
      { id: 'eclss_rack', label: 'ECLSS Life Support Rack', x: 740, y: 680, width: 180, height: 140, description: 'O2 generator & CO2 scrubber stack' },
      { id: 'hydro_loop', label: 'Hydro-Loop Recycling', x: 1180, y: 680, width: 180, height: 140, description: 'Distillation tanks & graywater loop' },
      { id: 'rad_bunker', label: 'Regolith Storm Bunker', x: 1480, y: 440, width: 280, height: 180, description: 'Berm-shielded reinforced refuge' },
      { id: 'high_gain', label: 'High-Gain Earth Dish', x: 1580, y: 220, width: 160, height: 180, description: 'Earth-pointing parabolic antenna' }
    ]
  },
  EXPEDITION_MAP: {
    id: 'expedition_map',
    sceneName: 'ExpeditionMapScene',
    expectedFilename: 'mars_orbital_map.png',
    aspectRatio: '1920x1080',
    cameraSpecs: 'Equirectangular orbital view or MOLA hillshade elevation raster',
    lightingSpecs: 'Global zenith illumination with relief shadowing',
    hotspots: [
      { id: 'gale_site', label: 'Gale Crater (Origin)', x: 1480, y: 600, width: 90, height: 90, description: 'Act I & III staging point' },
      { id: 'arcadia_site', label: 'Arcadia Planitia', x: 130, y: 320, width: 110, height: 110, description: 'Act II Cryo-ISRU site' },
      { id: 'jezero_site', label: 'Jezero Crater', x: 1180, y: 440, width: 90, height: 90, description: 'Act IV & V Conjunction site' }
    ]
  },
  ARCADIA_FIELD: {
    id: 'arcadia_field',
    sceneName: 'ArcadiaFieldScene',
    expectedFilename: 'arcadia_field.png',
    aspectRatio: '1920x1080',
    cameraSpecs: 'Ground-level wide angle (24mm) looking across polygonal ground fractures with LREV Rover foreground',
    lightingSpecs: 'High-latitude pale winter sun, frosty ice specular reflections in soil polygons',
    hotspots: [
      { id: 'gpr_grid', label: 'Polygonal Ice Ground', x: 500, y: 620, width: 440, height: 320, description: '6x6 GPR scanning area' },
      { id: 'drill_rig', label: 'LREV Percussive Drill', x: 1100, y: 580, width: 240, height: 260, description: 'Ice coring mechanical rig' },
      { id: 'mreu_unit', label: 'MREU Vapor Chamber', x: 1460, y: 520, width: 220, height: 220, description: 'Sublimation reactor' },
      { id: 'regolith_pad', label: 'Soil Bearing Test Bed', x: 860, y: 820, width: 340, height: 180, description: 'ISRU structural pad test site' }
    ]
  },
  JEZERO_FIELD: {
    id: 'jezero_field',
    sceneName: 'JezeroFieldScene',
    expectedFilename: 'jezero_field.png',
    aspectRatio: '1920x1080',
    cameraSpecs: 'Dramatically layered river delta cliff face (Kodiak Butte style), river canyon mouth in midground',
    lightingSpecs: 'Approaching afternoon dust haze, warm amber cast, heavy shadows under sedimentary scarps',
    hotspots: [
      { id: 'delta_scarp', label: 'Ancient Delta Strata', x: 600, y: 400, width: 500, height: 280, description: 'LiDAR strata scanning site' },
      { id: 'spectro_target', label: 'Clay/Carbonate Outcrop', x: 1250, y: 480, width: 320, height: 220, description: 'Raman & XRF spectroscopy point' },
      { id: 'bio_tube_site', label: 'Organic Mudstone Core', x: 920, y: 720, width: 280, height: 180, description: 'Biosignature sample sleeve extraction' },
      { id: 'weather_mast', label: 'MEDA Weather Mast', x: 1620, y: 620, width: 140, height: 260, description: 'Atmospheric telemetry station' }
    ]
  },
  JEZERO_SHELTER: {
    id: 'jezero_shelter',
    sceneName: 'JezeroShelterScene',
    expectedFilename: 'jezero_shelter.png',
    aspectRatio: '1920x1080',
    cameraSpecs: 'Interior cutaway / wide interior angle (20mm) of the pressurized Jezero Field Station looking at observation window and breaker panel',
    lightingSpecs: 'Emergency amber cabin lighting, dust storm darkness visible through reinforced quartz window pane, LED breaker status panels',
    hotspots: [
      { id: 'power_bus', label: 'Power Breaker Load Bus', x: 380, y: 460, width: 300, height: 320, description: 'Breaker switches: ECLSS, Thermal, Cryo, Recycler' },
      { id: 'water_shield_wall', label: 'Water Bladder Storm Shelter', x: 880, y: 380, width: 280, height: 360, description: 'Radiation shield water barrier' },
      { id: 'cryo_freezer', label: 'Sample Cryo-Preservation Unit', x: 1240, y: 520, width: 220, height: 260, description: 'Cryogenic core sample lock' },
      { id: 'airlock_door', label: 'EVA Airlock Hatch', x: 1600, y: 480, width: 200, height: 380, description: 'Exterior dust storm cycle hatch' },
      { id: 'storm_window', label: 'Observation Viewport', x: 880, y: 160, width: 380, height: 160, description: 'View of raging regional dust storm' }
    ]
  },
  ENDING_SCENE: {
    id: 'ending_scene',
    sceneName: 'EndingScene',
    expectedFilename: 'ending_scene.png',
    aspectRatio: '1920x1080',
    cameraSpecs: 'Cinematic widescreen view of sunrise clearing through Martian dust over the station and LREV rover',
    lightingSpecs: 'Dawn twilight piercing dust haze, high-contrast emotional lighting',
    hotspots: []
  }
};

/**
 * Checks if a Blender 3D render texture was genuinely loaded and is not a missing/failed texture.
 */
export function isBlenderTextureLoaded(scene: Phaser.Scene, textureKey: string): boolean {
  if (!scene.textures.exists(textureKey)) return false;
  try {
    const tex = scene.textures.get(textureKey);
    if (!tex || tex.key === '__MISSING' || tex.key === '__DEFAULT') return false;
    if (!tex.source || tex.source.length === 0) return false;
    const src = tex.source[0];
    if (src.width <= 32 && src.height <= 32) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates or renders the scene backdrop:
 * Checks if the user has provided the Blender 3D render in assets/renders/<expectedFilename>.
 * If present, draws the Blender render.
 * If not present, calls proceduralFallback() to generate high-fidelity 2D canvas graphics,
 * and adds an authoring watermark showing where the Blender render fits.
 */
export function attachBlenderSceneSlot(
  scene: Phaser.Scene,
  slotId: keyof typeof BLENDER_SCENE_SLOTS,
  proceduralFallback: () => void
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const slot = BLENDER_SCENE_SLOTS[slotId];
  if (!slot) {
    proceduralFallback();
    return container;
  }

  const textureKey = `blender_${slot.id}`;
  const usingBlenderAsset = isBlenderTextureLoaded(scene, textureKey);

  if (usingBlenderAsset) {
    const bgImage = scene.add.image(960, 540, textureKey);
    bgImage.setDisplaySize(1920, 1080);
    container.add(bgImage);
  } else {
    // Execute procedural fallback graphics!
    proceduralFallback();
  }

  // Add authoring HUD indicator in upper right corner
  const badgeBg = scene.add.rectangle(1700, 24, 380, 28, 0x050d1a, 0.75)
    .setStrokeStyle(1, usingBlenderAsset ? 0x10b981 : 0xf59e0b, 0.6);
  const badgeText = scene.add.text(
    1700,
    24,
    usingBlenderAsset ? `BLENDER 3D ASSET ACTIVE: ${slot.expectedFilename}` : `BLENDER SCENE SLOT READY: ${slot.expectedFilename}`,
    {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '10px',
      color: usingBlenderAsset ? '#34d399' : '#f59e0b'
    }
  ).setOrigin(0.5);

  container.add(badgeBg);
  container.add(badgeText);

  // Press 'B' key to toggle Blender Hotspot Alignment Guide
  const keyB = scene.input.keyboard?.addKey('B');
  let guideVisible = false;
  const guideContainer = scene.add.container(0, 0);
  guideContainer.setVisible(false);

  slot.hotspots.forEach(h => {
    const rect = scene.add.rectangle(h.x, h.y, h.width, h.height, 0x38bdf8, 0.15)
      .setStrokeStyle(2, 0x38bdf8, 0.85);
    const label = scene.add.text(h.x, h.y - h.height / 2 - 12, `[BLENDER ANCHOR: ${h.label}]`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#38bdf8',
      backgroundColor: '#0a101d'
    }).setOrigin(0.5);
    guideContainer.add(rect);
    guideContainer.add(label);
  });

  container.add(guideContainer);

  keyB?.on('down', () => {
    guideVisible = !guideVisible;
    guideContainer.setVisible(guideVisible);
  });

  return container;
}

