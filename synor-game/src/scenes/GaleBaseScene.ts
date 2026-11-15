/**
 * Gale Crater Base Scene (Act I Prologue & Act III Return)
 * Authentic 2.5D Pixel-Art Isometric Mars Outpost:
 * - Expansive 3200 x 2000 Gale Crater map at the base of Mount Sharp.
 * - Dynamic camera follow tracking the astronaut.
 * - Screen-space cardinal W/A/S/D & Arrow Key movement with 4-way animations:
 *   Walk-Front (Down), Walk-Back (Up), Walk-Right, Walk-Left (mirrored from Walk-Right), and Idle-Front.
 * - Individual high-resolution transparent building and structure sprites (NO cutoffs, NO square crops).
 * - Proper 2.5D isometric depth sorting (astronaut renders behind buildings when north, in front when south).
 * - Solid ground-foundation collision boundaries preventing player from walking through buildings or domes.
 * - Mars Orbital Map modal (Press 'M' or click HUD button) with instant fast-travel across base sectors.
 */

import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { soundFx } from '../utils/ProceduralAudio';
import { audioManager } from '../state/AudioManager';
import { MarsMapModal } from '../ui/MarsMapModal';

interface OutpostNode {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  radius: number;
  desc: string;
  onCommission: () => void;
}

export class GaleBaseScene extends Phaser.Scene {
  private astronaut!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private lastDirection: 'down' | 'up' | 'left' | 'right' = 'down';
  private lastFootstepTime = 0;

  private interactionPrompt!: Phaser.GameObjects.Container;
  private interactionPromptText!: Phaser.GameObjects.Text;
  private activeNearNode: OutpostNode | null = null;
  private actionDialogContainer: Phaser.GameObjects.Container | null = null;

  private activeMapModal: MarsMapModal | null = null;
  private statusBanner!: Phaser.GameObjects.Text;
  private fastTravelToast!: Phaser.GameObjects.Container;
  private fastTravelToastText!: Phaser.GameObjects.Text;
  private nodeMarkers: Phaser.GameObjects.Container[] = [];

  // 3200 x 2000 Expansive Gale Crater Sector Coordinates
  private outpostNodes: OutpostNode[] = [
    {
      id: 'landing_pad',
      name: 'Ares Descent Rocket Lander',
      category: 'LANDING PLATFORM',
      x: 2450,
      y: 1480,
      radius: 170,
      desc: 'The single-stage Ares lander and primary cargo platform that brought you through atmospheric entry to Gale Crater. Inspect methalox descent fuel cells and telemetry avionics.',
      onCommission: () => {
        gameState.resources.shelterProtection = Math.min(100, gameState.resources.shelterProtection + 10);
        gameState.addLog('ARES LANDER: Touchdown telemetry verified. Ascent avionics powered to warm standby.', 'system');
      }
    },
    {
      id: 'central_hab',
      name: 'Central Habitat Station',
      category: 'LIVING QUARTERS',
      x: 1600,
      y: 1170,
      radius: 170,
      desc: 'Modular crew living quarters, ECLSS life support hub, and pressurized dual airlocks. Verify internal cabin pressure at 101.3 kPa and activate Sabatier CO2 scrubbers.',
      onCommission: () => {
        gameState.resources.airReserve = Math.min(100, gameState.resources.airReserve + 15);
        gameState.hazards.co2Ppm = 410;
        gameState.addLog('CENTRAL HAB: Atmospheric envelope sealed at 101.3 kPa. Sabatier scrubbers operational.', 'system');
      }
    },
    {
      id: 'greenhouse_dome',
      name: 'Biosphere Greenhouse Dome',
      category: 'PRIMARY DOME',
      x: 750,
      y: 1040,
      radius: 180,
      desc: 'Pressurized geodesic greenhouse dome cultivating spirulina algae and dwarf wheat. Regenerates closed-loop atmospheric O2 and emergency food rations.',
      onCommission: () => {
        gameState.resources.food = Math.min(100, gameState.resources.food + 20);
        gameState.resources.airReserve = Math.min(100, gameState.resources.airReserve + 10);
        gameState.addLog('GREENHOUSE DOME: Photosynthetic scrubbers active. O2 output +15%, Food reserves secured.', 'science');
      }
    },
    {
      id: 'rover_hangar',
      name: 'Expedition Rover Hangar',
      category: 'VEHICLE DEPOT',
      x: 1100,
      y: 1170,
      radius: 170,
      desc: 'Pressurized rover servicing hangar and charging bay. Inspect drive bogies, solar tracking batteries, and sample drill equipment.',
      onCommission: () => {
        gameState.resources.shelterProtection = Math.min(100, gameState.resources.shelterProtection + 10);
        gameState.addLog('ROVER HANGAR: LREV Rover systems diagnostics green. Autonomous charging active.', 'system');
      }
    },
    {
      id: 'solar_yard',
      name: 'Photovoltaic Solar & Kilopower Yard',
      category: 'POWER GRID',
      x: 650,
      y: 490,
      radius: 170,
      desc: 'High-efficiency multi-junction solar array and power routing junction. Synchronize battery capacitor charging lines to power all base sectors.',
      onCommission: () => {
        gameState.resources.power = Math.min(100, gameState.resources.power + 25);
        gameState.addLog('SOLAR ARRAY: Photovoltaic panels linked to main bus. Battery banks at maximum charge.', 'system');
      }
    },
    {
      id: 'science_lab',
      name: 'Subsurface Science Module & Drill Rig',
      category: 'LABORATORY',
      x: 1550,
      y: 1820,
      radius: 170,
      desc: 'Analytical laboratory for processing Martian regolith, XRD spectroscopy, and calibrating expedition drilling tools for Act II expedition.',
      onCommission: () => {
        gameState.resources.waterReserve = Math.min(100, gameState.resources.waterReserve + 10);
        gameState.addLog('SCIENCE MODULE: Mass spectrometer calibrated. Ready for Arcadia cryo-ISRU analysis.', 'science');
      }
    },
    {
      id: 'high_gain',
      name: 'High-Gain Earth Relay Antenna',
      category: 'TELEMETRY',
      x: 2150,
      y: 530,
      radius: 170,
      desc: 'Parabolic telemetry dish pointing to Earth Deep Space Network (DSN) Goldstone station to establish high-bandwidth interplanetary uplink.',
      onCommission: () => {
        gameState.dsnLocked = true;
        gameState.addLog('DSN ANTENNA: 34m Earth link carrier acquired. Houston confirms Act II mission orders.', 'capcom');
      }
    },
    {
      id: 'gale_strata',
      name: 'Mount Sharp Murray Strata',
      category: 'GALE GEOLOGY',
      x: 1150,
      y: 1580,
      radius: 160,
      desc: 'Stepped sedimentary mudstone outcrop at the base of Mount Sharp. Analyze hydrated sulfate/clay mineral strata with laser-induced breakdown spectroscopy.',
      onCommission: () => {
        gameState.resources.shelterProtection = Math.min(100, gameState.resources.shelterProtection + 5);
        gameState.addLog('GALE STRATA: Layered clay/sulfate beds confirmed. Ancient lacustrine lake sediment logged.', 'science');
      }
    },
    {
      id: 'crater_depression',
      name: 'Gale Impact Depression & Scree',
      category: 'CRATER MORPHOLOGY',
      x: 2750,
      y: 810,
      radius: 160,
      desc: 'Secondary impact crater depression with basaltic scree and overturned bedrock. Measure shock metamorphism and regolith porosity.',
      onCommission: () => {
        gameState.resources.waterReserve = Math.min(100, gameState.resources.waterReserve + 5);
        gameState.addLog('CRATER DEPRESSION: Subsurface mineral moisture detected beneath impact breccia.', 'science');
      }
    }
  ];

  constructor() {
    super({ key: 'GaleBaseScene' });
  }

  create() {
    const worldW = 3200;
    const worldH = 2000;

    // 1. World & Camera Physics Setup
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // 2. Clean 3200 x 2000 Gale Crater Martian Surface Backdrop (Zero baked buildings, zero black lines)
    const bg = this.add.image(worldW / 2, worldH / 2, 'mars_gale_crater_clean');
    bg.setDisplaySize(worldW, worldH);
    bg.setDepth(0);

    // 3. Collision Obstacles Group
    this.obstacles = this.physics.add.staticGroup();

    // 4. Place Modular Transparent Outpost Structures & Equipment
    this.createOutpostStructures();

    // 5. Interactive Base Nodes & Waypoint Rings
    this.createInteractiveNodes();

    // 6. Astronaut Player Character (Spawns at Ares Rocket Landing Pad)
    this.createAstronautCharacter();

    // Camera smoothly follows astronaut
    this.cameras.main.startFollow(this.astronaut, true, 0.08, 0.08);

    // 7. Input Controls (WASD, Arrows, E, Space, M)
    this.setupControls();

    // 8. UI Components: Proximity Prompt, Screen HUD, Fast-Travel Toast
    this.createProximityPrompt();
    this.createScreenHUD();
    this.createFastTravelToast();

    // Ambient Atmosphere & Continuous In-Game Music Loop ('warm marimba')
    audioManager.playMusic(this, 'music_game', { loop: true, fadeIn: 800 });
    soundFx.startSpaceAtmosphereDrone();

    // Check Act III return
    if (gameState.currentChapter === 'act_3_gale_return') {
      this.createAct3Upgrades();
    }
  }

  /**
   * Places transparent, high-resolution modular outpost structures,
   * sets their visual depths to their ground footprint base,
   * and builds solid physics collision boundaries around them.
   */
  private createOutpostStructures() {
    // 1. Biosphere Greenhouse Dome (West Sector)
    // Visual position: (750, 850), scale 0.7 (458 x 465)
    // Base foundation touches ground at y ~ 1040. Depth set to ground contact.
    const dome = this.add.image(750, 850, 'outpost_dome').setScale(0.7);
    dome.setDepth(1060);
    // Complete solid physical collider covering entire dome footprint (cannot walk into or over dome)
    this.addStaticObstacle(750, 880, 430, 300);

    // 2. Ares Rocket Lander on Landing Platform (East Sector)
    // Visual position: (2450, 1300), scale 0.8 (386 x 400)
    const rocket = this.add.image(2450, 1300, 'outpost_rocket').setScale(0.8);
    rocket.setDepth(1480);
    // Solid platform collider
    this.addStaticObstacle(2450, 1360, 350, 240);

    // 3. Central Habitat Station (Central Sector)
    // Visual position: (1600, 1000), scale 0.7 (370 x 465)
    const hab = this.add.image(1600, 1000, 'outpost_hab').setScale(0.7);
    hab.setDepth(1220);
    this.addStaticObstacle(1600, 1040, 370, 270);

    // 4. Expedition Rover Hangar & Garage (Central-West Sector)
    // Visual position: (1100, 1000), scale 0.65 (445 x 431)
    const hangar = this.add.image(1100, 1000, 'outpost_hangar').setScale(0.65);
    hangar.setDepth(1200);
    this.addStaticObstacle(1100, 1040, 420, 270);

    // 5. Subsurface Science Module & Drill Rig (South Sector)
    // Visual position: (1550, 1650), scale 0.65 (426 x 431)
    const science = this.add.image(1550, 1650, 'outpost_science').setScale(0.65);
    science.setDepth(1850);
    this.addStaticObstacle(1550, 1690, 400, 270);

    // 6. Photovoltaic Solar Array (North-West Sector)
    // Visual position: (650, 380), scale 0.9 (264 x 220)
    const solar = this.add.image(650, 380, 'outpost_solar').setScale(0.9);
    solar.setDepth(490);
    this.addStaticObstacle(650, 400, 270, 170);

    // Power Box beside solar panels
    const powerBox = this.add.image(500, 420, 'outpost_powerbox').setScale(0.5);
    powerBox.setDepth(490);
    this.addStaticObstacle(500, 420, 70, 60);

    // 7. High-Gain Earth Relay Parabolic Dish (North-East Sector)
    // Visual position: (2150, 380), scale 0.75 (227 x 361)
    const relay = this.add.image(2150, 380, 'outpost_dish').setScale(0.75);
    relay.setDepth(560);
    this.addStaticObstacle(2150, 440, 210, 190);

    // 8. Observation & Weather Tower (East Horizon Ridge)
    const tower = this.add.image(2600, 400, 'outpost_tower').setScale(0.65);
    tower.setDepth(615);
    this.addStaticObstacle(2600, 470, 210, 210);

    // 9. Medical Bay Facility (Central-East Sector)
    const medBay = this.add.image(2050, 980, 'outpost_medbay').setScale(0.75);
    medBay.setDepth(1110);
    this.addStaticObstacle(2050, 1010, 290, 190);

    // 10. Vehicles & Ground Equipment
    // Rover vehicle near hangar
    const rover = this.add.image(1220, 1050, 'outpost_rover').setScale(0.35);
    rover.setDepth(1060);
    this.addStaticObstacle(1220, 1055, 110, 60);

    // Heavy Haul Truck near Science Lab
    const truck = this.add.image(1380, 1680, 'outpost_truck').setScale(0.4);
    truck.setDepth(1690);
    this.addStaticObstacle(1380, 1685, 120, 60);

    // Cargo Supply Crates near Rocket Pad
    const crates = this.add.image(2280, 1370, 'outpost_crates').setScale(0.45);
    crates.setDepth(1380);
    this.addStaticObstacle(2280, 1375, 120, 60);

    // Fuel Canisters
    const fuel = this.add.image(2620, 1350, 'outpost_fuel').setScale(0.45);
    fuel.setDepth(1360);
    this.addStaticObstacle(2620, 1355, 90, 50);

    // 11. Geological Formations (Rock Butte & Mountain Outcrops)
    // Mount Sharp Sedimentary Strata Butte
    const butte = this.add.image(1150, 1450, 'outpost_butte').setScale(0.85);
    butte.setDepth(1520);
    this.addStaticObstacle(1150, 1490, 300, 140);

    // Basalt Mountain Outcrop
    const rockMtn = this.add.image(2750, 720, 'outpost_rockmtn').setScale(0.8);
    rockMtn.setDepth(760);
    this.addStaticObstacle(2750, 740, 240, 100);

    // Subsurface Ice Crystal Outcrop
    const ice = this.add.image(850, 1650, 'outpost_ice').setScale(0.7);
    ice.setDepth(1670);
    this.addStaticObstacle(850, 1660, 100, 60);

    // 12. World Boundary Colliders
    // North: Mount Sharp horizon & starry sky
    this.addStaticObstacle(1600, 130, 3200, 260);
    // South: Outer crater ridge
    this.addStaticObstacle(1600, 1960, 3200, 80);
    // West & East edge boundaries
    this.addStaticObstacle(25, 1000, 50, 2000);
    this.addStaticObstacle(3175, 1000, 50, 2000);
  }

  private addStaticObstacle(x: number, y: number, width: number, height: number) {
    const obs = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.physics.add.existing(obs, true);
    this.obstacles.add(obs);
  }

  private createAstronautCharacter() {
    // Spawn astronaut on the open pathway near the rocket landing pad
    const spawnX = 2450;
    const spawnY = 1490;

    this.astronaut = this.physics.add.sprite(spawnX, spawnY, 'astronaut_iso', 0);
    this.astronaut.setScale(1.25);
    this.astronaut.setDepth(this.astronaut.y);
    this.astronaut.setCollideWorldBounds(true);

    // Tight foot-level collision box: 24x18 pixels centered strictly at boots
    this.astronaut.body.setSize(24, 18);
    this.astronaut.body.setOffset(20, 74);

    // Collide with obstacles
    this.physics.add.collider(this.astronaut, this.obstacles);

    if (this.anims.exists('astro_idle')) {
      this.astronaut.play('astro_idle');
    }
  }

  private setupControls() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyM = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const onInteract = () => {
      if (this.activeMapModal || this.actionDialogContainer) return;
      if (this.activeNearNode) {
        soundFx.playClick(1100);
        this.openNodeDialog(this.activeNearNode);
      }
    };

    this.keyE.on('down', onInteract);
    this.keySpace.on('down', onInteract);

    // Press 'M' to toggle Mars Orbital Map & Fast Travel
    this.keyM.on('down', () => this.toggleMapModal());
  }

  public toggleMapModal() {
    if (this.actionDialogContainer) return;

    if (this.activeMapModal) {
      this.activeMapModal.close();
      this.activeMapModal = null;
      return;
    }

    this.astronaut.setVelocity(0, 0);

    this.activeMapModal = new MarsMapModal(
      this,
      (targetX: number, targetY: number, locName: string) => {
        this.teleportAstronaut(targetX, targetY, locName);
      },
      () => {
        this.activeMapModal = null;
      }
    );
  }

  private teleportAstronaut(x: number, y: number, locName: string) {
    if (this.activeMapModal) {
      this.activeMapModal.close();
      this.activeMapModal = null;
    }

    // Teleport astronaut
    this.astronaut.setPosition(x, y);
    this.astronaut.setVelocity(0, 0);
    this.astronaut.setDepth(this.astronaut.y);

    // Audio SFX: Teleport warp ignition + pop + flash
    audioManager.playSfx(this, 'sfx_teleport_warp', { volume: 0.85 });
    audioManager.playSfx(this, 'sfx_teleport_pop', { volume: 0.7 });
    this.cameras.main.flash(350, 56, 189, 248);
    this.cameras.main.pan(x, y, 400, 'Sine.easeOut');

    // Show on-screen notification
    this.showFastTravelToast(`FAST TRAVEL COMPLETE // ${locName.toUpperCase()}`);
  }

  private createInteractiveNodes() {
    this.nodeMarkers.forEach(m => m.destroy());
    this.nodeMarkers = [];

    this.outpostNodes.forEach(node => {
      const isDone = gameState.galeCommissionedNodes.includes(node.id);

      const marker = this.add.container(node.x, node.y);
      marker.setDepth(node.y + 10);

      // Pulse ring
      const ring = this.add.circle(0, 0, 32, isDone ? 0x10b981 : 0x0284c7, 0.28)
        .setStrokeStyle(2, isDone ? 0x34d399 : 0x38bdf8);

      const icon = this.add.text(0, 0, isDone ? '✓' : '⚡', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '15px',
        color: isDone ? '#34d399' : '#38bdf8'
      }).setOrigin(0.5);

      const label = this.add.text(0, 42, node.name.toUpperCase(), {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: isDone ? '#34d399' : '#ffffff',
        backgroundColor: '#070f1e'
      }).setOrigin(0.5);

      marker.add([ring, icon, label]);
      this.nodeMarkers.push(marker);

      // Smooth pulsing tween
      this.tweens.add({
        targets: ring,
        scale: { from: 0.95, to: 1.18 },
        alpha: { from: 0.25, to: 0.55 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Interactive pointer trigger
      ring.setInteractive({ useHandCursor: true });
      ring.on('pointerover', () => {
        audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.4 });
      });
      ring.on('pointerdown', () => {
        if (!this.activeMapModal && !this.actionDialogContainer) {
          audioManager.playSfx(this, 'sfx_ui_click', { volume: 0.7 });
          this.openNodeDialog(node);
        }
      });
    });
  }

  private createProximityPrompt() {
    this.interactionPrompt = this.add.container(0, 0).setDepth(3000);
    this.interactionPrompt.setVisible(false);

    const bg = this.add.rectangle(0, 0, 340, 36, 0x071120, 0.95)
      .setStrokeStyle(1.5, 0x38bdf8, 0.9);

    this.interactionPromptText = this.add.text(0, 0, '[E] INTERACT WITH MODULE', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.interactionPrompt.add([bg, this.interactionPromptText]);
  }

  private createScreenHUD() {
    const hud = this.add.container(0, 0).setScrollFactor(0).setDepth(4000);

    // Top Mission Status Banner
    const isAct3 = gameState.currentChapter === 'act_3_gale_return';
    const headerTitle = isAct3
      ? 'ACT III: GALE CRATER BASE // INGESTING ARCADIA WATER ICE DATA'
      : 'ACT I: GALE CRATER OUTPOST // COLONIZATION BASE COMMISSIONING';

    const hBg = this.add.rectangle(960, 68, 1020, 42, 0x070e1c, 0.92)
      .setStrokeStyle(1.5, 0x38bdf8, 0.8);

    const hTitle = this.add.text(960, 58, headerTitle, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.statusBanner = this.add.text(960, 78, '', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '11px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    // Fast Travel Map Shortcut Button in top-right HUD
    const mapBtnW = 260;
    const mapBtnH = 38;
    const mapBtnX = 1750;
    const mapBtnY = 68;

    const mapBtnBg = this.add.rectangle(mapBtnX, mapBtnY, mapBtnW, mapBtnH, 0x0a192f, 0.9)
      .setStrokeStyle(1.5, 0x38bdf8, 0.9)
      .setInteractive({ useHandCursor: true });

    const mapBtnText = this.add.text(mapBtnX, mapBtnY, '🗺️ [M] ORBITAL MAP', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#38bdf8',
      letterSpacing: 2
    }).setOrigin(0.5);

    mapBtnBg.on('pointerover', () => {
      mapBtnBg.setFillStyle(0x13385e, 0.95);
      mapBtnText.setColor('#ffffff');
      audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.45 });
    });
    mapBtnBg.on('pointerout', () => {
      mapBtnBg.setFillStyle(0x0a192f, 0.9);
      mapBtnText.setColor('#38bdf8');
    });
    mapBtnBg.on('pointerdown', () => {
      audioManager.playSfx(this, 'sfx_ui_click', { volume: 0.7 });
      this.toggleMapModal();
    });

    // Bottom Controls Hint Bar
    const controlsBg = this.add.rectangle(960, 1020, 880, 30, 0x070e1c, 0.92)
      .setStrokeStyle(1, 0x334155);
    const controlsText = this.add.text(
      960,
      1020,
      '[WASD / ARROWS] EXPLORE  •  [E / SPACE] INTERACT  •  [M] FAST TRAVEL MAP',
      {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: '#38bdf8',
        letterSpacing: 2
      }
    ).setOrigin(0.5);

    hud.add([hBg, hTitle, this.statusBanner, mapBtnBg, mapBtnText, controlsBg, controlsText]);
    this.updateStatusBanner();
  }

  private createFastTravelToast() {
    this.fastTravelToast = this.add.container(960, 140).setScrollFactor(0).setDepth(4500);
    this.fastTravelToast.setAlpha(0);

    const toastBg = this.add.rectangle(0, 0, 680, 40, 0x06152a, 0.96)
      .setStrokeStyle(2, 0x38bdf8, 0.9);

    this.fastTravelToastText = this.add.text(0, 0, '', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#38bdf8',
      letterSpacing: 3
    }).setOrigin(0.5);

    this.fastTravelToast.add([toastBg, this.fastTravelToastText]);
  }

  private showFastTravelToast(msg: string) {
    this.fastTravelToastText.setText(msg);
    this.tweens.killTweensOf(this.fastTravelToast);
    this.fastTravelToast.setAlpha(0);
    this.fastTravelToast.setY(120);

    this.tweens.add({
      targets: this.fastTravelToast,
      alpha: 1,
      y: 140,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(2200, () => {
          this.tweens.add({
            targets: this.fastTravelToast,
            alpha: 0,
            y: 120,
            duration: 400,
            ease: 'Power2'
          });
        });
      }
    });
  }

  update(time: number) {
    if (!this.astronaut || this.actionDialogContainer || this.activeMapModal) {
      if (this.astronaut) this.astronaut.setVelocity(0, 0);
      return;
    }

    // Screen-Space Cardinal Movement (W=Up, S=Down, A=Left, D=Right)
    let vx = 0;
    let vy = 0;
    let movingDir: 'down' | 'up' | 'left' | 'right' | null = null;

    if (this.cursors.left.isDown || this.keyA.isDown) {
      vx -= 1;
      movingDir = 'left';
    } else if (this.cursors.right.isDown || this.keyD.isDown) {
      vx += 1;
      movingDir = 'right';
    }

    if (this.cursors.up.isDown || this.keyW.isDown) {
      vy -= 1;
      movingDir = 'up';
    } else if (this.cursors.down.isDown || this.keyS.isDown) {
      vy += 1;
      movingDir = 'down';
    }

    // Normalize diagonal movement speed
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    const moveSpeed = 210;
    this.astronaut.setVelocity(vx * moveSpeed, vy * moveSpeed);

    // Dynamic depth sorting: astronaut depth matches feet y position
    this.astronaut.setDepth(this.astronaut.y);

    // Directional Animations
    if (vx !== 0 || vy !== 0) {
      this.lastDirection = movingDir || this.lastDirection;

      if (this.lastDirection === 'down') {
        this.astronaut.play('astro_walk_down', true);
      } else if (this.lastDirection === 'up') {
        this.astronaut.play('astro_walk_up', true);
      } else if (this.lastDirection === 'left') {
        // Mirrored Left walk animation
        this.astronaut.play('astro_walk_left', true);
      } else if (this.lastDirection === 'right') {
        this.astronaut.play('astro_walk_right', true);
      }

      // Uniform footstep cadence: ground noise on Martian soil, metal clank on platforms
      if (time - this.lastFootstepTime > 275) {
        const x = this.astronaut.x;
        const y = this.astronaut.y;

        // Structured metal surfaces across Gale Outpost:
        // 1. Ares Rocket Landing Platform (East Sector)
        // 2. Central Habitat Deck & Airlock Ramps (Central Sector)
        // 3. Rover Hangar Maintenance Apron (Central-West Sector)
        // 4. Solar & Kilopower Platform (North-West Sector)
        // 5. High-Gain Earth Relay Plinth (North-East Sector)
        // 6. Science Lab & Drill Platform (South Sector)
        const onMetal = (x >= 2250 && x <= 2650 && y >= 1180 && y <= 1520) ||
                        (x >= 1420 && x <= 1780 && y >= 940 && y <= 1180) ||
                        (x >= 920 && x <= 1260 && y >= 940 && y <= 1180) ||
                        (x >= 480 && x <= 780 && y >= 340 && y <= 520) ||
                        (x >= 2040 && x <= 2260 && y >= 340 && y <= 520) ||
                        (x >= 1380 && x <= 1720 && y >= 1600 && y <= 1800);

        const surface = onMetal ? 'metal' : 'ground';
        audioManager.playStep(this, surface, 0.42);
        this.lastFootstepTime = time;
      }
    } else {
      // Clean idle animation from Attachment 3 bottom row
      this.astronaut.play('astro_idle', true);
    }

    // Check proximity to base nodes
    this.checkProximityToNodes();
  }

  private checkProximityToNodes() {
    let nearestNode: OutpostNode | null = null;
    let minDistance = 180;

    for (const node of this.outpostNodes) {
      const dist = Phaser.Math.Distance.Between(this.astronaut.x, this.astronaut.y, node.x, node.y);
      if (dist < node.radius) {
        if (dist < minDistance) {
          nearestNode = node;
          minDistance = dist;
        }
      }
    }

    this.activeNearNode = nearestNode;

    if (nearestNode && !this.actionDialogContainer && !this.activeMapModal) {
      const isDone = gameState.galeCommissionedNodes.includes(nearestNode.id);
      this.interactionPrompt.setPosition(this.astronaut.x, this.astronaut.y - 75);
      this.interactionPromptText.setText(`[E] ${nearestNode.name.toUpperCase()} ${isDone ? '[STATUS]' : '[COMMISSION]'}`);
      this.interactionPrompt.setVisible(true);
    } else {
      this.interactionPrompt.setVisible(false);
    }
  }

  private openNodeDialog(node: OutpostNode) {
    if (this.actionDialogContainer) {
      this.actionDialogContainer.destroy();
    }

    this.astronaut.setVelocity(0, 0);
    this.interactionPrompt.setVisible(false);

    audioManager.playSfx(this, 'sfx_ui_modal_open', { volume: 0.75 });

    const isDone = gameState.galeCommissionedNodes.includes(node.id);

    this.actionDialogContainer = this.add.container(960, 540).setScrollFactor(0).setDepth(5000);

    const blocker = this.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.7)
      .setInteractive();

    const panel = this.add.rectangle(0, 0, 720, 380, 0x070f1e, 0.97)
      .setStrokeStyle(2, isDone ? 0x10b981 : 0x38bdf8, 0.9)
      .setInteractive();

    const doClose = () => {
      audioManager.playSfx(this, 'sfx_ui_modal_close', { volume: 0.65 });
      if (this.actionDialogContainer) {
        this.actionDialogContainer.destroy();
        this.actionDialogContainer = null;
      }
    };

    // Clicking anywhere outside the modal dismisses it
    blocker.on('pointerdown', doClose);

    // Top-Right [✕] Exit Button
    const exitBtnX = 720 / 2 - 36;
    const exitBtnY = -380 / 2 + 32;
    const exitBtnBg = this.add.rectangle(exitBtnX, exitBtnY, 34, 34, 0x111827, 0.9)
      .setStrokeStyle(1.5, 0xef4444)
      .setInteractive({ useHandCursor: true });
    const exitBtnTxt = this.add.text(exitBtnX, exitBtnY, '✕', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '18px',
      color: '#ef4444'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    exitBtnBg.on('pointerover', () => {
      exitBtnBg.setFillStyle(0xef4444, 0.35);
      exitBtnTxt.setColor('#ffffff');
      audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.35 });
    });
    exitBtnTxt.on('pointerover', () => {
      exitBtnBg.setFillStyle(0xef4444, 0.35);
      exitBtnTxt.setColor('#ffffff');
      audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.35 });
    });
    exitBtnBg.on('pointerout', () => {
      exitBtnBg.setFillStyle(0x111827, 0.9);
      exitBtnTxt.setColor('#ef4444');
    });
    exitBtnTxt.on('pointerout', () => {
      exitBtnBg.setFillStyle(0x111827, 0.9);
      exitBtnTxt.setColor('#ef4444');
    });
    exitBtnBg.on('pointerdown', doClose);
    exitBtnTxt.on('pointerdown', doClose);

    const categoryText = this.add.text(0, -145, `[ ${node.category} ]`, {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#f59e0b',
      letterSpacing: 3
    }).setOrigin(0.5);

    const title = this.add.text(0, -105, node.name.toUpperCase(), {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '20px',
      color: isDone ? '#34d399' : '#f8fafc',
      letterSpacing: 2
    }).setOrigin(0.5);

    const desc = this.add.text(0, -25, node.desc, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '16px',
      color: '#cbd5e1',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 600 }
    }).setOrigin(0.5);

    const btn = this.add.rectangle(0, 95, 320, 46, isDone ? 0x0f291e : 0x0284c7)
      .setStrokeStyle(1.5, isDone ? 0x10b981 : 0x38bdf8)
      .setInteractive({ useHandCursor: !isDone });

    const btnText = this.add.text(0, 95, isDone ? 'MODULE OPERATIONAL ✓' : 'COMMISSION MODULE [ENTER]', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: isDone ? '#34d399' : '#ffffff',
      letterSpacing: 2
    }).setOrigin(0.5);

    if (!isDone) {
      btn.on('pointerover', () => {
        btn.setFillStyle(0x0284c7, 0.95);
        audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.45 });
      });
      btn.on('pointerout', () => {
        btn.setFillStyle(0x0284c7, 0.85);
      });
      btn.on('pointerdown', () => this.commissionNode(node));
      this.input.keyboard?.once('keydown-ENTER', () => {
        if (this.actionDialogContainer) this.commissionNode(node);
      });
    }

    const closeBtn = this.add.rectangle(0, 150, 160, 36, 0x111827, 0.9)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true });
    const closeText = this.add.text(0, 150, 'EXIT [ESC]', {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '12px',
      color: '#94a3b8'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => {
      closeBtn.setFillStyle(0x1f2937, 0.95);
      closeBtn.setStrokeStyle(1.5, 0x38bdf8);
      closeText.setColor('#38bdf8');
      audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.35 });
    });
    closeText.on('pointerover', () => {
      closeBtn.setFillStyle(0x1f2937, 0.95);
      closeBtn.setStrokeStyle(1.5, 0x38bdf8);
      closeText.setColor('#38bdf8');
      audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.35 });
    });
    closeBtn.on('pointerout', () => {
      closeBtn.setFillStyle(0x111827, 0.9);
      closeBtn.setStrokeStyle(1, 0x475569);
      closeText.setColor('#94a3b8');
    });
    closeText.on('pointerout', () => {
      closeBtn.setFillStyle(0x111827, 0.9);
      closeBtn.setStrokeStyle(1, 0x475569);
      closeText.setColor('#94a3b8');
    });
    closeBtn.on('pointerdown', doClose);
    closeText.on('pointerdown', doClose);
    this.input.keyboard?.once('keydown-ESC', doClose);

    this.time.delayedCall(150, () => {
      if (this.actionDialogContainer) {
        this.input.keyboard?.once('keydown-E', doClose);
      }
    });

    this.actionDialogContainer.add([
      blocker,
      panel,
      exitBtnBg,
      exitBtnTxt,
      categoryText,
      title,
      desc,
      btn,
      btnText,
      closeBtn,
      closeText
    ]);
  }

  private commissionNode(node: OutpostNode) {
    audioManager.playSfx(this, 'sfx_ui_commission', { volume: 0.85 });
    audioManager.playSfx(this, 'sfx_ui_confirm', { volume: 0.65 });
    if (!gameState.galeCommissionedNodes.includes(node.id)) {
      gameState.galeCommissionedNodes.push(node.id);
    }
    node.onCommission();

    if (this.actionDialogContainer) {
      this.actionDialogContainer.destroy();
      this.actionDialogContainer = null;
    }

    this.createInteractiveNodes();
    this.updateStatusBanner();
  }

  private updateStatusBanner() {
    const total = this.outpostNodes.length;
    const done = gameState.galeCommissionedNodes.length;
    this.statusBanner.setText(`BASE READINESS: ${done}/${total} MODULES COMMISSIONED`);

    if (done >= total && gameState.currentChapter === 'act_1_prologue') {
      this.statusBanner.setText('ALL GALE OUTPOST MODULES COMMISSIONED // TRAVERSE ROUTE TO ARCADIA UNLOCKED');
      this.statusBanner.setColor('#34d399');

      const navBtn = this.add.rectangle(960, 960, 440, 48, 0x0284c7)
        .setScrollFactor(0)
        .setStrokeStyle(2, 0x38bdf8)
        .setInteractive({ useHandCursor: true })
        .setDepth(4200);

      const navText = this.add.text(960, 960, 'LAUNCH EXPEDITION TRAVERSE PLANNER →', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        letterSpacing: 2
      }).setOrigin(0.5).setScrollFactor(0).setDepth(4201);

      navBtn.on('pointerover', () => {
        navBtn.setFillStyle(0x0369a1);
        audioManager.playSfx(this, 'sfx_ui_hover', { volume: 0.5 });
      });
      navBtn.on('pointerout', () => {
        navBtn.setFillStyle(0x0284c7);
      });
      navBtn.on('pointerdown', () => {
        audioManager.playSfx(this, 'sfx_ui_confirm', { volume: 0.85 });
        gameState.currentChapter = 'act_2_arcadia';
        gameState.save();
        this.scene.start('ExpeditionMapScene');
      });

      this.tweens.add({
        targets: navBtn,
        scale: { from: 0.98, to: 1.03 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  private createAct3Upgrades() {
    const upgCont = this.add.container(960, 940).setScrollFactor(0).setDepth(4200);
    const upgBg = this.add.rectangle(0, 0, 740, 64, 0x050c18, 0.95)
      .setStrokeStyle(2, 0x10b981);

    const txt = this.add.text(-240, 0, 'ACT III: INGEST ARCADIA WATER DATA & PREP JEZERO EXPEDITION', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#34d399',
      letterSpacing: 1
    }).setOrigin(0, 0.5);

    const actionBtn = this.add.rectangle(250, 0, 200, 36, 0x10b981)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const actionBtnTxt = this.add.text(250, 0, 'PROCEED TO JEZERO', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '11px',
      color: '#050a14',
      letterSpacing: 1
    }).setOrigin(0.5);

    actionBtn.on('pointerdown', () => {
      soundFx.playTelemetryChirp();
      gameState.arcadiaWaterFiltered = true;
      gameState.resources.airReserve = 100;
      gameState.resources.power = 100;
      gameState.resources.waterReserve = 100;
      gameState.currentChapter = 'act_4_jezero';
      gameState.addLog('ACT III COMPLETE: Nanofiltration membranes synthesized. Outpost ready for Jezero Crater.', 'science');
      gameState.save();
      this.scene.start('ExpeditionMapScene');
    });

    upgCont.add([upgBg, txt, actionBtn, actionBtnTxt]);
  }
}
