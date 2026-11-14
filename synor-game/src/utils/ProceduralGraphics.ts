/**
 * Procedural Graphics Generator
 * Generates fallback textures, Mars orbital map, rover, astronaut, and science apparatuses
 * to guarantee complete visual fidelity prior to loading Blender 3D renders.
 */

import Phaser from 'phaser';

export class ProceduralGraphics {
  /**
   * Generates a 2D global Mars elevation map resembling NASA MOLA / Mars Trek
   */
  public static generateMarsGlobalMap(scene: Phaser.Scene, key: string, width = 1200, height = 600): string {
    if (scene.textures.exists(key)) return key;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return key;

    // Background Martian base gradient (MOLA elevation color hillshade inspired)
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1a365d'); // Northern lowlands / Vastitas Borealis (deep blue/purple low elevation)
    grad.addColorStop(0.35, '#2b6cb0'); // Arcadia Planitia smooth lowlands (cyan/blue)
    grad.addColorStop(0.5, '#c05621'); // Equatorial transition / Elysium (orange/ochre)
    grad.addColorStop(0.7, '#9c4221'); // Southern cratered highlands (rusty red-brown)
    grad.addColorStop(1.0, '#742a2a'); // South polar plateau (dark red/brown)
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Procedural elevation ridges & crater rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Lat/Lon grid lines
    for (let lon = 0; lon <= width; lon += width / 12) {
      ctx.beginPath();
      ctx.moveTo(lon, 0);
      ctx.lineTo(lon, height);
      ctx.stroke();
    }
    for (let lat = 0; lat <= height; lat += height / 6) {
      ctx.beginPath();
      ctx.moveTo(0, lat);
      ctx.lineTo(width, lat);
      ctx.stroke();
    }

    // Topographic contours
    ctx.strokeStyle = 'rgba(235, 120, 50, 0.25)';
    for (let i = 0; i < 40; i++) {
      const cx = (Math.sin(i * 3.7) * 0.5 + 0.5) * width;
      const cy = (Math.cos(i * 2.3) * 0.5 + 0.5) * height;
      const r = 20 + (i % 7) * 15;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Major geographic landmarks
    // Olympus Mons
    const omX = ((-133 + 180) / 360) * width;
    const omY = ((90 - 18.65) / 180) * height;
    ctx.fillStyle = 'rgba(255, 200, 150, 0.4)';
    ctx.beginPath();
    ctx.arc(omX, omY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbd38d';
    ctx.font = '9px monospace';
    ctx.fillText('OLYMPUS MONS', omX - 35, omY + 38);

    // Valles Marineris canyon
    const vmX = ((-70 + 180) / 360) * width;
    const vmY = ((90 - (-14)) / 180) * height;
    ctx.strokeStyle = 'rgba(60, 20, 10, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vmX - 60, vmY - 10);
    ctx.lineTo(vmX + 80, vmY + 15);
    ctx.stroke();
    ctx.fillText('VALLES MARINERIS', vmX - 40, vmY + 28);

    scene.textures.addCanvas(key, canvas);
    return key;
  }

  /**
   * Generates Astronaut EVA sprite
   */
  public static generateAstronautSprite(scene: Phaser.Scene, key = 'sprite_astronaut'): string {
    if (scene.textures.exists(key)) return key;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return key;

    // Mars exploration suit (White composite with orange safety bands and gold-plated visor)
    // Backpack / PLSS Life Support
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(16, 24, 32, 44);

    // Torso suit
    ctx.fillStyle = '#edf2f7';
    ctx.fillRect(20, 28, 24, 36);
    // Orange mission trim
    ctx.fillStyle = '#dd6b20';
    ctx.fillRect(20, 42, 24, 6);

    // Helmet & Visor
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(32, 20, 14, 0, Math.PI * 2);
    ctx.fill();

    // Gold reflective visor
    ctx.fillStyle = '#d69e2e';
    ctx.beginPath();
    ctx.ellipse(32, 20, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Suit Legs
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(21, 64, 10, 24);
    ctx.fillRect(33, 64, 10, 24);

    // Boots
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(18, 86, 14, 8);
    ctx.fillRect(32, 86, 14, 8);

    // Chest control unit LED
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(30, 32, 4, 4);

    scene.textures.addCanvas(key, canvas);
    return key;
  }

  /**
   * Generates LREV Rover sprite
   */
  public static generateRoverSprite(scene: Phaser.Scene, key = 'sprite_rover'): string {
    if (scene.textures.exists(key)) return key;

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    if (!ctx) return key;

    // 6-wheel rocker-bogie chassis
    ctx.fillStyle = '#1a202c';
    const wheels = [20, 50, 80, 110, 140];
    wheels.forEach(wx => {
      ctx.beginPath();
      ctx.arc(wx, 72, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#718096';
      ctx.beginPath();
      ctx.arc(wx, 72, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a202c';
    });

    // Suspension linkages
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 68);
    ctx.lineTo(80, 48);
    ctx.lineTo(130, 68);
    ctx.stroke();

    // Chassis body
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(30, 32, 100, 26);
    // Gold thermal foil
    ctx.fillStyle = '#d69e2e';
    ctx.fillRect(40, 36, 40, 18);

    // Remote Sensing Mast & Camera
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(115, 32);
    ctx.lineTo(115, 12);
    ctx.stroke();
    ctx.fillStyle = '#e53e3e';
    ctx.fillRect(110, 8, 12, 8);

    // Robotic arm and drill head
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(125, 45);
    ctx.lineTo(145, 48);
    ctx.lineTo(142, 62);
    ctx.stroke();

    scene.textures.addCanvas(key, canvas);
    return key;
  }

  /**
   * Generates a photorealistic textured Mars globe with 3D spherical shading,
   * craters, Valles Marineris canyon, atmospheric limb, and an illuminated colonization habitat dome.
   */
  public static generateRealisticMarsSphere(scene: Phaser.Scene, key = 'mars_sphere_procedural', size = 1024): string {
    if (scene.textures.exists(key)) return key;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return key;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.44;

    // 1. Atmospheric Outer Glow (Rayleigh scattering)
    const atmoGrad = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.08);
    atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    atmoGrad.addColorStop(0.3, 'rgba(234, 88, 12, 0.3)');
    atmoGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.08)');
    atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmoGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.fill();

    // 2. Planet Disc Clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Base Martian Regolith color
    ctx.fillStyle = '#9c3818';
    ctx.fillRect(0, 0, size, size);

    // 3. Martian Surface Albedo & Maria (darker basaltic lowlands)
    const albedoPatterns = [
      { x: cx - radius * 0.3, y: cy - radius * 0.1, r: radius * 0.45, col: '#5c1f0d' },
      { x: cx + radius * 0.1, y: cy + radius * 0.3, r: radius * 0.5, col: '#45170a' },
      { x: cx - radius * 0.5, y: cy + radius * 0.2, r: radius * 0.35, col: '#6e2710' },
      { x: cx + radius * 0.4, y: cy - radius * 0.3, r: radius * 0.3, col: '#50190a' }
    ];
    albedoPatterns.forEach(p => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, p.col);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Craters & Topographic Details
    const craters = [
      { x: cx - radius * 0.4, y: cy - radius * 0.3, r: 28 },
      { x: cx - radius * 0.1, y: cy - radius * 0.5, r: 18 },
      { x: cx + radius * 0.2, y: cy - radius * 0.2, r: 35 },
      { x: cx - radius * 0.2, y: cy + radius * 0.15, r: 24 },
      { x: cx + radius * 0.3, y: cy + radius * 0.2, r: 42 },
      { x: cx - radius * 0.6, y: cy - radius * 0.05, r: 16 },
      { x: cx + radius * 0.05, y: cy + radius * 0.45, r: 22 }
    ];
    craters.forEach(c => {
      // Crater floor shadow
      ctx.fillStyle = 'rgba(30, 8, 4, 0.65)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      // Sunlit rim highlight
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(c.x - 1, c.y - 1, c.r, Math.PI * 0.8, Math.PI * 1.8);
      ctx.stroke();
    });

    // Valles Marineris canyon cut
    ctx.strokeStyle = '#2d0c05';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.4, cy);
    ctx.bezierCurveTo(cx - radius * 0.1, cy + 18, cx + radius * 0.2, cy - 10, cx + radius * 0.5, cy + 15);
    ctx.stroke();

    // 5. Northern Polar Ice Cap (Carbon dioxide & water ice frost)
    const polarGrad = ctx.createRadialGradient(cx, cy - radius * 0.9, 0, cx, cy - radius * 0.9, radius * 0.32);
    polarGrad.addColorStop(0, '#f1f5f9');
    polarGrad.addColorStop(0.6, 'rgba(226, 232, 240, 0.85)');
    polarGrad.addColorStop(0.9, 'rgba(186, 230, 253, 0.3)');
    polarGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = polarGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - radius * 0.88, radius * 0.35, radius * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 6. Realistic 3D Spherical Light & Terminator Shadow
    // Sun shines from top-left (lightOriginX, lightOriginY)
    const lightX = cx - radius * 0.45;
    const lightY = cy - radius * 0.45;
    const sphereLight = ctx.createRadialGradient(lightX, lightY, radius * 0.1, lightX, lightY, radius * 1.4);
    sphereLight.addColorStop(0, 'rgba(255, 180, 140, 0.28)'); // Sunlit warm specular
    sphereLight.addColorStop(0.4, 'rgba(0, 0, 0, 0)');
    sphereLight.addColorStop(0.65, 'rgba(15, 5, 2, 0.5)'); // Terminator transition
    sphereLight.addColorStop(0.95, 'rgba(2, 1, 1, 0.97)'); // Deep night side
    ctx.fillStyle = sphereLight;
    ctx.fillRect(0, 0, size, size);

    // 7. Small Colonization Research Dome on the sunlit limb
    const domeX = cx - radius * 0.38;
    const domeY = cy - radius * 0.48;

    // Small foundation pad
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(domeX, domeY + 4, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Habitat Dome (translucent glass/composite with warm interior glow)
    const domeGrad = ctx.createRadialGradient(domeX, domeY - 4, 1, domeX, domeY, 12);
    domeGrad.addColorStop(0, '#fef08a'); // Warm internal habitat lighting
    domeGrad.addColorStop(0.5, '#f59e0b');
    domeGrad.addColorStop(0.9, 'rgba(56, 189, 248, 0.7)'); // Outer structural shield
    domeGrad.addColorStop(1, 'rgba(30, 41, 59, 0.9)');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(domeX, domeY, 12, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Solar array wings
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(domeX - 28, domeY + 1, 10, 4);
    ctx.fillRect(domeX + 18, domeY + 1, 10, 4);

    // Antenna Mast
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(domeX, domeY - 12);
    ctx.lineTo(domeX, domeY - 24);
    ctx.stroke();

    // Beacon Light
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(domeX, domeY - 25, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    scene.textures.addCanvas(key, canvas);
    return key;
  }

  /**
   * Generates a rich, textured top-down Mars ground terrain
   * with soil noise, impact craters, basalt rocks, and rocket landing scorch marks.
   */
  public static generateMarsGroundTerrain(scene: Phaser.Scene, key = 'mars_ground_terrain', width = 2400, height = 1600): string {
    if (scene.textures.exists(key)) return key;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return key;

    // Base Martian iron oxide gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#933a17');
    grad.addColorStop(0.5, '#ab441d');
    grad.addColorStop(1, '#853012');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle soil texture noise
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const s = Math.random() * 3 + 1;
      const c = Math.random() < 0.5 ? 'rgba(70, 20, 8, 0.4)' : 'rgba(230, 110, 50, 0.25)';
      ctx.fillStyle = c;
      ctx.fillRect(x, y, s, s);
    }

    // Impact craters with rim highlights
    for (let c = 0; c < 35; c++) {
      const cx = (Math.sin(c * 17.3) * 0.5 + 0.5) * width;
      const cy = (Math.cos(c * 13.7) * 0.5 + 0.5) * height;
      const r = 15 + (c % 8) * 12;

      // Dark shadow depression
      const cg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
      cg.addColorStop(0, 'rgba(40, 12, 5, 0.85)');
      cg.addColorStop(0.8, 'rgba(65, 22, 10, 0.5)');
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Sunlit rim arc
      ctx.strokeStyle = 'rgba(255, 140, 70, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 1.8);
      ctx.stroke();
    }

    // Scattered Martian basalt rocks
    for (let r = 0; r < 120; r++) {
      const rx = (Math.sin(r * 5.1) * 0.5 + 0.5) * width;
      const ry = (Math.cos(r * 3.9) * 0.5 + 0.5) * height;
      const size = 3 + (r % 5) * 2;
      ctx.fillStyle = 'rgba(45, 15, 8, 0.8)';
      ctx.beginPath();
      ctx.arc(rx, ry, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240, 140, 90, 0.35)';
      ctx.beginPath();
      ctx.arc(rx - 1, ry - 1, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rocket Lander Touchdown Zone (scorch marks & landing pad)
    const landX = 420;
    const landY = 820;

    // Thruster burn blast ring
    const burnGrad = ctx.createRadialGradient(landX, landY, 20, landX, landY, 180);
    burnGrad.addColorStop(0, 'rgba(20, 8, 5, 0.95)');
    burnGrad.addColorStop(0.4, 'rgba(45, 15, 8, 0.7)');
    burnGrad.addColorStop(0.8, 'rgba(90, 30, 15, 0.3)');
    burnGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = burnGrad;
    ctx.beginPath();
    ctx.arc(landX, landY, 180, 0, Math.PI * 2);
    ctx.fill();

    // Radial thruster plume streaks
    ctx.strokeStyle = 'rgba(25, 8, 4, 0.6)';
    ctx.lineWidth = 3;
    for (let a = 0; a < 16; a++) {
      const angle = (a / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(landX + Math.cos(angle) * 30, landY + Math.sin(angle) * 30);
      ctx.lineTo(landX + Math.cos(angle) * 160, landY + Math.sin(angle) * 160);
      ctx.stroke();
    }

    // Landing footprint pads
    ctx.fillStyle = '#475569';
    for (let p = 0; p < 4; p++) {
      const pa = (p / 4) * Math.PI * 2 + Math.PI / 4;
      const px = landX + Math.cos(pa) * 65;
      const py = landY + Math.sin(pa) * 65;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    scene.textures.addCanvas(key, canvas);
    return key;
  }
}

