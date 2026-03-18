/**
 * WindParticles - GPU-driven particle system visualizing wind and gusts.
 * Particles flow in the wind direction with intensity based on gust strength.
 */
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { SimulationSnapshot } from '../../lib/types';

const PARTICLE_COUNT = 3000;
const SPREAD = 80; // meters around drone

interface WindParticlesProps {
  snapshot: SimulationSnapshot | null;
}

export function WindParticles({ snapshot }: WindParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const wind = snapshot?.environment.windWorld ?? { x: 0, y: 0, z: 0 };
  const gustStrength = snapshot?.environment.gustStrength ?? 0;
  const dronePos = snapshot?.drone.position ?? { x: 0, y: 0, z: 25 };
  const turbulenceIndex = snapshot?.environment.turbulenceIndex ?? 0;

  const { positions, velocities, lifetimes } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const life = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 1] = Math.random() * 60 + 5; // y (height in three.js)
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      vel[i * 3] = 0;
      vel[i * 3 + 1] = 0;
      vel[i * 3 + 2] = 0;
      life[i] = Math.random();
    }

    return { positions: pos, velocities: vel, lifetimes: life };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(lifetimes, 1));
    return geo;
  }, [positions, lifetimes]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const lifeAttr = pointsRef.current.geometry.getAttribute(
      'aLife'
    ) as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const lifeArr = lifeAttr.array as Float32Array;

    // Map sim coords to three.js: sim(x,y,z) -> three(x,z,-y)
    const centerX = dronePos.x;
    const centerY = dronePos.z; // sim z -> three y
    const centerZ = -dronePos.y; // sim y -> three -z

    // Wind in three.js space
    const windX = wind.x;
    const windY = wind.z; // sim z wind -> three y
    const windZ = -wind.y; // sim y wind -> three -z

    const gustScale = 1.0 + gustStrength * 2.0;
    const dt = Math.min(delta, 0.05);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Update lifetime
      lifeArr[i] -= dt * (0.15 + turbulenceIndex * 0.3);

      // Move particle with wind
      posArr[i3] += (windX * gustScale + velocities[i3]) * dt;
      posArr[i3 + 1] += (windY * gustScale * 0.3 + velocities[i3 + 1]) * dt;
      posArr[i3 + 2] += (windZ * gustScale + velocities[i3 + 2]) * dt;

      // Add turbulence
      const turbFactor = turbulenceIndex * 3.0;
      velocities[i3] += (Math.random() - 0.5) * turbFactor * dt;
      velocities[i3 + 1] += (Math.random() - 0.5) * turbFactor * 0.5 * dt;
      velocities[i3 + 2] += (Math.random() - 0.5) * turbFactor * dt;

      // Damping
      velocities[i3] *= 0.98;
      velocities[i3 + 1] *= 0.98;
      velocities[i3 + 2] *= 0.98;

      // Respawn if out of bounds or dead
      const dx = posArr[i3] - centerX;
      const dy = posArr[i3 + 1] - centerY;
      const dz = posArr[i3 + 2] - centerZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (lifeArr[i] <= 0 || dist > SPREAD) {
        posArr[i3] = centerX + (Math.random() - 0.5) * SPREAD;
        posArr[i3 + 1] = centerY + Math.random() * 40 - 10;
        posArr[i3 + 2] = centerZ + (Math.random() - 0.5) * SPREAD;
        lifeArr[i] = 0.5 + Math.random() * 0.5;
        velocities[i3] = 0;
        velocities[i3 + 1] = 0;
        velocities[i3 + 2] = 0;
      }
    }

    posAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;

    // Update material uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.uGustStrength.value = gustStrength;
      materialRef.current.uniforms.uTurbulence.value = turbulenceIndex;
    }
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uGustStrength: { value: 0 },
          uTurbulence: { value: 0 },
        },
        vertexShader: /* glsl */ `
          attribute float aLife;
          varying float vLife;
          varying float vDist;
          
          void main() {
            vLife = aLife;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vDist = -mvPos.z;
            gl_Position = projectionMatrix * mvPos;
            // Size based on distance and life
            gl_PointSize = clamp(2.5 * aLife * (120.0 / -mvPos.z), 1.0, 18.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uGustStrength;
          uniform float uTurbulence;
          varying float vLife;
          varying float vDist;
          
          void main() {
            // Circular point
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            
            float alpha = smoothstep(0.5, 0.2, d) * vLife;
            
            // Color shifts with turbulence: calm = white/blue, turbulent = yellow/orange
            vec3 calmColor = vec3(0.6, 0.7, 0.9);
            vec3 turbColor = vec3(1.0, 0.7, 0.3);
            vec3 color = mix(calmColor, turbColor, uTurbulence);
            
            // Fade with distance
            float distFade = 1.0 - smoothstep(30.0, 80.0, vDist);
            alpha *= distFade * (0.12 + uGustStrength * 0.25);
            
            gl_FragColor = vec4(color, alpha);
          }
        `,
      }),
    []
  );

  return (
    <points ref={pointsRef} geometry={geometry} material={material}>
      <primitive object={material} ref={materialRef} />
    </points>
  );
}
