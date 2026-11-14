/**
 * Resource Simulation Engine
 * Handles hourly/daily resource tick, CO2 accumulation, thermal loss,
 * water-tank radiation shielding physics, and life-support consequences.
 */

import { gameState, GameState } from './GameState';
import { soundFx } from '../utils/ProceduralAudio';

export class ResourceEngine {
  private static instance: ResourceEngine;
  private state: GameState;
  private tickTimer: number | null = null;
  private tickIntervalMs: number = 3000; // 3 seconds per simulated hour in game

  private constructor() {
    this.state = gameState;
  }

  public static getInstance(): ResourceEngine {
    if (!ResourceEngine.instance) {
      ResourceEngine.instance = new ResourceEngine();
    }
    return ResourceEngine.instance;
  }

  public startSimulation() {
    if (this.tickTimer !== null) return;
    this.tickTimer = window.setInterval(() => {
      this.tick();
    }, this.tickIntervalMs);
  }

  public stopSimulation() {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  public tick() {
    const { resources, hazards, breakers, evaActive } = this.state;

    // 1. Life Support & CO2 Dynamics
    if (breakers.lifeSupport) {
      if (hazards.co2Ppm > 600) {
        hazards.co2Ppm = Math.max(500, hazards.co2Ppm - 45);
      }
      resources.airReserve = Math.max(0, Math.min(100, resources.airReserve + 0.1));
    } else {
      hazards.co2Ppm += 120;
      resources.airReserve = Math.max(0, resources.airReserve - 0.8);
      if (hazards.co2Ppm > 3000 && Math.random() < 0.25) {
        this.state.addLog(`CRITICAL: Cabin CO2 concentration elevated (${Math.round(hazards.co2Ppm)} ppm). Cognitive impairment detected.`, 'warning');
        soundFx.playAlarmTone();
      }
    }

    // 2. Thermal Stability
    if (breakers.thermalHeating) {
      if (resources.thermalStability < 85) {
        resources.thermalStability = Math.min(85, resources.thermalStability + 0.5);
      }
    } else {
      resources.thermalStability = Math.max(0, resources.thermalStability - 0.9);
      if (resources.thermalStability < 40 && Math.random() < 0.2) {
        this.state.addLog(`WARNING: Internal habitat temperature dropping. Risk of line freezing.`, 'warning');
      }
    }

    // 3. Power Generation & Consumption
    const wattage = this.state.getBreakerWattage();
    let generation = 65; // Nominal base power generation
    if (this.state.currentChapter === 'act_5_conjunction') {
      generation = 20; // Massive dust storm deficit
    }
    const netFlow = generation - wattage.used;
    resources.power = Math.max(0, Math.min(100, resources.power + (netFlow * 0.04)));

    // 4. Water & Hydro-Loop
    if (breakers.waterFiltration) {
      // Nominal closed-loop recovery with slight metabolic drain
      resources.waterReserve = Math.max(0, resources.waterReserve - 0.05);
    } else {
      resources.waterReserve = Math.max(0, resources.waterReserve - 0.35);
    }

    // 5. Radiation & Water-Tank Shielding Math (Hard-Science Feature)
    // Water stored along perimeter walls acts as hydrogen-dense neutron/SPE shielding
    const effectiveShielding = (resources.shelterProtection / 100) * (resources.waterReserve / 100);
    let backgroundDoseRate = 0.002; // mSv / tick

    if (this.state.currentChapter === 'act_5_conjunction' && this.state.conjunctionDay === 6) {
      // Solar Particle Event Day
      backgroundDoseRate = 0.08;
    }

    if (evaActive) {
      // Outside suit radiation rate (no regolith or water shield)
      hazards.radiationDoseMsv += backgroundDoseRate * 6;
      this.state.suitO2 = Math.max(0, this.state.suitO2 - 1.2);
      this.state.suitBattery = Math.max(0, this.state.suitBattery - 0.9);

      if (Math.random() < 0.3) {
        soundFx.playGeigerClick();
      }

      if (this.state.suitO2 <= 15) {
        this.state.addLog('CRITICAL: Spacesuit O2 reserves below 15%! Return to airlock immediately!', 'alert');
        soundFx.playAlarmTone();
      }
    } else {
      // Inside shelter protected by water-tanks and regolith
      const absorbedDose = backgroundDoseRate * (1 - (effectiveShielding * 0.85));
      hazards.radiationDoseMsv += absorbedDose;
    }

    // 6. Sample Cryo-Preservation Degradation
    if (!breakers.sampleCryo && this.state.biosignatureSampleTube) {
      this.state.sciencePreservedPercent = Math.max(20, this.state.sciencePreservedPercent - 0.3);
      if (Math.random() < 0.15) {
        this.state.addLog(`ALERT: Sample cryo-storage unpowered! Organic biomarkers degrading (${Math.round(this.state.sciencePreservedPercent)}% preserved).`, 'alert');
      }
    }

    // Check catastrophic failure limits (Ending C trigger conditions)
    if (resources.airReserve <= 0 || resources.waterReserve <= 0 || resources.thermalStability <= 0 || hazards.co2Ppm >= 5000) {
      this.state.addLog('CRITICAL LIFE SUPPORT COLLAPSE: VITAL HABITAT BUFFER EXHAUSTED.', 'alert');
      soundFx.playAlarmTone();
    }

    this.state.notifyChange('tick');
  }

  /**
   * Cycles EVA airlock: consumes suit reserves and habitat airlock buffer
   */
  public cycleAirlock(): boolean {
    if (!this.state.evaActive) {
      // Exiting to EVA
      if (this.state.resources.airReserve < 5) {
        this.state.addLog('AIRLOCK CYCLE ABORT: Habitat air reserve too low to vent airlock volume.', 'warning');
        return false;
      }
      this.state.resources.airReserve -= 3;
      this.state.evaActive = true;
      this.state.suitO2 = 100;
      this.state.suitBattery = 100;
      this.state.addLog('AIRLOCK CYCLED: Exterior hatch open. Commencing Martian surface EVA.', 'system');
      soundFx.playAirlockHiss();
      return true;
    } else {
      // Re-entering Habitat
      this.state.evaActive = false;
      this.state.addLog('AIRLOCK CYCLED: Interior seal restored. Explorer returned to habitat.', 'system');
      soundFx.playAirlockHiss();
      return true;
    }
  }
}

export const resourceEngine = ResourceEngine.getInstance();

