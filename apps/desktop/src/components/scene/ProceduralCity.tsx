/**
 * ProceduralCity - GPU-efficient city using a prebaked window texture atlas.
 *
 * Instead of computing window grids per-pixel with trig hashes (expensive),
 * we prebake a 2048×2048 Canvas atlas with 6 lit-percentage bands.
 * Each building samples a unique region via per-instance UV attributes.
 * Inspired by git-city's InstancedBuildings approach.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { generateCity } from '../../lib/cityGenerator';

// ─── Atlas Constants ───────────────────────────────────────────
const ATLAS_SIZE = 2048;
const ATLAS_CELL = 8; // 6px window + 2px gap
const ATLAS_COLS = ATLAS_SIZE / ATLAS_CELL; // 256
const ATLAS_BAND_ROWS = 42; // rows per lit-percentage band
const ATLAS_LIT_PCTS = [0.20, 0.35, 0.50, 0.65, 0.80, 0.95];
const WINDOW_PX = 6;

// Window color palette
const FACE_COLOR = '#1a1e26'; // dark building face between windows
const WINDOW_OFF = '#0a0c10'; // unlit window
const WINDOW_LIT_COLORS = [
  '#fff5d4', // warm white
  '#ffe0a0', // warm amber
  '#d4e8ff', // cool blue-white
  '#ffd080', // golden
];

/**
 * Create the window texture atlas.
 * 6 horizontal bands, each 42 rows of 256 window cells.
 * Uses Uint32Array direct pixel writes for speed (10-50x faster than fillRect).
 */
function createWindowAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const buf32 = new Uint32Array(imageData.data.buffer);

  // Parse hex to ABGR uint32 (little-endian)
  const hexToABGR = (hex: string): number => {
    const c = new THREE.Color(hex);
    return (
      (255 << 24) |
      (Math.round(c.b * 255) << 16) |
      (Math.round(c.g * 255) << 8) |
      Math.round(c.r * 255)
    );
  };

  const faceABGR = hexToABGR(FACE_COLOR);
  const offABGR = hexToABGR(WINDOW_OFF);
  const litABGRs = WINDOW_LIT_COLORS.map(hexToABGR);

  // Fill background with face color
  buf32.fill(faceABGR);

  // Seeded PRNG for deterministic atlas
  let s = 42;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let band = 0; band < ATLAS_LIT_PCTS.length; band++) {
    const litPct = ATLAS_LIT_PCTS[band];
    const bandStartRow = band * ATLAS_BAND_ROWS;

    for (let r = 0; r < ATLAS_BAND_ROWS; r++) {
      const rowY = (bandStartRow + r) * ATLAS_CELL;
      for (let c = 0; c < ATLAS_COLS; c++) {
        const px = c * ATLAS_CELL;
        const abgr =
          rand() < litPct
            ? litABGRs[Math.floor(rand() * litABGRs.length)]
            : offABGR;

        // Write WINDOW_PX × WINDOW_PX pixel block
        for (let dy = 0; dy < WINDOW_PX; dy++) {
          const rowOffset = (rowY + dy) * ATLAS_SIZE + px;
          for (let dx = 0; dx < WINDOW_PX; dx++) {
            buf32[rowOffset + dx] = abgr;
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Building Shader (atlas-based) ────────────────────────────
const buildingVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  // Per-instance attributes
  attribute vec3 instanceColorAttr;
  attribute vec4 aUvFront;   // offset.xy + repeat.zw for front/back faces
  attribute vec4 aUvSide;    // offset.xy + repeat.zw for left/right faces

  varying vec3 vBuildingColor;
  varying vec4 vUvFront;
  varying vec4 vUvSide;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vBuildingColor = instanceColorAttr;
    vUvFront = aUvFront;
    vUvSide = aUvSide;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const buildingFragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vBuildingColor;
  varying vec4 vUvFront;
  varying vec4 vUvSide;

  void main() {
    vec3 absN = abs(vNormal);
    float isRoof = step(0.5, absN.y);

    // Roof — slightly different shade, simple lighting
    if (isRoof > 0.5) {
      vec3 roofColor = vBuildingColor * 0.7 + vec3(0.05, 0.04, 0.03);
      float diffuse = max(dot(vNormal, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
      vec3 lit = roofColor * (0.3 + 0.7 * diffuse);

      // Fog
      float dist = length(vWorldPosition - cameraPosition);
      float fogFactor = smoothstep(100.0, 900.0, dist);
      lit = mix(lit, vec3(0.10, 0.125, 0.19), fogFactor);

      gl_FragColor = vec4(lit, 1.0);
      return;
    }

    // Wall faces — sample atlas texture
    // Choose UV params based on face direction
    bool isFrontBack = absN.z > absN.x;
    vec4 uvParams = isFrontBack ? vUvFront : vUvSide;

    // Sample atlas at the per-instance UV region
    vec2 atlasUv = uvParams.xy + vUv * uvParams.zw;
    vec3 windowColor = texture2D(uAtlas, atlasUv).rgb;

    // Emissive glow for lit windows
    float windowBrightness = dot(windowColor, vec3(0.299, 0.587, 0.114));
    float isLitWindow = step(0.15, windowBrightness);

    // Wall color with simple lighting
    float diffuse = max(dot(vNormal, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
    vec3 wallColor = vBuildingColor * (0.3 + 0.7 * diffuse);

    // AO at building base
    float ao = smoothstep(0.0, 8.0, vWorldPosition.y);
    wallColor *= (0.5 + 0.5 * ao);

    // Composite: dark face pixels show building color, lit pixels show window light
    // Atlas face pixels are dark (#1a1e26), windows are brighter
    vec3 faceRef = vec3(0.10, 0.12, 0.15);
    float isFacePixel = 1.0 - step(0.08, length(windowColor - faceRef));
    vec3 finalColor = mix(windowColor, wallColor, isFacePixel);

    // Window emissive boost for bloom
    finalColor += windowColor * isLitWindow * 0.3;

    // Distance fog
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(100.0, 900.0, dist);
    finalColor = mix(finalColor, vec3(0.10, 0.125, 0.19), fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ─── Ground Shader ────────────────────────────────────────────
const groundVertexShader = /* glsl */ `
  varying vec2 vWorldXZ;
  varying float vDist;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPos.xz;
    vDist = length(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const groundFragmentShader = /* glsl */ `
  varying vec2 vWorldXZ;
  varying float vDist;

  uniform float uBlockSize;
  uniform float uRoadWidth;

  void main() {
    float cellSize = uBlockSize + uRoadWidth;
    vec2 cellPos = mod(vWorldXZ + cellSize * 0.5, cellSize);

    float roadX = step(cellPos.x, uRoadWidth) + step(cellSize - uRoadWidth, cellPos.x);
    float roadZ = step(cellPos.y, uRoadWidth) + step(cellSize - uRoadWidth, cellPos.y);
    float isRoad = min(1.0, roadX + roadZ);

    // Road markings
    float isCenterLine = 0.0;
    if (isRoad > 0.5) {
      if (roadX > 0.5) {
        float stripe = step(0.5, fract(vWorldXZ.y * 0.15));
        isCenterLine = step(abs(cellPos.x - uRoadWidth * 0.5), 0.15) * stripe;
        isCenterLine += step(abs(cellPos.x - (cellSize - uRoadWidth * 0.5)), 0.15) * stripe;
      }
      if (roadZ > 0.5) {
        float stripe = step(0.5, fract(vWorldXZ.x * 0.15));
        isCenterLine += step(abs(cellPos.y - uRoadWidth * 0.5), 0.15) * stripe;
        isCenterLine += step(abs(cellPos.y - (cellSize - uRoadWidth * 0.5)), 0.15) * stripe;
      }
      isCenterLine = min(1.0, isCenterLine);
    }

    vec3 asphaltColor = vec3(0.08, 0.08, 0.09);
    vec3 sidewalkColor = vec3(0.18, 0.17, 0.16);
    vec3 lineColor = vec3(0.7, 0.7, 0.5);
    vec3 grassColor = vec3(0.04, 0.08, 0.03);

    float isSidewalk = 0.0;
    if (isRoad < 0.5) {
      float dxRoad = min(cellPos.x, cellSize - cellPos.x);
      float dzRoad = min(cellPos.y, cellSize - cellPos.y);
      float minDist = min(dxRoad, dzRoad);
      isSidewalk = 1.0 - step(1.5, minDist - uRoadWidth);
    }

    vec3 color = grassColor;
    if (isRoad > 0.5) {
      color = mix(asphaltColor, lineColor, isCenterLine);
    } else if (isSidewalk > 0.5) {
      color = sidewalkColor;
    }

    float fogFactor = smoothstep(100.0, 900.0, vDist);
    color = mix(color, vec3(0.10, 0.125, 0.19), fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Component ────────────────────────────────────────────────
export function ProceduralCity() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const cityData = useMemo(() => generateCity(42), []);

  // Create the window texture atlas (once)
  const atlasTexture = useMemo(() => createWindowAtlas(), []);

  // Dispose atlas on unmount
  useEffect(() => {
    return () => atlasTexture.dispose();
  }, [atlasTexture]);

  // Create instanced geometry with per-instance attributes
  const { geometry, count } = useMemo(() => {
    const buildings = cityData.buildings;
    const count = buildings.length;
    const geo = new THREE.BoxGeometry(1, 1, 1);

    // Per-instance data buffers
    const colors = new Float32Array(count * 3);
    const uvFront = new Float32Array(count * 4); // offset.xy + repeat.zw
    const uvSide = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const b = buildings[i];

      // Colors
      colors[i * 3] = b.colorR;
      colors[i * 3 + 1] = b.colorG;
      colors[i * 3 + 2] = b.colorB;

      // Determine atlas band from lit percentage
      const bandIndex = Math.min(
        ATLAS_LIT_PCTS.length - 1,
        Math.max(0, Math.round(b.litPercentage * (ATLAS_LIT_PCTS.length - 1)))
      );
      const bandRowOffset = bandIndex * ATLAS_BAND_ROWS;

      // Unique seed for column offset (deterministic per building)
      const seed =
        b.windowSeed * 137 +
        Math.floor(b.x * 7) +
        Math.floor(b.z * 13);

      // Front face UV — sample windowsPerFloor columns × floors rows
      const frontColStart = Math.abs(
        Math.floor(seed) % Math.max(1, ATLAS_COLS - b.windowsPerFloor)
      );
      uvFront[i * 4 + 0] = frontColStart / ATLAS_COLS; // offset.x
      uvFront[i * 4 + 1] = bandRowOffset / ATLAS_COLS; // offset.y
      uvFront[i * 4 + 2] = b.windowsPerFloor / ATLAS_COLS; // repeat.x
      uvFront[i * 4 + 3] = b.floors / ATLAS_COLS; // repeat.y

      // Side face UV — different column start for visual variety
      const sideColStart = Math.abs(
        Math.floor(seed + 7919) %
          Math.max(1, ATLAS_COLS - b.sideWindowsPerFloor)
      );
      uvSide[i * 4 + 0] = sideColStart / ATLAS_COLS;
      uvSide[i * 4 + 1] = bandRowOffset / ATLAS_COLS;
      uvSide[i * 4 + 2] = b.sideWindowsPerFloor / ATLAS_COLS;
      uvSide[i * 4 + 3] = b.floors / ATLAS_COLS;
    }

    geo.setAttribute(
      'instanceColorAttr',
      new THREE.InstancedBufferAttribute(colors, 3)
    );
    geo.setAttribute(
      'aUvFront',
      new THREE.InstancedBufferAttribute(uvFront, 4)
    );
    geo.setAttribute(
      'aUvSide',
      new THREE.InstancedBufferAttribute(uvSide, 4)
    );

    return { geometry: geo, count };
  }, [cityData]);

  // Set instance transforms
  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    cityData.buildings.forEach((b, i) => {
      dummy.position.set(b.x, b.height / 2, b.z);
      dummy.scale.set(b.width, b.height, b.depth);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [cityData]);

  // Building material with atlas
  const buildingMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: buildingVertexShader,
        fragmentShader: buildingFragmentShader,
        uniforms: {
          uAtlas: { value: atlasTexture },
        },
      }),
    [atlasTexture]
  );

  // Ground material — use average standard road width since variable roads
  const groundMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: groundVertexShader,
        fragmentShader: groundFragmentShader,
        uniforms: {
          uBlockSize: { value: cityData.blockSize },
          uRoadWidth: { value: 14.0 },
        },
      }),
    [cityData]
  );

  return (
    <group>
      {/* Ground plane — covers 4km city */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        material={groundMaterial}
      >
        <planeGeometry args={[4200, 4200, 1, 1]} />
      </mesh>

      {/* Buildings — single draw call via InstancedMesh */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, buildingMaterial, count]}
        frustumCulled={false}
      />
    </group>
  );
}
