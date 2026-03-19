// Procedural city generator for Gust simulation environment
// Giant city with variable road widths, mile-high supertalls, and zone-based heights

export interface BuildingData {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  colorR: number;
  colorG: number;
  colorB: number;
  windowSeed: number;
  zone: 'supertall' | 'downtown' | 'inner' | 'midrise' | 'suburban';
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
  litPercentage: number;
}

export type RoadType = 'boulevard' | 'standard' | 'alley';

export interface RoadLine {
  pos: number;
  axis: 'x' | 'z';
  width: number;
  type: RoadType;
}

export interface CityData {
  buildings: BuildingData[];
  gridSize: number;
  blockSize: number;
  roads: RoadLine[];
}

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCity(seed = 42): CityData {
  const rand = mulberry32(seed);
  const buildings: BuildingData[] = [];
  const roads: RoadLine[] = [];

  const gridSize = 4000; // 4km total area
  const blockSize = 50;
  const halfGrid = gridSize / 2;

  // Generate road grid with variable widths
  const numCellsX = Math.floor(gridSize / 60);
  const numCellsZ = Math.floor(gridSize / 60);

  // Build road arrays for X and Z axes
  const xRoads: { pos: number; width: number; type: RoadType }[] = [];
  const zRoads: { pos: number; width: number; type: RoadType }[] = [];

  let posAccum = -halfGrid;
  for (let i = 0; i <= numCellsX; i++) {
    let roadWidth: number;
    let roadType: RoadType;
    if (i % 4 === 0) {
      roadWidth = 32;
      roadType = 'boulevard';
    } else if (rand() < 0.25) {
      roadWidth = 5;
      roadType = 'alley';
    } else {
      roadWidth = 14;
      roadType = 'standard';
    }
    xRoads.push({ pos: posAccum, width: roadWidth, type: roadType });
    roads.push({ pos: posAccum, axis: 'x', width: roadWidth, type: roadType });
    posAccum += roadWidth + blockSize + rand() * 8;
    if (posAccum > halfGrid + 100) break;
  }

  posAccum = -halfGrid;
  for (let i = 0; i <= numCellsZ; i++) {
    let roadWidth: number;
    let roadType: RoadType;
    if (i % 4 === 0) {
      roadWidth = 32;
      roadType = 'boulevard';
    } else if (rand() < 0.25) {
      roadWidth = 5;
      roadType = 'alley';
    } else {
      roadWidth = 14;
      roadType = 'standard';
    }
    zRoads.push({ pos: posAccum, width: roadWidth, type: roadType });
    roads.push({ pos: posAccum, axis: 'z', width: roadWidth, type: roadType });
    posAccum += roadWidth + blockSize + rand() * 8;
    if (posAccum > halfGrid + 100) break;
  }

  // Place fixed supertall anchors near downtown (outside 60m spawn clearing)
  const supertallPositions = [
    { x: 120, z: -90 },
    { x: -100, z: 110 },
  ];
  for (const st of supertallPositions) {
    const height = 1400 + rand() * 200; // 1400-1600m
    const w = 30 + rand() * 20;
    const d = 30 + rand() * 20;
    buildings.push(makeBuilding(rand, st.x, st.z, w, d, height, 'supertall'));
  }

  // Fill blocks with buildings based on zone
  for (let xi = 0; xi < xRoads.length - 1; xi++) {
    for (let zi = 0; zi < zRoads.length - 1; zi++) {
      const blockX = xRoads[xi].pos + xRoads[xi].width;
      const blockZ = zRoads[zi].pos + zRoads[zi].width;
      const blockW = (xRoads[xi + 1]?.pos ?? blockX + blockSize) - blockX;
      const blockD = (zRoads[zi + 1]?.pos ?? blockZ + blockSize) - blockZ;

      if (blockW < 10 || blockD < 10) continue;

      const centerX = blockX + blockW / 2;
      const centerZ = blockZ + blockD / 2;
      const dist = Math.sqrt(centerX * centerX + centerZ * centerZ);

      let zone: BuildingData['zone'];
      if (dist < 250) zone = 'downtown';
      else if (dist < 600) zone = 'inner';
      else if (dist < 1400) zone = 'midrise';
      else zone = 'suburban';

      // Skip some blocks for parks/plazas
      if (rand() < 0.06) continue;

      const numBuildings =
        zone === 'downtown' ? Math.floor(1 + rand() * 2)
          : zone === 'inner' ? Math.floor(1 + rand() * 3)
            : zone === 'midrise' ? Math.floor(1 + rand() * 4)
              : Math.floor(1 + rand() * 5);

      for (let b = 0; b < numBuildings; b++) {
        const localX = rand() * (blockW - 8) + 4;
        const localZ = rand() * (blockD - 8) + 4;
        const bx = blockX + localX;
        const bz = blockZ + localZ;

        // Skip if too close to supertall anchors
        const nearSupertall = supertallPositions.some(
          (st) => Math.abs(bx - st.x) < 40 && Math.abs(bz - st.z) < 40
        );
        if (nearSupertall) continue;

        // Skip if inside spawn clearing — keep a 60m radius around (0,0) clear
        // so the drone starts on a visible "road" without clipping buildings
        if (Math.abs(bx) < 60 && Math.abs(bz) < 60) continue;

        let width: number, depth: number, height: number;

        if (zone === 'downtown') {
          width = 14 + rand() * 20;
          depth = 14 + rand() * 20;
          height = 150 + rand() * 250;
          if (rand() < 0.08) height = 400 + rand() * 200; // occasional 400-600m
        } else if (zone === 'inner') {
          width = 10 + rand() * 18;
          depth = 10 + rand() * 18;
          height = 35 + rand() * 85;
        } else if (zone === 'midrise') {
          width = 8 + rand() * 16;
          depth = 8 + rand() * 16;
          height = 12 + rand() * 33;
        } else {
          width = 6 + rand() * 12;
          depth = 6 + rand() * 12;
          height = 4 + rand() * 14;
        }

        buildings.push(makeBuilding(rand, bx, bz, width, depth, height, zone));
      }
    }
  }

  return { buildings, gridSize, blockSize, roads };
}

function makeBuilding(
  rand: () => number,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  zone: BuildingData['zone'],
): BuildingData {
  const colorVariant = rand();
  let colorR: number, colorG: number, colorB: number;

  if (colorVariant < 0.3) {
    colorR = 0.12 + rand() * 0.08;
    colorG = 0.14 + rand() * 0.1;
    colorB = 0.18 + rand() * 0.12;
  } else if (colorVariant < 0.6) {
    colorR = 0.35 + rand() * 0.15;
    colorG = 0.33 + rand() * 0.15;
    colorB = 0.32 + rand() * 0.12;
  } else if (colorVariant < 0.85) {
    colorR = 0.4 + rand() * 0.15;
    colorG = 0.35 + rand() * 0.12;
    colorB = 0.28 + rand() * 0.1;
  } else {
    colorR = 0.15 + rand() * 0.08;
    colorG = 0.2 + rand() * 0.1;
    colorB = 0.3 + rand() * 0.15;
  }

  const floorHeight = 3.5;
  const windowBayWidth = 2.0;
  const floors = Math.max(1, Math.floor(height / floorHeight));
  const windowsPerFloor = Math.max(1, Math.floor(width / windowBayWidth));
  const sideWindowsPerFloor = Math.max(1, Math.floor(depth / windowBayWidth));
  const litPercentage =
    zone === 'supertall' ? 0.65 + rand() * 0.25
      : zone === 'downtown' ? 0.55 + rand() * 0.3
        : zone === 'inner' ? 0.4 + rand() * 0.25
          : zone === 'midrise' ? 0.35 + rand() * 0.25
            : 0.15 + rand() * 0.2;

  return {
    x, z, width, depth, height,
    colorR, colorG, colorB,
    windowSeed: rand() * 1000,
    zone, floors, windowsPerFloor, sideWindowsPerFloor, litPercentage,
  };
}

// Generate road network data for rendering
export function generateRoadLines(city: CityData): Array<[number, number, number, number]> {
  const lines: Array<[number, number, number, number]> = [];
  const half = city.gridSize / 2;

  for (const road of city.roads) {
    if (road.axis === 'x') {
      // Vertical road line at road.pos
      lines.push([road.pos, -half, road.pos, half]);
    } else {
      // Horizontal road line at road.pos
      lines.push([-half, road.pos, half, road.pos]);
    }
  }

  return lines;
}
