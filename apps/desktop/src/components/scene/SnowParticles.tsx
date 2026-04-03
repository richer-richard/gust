/**
 * SnowParticles - Falling snow effect for snowy weather themes.
 */
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { SimulationSnapshot } from '../../lib/types';

const PARTICLE_COUNT = 4000;
const SPREAD = 120;
const FALL_SPEED = 4.0;
const DRIFT_STRENGTH = 1.5;
const HEIGHT_RANGE = 80;

interface SnowParticlesProps {
  snapshot: SimulationSnapshot | null;
}

export function SnowParticles({ snapshot }: SnowParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const dronePos = snapshot?.drone.position ?? { x: 0, y: 0, z: 25 };

  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const ph = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 1] = Math.random() * HEIGHT_RANGE;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      ph[i] = Math.random() * Math.PI * 2;
    }

    return { positions: pos, phases: ph };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xeeeeff,
        size: 1.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        fog: true,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = clock.getElapsedTime();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      arr[i3 + 1] -= FALL_SPEED * 0.016;
      arr[i3] += Math.sin(t * 0.5 + phases[i]) * DRIFT_STRENGTH * 0.016;
      arr[i3 + 2] += Math.cos(t * 0.3 + phases[i] * 1.3) * DRIFT_STRENGTH * 0.016 * 0.7;

      if (arr[i3 + 1] < -5) {
        arr[i3 + 1] = HEIGHT_RANGE;
        arr[i3] = (Math.random() - 0.5) * SPREAD;
        arr[i3 + 2] = (Math.random() - 0.5) * SPREAD;
      }
    }

    posAttr.needsUpdate = true;
    pointsRef.current.position.set(dronePos.x, 0, -dronePos.y);
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
