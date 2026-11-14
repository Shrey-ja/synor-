# SYNOR: Blender 3D Scene Specification & Asset Drop Guide

This document outlines the exact specifications for rendering 3D backgrounds and assets in **Blender** to drop into the Phaser 3 game.

The game is built with **Blender Scene Slots** that automatically detect and display your 3D renders from `public/assets/renders/`. If an asset hasn't been rendered yet, the game falls back to high-fidelity procedural vector graphics and keeps the gameplay 100% playable.

---

## 1. Quick Drop Instructions

1. Model and render your scene in Blender at **1920x1080 (16:9 ratio)**.
2. Export as **PNG** or **WEBP** with the filename listed below.
3. Place the file into:
   ```text
   synor-game/public/assets/renders/<expectedFilename>
   ```
4. Refresh the game in your browser—the Phaser engine automatically detects the render and swaps out the procedural placeholder!
5. **Alignment Guide:** In any scene, press the **`B`** key on your keyboard to toggle the visual overlay showing the exact interactive hotspot coordinates!

---

## 2. Scene Specifications & Camera Angles

### 1. Start Menu Backdrop
* **Filename:** `menu_background.png`
* **Scene:** Main Title & Cinematic Zoom
* **Camera:** 35mm focal length. Orbit view of the curved Martian limb against starfield. At the terminator line, show a small perched research outpost with a pulsing beacon light.
* **Lighting:** Low-angle solar rim light (amber/red glow) with deep dark shadows on the unlit hemisphere.

### 2. Act I & III: Gale Crater Base
* **Filename:** `gale_base.png`
* **Scene:** Base Commissioning & Rover Overhaul (Aeolis Mons / Mount Sharp foothills)
* **Camera:** Isometric / High 3/4 perspective (Elevation 30°, Azimuth 45°).
* **Key Elements & Positions:**
  * **(420, 420):** Photovoltaic solar array yard & Kilopower fission reactor radiator vanes.
  * **(960, 480):** Pressurized cylindrical Habitat Core with exterior airlock.
  * **(740, 680):** ECLSS Life Support processing rack & plumbing conduits.
  * **(1180, 680):** Hydro-Loop water distillation & storage tanks.
  * **(1480, 440):** Heavy regolith-covered radiation storm bunker.
  * **(1580, 220):** High-Gain Earth relay parabolic dish antenna.

### 3. Act II: Arcadia Planitia Polygonal Cryo-Terrain
* **Filename:** `arcadia_field.png`
* **Scene:** Subsurface Ice Drilling & Regolith ISRU Field
* **Camera:** Ground-level wide angle (24mm) looking across vast flat northern plains with giant hexagonal/polygonal soil frost fractures.
* **Key Elements & Positions:**
  * **(500, 620):** 6x6 Ground-Penetrating Radar scanning zone (polygonal fractures).
  * **(1100, 580):** LREV Rover with robotic arm & percussive rotary drill bit deployed.
  * **(1460, 520):** MREU thermal sublimation chamber unit.
  * **(860, 820):** Compacted regolith test pad for landing infrastructure.

### 4. Act IV: Jezero Crater Ancient River Delta
* **Filename:** `jezero_field.png`
* **Scene:** Western Delta Outcrop & Astrobiology Search
* **Camera:** 28mm lens focused on towering stratified sedimentary cliff faces (Kodiak Butte style river delta scarp).
* **Lighting:** Late afternoon dusty atmosphere, dramatic amber haze, long cast shadows.
* **Key Elements & Positions:**
  * **(600, 400):** Ancient layered sedimentary river delta scarp.
  * **(1250, 480):** Clay and carbonate rock outcrop for Raman/XRF laser spectroscopy.
  * **(920, 720):** Organic-bearing mudstone strata for sealed biosignature sample tubes.
  * **(1620, 620):** Deployed MEDA automated weather station mast.

### 5. Act V: Jezero Field Shelter (14-Day Solar Conjunction)
* **Filename:** `jezero_shelter.png`
* **Scene:** Pressurized Interior Survival Module during raging global dust storm.
* **Camera:** Wide interior angle (20mm) showing cabin module interior and reinforced viewport window looking outside.
* **Lighting:** Emergency amber/red cabin LEDs, dim instrument dials, storm howling outside window.
* **Key Elements & Positions:**
  * **(380, 460):** Power Bus breaker panel (switches for ECLSS, Thermal, Cryo, Recycler).
  * **(880, 160):** Reinforced observation window looking out into zero-visibility dust storm.
  * **(880, 380):** Water-tank reinforced radiation storm shelter bulkhead.
  * **(1240, 520):** Cryogenic sample preservation freezer unit (with temperature display).
  * **(1600, 480):** EVA cycling airlock hatch.

### 6. Epilogue / Ending Screen
* **Filename:** `ending_scene.png`
* **Scene:** Dawn of Day 14. Clearing Martian skies as the Sun rises over Jezero and the high-gain antenna confirms Earth carrier lock.

---

## 3. Render Settings Recommendation
* **Resolution:** 1920 x 1080 (or 3840 x 2160 exported at 1920)
* **Color Space:** sRGB
* **Engine:** Blender Cycles (for physical raytraced Martian dust scattering) or EEVEE Next (for rapid iteration).
* **Volumetrics:** Subtle dust absorption/scattering in the atmosphere adds incredible realism to the Martian surface.

