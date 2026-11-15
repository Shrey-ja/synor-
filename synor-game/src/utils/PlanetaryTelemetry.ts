import { MARS_SITES, MarsCoord, sampleMarsTrekTerrain } from './MarsGeo';

export interface TerrainTelemetry {
  id: 'gale' | 'jezero' | 'arcadia';
  site: MarsCoord;
  classification: string;
  roughness: 'LOW' | 'MODERATE' | 'SEVERE';
  dustTau: number;
  surfaceTemperatureK: number;
  waterIceProbability: number;
  solarEfficiency: number;
  biosignaturePriority: number;
}

export const TERRAIN_TELEMETRY: TerrainTelemetry[] = [
  {
    id: 'gale',
    site: MARS_SITES.GALE_CRATER,
    classification: 'Layered Sulfate Basin',
    roughness: 'MODERATE',
    dustTau: 0.72,
    surfaceTemperatureK: 208,
    waterIceProbability: 0.34,
    solarEfficiency: 0.98,
    biosignaturePriority: 0.68
  },
  {
    id: 'jezero',
    site: MARS_SITES.JEZERO_CRATER,
    classification: 'Alluvial Delta Scarp',
    roughness: 'SEVERE',
    dustTau: 1.42,
    surfaceTemperatureK: 209,
    waterIceProbability: 0.61,
    solarEfficiency: 0.92,
    biosignaturePriority: 0.96
  },
  {
    id: 'arcadia',
    site: MARS_SITES.ARCADIA_PLANITIA,
    classification: 'Subsurface Cryo-Plains',
    roughness: 'LOW',
    dustTau: 0.48,
    surfaceTemperatureK: 188,
    waterIceProbability: 0.93,
    solarEfficiency: 0.76,
    biosignaturePriority: 0.42
  }
];

export function getTerrainTelemetry(id: TerrainTelemetry['id']): TerrainTelemetry {
  return TERRAIN_TELEMETRY.find(terrain => terrain.id === id) ?? TERRAIN_TELEMETRY[0];
}

export function getTerrainAtCoordinate(lat: number, lon: number): TerrainTelemetry {
  const nearest = TERRAIN_TELEMETRY.reduce((best, terrain) => {
    const bestDistance = Math.abs(best.site.lat - lat) + Math.abs(best.site.lon - lon);
    const distance = Math.abs(terrain.site.lat - lat) + Math.abs(terrain.site.lon - lon);
    return distance < bestDistance ? terrain : best;
  });
  const sampled = sampleMarsTrekTerrain(lat, lon);
  return {
    ...nearest,
    site: { ...nearest.site, ...sampled, lat, lon }
  };
}

export async function fetchTelemetryWithFallback<T>(
  url: string,
  fallback: T,
  timeoutMs = 1800
): Promise<T> {
  if (typeof fetch === 'undefined') return fallback;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Telemetry HTTP ${response.status}`);
    return await response.json() as T;
  } catch (error) {
    console.warn('Planetary telemetry unavailable; using local fallback.', error);
    return fallback;
  } finally {
    window.clearTimeout(timeout);
  }
}

