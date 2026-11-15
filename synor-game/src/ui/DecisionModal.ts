/**
 * Sci-Fi Trade-Off Decision Modal
 * Renders immediate and delayed risks, resource impacts, and branching choices.
 * Integrated with NASA OSDR (Open Science Data Repository), DONKI, and Mars Trek.
 */

import Phaser from 'phaser';
import { soundFx } from '../utils/ProceduralAudio';
import { resourceEngine } from '../state/ResourceEngine';
import { gameState } from '../state/GameState';
import { MARS_SITES } from '../utils/MarsGeo';

export interface DecisionChoice {
  text: string;
  detail: string;
  consequences?: string[];
  powerDelta?: number;
  o2Cost?: number;
  radiationDose?: number;
  thermalDelta?: number;
  foodDelta?: number;
  waterDelta?: number;
  onSelect: () => void;
}

export interface DecisionData {
  title: string;
  summary: string;
  hazardLevel?: 'NOMINAL' | 'ELEVATED' | 'CRITICAL' | 'CANON EVENT';
  osdrKeyword?: string; // Optional override keyword for NASA OSDR search
  choices: DecisionChoice[];
}

interface OsdrStudyBrief {
  accessionId: string;
  studyTitle: string;
  clinicalNote: string;
  searchTerm: string;
}

const OSDR_FALLBACK_ARCHIVE: Record<string, OsdrStudyBrief> = {
  radiation: {
    accessionId: 'OSD-379',
    studyTitle: 'Ionizing Radiation & Oxidative Stress in Spaceflight Mammalian Tissue',
    clinicalNote: 'OSDR Finding: Unshielded SPE exposure accelerates DNA double-strand breaks & hematopoietic stem cell depletion.',
    searchTerm: 'radiation'
  },
  hypoxia: {
    accessionId: 'OSD-168',
    studyTitle: 'Hypercapnia & Hypoxic Stress Effects on Crew Neurocognitive Performance',
    clinicalNote: 'OSDR Finding: Elevated cabin CO2 (>2500 ppm) impairs executive decision latency and fine motor control.',
    searchTerm: 'hypoxia'
  },
  thermal: {
    accessionId: 'OSD-242',
    studyTitle: 'Metabolic & Thermoregulatory Adaptation in Extreme Isolated Environments',
    clinicalNote: 'OSDR Finding: Habitat thermal drops increase caloric burn by 22% and degrade peripheral dexterity.',
    searchTerm: 'thermoregulation'
  },
  muscle: {
    accessionId: 'OSD-570',
    studyTitle: 'Skeletal Muscle Atrophy and Bone Mineral Density Loss in Partial Gravity',
    clinicalNote: 'OSDR Finding: High-exertion surface EVAs without recovery increase musculoskeletal micro-fracture risk.',
    searchTerm: 'muscle atrophy'
  },
  nutrition: {
    accessionId: 'OSD-115',
    studyTitle: 'Closed-Loop Hydration & Caloric Restriction Impacts on Astronaut Immunity',
    clinicalNote: 'OSDR Finding: Water and ration deficits elevate cortisol and suppress T-cell immune response.',
    searchTerm: 'metabolism'
  }
};

export class DecisionModal extends Phaser.GameObjects.Container {
  private osdrTitleText?: Phaser.GameObjects.Text;
  private osdrStatusText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, data: DecisionData) {
    super(scene, 960, 540);
    this.createModal(data);
    scene.add.existing(this);
    this.setDepth(300);
  }

  /**
   * Automatically selects the most relevant NASA OSDR study category
   * based on the modal's title, summary, or choice deltas.
   */
  private resolveOsdrBrief(data: DecisionData): OsdrStudyBrief {
    const combined = `${data.title} ${data.summary} ${data.osdrKeyword || ''}`.toLowerCase();

    if (combined.includes('rad') || combined.includes('flare') || combined.includes('storm') || combined.includes('shield')) {
      return OSDR_FALLBACK_ARCHIVE.radiation;
    }
    if (combined.includes('co2') || combined.includes('air') || combined.includes('o2') || combined.includes('oxygen') || combined.includes('eclss')) {
      return OSDR_FALLBACK_ARCHIVE.hypoxia;
    }
    if (combined.includes('therm') || combined.includes('cold') || combined.includes('heat') || combined.includes('cryo') || combined.includes('freez')) {
      return OSDR_FALLBACK_ARCHIVE.thermal;
    }
    if (combined.includes('water') || combined.includes('food') || combined.includes('hydro') || combined.includes('ration')) {
      return OSDR_FALLBACK_ARCHIVE.nutrition;
    }
    return OSDR_FALLBACK_ARCHIVE.muscle;
  }

  /**
   * Queries NASA's live Open Science Data Repository (OSDR) API and updates the modal badge
   */
  private async fetchLiveOsdrStudy(brief: OsdrStudyBrief) {
    try {
      const response = await fetch(
        `https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(brief.searchTerm)}&size=1`
      );
      if (!response.ok) throw new Error(`OSDR HTTP ${response.status}`);

      const json = await response.json();
      const hit = json?.hits?.hits?.[0]?._source;

      if (hit && hit['Study Title'] && this.scene && this.active) {
        const liveId = hit['Accession'] || brief.accessionId;
        const rawTitle: string = hit['Study Title'];
        const cleanTitle = rawTitle.length > 88 ? `${rawTitle.slice(0, 85)}...` : rawTitle;

        this.osdrStatusText?.setText(`🧬 NASA OSDR LIVE ARCHIVE [${liveId}]`);
        this.osdrTitleText?.setText(`"${cleanTitle}"\n${brief.clinicalNote}`);
      }
    } catch {
      // Keeps fallback OSDR study displayed if offline or blocked by CORS
    }
  }

  private createModal(data: DecisionData) {
    soundFx.playAlarmTone();

    const osdrBrief = this.resolveOsdrBrief(data);
    const donki = resourceEngine.donkiWeather;
    const site = MARS_SITES.GALE_CRATER;

    // Log NASA OSDR study reference to bottom console bar
    gameState.addLog(
      `NASA OSDR SCIENCE BRIEF [${osdrBrief.accessionId}]: ${osdrBrief.studyTitle}`,
      'system'
    );

    // Dark backdrop blocker
    const blocker = this.scene.add
      .rectangle(0, 0, 1920, 1080, 0x000000, 0.82)
      .setInteractive()
      .setOrigin(0.5);
    this.add(blocker);

    // Modal frame (expanded slightly to fit NASA OSDR & Telemetry bars cleanly)
    const frameWidth = 860;
    const frameHeight = 610;
    const panel = this.scene.add
      .rectangle(0, 0, frameWidth, frameHeight, 0x070b14, 0.97)
      .setStrokeStyle(2, data.hazardLevel === 'CRITICAL' ? 0xef4444 : 0x38bdf8, 0.9)
      .setOrigin(0.5);
    this.add(panel);

    // Hazard Banner
    const hazardColor = data.hazardLevel === 'CRITICAL' ? '#ef4444' : '#38bdf8';
    const banner = this.scene.add
      .text(0, -270, `[MISSION ADVISORY: ${data.hazardLevel || 'DECISION REQUIRED'}]`, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '13px',
        color: hazardColor,
        letterSpacing: 2
      })
      .setOrigin(0.5);
    this.add(banner);

    // Step 1 & 2 Strip: Live DONKI + Mars Trek Context Bar inside Modal
    const telemetryStrip = this.scene.add
      .text(
        0,
        -246,
        `NASA DONKI FLARE: ${donki.flareClass} (${donki.radiationMultiplier}x Flux)   |   MARS TREK MOLA: ${site.name} (${site.elevationMeters}m, Slope ${site.slopeDeg}°)`,
        {
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '11px',
          color: '#22d3ee'
        }
      )
      .setOrigin(0.5);
    this.add(telemetryStrip);

    // Title
    const title = this.scene.add
      .text(0, -210, data.title, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '21px',
        color: '#f8fafc',
        align: 'center'
      })
      .setOrigin(0.5);
    this.add(title);

    // Summary Box
    const summaryBox = this.scene.add
      .text(0, -158, data.summary, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '16px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: 760 }
      })
      .setOrigin(0.5);
    this.add(summaryBox);

    // Step 3 Box: NASA OSDR Biomedical Research Brief
    const osdrBoxBg = this.scene.add
      .rectangle(0, -86, 780, 68, 0x091926, 0.95)
      .setStrokeStyle(1, 0x10b981, 0.85)
      .setOrigin(0.5);

    this.osdrStatusText = this.scene.add
      .text(-375, -108, `🧬 NASA OSDR BIOMEDICAL ARCHIVE [${osdrBrief.accessionId}]`, {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '11px',
        color: '#10b981'
      })
      .setOrigin(0, 0.5);

    this.osdrTitleText = this.scene.add
      .text(-375, -78, `"${osdrBrief.studyTitle}"\n${osdrBrief.clinicalNote}`, {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '13px',
        color: '#e2e8f0',
        wordWrap: { width: 750 }
      })
      .setOrigin(0, 0.5);

    this.add([osdrBoxBg, this.osdrStatusText, this.osdrTitleText]);

    // Trigger live NASA OSDR API query to enrich study title
    this.fetchLiveOsdrStudy(osdrBrief);

    // Render Choice Cards
    const numChoices = data.choices.length;
    const cardWidth = Math.min(360, (780 - (numChoices - 1) * 20) / numChoices);
    const startX = -((numChoices - 1) * (cardWidth + 20)) / 2;

    data.choices.forEach((choice, index) => {
      const cx = startX + index * (cardWidth + 20);
      const cy = 85;
      const cardHeight = 225;

      const cardBg = this.scene.add
        .rectangle(cx, cy, cardWidth, cardHeight, 0x0f172a, 0.9)
        .setStrokeStyle(1, 0x475569)
        .setInteractive({ useHandCursor: true });

      const choiceTitle = this.scene.add
        .text(cx, cy - 80, choice.text, {
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '14px',
          color: '#38bdf8',
          align: 'center',
          wordWrap: { width: cardWidth - 24 }
        })
        .setOrigin(0.5);

      const choiceDetail = this.scene.add
        .text(cx, cy - 20, choice.detail, {
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: '13px',
          color: '#94a3b8',
          align: 'center',
          wordWrap: { width: cardWidth - 24 }
        })
        .setOrigin(0.5);

      // Consequence metrics
      let metricStr = '';
      if (choice.powerDelta) metricStr += `Power: ${choice.powerDelta > 0 ? '+' : ''}${choice.powerDelta}%  `;
      if (choice.o2Cost) metricStr += `O2 Cost: -${choice.o2Cost}%  `;
      if (choice.radiationDose) metricStr += `Rad: +${choice.radiationDose}mSv  `;
      if (choice.thermalDelta) metricStr += `Thermal: ${choice.thermalDelta > 0 ? '+' : ''}${choice.thermalDelta}%  `;
      if (choice.foodDelta) metricStr += `Food: ${choice.foodDelta > 0 ? '+' : ''}${choice.foodDelta}%  `;
      if (choice.waterDelta) metricStr += `H2O: ${choice.waterDelta > 0 ? '+' : ''}${choice.waterDelta}%  `;

      const metricText = this.scene.add
        .text(cx, cy + 40, metricStr, {
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '11px',
          color: '#f59e0b',
          align: 'center',
          wordWrap: { width: cardWidth - 20 }
        })
        .setOrigin(0.5);

      // Execute Button inside card
      const btn = this.scene.add
        .rectangle(cx, cy + 82, cardWidth - 40, 32, 0x1e293b)
        .setStrokeStyle(1, 0x38bdf8)
        .setInteractive({ useHandCursor: true });

      const btnText = this.scene.add
        .text(cx, cy + 82, 'CONFIRM ACTION', {
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '11px',
          color: '#38bdf8'
        })
        .setOrigin(0.5);

      const triggerAction = () => {
        soundFx.playClick(1100);
        this.destroy();
        choice.onSelect();
      };

      btn.on('pointerdown', triggerAction);
      cardBg.on('pointerdown', triggerAction);

      cardBg.on('pointerover', () => {
        cardBg.setStrokeStyle(2, 0x38bdf8);
        cardBg.setFillStyle(0x1e293b, 0.95);
        soundFx.playClick(900);
      });

      cardBg.on('pointerout', () => {
        cardBg.setStrokeStyle(1, 0x475569);
        cardBg.setFillStyle(0x0f172a, 0.9);
      });

      this.add([cardBg, choiceTitle, choiceDetail, metricText, btn, btnText]);
    });
  }
}