/**
 * Mars Orbital Map & Fast Travel Modal
 * Activated by pressing 'M' or clicking the HUD Map button.
 * Displays holographic Mars satellite orbital map with interactive sector waypoints
 * allowing instant sub-orbital fast travel across Gale Crater sectors and previewing
 * distant expedition regions (Arcadia Planitia, Jezero Crater).
 */

import Phaser from 'phaser';
import { soundFx } from '../utils/ProceduralAudio';

export interface FastTravelPoint {
  id: string;
  name: string;
  region: string;
  coordText: string;
  targetX?: number;
  targetY?: number;
  isUnlocked: boolean;
  mapPinX: number;
  mapPinY: number;
  desc: string;
}

export class MarsMapModal extends Phaser.GameObjects.Container {
  private onCloseCallback: () => void;
  private onTeleportCallback: (x: number, y: number, locName: string) => void;

  private waypoints: FastTravelPoint[] = [
    {
      id: 'landing_pad',
      name: 'Ares Rocket Landing Pad',
      region: 'GALE CRATER // EAST SECTOR',
      coordText: 'LAT -5.38° LON 137.84°',
      targetX: 2450,
      targetY: 1480,
      isUnlocked: true,
      mapPinX: 740,
      mapPinY: 480,
      desc: 'Touchdown site of the Ares single-stage lander and cargo depot.'
    },
    {
      id: 'central_hab',
      name: 'Central Habitat & Command Core',
      region: 'GALE CRATER // CENTRAL SECTOR',
      coordText: 'LAT -5.36° LON 137.82°',
      targetX: 1600,
      targetY: 1170,
      isUnlocked: true,
      mapPinX: 620,
      mapPinY: 420,
      desc: 'Pressurized crew living quarters, ECLSS life support, and airlocks.'
    },
    {
      id: 'greenhouse',
      name: 'Biosphere Greenhouse Dome',
      region: 'GALE CRATER // WEST SECTOR',
      coordText: 'LAT -5.34° LON 137.79°',
      targetX: 750,
      targetY: 1040,
      isUnlocked: true,
      mapPinX: 480,
      mapPinY: 400,
      desc: 'Geodesic glass dome cultivating aeroponic algae and dwarf wheat.'
    },
    {
      id: 'solar_yard',
      name: 'Photovoltaic Solar & Kilopower Farm',
      region: 'GALE CRATER // NORTH-WEST SECTOR',
      coordText: 'LAT -5.32° LON 137.78°',
      targetX: 650,
      targetY: 490,
      isUnlocked: true,
      mapPinX: 460,
      mapPinY: 300,
      desc: 'Multi-tracker solar field and power regulation junction.'
    },
    {
      id: 'science_lab',
      name: 'Subsurface Geology Lab & Drill Rig',
      region: 'GALE CRATER // SOUTH SECTOR',
      coordText: 'LAT -5.40° LON 137.82°',
      targetX: 1550,
      targetY: 1820,
      isUnlocked: true,
      mapPinX: 610,
      mapPinY: 550,
      desc: 'Deep percussive core drill apparatus and XRD spectrometry module.'
    },
    {
      id: 'high_gain',
      name: 'High-Gain Earth Relay Antenna',
      region: 'GALE CRATER // NORTH-EAST RIDGE',
      coordText: 'LAT -5.31° LON 137.86°',
      targetX: 2150,
      targetY: 530,
      isUnlocked: true,
      mapPinX: 700,
      mapPinY: 290,
      desc: '34m parabolic antenna with direct carrier lock to Earth DSN.'
    },
    {
      id: 'arcadia_site',
      name: 'Arcadia Planitia (Cryo-ISRU)',
      region: 'NORTHERN LOWLANDS',
      coordText: 'LAT 46.7°N LON 168.0°W (4,180 KM)',
      isUnlocked: false,
      mapPinX: 240,
      mapPinY: 220,
      desc: 'Vast subsurface glacial ice sheets. Unlocks in Act II via LREV Rover.'
    },
    {
      id: 'jezero_site',
      name: 'Jezero Crater Ancient River Delta',
      region: 'ISIDIS BASIN MARGIN',
      coordText: 'LAT 18.38°N LON 77.58°E (3,790 KM)',
      isUnlocked: false,
      mapPinX: 860,
      mapPinY: 260,
      desc: 'Stratified fossil river delta scarp. Unlocks in Act IV for biosignature search.'
    }
  ];

  constructor(
    scene: Phaser.Scene,
    onTeleport: (x: number, y: number, locName: string) => void,
    onClose: () => void
  ) {
    super(scene, 960, 540);
    this.onTeleportCallback = onTeleport;
    this.onCloseCallback = onClose;

    this.createMapUI();
    scene.add.existing(this);
    this.setDepth(500);

    // Listen for close keys (M or ESC)
    scene.input.keyboard?.once('keydown-M', () => this.close());
    scene.input.keyboard?.once('keydown-ESC', () => this.close());
  }

  private createMapUI() {
    // 1. Dark Screen Overlay Blocker
    const blocker = this.scene.add.rectangle(0, 0, 1920, 1080, 0x02050c, 0.88)
      .setInteractive();
    this.add(blocker);

    // 2. Holographic Map Main Panel
    const panelW = 1420;
    const panelH = 820;
    const panel = this.scene.add.rectangle(0, 0, panelW, panelH, 0x050d1a, 0.96)
      .setStrokeStyle(2, 0x38bdf8, 0.85);
    this.add(panel);

    // Map Header Bar
    const headerBg = this.scene.add.rectangle(0, -panelH / 2 + 36, panelW - 4, 68, 0x081528, 0.95);
    const headerTitle = this.scene.add.text(-panelW / 2 + 32, -panelH / 2 + 22, 'NASA / ARES-V ORBITAL RECONNAISSANCE SATELLITE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '18px',
      color: '#38bdf8',
      letterSpacing: 4
    });

    const headerSub = this.scene.add.text(-panelW / 2 + 32, -panelH / 2 + 46, 'TOPOGRAPHIC GEODETIC SCANNER // SELECT SECTOR WAYPOINT TO FAST TRAVEL', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#94a3b8',
      letterSpacing: 2
    });

    this.add([headerBg, headerTitle, headerSub]);

    // 3. Orbital Mars Map Viewport (Left Area)
    const mapBoxW = 880;
    const mapBoxH = 680;
    const mapBoxX = -panelW / 2 + 40 + mapBoxW / 2;
    const mapBoxY = 40;

    const mapBox = this.scene.add.rectangle(mapBoxX, mapBoxY, mapBoxW, mapBoxH, 0x020712)
      .setStrokeStyle(1.5, 0x38bdf8, 0.6);
    this.add(mapBox);

    // Placeholder Mars Orbital Texture
    if (this.scene.textures.exists('mars_menu_realistic')) {
      const marsImg = this.scene.add.image(mapBoxX, mapBoxY, 'mars_menu_realistic')
        .setDisplaySize(mapBoxW - 4, mapBoxH - 4)
        .setAlpha(0.65);
      this.add(marsImg);
    }

    // Grid scan lines over the map
    const grid = this.scene.add.graphics();
    grid.lineStyle(1, 0x38bdf8, 0.2);
    for (let gx = -mapBoxW / 2; gx <= mapBoxW / 2; gx += 80) {
      grid.moveTo(mapBoxX + gx, mapBoxY - mapBoxH / 2);
      grid.lineTo(mapBoxX + gx, mapBoxY + mapBoxH / 2);
    }
    for (let gy = -mapBoxH / 2; gy <= mapBoxH / 2; gy += 80) {
      grid.moveTo(mapBoxX - mapBoxW / 2, mapBoxY + gy);
      grid.lineTo(mapBoxX + mapBoxW / 2, mapBoxY + gy);
    }
    grid.stroke();
    this.add(grid);

    // Orbital Coordinates HUD badge
    const coordsBadge = this.scene.add.text(mapBoxX - mapBoxW / 2 + 16, mapBoxY - mapBoxH / 2 + 16, 'ORBITAL ALTITUDE: 420 KM // SENSOR RES: 0.25M/PX\nGALE CRATER QUADRANGLE [MC-23]', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#38bdf8',
      backgroundColor: '#040914'
    });
    this.add(coordsBadge);

    // 4. Waypoint Pin & Fast Travel Cards on the Right
    const listX = panelW / 2 - 230;
    const listStartY = -260;

    this.waypoints.forEach((wp, idx) => {
      // Map Pin on the orbital map
      const pinX = mapBoxX - mapBoxW / 2 + (wp.mapPinX * mapBoxW) / 1000;
      const pinY = mapBoxY - mapBoxH / 2 + (wp.mapPinY * mapBoxH) / 700;

      const pinRing = this.scene.add.circle(pinX, pinY, 12, wp.isUnlocked ? 0x10b981 : 0x64748b, 0.35)
        .setStrokeStyle(1.5, wp.isUnlocked ? 0x34d399 : 0x94a3b8);
      const pinDot = this.scene.add.circle(pinX, pinY, 4, wp.isUnlocked ? 0x34d399 : 0x94a3b8);

      const pinLabel = this.scene.add.text(pinX + 16, pinY - 8, wp.name, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '10px',
        color: wp.isUnlocked ? '#34d399' : '#94a3b8',
        backgroundColor: '#060d1a'
      });

      this.add([pinRing, pinDot, pinLabel]);

      if (wp.isUnlocked) {
        this.scene.tweens.add({
          targets: pinRing,
          scale: { from: 0.9, to: 1.4 },
          alpha: { from: 0.5, to: 0.1 },
          duration: 1400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }

      // Waypoint List Card on the right
      const cardY = listStartY + idx * 72;
      const cardBg = this.scene.add.rectangle(listX, cardY, 420, 60, wp.isUnlocked ? 0x091b32 : 0x070e1c, 0.9)
        .setStrokeStyle(1, wp.isUnlocked ? 0x38bdf8 : 0x334155, wp.isUnlocked ? 0.75 : 0.4)
        .setInteractive({ useHandCursor: wp.isUnlocked });

      const cardTitle = this.scene.add.text(listX - 195, cardY - 18, wp.name.toUpperCase(), {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '11px',
        color: wp.isUnlocked ? '#f0f9ff' : '#64748b',
        letterSpacing: 1
      });

      const cardSub = this.scene.add.text(listX - 195, cardY + 2, `${wp.region} • ${wp.coordText}`, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '9px',
        color: wp.isUnlocked ? '#38bdf8' : '#475569'
      });

      const btnTravel = this.scene.add.text(listX + 140, cardY, wp.isUnlocked ? 'TRAVEL →' : 'LOCKED', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '10px',
        color: wp.isUnlocked ? '#34d399' : '#64748b'
      }).setOrigin(0.5);

      if (wp.isUnlocked && wp.targetX !== undefined && wp.targetY !== undefined) {
        cardBg.on('pointerover', () => {
          cardBg.setFillStyle(0x133866, 0.95);
          soundFx.playClick(1000);
        });

        cardBg.on('pointerout', () => {
          cardBg.setFillStyle(0x091b32, 0.9);
        });

        const doFastTravel = () => {
          soundFx.playTelemetryChirp();
          this.onTeleportCallback(wp.targetX!, wp.targetY!, wp.name);
          this.close();
        };

        cardBg.on('pointerdown', doFastTravel);
        pinRing.setInteractive({ useHandCursor: true });
        pinRing.on('pointerdown', doFastTravel);
      }

      this.add([cardBg, cardTitle, cardSub, btnTravel]);
    });

    // 5. Close Button
    const closeBtn = this.scene.add.rectangle(panelW / 2 - 60, -panelH / 2 + 36, 120, 36, 0x111827, 0.9)
      .setStrokeStyle(1.5, 0xef4444)
      .setInteractive({ useHandCursor: true });

    const closeTxt = this.scene.add.text(panelW / 2 - 60, -panelH / 2 + 36, 'CLOSE [M]', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#ef4444',
      letterSpacing: 2
    }).setOrigin(0.5);

    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0xef4444, 0.25));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x111827, 0.9));
    closeBtn.on('pointerdown', () => this.close());

    this.add([closeBtn, closeTxt]);
  }

  public close() {
    soundFx.playClick(600);
    this.onCloseCallback();
    this.destroy();
  }
}
