/**
 * CityScene - Main 3D viewport combining all scene elements.
 * Full-screen Canvas with camera tracking, city, drone, effects.
 */
import { Suspense, useRef, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ProceduralCity } from './ProceduralCity';
import { DroneModel } from './DroneModel';
import { SkyAndEnvironment, CloudLayer } from './SkyAndEnvironment';
import { WindParticles } from './WindParticles';
import { WaypointMarkers } from './WaypointMarkers';
import { PostEffects } from './PostEffects';
import type { SimulationSnapshot } from '../../lib/types';

interface CitySceneProps {
  snapshot: SimulationSnapshot | null;
  cameraMode: 'orbit' | 'follow' | 'topdown';
}

export function CityScene({ snapshot, cameraMode }: CitySceneProps) {
  const dronePos = snapshot?.drone.position ?? { x: 0, y: 0, z: 25 };

  // Camera initial position: elevated 45° view showing city skyline with drone
  const initialCamPos: [number, number, number] = [
    dronePos.x - 40,
    dronePos.z + 50,
    -dronePos.y + 40,
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        toneMapping: THREE.NoToneMapping, // handled by postprocessing
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      camera={{
        fov: 55,
        near: 0.1,
        far: 2000,
        position: initialCamPos,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SkyAndEnvironment />
        <CloudLayer />
        <ProceduralCity />
        <DroneModel snapshot={snapshot} />
        <WindParticles snapshot={snapshot} />
        <WaypointMarkers snapshot={snapshot} />
        <CameraController snapshot={snapshot} mode={cameraMode} />
        <PostEffects />
      </Suspense>
    </Canvas>
  );
}

/**
 * CameraController - Manages camera behavior based on selected mode.
 * - orbit: free OrbitControls targeting drone
 * - follow: chase camera behind drone
 * - topdown: bird's eye view
 */
function CameraController({
  snapshot,
  mode,
}: {
  snapshot: SimulationSnapshot | null;
  mode: 'orbit' | 'follow' | 'topdown';
}) {
  const controlsRef = useRef<any>(null);

  const dronePos = snapshot?.drone.position ?? { x: 0, y: 0, z: 25 };
  // Sim coords -> Three.js: sim(x,y,z) -> three(x,z,-y)
  const targetX = dronePos.x;
  const targetY = dronePos.z;
  const targetZ = -dronePos.y;

  if (mode === 'orbit') {
    return (
      <OrbitControls
        ref={controlsRef}
        target={[targetX, targetY, targetZ]}
        enablePan
        enableRotate
        enableZoom
        maxDistance={500}
        minDistance={2}
        maxPolarAngle={Math.PI * 0.85}
      />
    );
  }

  if (mode === 'follow') {
    return (
      <>
        <FollowCamera
          targetX={targetX}
          targetY={targetY}
          targetZ={targetZ}
          euler={snapshot?.drone.euler ?? { x: 0, y: 0, z: 0 }}
        />
      </>
    );
  }

  // topdown
  return (
    <>
      <TopDownCamera targetX={targetX} targetY={targetY} targetZ={targetZ} />
    </>
  );
}

import { useFrame } from '@react-three/fiber';

function FollowCamera({
  targetX,
  targetY,
  targetZ,
  euler,
}: {
  targetX: number;
  targetY: number;
  targetZ: number;
  euler: { x: number; y: number; z: number };
}) {
  useFrame(({ camera }) => {
    // Chase camera: behind and above the drone
    const yaw = -euler.z; // sim yaw -> three.js rotation
    const offsetDist = 6;
    const offsetHeight = 3;

    const idealX = targetX - Math.cos(yaw) * offsetDist;
    const idealY = targetY + offsetHeight;
    const idealZ = targetZ - Math.sin(yaw) * offsetDist;

    // Smooth interpolation
    camera.position.x += (idealX - camera.position.x) * 0.05;
    camera.position.y += (idealY - camera.position.y) * 0.05;
    camera.position.z += (idealZ - camera.position.z) * 0.05;

    camera.lookAt(targetX, targetY, targetZ);
  });

  return null;
}

function TopDownCamera({
  targetX,
  targetY,
  targetZ,
}: {
  targetX: number;
  targetY: number;
  targetZ: number;
}) {
  useFrame(({ camera }) => {
    const idealX = targetX;
    const idealY = targetY + 80;
    const idealZ = targetZ;

    camera.position.x += (idealX - camera.position.x) * 0.05;
    camera.position.y += (idealY - camera.position.y) * 0.05;
    camera.position.z += (idealZ - camera.position.z) * 0.05;

    camera.lookAt(targetX, targetY, targetZ);
  });

  return null;
}
