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
}

