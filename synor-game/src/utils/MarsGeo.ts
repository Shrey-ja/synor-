/**
 * Mars Topographic & Geographic Coordinate Projection Helper
 * Hard-Science calculations based on NASA Mars Trek coordinate space
 */

export interface MarsCoord {
  lat: number; // degrees (-90 to +90)
  lon: number; // degrees (-180 to +180 or 0 to 360)
  name: string;
  elevationMeters?: number;
  description?: string;
}

export const MARS_RADIUS_KM = 3389.5;

// Key Mission Exploration Sites from NASA Mars Trek
export const MARS_SITES: Record<string, MarsCoord> = {
  GALE_CRATER: {
    lat: -5.4,
    lon: 137.8,
    name: 'Gale Crater (Aeolis Mons)',
    elevationMeters: -4500,
    description: 'Homebase origin. Sedimentary strata of Mount Sharp and clay-rich mudstones.'
  },
  ARCADIA_PLANITIA: {
    lat: 46.7,
    lon: -168.0, // or 192.0 E
    name: 'Arcadia Planitia',
    elevationMeters: -3200,
    description: 'Smooth northern lowlands with shallow subsurface slab ice in polygonal ground.'
  },
  JEZERO_CRATER: {
    lat: 18.38,
    lon: 77.58,
    name: 'Jezero Crater (Ancient Delta)',
    elevationMeters: -2500,
    description: '45 km impact crater hosting pristine river delta sediments and biosignature targets.'
  }
};

// Pre-positioned NASA Autonomous Cargo Depots along traverse routes
export const CARGO_DEPOTS: MarsCoord[] = [
  { lat: 15.0, lon: 152.0, name: 'Depot Alpha (Elysium Border)', description: 'Methane fuel & spare wheel assemblies' },
  { lat: 31.0, lon: 168.0, name: 'Depot Beta (Phlegra Dorsa)', description: 'O2 cryo-cylinders and battery packs' },
  { lat: 8.0, lon: 108.0, name: 'Depot Gamma (Syrtis Major East)', description: 'Sealed food rations & ECLSS filter cartridges' },
  { lat: 14.5, lon: 92.0, name: 'Depot Delta (Isidis Basin Edge)', description: 'High-gain radio relay & drill bits' }
];

/**
 * Projects Martian latitude and longitude onto Phaser canvas coordinates (x, y)
 * @param lat Latitude in degrees [-90, +90]
 * @param lon Longitude in degrees [-180, +180] (or [0, 360])
 * @param width Canvas width
 * @param height Canvas height
 */
export function projectMarsToCanvas(lat: number, lon: number, width: number, height: number): { x: number; y: number } {
  // Normalize longitude to [-180, 180]
  let normalizedLon = lon;
  while (normalizedLon > 180) normalizedLon -= 360;
  while (normalizedLon < -180) normalizedLon += 360;

  const x = ((normalizedLon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;

  return { x, y };
}

/**
 * Converts canvas coordinates back to Martian latitude and longitude
 */
export function projectCanvasToMars(x: number, y: number, width: number, height: number): { lat: number; lon: number } {
  const lon = (x / width) * 360 - 180;
  const lat = 90 - (y / height) * 180;
  return { lat, lon };
}

/**
 * Calculates Great-Circle Traverse Distance on Mars using Spherical Law of Cosines
 * d = R_Mars * arccos(sin(lat1) * sin(lat2) + cos(lat1) * cos(lat2) * cos(lon2 - lon1))
 * Returns distance in kilometres (km)
 */
export function calculateTraverseDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const cosTheta = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  // Clamp between -1 and 1 to prevent floating point domain errors
  const clampedCos = Math.max(-1, Math.min(1, cosTheta));
  const angularDistance = Math.acos(clampedCos);

  return Math.round(MARS_RADIUS_KM * angularDistance);
}

/**
 * Interpolates points along a Great Circle route for autonomous LREV traverse pathing
 */
export function getTraverseWaypoints(
  start: MarsCoord,
  end: MarsCoord,
  numSegments: number = 8
): { lat: number; lon: number; fraction: number }[] {
  const points: { lat: number; lon: number; fraction: number }[] = [];
  for (let i = 0; i <= numSegments; i++) {
    const f = i / numSegments;
    // Linear approximation across Martian coordinate space for smooth waypoint plotting
    const lat = start.lat + (end.lat - start.lat) * f;
    let lon = start.lon + (end.lon - start.lon) * f;
    points.push({ lat, lon, fraction: f });
  }
  return points;
}

