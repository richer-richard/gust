/**
 * SkyAndEnvironment - Theme-aware atmospheric sky, lighting, fog, and cloud layer.
 */
import { useMemo } from 'react';
import { Sky } from '@react-three/drei';
import type { SceneTheme } from '../../lib/theme';

interface SkyAndEnvironmentProps {
  theme: SceneTheme;
}

export function SkyAndEnvironment({ theme }: SkyAndEnvironmentProps) {
  const { lighting, sky, fogColor, fogNear, fogFar } = theme;

  return (
    <>
      <Sky
        distance={sky.distance}
        sunPosition={sky.sunPosition}
        rayleigh={sky.rayleigh}
        turbidity={sky.turbidity}
        mieCoefficient={sky.mieCoefficient}
        mieDirectionalG={sky.mieDirectionalG}
      />

      <directionalLight
        position={lighting.keyPosition}
        intensity={lighting.keyIntensity}
        color={lighting.keyColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-180}
        shadow-camera-right={180}
        shadow-camera-top={180}
        shadow-camera-bottom={-180}
        shadow-camera-near={0.5}
        shadow-camera-far={900}
        shadow-bias={-0.0004}
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
