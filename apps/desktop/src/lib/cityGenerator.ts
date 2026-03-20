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
  roadWidth: number;
  plazaHalfExtent: number;
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
  const buildings: BuildingData[] = [];
  const roads: RoadLine[] = [];

  const gridSize = 5600;
  const blockSize = 60;
  const roadWidth = 16;
  const plazaHalfExtent = 170;
  const halfGrid = gridSize / 2;
  const cellSize = blockSize + roadWidth;
  const maxCellIndex = Math.floor(halfGrid / cellSize);

  for (let i = -maxCellIndex; i <= maxCellIndex; i++) {
    const pos = i * cellSize - roadWidth * 0.5;
    const type: RoadType =
      i === 0 ? 'boulevard' : i % 5 === 0 ? 'boulevard' : i % 2 === 0 ? 'standard' : 'alley';
    const width = type === 'boulevard' ? roadWidth + 8 : type === 'standard' ? roadWidth : 8;
    roads.push({ pos, axis: 'x', width, type });
    roads.push({ pos, axis: 'z', width, type });
  }

  const supertallAnchors = [
    { x: -520, z: -280, width: 42, depth: 38, height: 760 },
    { x: 520, z: -220, width: 40, depth: 36, height: 700 },
    { x: -640, z: 120, width: 46, depth: 42, height: 980 },
    { x: 360, z: 560, width: 34, depth: 34, height: 560 },
    { x: 760, z: 420, width: 48, depth: 44, height: 1100 },
  ];
  const downtownAnchors = [
    { x: 240, z: -80, width: 34, depth: 30, height: 240 },
    { x: -250, z: 120, width: 38, depth: 32, height: 280 },
    { x: 110, z: 265, width: 32, depth: 32, height: 220 },
    { x: -120, z: -285, width: 34, depth: 30, height: 250 },
    { x: 330, z: 180, width: 28, depth: 26, height: 200 },
    { x: -345, z: -140, width: 30, depth: 28, height: 220 },
    { x: 60, z: -370, width: 26, depth: 24, height: 180 },
    { x: -70, z: 385, width: 28, depth: 24, height: 190 },
  ];
  for (const anchor of downtownAnchors) {
    const towerRand = mulberry32(
      ((seed * 3001) ^ Math.floor(anchor.x * 13) ^ Math.floor(anchor.z * 19)) >>> 0
    );
    buildings.push(
      makeBuilding(
        towerRand,
        anchor.x,
        anchor.z,
        anchor.width,
        anchor.depth,
        anchor.height * (0.94 + towerRand() * 0.1),
        'downtown'
      )
    );
  }
  for (const anchor of supertallAnchors) {
    const towerRand = mulberry32(
      ((seed * 1009) ^ Math.floor(anchor.x * 31) ^ Math.floor(anchor.z * 17)) >>> 0
    );
    buildings.push(
      makeBuilding(
        towerRand,
        anchor.x,
        anchor.z,
        anchor.width,
        anchor.depth,
        anchor.height * (0.92 + towerRand() * 0.16),
        'supertall'
      )
    );
  }

  for (let xi = -maxCellIndex; xi <= maxCellIndex; xi++) {
    const centerX = xi * cellSize;
    if (Math.abs(centerX) > halfGrid - blockSize * 0.5) continue;

    for (let zi = -maxCellIndex; zi <= maxCellIndex; zi++) {
      const centerZ = zi * cellSize;
      if (Math.abs(centerZ) > halfGrid - blockSize * 0.5) continue;

      if (Math.abs(centerX) < plazaHalfExtent && Math.abs(centerZ) < plazaHalfExtent) {
        continue;
      }

      const dist = Math.hypot(centerX, centerZ);
      const angle = Math.atan2(centerZ, centerX);
      const cellSeed =
        (((xi + 4096) * 73856093) ^ ((zi + 4096) * 19349663) ^ (seed * 83492791)) >>> 0;
      const rand = mulberry32(cellSeed);
      const sectorDensity =
        0.78 +
        (Math.sin(angle * 3.0 + dist * 0.0012) * 0.22) +
        rand() * 0.18;

      let zone: BuildingData['zone'];
      if (dist < plazaHalfExtent + 360) zone = 'downtown';
      else if (dist < 1180) zone = 'inner';
      else if (dist < 2050) zone = 'midrise';
      else zone = 'suburban';

      const nearAnchor = [...downtownAnchors, ...supertallAnchors].some(
        (anchor) => Math.abs(centerX - anchor.x) < 70 && Math.abs(centerZ - anchor.z) < 70
      );
      if (nearAnchor) continue;

      const occupancyChance =
        zone === 'downtown' ? 0.98
          : zone === 'inner' ? 0.9 * sectorDensity
            : zone === 'midrise' ? 0.72 * sectorDensity
              : 0.4 * sectorDensity;
      if (rand() > clamp(occupancyChance, 0.12, 0.98)) continue;

      const parkChance =
        zone === 'downtown' ? 0.025
          : zone === 'inner' ? 0.06
            : zone === 'midrise' ? 0.12
              : 0.18;
      if (rand() < parkChance) continue;

      const columns = zone === 'downtown' ? 2 : zone === 'inner' ? 2 : 1;
      const rows = zone === 'downtown' ? 2 : zone === 'inner' ? 2 : zone === 'midrise' ? 2 : 1;
      const slots = buildSlots(centerX, centerZ, blockSize, columns, rows);
      shuffle(slots, rand);

      const targetCount =
        zone === 'downtown' ? 3 + Math.floor(rand() * 2.4)
          : zone === 'inner' ? 2 + Math.floor(rand() * 2.2)
            : zone === 'midrise' ? 1 + Math.floor(rand() * 2.0)
              : 1 + Math.floor(rand() * 1.2);
      const count = Math.min(slots.length, targetCount);

      for (let index = 0; index < count; index++) {
        const slot = slots[index];
        const density = clamp(sectorDensity, 0.6, 1.25);

        const widthBase =
          zone === 'downtown' ? 11 + rand() * 9
            : zone === 'inner' ? 13 + rand() * 11
              : zone === 'midrise' ? 14 + rand() * 12
                : 18 + rand() * 14;
        const depthBase =
          zone === 'downtown' ? 11 + rand() * 9
            : zone === 'inner' ? 13 + rand() * 10
              : zone === 'midrise' ? 14 + rand() * 11
                : 18 + rand() * 14;

        const width = clamp(widthBase, 10, slot.maxWidth);
        const depth = clamp(depthBase, 10, slot.maxDepth);
        const jitterX = (rand() - 0.5) * slot.maxWidth * 0.16;
        const jitterZ = (rand() - 0.5) * slot.maxDepth * 0.16;

        let height: number;
        if (zone === 'downtown') {
          height = 180 + rand() * 260 * density;
          if (rand() < 0.18 * density) {
            height += 180 + rand() * 240;
          }
        } else if (zone === 'inner') {
          height = 70 + rand() * 170 * density;
        } else if (zone === 'midrise') {
          height = 28 + rand() * 90 * density;
        } else {
          height = 12 + rand() * 46 * density;
        }

        buildings.push(
          makeBuilding(
            rand,
            slot.x + jitterX,
            slot.z + jitterZ,
            width,
            depth,
            height,
            zone
          )
        );
      }
    }
  }

  return { buildings, gridSize, blockSize, roadWidth, plazaHalfExtent, roads };
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

function buildSlots(
  centerX: number,
  centerZ: number,
  blockSize: number,
  columns: number,
  rows: number,
): Array<{ x: number; z: number; maxWidth: number; maxDepth: number }> {
  const inset = columns > 1 || rows > 1 ? 4 : 6;
  const usable = blockSize - inset * 2;
  const cellWidth = usable / columns;
  const cellDepth = usable / rows;
  const slots: Array<{ x: number; z: number; maxWidth: number; maxDepth: number }> = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      slots.push({
        x: centerX - usable * 0.5 + cellWidth * (col + 0.5),
        z: centerZ - usable * 0.5 + cellDepth * (row + 0.5),
        maxWidth: cellWidth - 3,
        maxDepth: cellDepth - 3,
      });
    }
  }

  return slots;
}

function shuffle<T>(items: T[], rand: () => number): void {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rand() * (index + 1));
    const temp = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = temp;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
