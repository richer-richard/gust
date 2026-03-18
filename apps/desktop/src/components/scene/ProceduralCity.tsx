/**
 * ProceduralCity - Generates a realistic city environment using InstancedMesh
 * Buildings have procedural window patterns via custom shaders for a near-real look.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { generateCity, type CityData } from '../../lib/cityGenerator';

// Custom building shader with procedural windows
const buildingVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  
  // Per-instance attributes
  attribute vec3 instanceColorAttr;
  attribute float instanceWindowSeed;
  attribute float instanceBuildingHeight;
  
  varying vec3 vBuildingColor;
  varying float vWindowSeed;
  varying float vBuildingHeight;
  
  void main() {
    vUv = uv;
    vNormal = normalMatrix * normal;
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vHeight = position.y;
    vBuildingColor = instanceColorAttr;
    vWindowSeed = instanceWindowSeed;
    vBuildingHeight = instanceBuildingHeight;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const buildingFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec3 vBuildingColor;
  varying float vWindowSeed;
  varying float vBuildingHeight;
  
  uniform float uTime;
  
  // Hash function for deterministic randomness
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
  }
  
  void main() {
    vec3 normal = normalize(vNormal);
    
    // Only show windows on vertical faces (not top/bottom)
    float isVertical = 1.0 - abs(normal.y);
    
    if (isVertical < 0.5) {
      // Roof - slightly different shade
      vec3 roofColor = vBuildingColor * 0.7 + vec3(0.05, 0.04, 0.03);
      
      // Simple lighting
      float diffuse = max(dot(normal, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
      vec3 lit = roofColor * (0.3 + 0.7 * diffuse);
      gl_FragColor = vec4(lit, 1.0);
      return;
    }
    
    // Window grid parameters based on building height
    float floorHeight = 3.5; // meters per floor
    float windowWidth = 2.0; // meters per window bay
    
    // Calculate UV in world space for consistent window sizing
    float wallU, wallV;
    if (abs(normal.x) > 0.5) {
      wallU = vWorldPosition.z / windowWidth;
      wallV = vWorldPosition.y / floorHeight;
    } else {
      wallU = vWorldPosition.x / windowWidth;
      wallV = vWorldPosition.y / floorHeight;
    }
    
    vec2 windowId = floor(vec2(wallU, wallV));
    vec2 windowUv = fract(vec2(wallU, wallV));
    
    // Window shape - rectangular with margins
    float marginX = 0.18;
    float marginTop = 0.15;
    float marginBottom = 0.28;
    float isWindow = step(marginX, windowUv.x) * step(windowUv.x, 1.0 - marginX) *
                     step(marginBottom, windowUv.y) * step(windowUv.y, 1.0 - marginTop);
    
    // Skip windows near ground floor and above building top
    float aboveGround = step(0.5, wallV);
    float belowTop = step(vWorldPosition.y, vBuildingHeight - 1.0);
    isWindow *= aboveGround * belowTop;
    
    // Deterministic window lighting - some windows lit, some dark
    float windowHash = hash(windowId + vec2(vWindowSeed));
    float windowHash2 = hash2(windowId + vec2(vWindowSeed * 1.3));
    
    // Time-varying: some windows flicker on/off slowly
    float timeFlicker = step(0.7, hash(windowId + vec2(floor(uTime * 0.02))));
    float isLit = step(0.42, windowHash) * (1.0 - 0.3 * timeFlicker);
    
    // Window colors - warm interior light variations
    vec3 warmLight = vec3(1.0, 0.88, 0.65);
    vec3 coolLight = vec3(0.7, 0.85, 1.0);
    vec3 windowLitColor = mix(warmLight, coolLight, step(0.7, windowHash2)) * (0.6 + 0.4 * windowHash2);
    vec3 windowDarkColor = vec3(0.04, 0.05, 0.07);
    vec3 windowColor = mix(windowDarkColor, windowLitColor, isLit);
    
    // Window frame / mullion
    float frameThick = 0.02;
    float isFrame = 0.0;
    if (isWindow > 0.5) {
      float dxLeft = windowUv.x - marginX;
      float dxRight = (1.0 - marginX) - windowUv.x;
      float dyBot = windowUv.y - marginBottom;
      float dyTop = (1.0 - marginTop) - windowUv.y;
      float minDist = min(min(dxLeft, dxRight), min(dyBot, dyTop));
      isFrame = 1.0 - step(frameThick, minDist);
    }
    
    // Wall color with simple lighting
    float diffuse = max(dot(normal, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
    float ambient = 0.25;
    vec3 wallColor = vBuildingColor * (ambient + 0.75 * diffuse);
    
    // Add subtle AO at base of building
    float ao = smoothstep(0.0, 8.0, vWorldPosition.y);
    wallColor *= (0.5 + 0.5 * ao);
    
    // Frame color
    vec3 frameColor = vBuildingColor * 0.3;
    
    // Composite
    vec3 finalColor = wallColor;
    if (isWindow > 0.5) {
      if (isFrame > 0.5) {
        finalColor = frameColor;
      } else {
        finalColor = windowColor;
        // Window reflections - slight sky reflection on dark windows
        if (isLit < 0.5) {
          float reflectAmount = 0.15 + 0.1 * max(0.0, normal.y + 0.5);
          vec3 skyReflect = vec3(0.15, 0.2, 0.35);
          finalColor = mix(finalColor, skyReflect, reflectAmount);
        }
      }
    }
    
    // Distance fog
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * 0.003);
    vec3 fogColor = vec3(0.08, 0.1, 0.16);
    finalColor = mix(finalColor, fogColor, fogFactor);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Ground shader with road grid
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
    
    // Position within cell
    vec2 cellPos = mod(vWorldXZ + cellSize * 0.5, cellSize);
    
    // Road detection - roads are at cell boundaries
    float roadX = step(cellPos.x, uRoadWidth) + step(cellSize - uRoadWidth, cellPos.x);
    float roadZ = step(cellPos.y, uRoadWidth) + step(cellSize - uRoadWidth, cellPos.y);
    float isRoad = min(1.0, roadX + roadZ);
    
    // Road markings - center line
    float centerLineX = abs(cellPos.x - cellSize * 0.5);
    float centerLineZ = abs(cellPos.y - cellSize * 0.5);
    float isCenterLine = 0.0;
    if (isRoad > 0.5) {
      if (roadX > 0.5 && centerLineX < uRoadWidth * 0.5) {
        float stripe = step(0.5, fract(vWorldXZ.y * 0.15));
        isCenterLine = step(abs(cellPos.x - uRoadWidth * 0.5), 0.15) * stripe;
        isCenterLine += step(abs(cellPos.x - (cellSize - uRoadWidth * 0.5)), 0.15) * stripe;
      }
      if (roadZ > 0.5 && centerLineZ < uRoadWidth * 0.5) {
        float stripe = step(0.5, fract(vWorldXZ.x * 0.15));
        isCenterLine += step(abs(cellPos.y - uRoadWidth * 0.5), 0.15) * stripe;
        isCenterLine += step(abs(cellPos.y - (cellSize - uRoadWidth * 0.5)), 0.15) * stripe;
      }
      isCenterLine = min(1.0, isCenterLine);
    }
    
    // Colors
    vec3 asphaltColor = vec3(0.08, 0.08, 0.09);
    vec3 sidewalkColor = vec3(0.18, 0.17, 0.16);
    vec3 lineColor = vec3(0.7, 0.7, 0.5);
    vec3 grassColor = vec3(0.04, 0.08, 0.03);
    
    // Sidewalk at road edges
    float sidewalkWidth = 1.5;
    float isSidewalk = 0.0;
    if (isRoad < 0.5) {
      float dxRoad = min(cellPos.x, cellSize - cellPos.x);
      float dzRoad = min(cellPos.y, cellSize - cellPos.y);
      float minDist = min(dxRoad, dzRoad);
      isSidewalk = 1.0 - step(sidewalkWidth, minDist - uRoadWidth);
    }
    
    vec3 color = grassColor;
    if (isRoad > 0.5) {
      color = mix(asphaltColor, lineColor, isCenterLine);
    } else if (isSidewalk > 0.5) {
      color = sidewalkColor;
    }
    
    // Distance fog
    float fogFactor = 1.0 - exp(-vDist * 0.003);
    vec3 fogColor = vec3(0.08, 0.1, 0.16);
    color = mix(color, fogColor, fogFactor);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function ProceduralCity() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const buildingMatRef = useRef<THREE.ShaderMaterial | null>(null);

  const cityData = useMemo(() => generateCity(42), []);

  // Create instanced geometry and set transforms + attributes
  const { geometry, count } = useMemo(() => {
    const buildings = cityData.buildings;
    const count = buildings.length;

    // Use a unit box and scale per instance
    const geo = new THREE.BoxGeometry(1, 1, 1);

    // Custom per-instance attributes
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const heights = new Float32Array(count);

    buildings.forEach((b, i) => {
      colors[i * 3] = b.colorR;
      colors[i * 3 + 1] = b.colorG;
      colors[i * 3 + 2] = b.colorB;
      seeds[i] = b.windowSeed;
      heights[i] = b.height;
    });

    geo.setAttribute(
      'instanceColorAttr',
      new THREE.InstancedBufferAttribute(colors, 3)
    );
    geo.setAttribute(
      'instanceWindowSeed',
      new THREE.InstancedBufferAttribute(seeds, 1)
    );
    geo.setAttribute(
      'instanceBuildingHeight',
      new THREE.InstancedBufferAttribute(heights, 1)
    );

    return { geometry: geo, count };
  }, [cityData]);

  // Set instance matrices after mount
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

  // Animate time uniform for window flickering
  useFrame(({ clock }) => {
    if (buildingMatRef.current) {
      buildingMatRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  const buildingMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: buildingVertexShader,
      fragmentShader: buildingFragmentShader,
      uniforms: {
        uTime: { value: 0 },
      },
    });
    buildingMatRef.current = mat;
    return mat;
  }, []);

  const groundMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: groundVertexShader,
        fragmentShader: groundFragmentShader,
        uniforms: {
          uBlockSize: { value: cityData.blockSize },
          uRoadWidth: { value: cityData.roadWidth },
        },
      }),
    [cityData]
  );

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={groundMaterial}>
        <planeGeometry args={[800, 800, 1, 1]} />
      </mesh>

      {/* Buildings */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, buildingMaterial, count]}
        frustumCulled={false}
      />
    </group>
  );
}
