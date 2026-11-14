# SYNOR — The Silence Between Worlds: Phaser 3 Development Plan

## 1. Game Vision & Core Design Pillars

* **Title:** SYNOR — The Silence Between Worlds
* **Tagline:** *Humanity sent an explorer to uncover the secrets of Mars. It did not prepare him for being alone.*
* **Setting:** Year 2047 — Mission SYNOR
* **Genre:** 2D Hard-Science Mars Exploration, Resource Management, & Survival Strategy
* **Engine:** Phaser 3 (TypeScript + Vite)

### Narrative & Gameplay Arc
$$\text{Gale Crater} \rightarrow \text{Arcadia Planitia} \rightarrow \text{Gale Crater} \rightarrow \text{Jezero Crater} \rightarrow \text{Solar Conjunction} \rightarrow \text{Survival}$$

### Core Design Rules
1. **Connected Progression:** Scientific discoveries and equipment upgrades from **Arcadia Planitia** (water ice ISRU) and **Jezero Crater** (ancient delta geology & weather telemetry) directly unlock efficiency bonuses, diagnostic data, and survival advantages during the **14-Day Solar Conjunction**.
2. **Real Martian Geography:** Gale, Arcadia, and Jezero are separated by thousands of kilometres. Multi-week traverses are simulated via an autonomous Long-Range Exploration Vehicle (LREV) using pre-positioned cargo depots and real orbital map data from [NASA Mars Trek](https://trek.nasa.gov/mars).
3. **Hard-Science Authenticity:**
   * Subsurface ice in Arcadia is patchy and contaminated with regolith/salts—never an automatic infinite water source.
   * Jezero samples reveal potential biosignatures and organic molecules, not confirmed living organisms.
   * Solar conjunction blocks real-time Earth radio uplinks due to solar corona plasma interference; dust storms and hardware faults are independent environmental hazards.
   * Every exterior task (EVA) requires cycling an airlock and consuming spacesuit $\text{O}_2$ and battery reserves.

---

## 2. Technical Stack & Project Structure

### Recommended Stack
* **Framework:** Phaser 3 (`phaser@^3.80.0`)
* **Build Tool & Language:** Vite + TypeScript (`strict: true`)
* **UI Layer:** Hybrid Phaser Canvas (`HUDScene` for diegetic gauges/maps) + lightweight DOM overlay for crisp scientific telemetry logs and audio sliders.
* **Audio Architecture:** Web Audio API via Phaser's `SoundManager` with three logical gain channels: **Master**, **Music**, and **SFX**, persisted to `localStorage`.

### Directory Layout
```text
synor-phaser/
├── index.html
├── package.json
├── public/
│   └── assets/
│       ├── maps/                 # Exported NASA Mars Trek global & crater rasters
│       ├── sprites/              # Astronaut EVA, LREV rover, habitats, asteroids
│       ├── audio/                # Ambient space synth, wind/dust SFX, UI clicks
│       └── data/
│           ├── chapters.json     # Narrative scripts & Mission Control transmissions
│           ├── experiments.json  # Arcadia & Jezero scientific parameters
│           └── conjunction.json  # 14-day survival events & branching outcomes
└── src/
    ├── main.ts                   # Phaser.Game configuration & scale manager
    ├── state/
    │   ├── GameState.ts          # Centralized reactive store (resources, logs, flags)
    │   ├── ResourceEngine.ts     # Hourly/daily resource tick & delayed consequences
    │   └── AudioManager.ts       # Master, Music, and SFX volume controller
    ├── scenes/
    │   ├── BootScene.ts          # Minimal asset boot & settings hydration
    │   ├── PreloadScene.ts       # Progress bar & texture/audio loading
    │   ├── StartMenuScene.ts     # Live 2D Mars parallax + Audio Settings + Cutscene
    │   ├── HUDScene.ts           # Persistent top/bottom telemetry bar & comms log
    │   ├── GaleBaseScene.ts      # Habitat commissioning & rover overhaul
    │   ├── ExpeditionMapScene.ts # Interactive NASA Mars Trek traverse planner
    │   ├── ArcadiaFieldScene.ts  # 4 subsurface ice & regolith experiments
    │   ├── JezeroFieldScene.ts   # 4 delta/astrobiology experiments + critical choice
    │   ├── JezeroShelterScene.ts # 14-day Solar Conjunction survival interior/EVA
    │   └── EndingScene.ts        # Dynamic epilogue (Endings A, B, or C)
    └── ui/
        ├── AudioSettingsModal.ts # Audio-only sliders (Master, Music, SFX + Back)
        └── DecisionModal.ts      # Trade-off cards showing immediate & delayed risks
```

---

## 3. Integrating NASA Mars Trek (`https://trek.nasa.gov/mars`)

To ground the expedition in real Martian topography, use NASA Mars Trek data across two layers: **Global Traverse Navigation** and **Local Crater Sectors**.

### Target Landing Coordinates & Distances
| Site | Coordinates | Elevation / Geological Feature | Straight-Line Traverse |
| :--- | :--- | :--- | :--- |
| **Gale Crater** | $5.4^\circ\text{S}, 137.8^\circ\text{E}$ | Aeolis Mons (Mount Sharp) layered sediments | Homebase Origin |
| **Arcadia Planitia** | $46.7^\circ\text{N}, 168.0^\circ\text{W}$ | Smooth northern plains with polygonal ice terrain | $4,180\text{ km}$ from Gale |
| **Jezero Crater** | $18.38^\circ\text{N}, 77.58^\circ\text{E}$ | $45\text{ km}$ impact crater & western river delta | $3,790\text{ km}$ from Gale |

### How to Build the Map System in Phaser
1. **Exporting Base Imagery from Mars Trek:**
   * Open `https://trek.nasa.gov/mars` and switch layers to **MOLA Color Hillshade** (for elevation relief) and **Viking MDIM 2.1 Color Mosaic** (for visual orbital imagery).
   * Export or stitch an equirectangular global map texture (`mars_global_4096x2048.webp`) plus three high-detail regional cutouts (`gale_sector.webp`, `arcadia_sector.webp`, `jezero_sector.webp`).
   * *(Optional Live Tiles)*: Configure a custom Phaser tile loader that fetches NASA Mars Trek WMTS XYZ tiles (`https://trek.nasa.gov/tiles/Mars/EQ/...`) with automatic fallback to bundled local textures when offline.
2. **Coordinate Projection Helper (`src/utils/MarsGeo.ts`):**
   Convert Martian latitude $\phi$ and longitude $\lambda$ into Phaser pixel coordinates $(x, y)$ on a map of width $W$ and height $H$:
   $$x = \frac{\lambda + 180}{360} \cdot W, \qquad y = \frac{90 - \phi}{180} \cdot H$$
   Compute realistic traverse distances using the spherical law of cosines with Mars's mean radius $R_{\text{Mars}} = 3,389.5\text{ km}$:
   $$d = R_{\text{Mars}} \cdot \arccos\big(\sin\phi_1 \sin\phi_2 + \cos\phi_1 \cos\phi_2 \cos(\lambda_2 - \lambda_1)\big)$$
3. **Interactive Traverse Gameplay (`ExpeditionMapScene`):**
   * Players plot waypoints between **Gale $\leftrightarrow$ Arcadia** ($4,180\text{ km}$) and **Gale $\rightarrow$ Jezero** ($3,790\text{ km}$) passing pre-positioned autonomous cargo depots.
   * Zooming in with `this.cameras.main.setZoom()` transitions smoothly from orbital elevation contours down to the local field sector grid.

---

## 4. Phaser Scene Architecture & Seamless Opening Cutscene

### Start Menu & Seamless Transition (`StartMenuScene.ts`)
1. **Live Multi-Depth Parallax Background:**
   * **Layer 0 (`scrollFactor = 0.05`):** Deep-space gradient + procedural twinkling starfield (`Phaser.GameObjects.Particles.ParticleEmitter`).
   * **Layer 1 (`scrollFactor = 0.20`):** Distant star clusters and faint nebula dust.
   * **Layer 2 (`scrollFactor = 0.45`):** High-resolution Mars limb artwork with an atmospheric rim shader/glow and a perched **Mars Research Outpost** featuring pulsing beacon lights.
   * **Layer 3 (`scrollFactor = 0.90`):** Object-pooled foreground/midground asteroid sprites drifting and rotating continuously across the viewport.
2. **Minimalist UI Overlay:**
   * Title emblem (`SYNOR — The Silence Between Worlds`) and three buttons: **Start Game**, **Settings**, and **Exit**.
   * **Settings Modal:** Contains **only** three range sliders (**Master**, **Music**, **SFX**) and a **Back** button.
3. **Zero-Cut Transition to Gameplay:**
   * Clicking **Start Game** disables menu input (`button.disableInteractive()`), tweens the menu container alpha to `0` over `1000 ms`, and simultaneously triggers `this.cameras.main.pan()` + `this.cameras.main.zoomTo(2.4, 2800, 'Sine.easeInOut')` straight past the drifting asteroids toward the Martian surface—launching `GaleBaseScene` cleanly without any black screen.

---

## 5. Core Simulation & Survival Systems (`GameState.ts`)

### Primary Habitat & Suit Telemetry (0% – 100%)
| Metric | Initial Jezero Conjunction Value | Depletion / Recovery Drivers |
| :--- | :--- | :--- |
| **Air Reserve** | $76\%$ | $\text{O}_2$ generator power, reserve tanks, airlock EVA cycles |
| **Water Reserve** | $61\%$ | Drinking, hygiene, greenhouse irrigation, vapor recycling |
| **Power** | $48\%$ | Solar array output (reduced by dust), battery bank, compact fission |
| **Food** | $78\%$ | Packaged rations + experimental greenhouse yield |
| **Thermal Stability** | $68\%$ | Electric heaters, thermal loops, compartment isolation |
| **Shelter Protection** | $80\%$ | Regolith shielding + water-tank wall placement |

### Independent Hazard Accumulators (Non-Percentage)
1. **Cabin $\text{CO}_2$ Concentration ($\text{ppm}$):**
   * Nominal baseline: $400\text{ ppm}$ – $800\text{ ppm}$.
   * Rises rapidly if the primary $\text{CO}_2$ scrubber saturates or loses power. Above $3,000\text{ ppm}$, astronaut cognitive efficiency drops (longer task times); above $5,000\text{ ppm}$, triggers critical life-support failure.
2. **Cumulative Radiation Dose ($\text{mSv}$):**
   * Increases during exterior EVAs and Solar Particle Events (SPEs).
   * **Water-Shielding Mechanic:** Stored water tanks line the reinforced storm shelter walls. Consuming or relocating water reserves without replenishment reduces `Shelter Protection`, increasing radiation penetration during solar alerts.

### Compact Fission & Power Load-Balancing Grid
During solar conjunction dust storms, solar output drops sharply. The player toggles breakers on a limited power bus (`maxWatts`):
* **Life Support ($\text{O}_2$ / $\text{CO}_2$ Scrubbers):** High priority
* **Habitat Heating & Thermal Loops:** High priority (can be restricted to sleeping/life-support core)
* **Water Filtration & Sabatier/Recycling Unit:** Medium priority
* **Sample Preservation Cryo-Unit:** Medium priority (protects Jezero biosignature cores)
* **Communications Array & Greenhouse Lighting:** Low priority

---

## 6. Chapter-by-Chapter Implementation Roadmap

### Act I: Prologue — Gale Crater Base Commissioning (`GaleBaseScene.ts`)
* **Objective:** Bring a partially assembled cargo-delivered outpost online before exploring Mars.
* **Interactive Station Nodes:**
  1. *Habitat Core:* Seal interior bulkheads & run pressure integrity check.
  2. *Solar & Battery Yard:* Link photovoltaic arrays to main battery storage.
  3. *ECLSS Rack:* Commission $\text{O}_2$ electrolysis and $\text{CO}_2$ scrubbers.
  4. *Hydro-Loop:* Test closed-loop water recycling and graywater filtration.
  5. *Radiation Bunker:* Command construction bots to pile Martian regolith over the shelter roof.
  6. *High-Gain Dish:* Align Earth relay antenna to unlock Chapter 1 orders.

### Act II: Chapter One — The Ice Beneath: Arcadia Planitia (`ArcadiaFieldScene.ts`)
* **Traverse:** $4,180\text{ km}$ autonomous LREV expedition north to Arcadia Planitia.
* **Four Scientific Mini-Games / Experiments:**
  * **Experiment A — Subsurface Ice Mapping:** Scan a $6 \times 6$ grid of polygonal patterned ground using Ground-Penetrating Radar (GPR), Neutron Spectrometer, and Thermal Imager to locate shallow ice signatures.
  * **Experiment B — Ice Core Extraction:** Select drill depth (Shallow Low-Power vs. Deep High-Power) to extract core samples and inspect ice-to-dust ratio and dissolved salts.
  * **Experiment C — Water Extraction Trial (MREU):** Heat an ice-bearing sample in the vapor capture chamber. *Plot Twist:* Extracted water contains mineral/perchlorate impurities—unfit to drink raw, proving future habitats require multi-stage purification.
  * **Experiment D — Martian Regolith Assessment:** Test soil bearing strength and compaction to designate a future ISRU processing pad.
* **Trade-Off System:** Limited LREV battery and cargo slots force players to balance deep drilling against emergency supply capacity.

### Act III: Chapter Two — Return to Gale (`GaleBaseScene.ts`)
* **Traverse:** $4,180\text{ km}$ return trip to Gale Crater.
* **Gameplay Actions:**
  1. Upload Arcadia ice dataset into the main lab to unlock **Improved Filtration Membranes** for later survival.
  2. Overhaul LREV suspension, wheels, and battery modules.
  3. Load survival consumables ($\text{O}_2$ tanks, spare $\text{CO}_2$ cartridges, medkits, radiation dosimeters) for the final expedition.

### Act IV: Chapter Three — The Ancient Lake: Jezero Crater (`JezeroFieldScene.ts`)
* **Traverse:** $3,790\text{ km}$ expedition to the $45\text{ km}$ Jezero impact crater and ancient river delta.
* **Four Scientific Experiments:**
  * **Experiment A — Ancient Delta Reconstruction:** Use laser scanner and panoramic imaging to map sedimentary strata and ancient river channels.
  * **Experiment B — Mineral & Chemical Analysis:** Analyze outcrops with portable Raman and XRF spectrometers for clays, carbonates, and iron-bearing minerals.
  * **Experiment C — Potential Biosignature Investigation:** Screen fine-grained mudstones for organic carbon chains and micro-textures, sealing top candidates in sterile tubes.
  * **Experiment D — Environmental Monitoring:** Deploy an automated weather station (pressure, temperature, wind, dust opacity, radiation).
* **The Critical Branching Decision:**
  * *Option A (Alternative Branch — Early Return):* Abort the final outcrop scan, preserve rover integrity, and return to Gale before conjunction (unlocks an early completion/cautious ending branch).
  * *Option B (Canon Event — Final Sample):* Extract the high-priority layered outcrop core. Power and time run low; diagnostic check reveals a **fractured rover drivetrain assembly**. Return to Gale before solar conjunction is impossible—stranding the astronaut at the **Jezero Field Station**.

### Act V: Chapters Four & Five — The 14-Day Solar Conjunction (`JezeroShelterScene.ts`)
* **Opening Cutscene:** Inside the Jezero Field Station window, the Earth comms display shifts to `EARTH COMMUNICATION INTERRUPTED — SOLAR CONJUNCTION MODE`.
* **14-Day Event Schedule (`conjunction.json`):**
  * **Day 1 — Silence:** Uplink drops; choose standard power profile vs. immediate conservation mode.
  * **Day 2 — The Dust Front:** Regional dust storm cuts solar input by $60\%$. Perform risky dusty EVA panel cleaning or rely on compact fission backup.
  * **Day 3 — Energy Crisis:** Battery approaches critical threshold; shed non-essential loads.
  * **Day 4 — Air Quality Warning:** Primary $\text{CO}_2$ filter degrades; install sole spare cartridge or attempt manual servicing.
  * **Day 5 — Water Shortage:** Filtration membrane faults (easier to repair if Arcadia purification data was unlocked); decide whether to pause the greenhouse.
  * **Day 6 — Radiation Alert:** Solar Particle Event spikes surface radiation; retreat into the water-shielded storm shelter and halt all EVAs.
  * **Day 7 — Halfway Point:** Resource audit; abandon remaining outdoor science or risk sparse reserves for telemetry.
  * **Day 8 — Mechanical Failure:** Secondary LREV fault confirms rover cannot drive back to Gale; salvage rover batteries/parts for the habitat or preserve rover chassis.
  * **Day 9 — Emergency Supply Cache:** Activate autonomous cargo depot beacon; spend power/EVA time clearing the landing zone for the unmanned supply rover.
  * **Day 10 — The Last Battery:** Primary battery bank degrades; run critical life-support systems strictly off the compact fission unit.
  * **Day 11 — Recovery:** Autonomous supply rover arrives with replacement filters and cells; repair full habitat or seal off into a compact emergency living module.
  * **Day 12 — The Final Check:** Compress all Arcadia and Jezero scientific datasets for burst transmission.
  * **Day 13 — Waiting:** Storm subsides; maintain cabin stability and resist unnecessary risks.
  * **Day 14 — The Signal:** Solar plasma interference clears; establish Mars relay lock and transmit survival & research logs to Earth.
* **The Core Dilemma — Science vs. Survival:**
  * *Option 1:* Keep the Jezero Sample Preservation Cryo-Unit at full power (preserves $100\%$ of astrobiology data, strains life support).
  * *Option 2:* Shut down cryo-storage to maximize heating, $\text{O}_2$, and water recycling (high survival margin, major data loss).
  * *Option 3:* Transfer only top-priority cores to a low-power micro-cooler (partial science, moderate safety).

---

## 7. Endings Matrix (`EndingScene.ts`)

| Ending | Title | Trigger Conditions | Narrative Outcome |
| :--- | :--- | :--- | :--- |
| **Ending A** | *SYNOR: Humanity Endures* | Astronaut survives Day 14 + Core life support intact + $\ge 75\%$ Arcadia & Jezero research preserved | Complete scientific triumph. Earth receives full water-ISRU and Jezero biosignature records and initiates an autonomous recovery mission. |
| **Ending B** | *SYNOR: The Price of Discovery* | Astronaut survives Day 14 + Sample storage powered down, habitat partially sealed, or $< 75\%$ data saved | Human life is prioritized over scientific cargo. Earth confirms survival and prepares recovery, though key Martian samples are lost. |
| **Ending C** | *SYNOR: Beyond the Signal* | Air, Water, or Thermal Stability hits $0\%$, $\text{CO}_2 > 5,000\text{ ppm}$, or Radiation exceeds lethal limit | When Earth communication resumes on Day 14, the Jezero Field Station is silent and uninhabitable; the data remains waiting on Mars. |

---

## 8. Step-by-Step Build Milestones

1. **Milestone 1 — Project Setup, Audio Bus & Seamless Menu Cutscene**
   * Initialize Vite + TypeScript + Phaser 3 (`1920x1080` `Phaser.Scale.FIT`).
   * Build `AudioManager` + `AudioSettingsModal` (Master, Music, SFX sliders only).
   * Build `StartMenuScene` with 4-layer Mars parallax, twinkling stars, asteroids, and `Camera` zoom-in cutscene transition.
2. **Milestone 2 — Reactive State Store & Resource Simulation Engine**
   * Implement `GameState.ts`, `localStorage` save/load slots, and `ResourceEngine.ts` (handling resource decay, $\text{CO}_2$ buildup, radiation dose, and water-tank shielding math).
   * Build persistent `HUDScene` with clean telemetry bars and Mission Control audio/text log feed.
3. **Milestone 3 — NASA Mars Trek Map & Traverse Planner**
   * Process Mars Trek global & crater rasters, implement `MarsGeo.ts` coordinate projections, and build `ExpeditionMapScene` for the $4,180\text{ km}$ and $3,790\text{ km}$ LREV journeys.
4. **Milestone 4 — Gale Base & Field Science Mini-Games**
   * Implement interactive point-and-click station modules in `GaleBaseScene`.
   * Build the 4 Arcadia subsurface ice experiments (`ArcadiaFieldScene`) and 4 Jezero delta/astrobiology experiments (`JezeroFieldScene`) plus the Option A / Option B branching point.
5. **Milestone 5 — 14-Day Solar Conjunction & Endings Polish**
   * Build `JezeroShelterScene` with breaker load-balancing, airlock EVA toggles, the 14-day event deck (`conjunction.json`), and `EndingScene` epilogues.