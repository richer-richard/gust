// Procedural city generator for Gust simulation environment
// Generates deterministic building layouts, roads, and urban features

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
  zone: 'downtown' | 'midrise' | 'suburban';
}

export interface CityData {
  buildings: BuildingData[];
  gridSize: number;
  blockSize: number;
  roadWidth: number;
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

  const gridSize = 600; // meters total area
  const blockSize = 40; // meters per block
  const roadWidth = 12; // meters road width
  const cellSize = blockSize + roadWidth;

  const halfGrid = gridSize / 2;
  const numCells = Math.floor(gridSize / cellSize);

  // Downtown center coordinates
  const centerX = 0;
  const centerZ = 0;

  for (let gx = 0; gx < numCells; gx++) {
    for (let gz = 0; gz < numCells; gz++) {
      const blockX = -halfGrid + gx * cellSize + roadWidth / 2;
      const blockZ = -halfGrid + gz * cellSize + roadWidth / 2;
      const blockCenterX = blockX + blockSize / 2;
      const blockCenterZ = blockZ + blockSize / 2;

      // Distance from city center determines zone
      const distFromCenter = Math.sqrt(
        (blockCenterX - centerX) ** 2 + (blockCenterZ - centerZ) ** 2
      );

      let zone: BuildingData['zone'];
      if (distFromCenter < 80) {
        zone = 'downtown';
      } else if (distFromCenter < 180) {
        zone = 'midrise';
      } else {
        zone = 'suburban';
      }

      // Skip some blocks for parks/plazas
      if (rand() < 0.08) continue;

      // Number of buildings per block depends on zone
      const numBuildings =
        zone === 'downtown'
          ? Math.floor(1 + rand() * 3)
          : zone === 'midrise'
            ? Math.floor(1 + rand() * 4)
            : Math.floor(1 + rand() * 5);

      for (let b = 0; b < numBuildings; b++) {
        const localX = rand() * (blockSize - 8) + 4;
        const localZ = rand() * (blockSize - 8) + 4;

        let width: number, depth: number, height: number;

        if (zone === 'downtown') {
          width = 12 + rand() * 18;
          depth = 12 + rand() * 18;
          height = 35 + rand() * 85;
          // Occasional supertall
          if (rand() < 0.12) height = 100 + rand() * 60;
        } else if (zone === 'midrise') {
          width = 8 + rand() * 16;
          depth = 8 + rand() * 16;
          height = 12 + rand() * 35;
        } else {
          width = 6 + rand() * 12;
          depth = 6 + rand() * 12;
          height = 4 + rand() * 15;
        }

        // Building colors - concrete/glass tones
        const colorVariant = rand();
        let colorR: number, colorG: number, colorB: number;

        if (colorVariant < 0.3) {
          // Dark glass
          colorR = 0.12 + rand() * 0.08;
          colorG = 0.14 + rand() * 0.1;
          colorB = 0.18 + rand() * 0.12;
        } else if (colorVariant < 0.6) {
          // Concrete gray
          colorR = 0.35 + rand() * 0.15;
          colorG = 0.33 + rand() * 0.15;
          colorB = 0.32 + rand() * 0.12;
        } else if (colorVariant < 0.85) {
          // Warm beige
          colorR = 0.4 + rand() * 0.15;
          colorG = 0.35 + rand() * 0.12;
          colorB = 0.28 + rand() * 0.1;
        } else {
          // Blue-tinted glass
          colorR = 0.15 + rand() * 0.08;
          colorG = 0.2 + rand() * 0.1;
          colorB = 0.3 + rand() * 0.15;
        }

        buildings.push({
          x: blockX + localX,
          z: blockZ + localZ,
          width,
          depth,
          height,
          colorR,
          colorG,
          colorB,
          windowSeed: rand() * 1000,
          zone,
        });
      }
    }
  }

  return { buildings, gridSize, blockSize, roadWidth };
}

// Generate road network data for rendering
export function generateRoadLines(city: CityData): Array<[number, number, number, number]> {
  const lines: Array<[number, number, number, number]> = [];
  const { gridSize, blockSize, roadWidth } = city;
  const cellSize = blockSize + roadWidth;
  const halfGrid = gridSize / 2;
  const numCells = Math.floor(gridSize / cellSize) + 1;

  for (let i = 0; i < numCells; i++) {
    const pos = -halfGrid + i * cellSize;
    // Horizontal roads
    lines.push([pos, -halfGrid, pos, halfGrid]);
    // Vertical roads  
    lines.push([-halfGrid, pos, halfGrid, pos]);
  }

  return lines;
}
