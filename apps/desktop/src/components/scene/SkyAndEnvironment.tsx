/**
 * SkyAndEnvironment - Atmospheric sky, sun, fog, and lighting for the city scene.
 * Uses a custom sky shader for realistic atmospheric scattering.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { Sky } from '@react-three/drei';

// Sun position for golden-hour-ish lighting
const SUN_POSITION: [number, number, number] = [150, 45, -100];

export function SkyAndEnvironment() {
  return (
    <>
      {/* Atmospheric sky */}
      <Sky
        distance={450000}
        sunPosition={SUN_POSITION}
        inclination={0.52}
        azimuth={0.25}
        rayleigh={1.5}
        turbidity={8}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* Main directional light (sun) */}
      <directionalLight
        position={SUN_POSITION}
        intensity={2.0}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-bias={-0.0005}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[-80, 30, 60]}
        intensity={0.4}
        color="#8ab4f0"
      />

      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.25} color="#4a6080" />

      {/* Hemisphere light for sky/ground color bleed */}
      <hemisphereLight
        color="#87ceeb"
        groundColor="#2a1810"
        intensity={0.35}
      />

      {/* Distance fog — city is 600m across so far plane needs to cover most of it */}
      <fog attach="fog" args={['#1a2030', 100, 900]} />
    </>
  );
}

/**
 * CloudLayer - Simple billboard cloud sprites for atmosphere
 */
export function CloudLayer() {
  const clouds = useMemo(() => {
    const items: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      opacity: number;
    }> = [];

    // Seeded random for deterministic clouds
    let seed = 123;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 40; i++) {
      const x = (rand() - 0.5) * 600;
      const z = (rand() - 0.5) * 600;
      const y = 80 + rand() * 60;
      const sx = 30 + rand() * 60;
      const sy = 8 + rand() * 15;
      items.push({
        position: [x, y, z],
        scale: [sx, sy, 1],
        opacity: 0.15 + rand() * 0.2,
      });
    }
    return items;
  }, []);

  return (
    <group>
      {clouds.map((cloud, i) => (
        <sprite key={i} position={cloud.position} scale={cloud.scale}>
          <spriteMaterial
            color="#d0d8e8"
            transparent
            opacity={cloud.opacity}
            depthWrite={false}
            fog
          />
        </sprite>
      ))}
    </group>
  );
}
