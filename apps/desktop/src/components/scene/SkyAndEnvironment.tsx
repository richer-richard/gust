/**
 * SkyAndEnvironment - Theme-aware atmospheric sky, lighting, fog, and cloud layer.
 * Supports day (Sky shader) and night (dark background + starfield) modes.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneTheme } from '../../lib/theme';

interface SkyAndEnvironmentProps {
  theme: SceneTheme;
}

export function SkyAndEnvironment({ theme }: SkyAndEnvironmentProps) {
  const { backgroundColor, lighting, shadows, sky, fogColor, fogNear, fogFar } = theme;

  return (
    <>
      <color attach="background" args={[backgroundColor]} />

      {theme.useSkyShader ? (
        <Sky
          distance={sky.distance}
          sunPosition={sky.sunPosition}
          rayleigh={sky.rayleigh}
          turbidity={sky.turbidity}
          mieCoefficient={sky.mieCoefficient}
          mieDirectionalG={sky.mieDirectionalG}
        />
      ) : null}

      {theme.stars ? <Starfield /> : null}

      <directionalLight
        position={lighting.keyPosition}
        intensity={lighting.keyIntensity}
        color={lighting.keyColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-shadows.area}
        shadow-camera-right={shadows.area}
        shadow-camera-top={shadows.area}
        shadow-camera-bottom={-shadows.area}
        shadow-camera-near={0.5}
        shadow-camera-far={shadows.far}
        shadow-bias={shadows.bias}
        shadow-normalBias={shadows.normalBias}
      />

      <directionalLight
        position={lighting.fillPosition}
        intensity={lighting.fillIntensity}
        color={lighting.fillColor}
      />

      <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />

      <hemisphereLight
        color={lighting.hemiSky}
        groundColor={lighting.hemiGround}
        intensity={lighting.hemiIntensity}
      />

      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
    </>
  );
}

function Starfield() {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    let seed = 7919;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 0.9 + 0.1);
      const r = 4000;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 1.0 + rand() * 2.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      fog: false,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.003;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

interface CloudLayerProps {
  theme: SceneTheme;
}

export function CloudLayer({ theme }: CloudLayerProps) {
  const clouds = useMemo(() => {
    const items: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      opacity: number;
    }> = [];

    let seed = 123;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 44; i++) {
      const x = (rand() - 0.5) * 1800;
      const z = (rand() - 0.5) * 1800;
      const y = 140 + rand() * 110;
      const sx = 90 + rand() * 150;
      const sy = 24 + rand() * 34;
      items.push({
        position: [x, y, z],
        scale: [sx, sy, 1],
        opacity:
          theme.clouds.opacityMin +
          rand() * (theme.clouds.opacityMax - theme.clouds.opacityMin),
      });
    }

    return items;
  }, [theme.clouds.opacityMax, theme.clouds.opacityMin]);

  return (
    <group>
      {clouds.map((cloud, index) => (
        <sprite key={index} position={cloud.position} scale={cloud.scale}>
          <spriteMaterial
            color={theme.clouds.color}
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
