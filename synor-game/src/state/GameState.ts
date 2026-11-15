/**
 * Central Reactive Game State Store
 * Tracks telemetry, hazard accumulators, breaker loads, scientific data,
 * and mission chapter progression.
 */

export interface TelemetryResources {
  airReserve: number;        // 0 - 100%
  waterReserve: number;      // 0 - 100%
  power: number;             // 0 - 100%
  food: number;              // 0 - 100%
  thermalStability: number;  // 0 - 100%
  shelterProtection: number; // 0 - 100%
}

export interface HazardAccumulators {
  co2Ppm: number;            // 400 - 6000 ppm
  radiationDoseMsv: number;  // Cumulative mSv
}

export interface PowerBreakers {
  lifeSupport: boolean;      // ECLSS O2 / CO2 scrubbers (30W)
  thermalHeating: boolean;   // Hab thermal heating (25W)
  waterFiltration: boolean;  // Water recycling unit (20W)
  sampleCryo: boolean;       // Sample preservation cryo-unit (20W)
  commsGreenhouse: boolean;  // Comms dish & greenhouse lighting (15W)
}

export interface ShelterUpgradeState {
  dome: boolean;
  rimshade: boolean;
  cap: boolean;
  radiationUmbrella: boolean;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  text: string;
  type: 'system' | 'capcom' | 'warning' | 'alert' | 'science';
}

export type ChapterId = 
  | 'act_1_prologue'
  | 'act_2_arcadia'
  | 'act_3_gale_return'
  | 'act_4_jezero'
  | 'act_5_conjunction'
  | 'ending';

const SAVE_KEY = 'synor_gamestate_v1';

export class GameState extends EventTarget {
  private static instance: GameState;

  // Primary Telemetry
  public resources: TelemetryResources = {
    airReserve: 95,
    waterReserve: 90,
    power: 85,
    food: 92,
    thermalStability: 88,
    shelterProtection: 80
  };

  // Hazard Accumulators
  public hazards: HazardAccumulators = {
    co2Ppm: 520,
    radiationDoseMsv: 14.5
  };

  // Power Breaker Bus
  public breakers: PowerBreakers = {
    lifeSupport: true,
    thermalHeating: true,
    waterFiltration: true,
    sampleCryo: true,
    commsGreenhouse: true
  };

  // EVA Suit Reserves
  public evaActive: boolean = false;
  public suitO2: number = 100;
  public suitBattery: number = 100;
  public waterIceReserve: number = 0;
  public regolithSamples: number = 0;
  public currentLocation: 'gale' | 'arcadia' | 'jezero' | 'jezero_shelter' = 'gale';
  public shelterUpgrades: ShelterUpgradeState = {
    dome: false,
    rimshade: false,
    cap: false,
    radiationUmbrella: false
  };

  // Mission Progression
  public currentChapter: ChapterId = 'act_1_prologue';
  public galeCommissionedNodes: string[] = [];
  public arcadiaCompletedExperiments: string[] = [];
  public arcadiaWaterFiltered: boolean = false;
  public jezeroCompletedExperiments: string[] = [];
  public biosignatureSampleTube: boolean = false;
  public jezeroBranchChoice: 'retreat_gale' | 'conjunction_survival' | null = null;

  // Act V Conjunction Specifics
  public conjunctionDay: number = 1;
  public sciencePreservedPercent: number = 100;
  public cryoMode: 'full' | 'eco' | 'off' = 'full';
  public dsnLocked: boolean = false;
  public roverChassisIntact: boolean = true;
  public habitatSealedCompact: boolean = false;
  public spareScrubbersCount: number = 1;

  // Comms and Audio Logs
  public logs: LogMessage[] = [];

  private constructor() {
    super();
    this.addLog('SYSTEM INITIALIZED. MISSION SYNOR READY.', 'system');
  }

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  public resetToPrologue() {
    this.resources = {
      airReserve: 95,
      waterReserve: 90,
      power: 85,
      food: 92,
      thermalStability: 88,
      shelterProtection: 80
    };
    this.hazards = {
      co2Ppm: 520,
      radiationDoseMsv: 14.5
    };
    this.breakers = {
      lifeSupport: true,
      thermalHeating: true,
      waterFiltration: true,
      sampleCryo: true,
      commsGreenhouse: true
    };
    this.evaActive = false;
    this.suitO2 = 100;
    this.suitBattery = 100;
    this.waterIceReserve = 0;
    this.regolithSamples = 0;
    this.currentLocation = 'gale';
    this.shelterUpgrades = { dome: false, rimshade: false, cap: false, radiationUmbrella: false };
    this.currentChapter = 'act_1_prologue';
    this.galeCommissionedNodes = [];
    this.arcadiaCompletedExperiments = [];
    this.arcadiaWaterFiltered = false;
    this.jezeroCompletedExperiments = [];
    this.biosignatureSampleTube = false;
    this.jezeroBranchChoice = null;
    this.conjunctionDay = 1;
    this.sciencePreservedPercent = 100;
    this.cryoMode = 'full';
    this.dsnLocked = false;
    this.roverChassisIntact = true;
    this.habitatSealedCompact = false;
    this.spareScrubbersCount = 1;
    this.logs = [];
    this.addLog('MISSION INITIALIZED: GALE CRATER EXPEDITION STAGE.', 'system');
    this.notifyChange('state_reset');
    this.save();
  }

  public initConjunctionValues() {
    // Ground-truth Initial values defined in plan Section 5 for Act V:
    this.resources.airReserve = 76;
    this.resources.waterReserve = 61;
    this.resources.power = 48;
    this.resources.food = 78;
    this.resources.thermalStability = 68;
    this.resources.shelterProtection = 80;
    this.hazards.co2Ppm = 950;
    this.conjunctionDay = 1;
    this.currentChapter = 'act_5_conjunction';
    this.addLog('SOLAR CONJUNCTION COMMENCED. EARTH RADIO BLIND FOR 14 DAYS.', 'alert');
    this.notifyChange('conjunction_init');
    this.save();
  }

  public getBreakerWattage(): { used: number; max: number } {
    let used = 0;
    if (this.breakers.lifeSupport) used += 30;
    if (this.breakers.thermalHeating) used += 25;
    if (this.breakers.waterFiltration) used += 20;
    if (this.breakers.sampleCryo) used += 20;
    if (this.breakers.commsGreenhouse) used += 15;
    return { used, max: 100 };
  }

  public toggleBreaker(key: keyof PowerBreakers): boolean {
    this.breakers[key] = !this.breakers[key];
    this.notifyChange('breakers_changed');
    this.save();
    return this.breakers[key];
  }

  public addLog(text: string, type: LogMessage['type'] = 'system') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const msg: LogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      text,
      type
    };
    this.logs.unshift(msg);
    if (this.logs.length > 50) this.logs.pop();
    this.notifyChange('new_log', msg);
  }

  public notifyChange(eventType: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent('change', { detail: { eventType, detail } }));
  }

  public save() {
    try {
      const data = {
        resources: this.resources,
        hazards: this.hazards,
        breakers: this.breakers,
        evaActive: this.evaActive,
        suitO2: this.suitO2,
        suitBattery: this.suitBattery,
        currentChapter: this.currentChapter,
        galeCommissionedNodes: this.galeCommissionedNodes,
        arcadiaCompletedExperiments: this.arcadiaCompletedExperiments,
        arcadiaWaterFiltered: this.arcadiaWaterFiltered,
        jezeroCompletedExperiments: this.jezeroCompletedExperiments,
        biosignatureSampleTube: this.biosignatureSampleTube,
        jezeroBranchChoice: this.jezeroBranchChoice,
        conjunctionDay: this.conjunctionDay,
        sciencePreservedPercent: this.sciencePreservedPercent,
        cryoMode: this.cryoMode,
        dsnLocked: this.dsnLocked,
        roverChassisIntact: this.roverChassisIntact,
        habitatSealedCompact: this.habitatSealedCompact,
        spareScrubbersCount: this.spareScrubbersCount,
        waterIceReserve: this.waterIceReserve,
        regolithSamples: this.regolithSamples,
        currentLocation: this.currentLocation,
        shelterUpgrades: this.shelterUpgrades
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save GameState to localStorage', e);
    }
  }

  public load(): boolean {
    try {
      const str = localStorage.getItem(SAVE_KEY);
      if (str) {
        const data = JSON.parse(str);
        Object.assign(this, data);
        this.notifyChange('state_loaded');
        return true;
      }
    } catch (e) {
      console.warn('Could not load GameState from localStorage', e);
    }
    return false;
  }
}

export const gameState = GameState.getInstance();

