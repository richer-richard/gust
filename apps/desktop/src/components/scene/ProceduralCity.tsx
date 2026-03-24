/**
 * ProceduralCity - Renders the backend-authored world layout with instanced towers.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SceneTheme } from '../../lib/theme';
import type { WorldBuilding, WorldLayout } from '../../lib/types';

const ATLAS_SIZE = 2048;
const ATLAS_CELL = 8;
const ATLAS_COLS = ATLAS_SIZE / ATLAS_CELL;
const ATLAS_BAND_ROWS = 42;
const ATLAS_LIT_PCTS = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];
const WINDOW_PX = 6;

function createWindowAtlas(theme: SceneTheme): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('failed to create city atlas canvas context');
  }

  const imageData = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const buf32 = new Uint32Array(imageData.data.buffer);

  const hexToABGR = (hex: string): number => {
    const color = new THREE.Color(hex);
    return (
      (255 << 24) |
      (Math.round(color.b * 255) << 16) |
      (Math.round(color.g * 255) << 8) |
      Math.round(color.r * 255)
    );
  };

  const faceABGR = hexToABGR(theme.city.faceColor);
  const offABGR = hexToABGR(theme.city.windowOff);
  const litABGRs = theme.city.windowLitColors.map(hexToABGR);

  buf32.fill(faceABGR);

  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let band = 0; band < ATLAS_LIT_PCTS.length; band += 1) {
    const litPct = ATLAS_LIT_PCTS[band];
    const bandStartRow = band * ATLAS_BAND_ROWS;

    for (let row = 0; row < ATLAS_BAND_ROWS; row += 1) {
      const rowY = (bandStartRow + row) * ATLAS_CELL;
      for (let col = 0; col < ATLAS_COLS; col += 1) {
        const px = col * ATLAS_CELL;
        const abgr =
          rand() < litPct
            ? litABGRs[Math.floor(rand() * litABGRs.length)]
            : offABGR;

        for (let dy = 0; dy < WINDOW_PX; dy += 1) {
          const rowOffset = (rowY + dy) * ATLAS_SIZE + px;
          for (let dx = 0; dx < WINDOW_PX; dx += 1) {
            buf32[rowOffset + dx] = abgr;
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const buildingVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  attribute vec3 instanceColorAttr;
  attribute vec4 aUvFront;
  attribute vec4 aUvSide;

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
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uFaceReference;
  uniform float uRoofWarmth;
  uniform float uWindowEmissive;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vBuildingColor;
  varying vec4 vUvFront;
  varying vec4 vUvSide;

  void main() {
    if (vNormal.y > 0.5) {
      vec3 roofColor = vBuildingColor * 0.76 + vec3(uRoofWarmth);
      float diffuse = max(dot(vNormal, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
      vec3 lit = roofColor * (0.3 + 0.7 * diffuse);
      float dist = length(vWorldPosition - cameraPosition);
      float fogFactor = smoothstep(uFogNear, uFogFar, dist);
      gl_FragColor = vec4(mix(lit, uFogColor, fogFactor), 1.0);
      return;
    }

    if (vNormal.y < -0.5) {
      vec3 undersideColor = vBuildingColor * 0.2;
      float dist = length(vWorldPosition - cameraPosition);
      float fogFactor = smoothstep(uFogNear, uFogFar, dist);
      gl_FragColor = vec4(mix(undersideColor, uFogColor, fogFactor), 1.0);
      return;
    }

    vec3 absN = abs(vNormal);
    bool isFrontBack = absN.z > absN.x;
    vec4 uvParams = isFrontBack ? vUvFront : vUvSide;
    vec2 atlasUv = uvParams.xy + vUv * uvParams.zw;
    vec3 windowColor = texture2D(uAtlas, atlasUv).rgb;

    float windowBrightness = dot(windowColor, vec3(0.299, 0.587, 0.114));
    float isLitWindow = step(0.15, windowBrightness);

    float diffuse = max(dot(vNormal, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
    vec3 wallColor = vBuildingColor * (0.32 + 0.68 * diffuse);

    float ao = smoothstep(0.0, 8.0, vWorldPosition.y);
    wallColor *= (0.5 + 0.5 * ao);

    float isFacePixel = 1.0 - step(0.08, length(windowColor - uFaceReference));
    vec3 finalColor = mix(windowColor, wallColor, isFacePixel);
    finalColor += windowColor * isLitWindow * uWindowEmissive;

    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    finalColor = mix(finalColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

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
  uniform vec3 uRoadColor;
  uniform vec3 uSidewalkColor;
  uniform vec3 uLineColor;
  uniform vec3 uParkColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  void main() {
    float cellSize = uBlockSize + uRoadWidth;
    vec2 cellPos = mod(vWorldXZ + cellSize * 0.5, cellSize);

    float roadX = step(cellPos.x, uRoadWidth) + step(cellSize - uRoadWidth, cellPos.x);
    float roadZ = step(cellPos.y, uRoadWidth) + step(cellSize - uRoadWidth, cellPos.y);
    float isRoad = min(1.0, roadX + roadZ);

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

    float isSidewalk = 0.0;
    if (isRoad < 0.5) {
      float dxRoad = min(cellPos.x, cellSize - cellPos.x);
      float dzRoad = min(cellPos.y, cellSize - cellPos.y);
      float minDist = min(dxRoad, dzRoad);
      isSidewalk = 1.0 - step(1.5, minDist - uRoadWidth);
    }

    vec3 color = uParkColor;
    if (isRoad > 0.5) {
      color = mix(uRoadColor, uLineColor, isCenterLine);
    } else if (isSidewalk > 0.5) {
      color = uSidewalkColor;
    }

    float fogFactor = smoothstep(uFogNear, uFogFar, vDist);
    color = mix(color, uFogColor, fogFactor);
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface ProceduralCityProps {
  theme: SceneTheme;
  worldLayout: WorldLayout;
}

export function ProceduralCity({ theme, worldLayout }: ProceduralCityProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const buildings = useMemo(() => worldLayout.buildings, [worldLayout.buildings]);
  const atlasTexture = useMemo(() => createWindowAtlas(theme), [theme]);

  useEffect(() => {
    return () => atlasTexture.dispose();
  }, [atlasTexture]);

  const { geometry, count } = useMemo(() => {
    const count = buildings.length;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const colors = new Float32Array(count * 3);
    const uvFront = new Float32Array(count * 4);
    const uvSide = new Float32Array(count * 4);

    for (let index = 0; index < count; index += 1) {
      const building = buildings[index];
      const collider = building.collider;

      colors[index * 3] = building.colorR;
      colors[index * 3 + 1] = building.colorG;
      colors[index * 3 + 2] = building.colorB;

      const bandIndex = Math.min(
        ATLAS_LIT_PCTS.length - 1,
        Math.max(0, Math.round(building.litPercentage * (ATLAS_LIT_PCTS.length - 1))),
      );
      const bandRowOffset = bandIndex * ATLAS_BAND_ROWS;
      const seed =
        building.windowSeed * 137 +
        Math.floor(collider.center.x * 7) +
        Math.floor(collider.center.y * 13);

      const frontColStart = Math.abs(
        Math.floor(seed) % Math.max(1, ATLAS_COLS - building.windowsPerFloor),
      );
      uvFront[index * 4 + 0] = frontColStart / ATLAS_COLS;
      uvFront[index * 4 + 1] = bandRowOffset / ATLAS_COLS;
      uvFront[index * 4 + 2] = building.windowsPerFloor / ATLAS_COLS;
      uvFront[index * 4 + 3] = building.floors / ATLAS_COLS;

      const sideColStart = Math.abs(
        Math.floor(seed + 7919) % Math.max(1, ATLAS_COLS - building.sideWindowsPerFloor),
      );
      uvSide[index * 4 + 0] = sideColStart / ATLAS_COLS;
      uvSide[index * 4 + 1] = bandRowOffset / ATLAS_COLS;
      uvSide[index * 4 + 2] = building.sideWindowsPerFloor / ATLAS_COLS;
      uvSide[index * 4 + 3] = building.floors / ATLAS_COLS;
    }

    geo.setAttribute('instanceColorAttr', new THREE.InstancedBufferAttribute(colors, 3));
    geo.setAttribute('aUvFront', new THREE.InstancedBufferAttribute(uvFront, 4));
    geo.setAttribute('aUvSide', new THREE.InstancedBufferAttribute(uvSide, 4));

    return { geometry: geo, count };
  }, [buildings]);

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }

    const dummy = new THREE.Object3D();
    buildings.forEach((building: WorldBuilding, index) => {
      const collider = building.collider;
      dummy.position.set(collider.center.x, collider.center.z, -collider.center.y);
      dummy.scale.set(collider.size.x, collider.size.z, collider.size.y);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [buildings]);

  const buildingMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: buildingVertexShader,
        fragmentShader: buildingFragmentShader,
        uniforms: {
          uAtlas: { value: atlasTexture },
          uFogColor: { value: new THREE.Color(theme.city.fogColor) },
          uFogNear: { value: theme.city.fogNear },
          uFogFar: { value: theme.city.fogFar },
          uFaceReference: { value: new THREE.Color(theme.city.faceColor) },
          uRoofWarmth: { value: theme.city.roofWarmth },
          uWindowEmissive: { value: theme.city.windowEmissive },
        },
      }),
    [atlasTexture, theme],
  );

  const groundMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: groundVertexShader,
        fragmentShader: groundFragmentShader,
        uniforms: {
          uBlockSize: { value: worldLayout.blockSize },
          uRoadWidth: { value: worldLayout.roadWidth },
          uRoadColor: { value: new THREE.Color(theme.city.groundRoad) },
          uSidewalkColor: { value: new THREE.Color(theme.city.groundSidewalk) },
          uLineColor: { value: new THREE.Color(theme.city.groundLine) },
          uParkColor: { value: new THREE.Color(theme.city.groundPark) },
          uFogColor: { value: new THREE.Color(theme.city.fogColor) },
          uFogNear: { value: theme.city.fogNear },
          uFogFar: { value: theme.city.fogFar },
        },
      }),
    [theme, worldLayout.blockSize, worldLayout.roadWidth],
  );

  const plazaTop = worldLayout.plaza.center.z + worldLayout.plaza.size.z * 0.5;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        material={groundMaterial}
        receiveShadow
      >
        <planeGeometry args={[worldLayout.gridSize + 900, worldLayout.gridSize + 900, 1, 1]} />
      </mesh>

      <mesh
        position={[
          worldLayout.plaza.center.x,
          worldLayout.plaza.center.z,
          -worldLayout.plaza.center.y,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            worldLayout.plaza.size.x,
            worldLayout.plaza.size.z,
            worldLayout.plaza.size.y,
          ]}
        />
        <meshStandardMaterial
          color={theme.city.groundPlaza}
          emissive={theme.city.groundPlazaAccent}
          emissiveIntensity={0.03}
          roughness={0.9}
          metalness={0.04}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, plazaTop + 0.03, 0]}
        receiveShadow
      >
        <planeGeometry
          args={[
            worldLayout.plaza.size.x - 10,
            worldLayout.plaza.size.y - 10,
            1,
            1,
          ]}
        />
        <meshStandardMaterial
          color={theme.city.groundPlazaAccent}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      <instancedMesh
        ref={meshRef}
        args={[geometry, buildingMaterial, count]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />
    </group>
  );
}
