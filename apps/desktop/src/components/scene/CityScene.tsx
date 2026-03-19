/**
 * CityScene - Main 3D viewport combining all scene elements.
 * Full-screen Canvas with chase camera, city, drone, enemy drones, effects.
 */
import { Suspense, useRef, useCallback, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ProceduralCity } from './ProceduralCity';
import { DroneModel } from './DroneModel';
import { EnemyDroneModel } from './EnemyDroneModel';
import { SkyAndEnvironment, CloudLayer } from './SkyAndEnvironment';
import { WindParticles } from './WindParticles';
import { WaypointMarkers } from './WaypointMarkers';
import { PostEffects } from './PostEffects';
import { useEnemyDrones, type EnemyDrone } from '../../hooks/useEnemyDrones';
import type { SimulationSnapshot } from '../../lib/types';

interface CitySceneProps {
  snapshot: SimulationSnapshot | null;
  cameraMode: 'orbit' | 'follow' | 'topdown';
}

export function CityScene({ snapshot, cameraMode }: CitySceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      camera={{
        fov: 55,
        near: 0.1,
        far: 6000,
        position: [0, 40, 28],
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SkyAndEnvironment />
        <CloudLayer />
        <ProceduralCity />
        <DroneModel snapshot={snapshot} />
        <EnemyDroneLayer snapshot={snapshot} />
        <WindParticles snapshot={snapshot} />
        <WaypointMarkers snapshot={snapshot} />
        <CameraController snapshot={snapshot} mode={cameraMode} />
        <PostEffects />
      </Suspense>
    </Canvas>
  );
}

/**
 * EnemyDroneLayer — Manages and renders enemy drones using the useEnemyDrones hook.
 */
function EnemyDroneLayer({ snapshot }: { snapshot: SimulationSnapshot | null }) {
  const enemies = useEnemyDrones(snapshot);

  return (
    <>
      {enemies.map((enemy: EnemyDrone) => (
        <EnemyDroneModel key={enemy.id} enemy={enemy} />
      ))}
    </>
  );
}

/**
 * CameraController - Manages camera behavior based on selected mode.
 * - orbit: free OrbitControls targeting drone
 * - follow: chase camera behind drone with camera shake
 * - topdown: bird's eye view
 */
function CameraController({
  snapshot,
  mode,
}: {
  snapshot: SimulationSnapshot | null;
  mode: 'orbit' | 'follow' | 'topdown';
}) {
  const dronePos = snapshot?.drone.position ?? { x: 0, y: 0, z: 0.5 };
  const targetX = dronePos.x;
  const targetY = dronePos.z;
  const targetZ = -dronePos.y;

  if (mode === 'orbit') {
    return (
      <OrbitControls
        target={[targetX, targetY, targetZ]}
        enablePan
        enableRotate
        enableZoom
        maxDistance={2000}
        minDistance={2}
        maxPolarAngle={Math.PI * 0.85}
      />
    );
  }

  if (mode === 'follow') {
    return (
      <FollowCamera
        targetX={targetX}
        targetY={targetY}
        targetZ={targetZ}
        euler={snapshot?.drone.euler ?? { x: 0, y: 0, z: 0 }}
        collision={snapshot?.drone.collision ?? false}
        health={snapshot?.drone.health ?? 1}
      />
    );
  }

  return <TopDownCamera targetX={targetX} targetY={targetY} targetZ={targetZ} />;
}

/**
 * FollowCamera - Cinematic chase camera behind and above the drone.
 *
 * Uses dual-layer smoothing to prevent wobble/vibration:
 *   Layer 1: The drone's raw position is smoothed into a "target" position,
 *            filtering out micro-oscillations from physics/wind.
 *   Layer 2: The camera itself follows the smoothed target with a very soft
 *            lerp, creating a gentle cinematic lag.
 *
 * Inspired by git-city's flyover camera — the key insight is that hard-locked
 * cameras amplify every physics tick into visible jitter. By allowing deviation
 * and pulling back softly, the view stays clear and coherent.
 */
function FollowCamera({
  targetX,
  targetY,
  targetZ,
  euler,
  collision,
  health,
}: {
  targetX: number;
  targetY: number;
  targetZ: number;
  euler: { x: number; y: number; z: number };
  collision: boolean;
  health: number;
}) {
  // Smoothed drone position (filters physics micro-oscillations)
  const smoothedTarget = useRef(new THREE.Vector3(targetX, targetY, targetZ));
  // Smoothed yaw to prevent camera swinging on angular jitter
  const smoothedYaw = useRef(-euler.z);
  const shakeRef = useRef(0);
  const initialized = useRef(false);

  useFrame(({ camera }) => {
    // ── Layer 1: Smooth the drone target position ──────────────
    // Low factor = heavy smoothing, filters rapid oscillations
    const TARGET_SMOOTH = 0.035;
    smoothedTarget.current.x += (targetX - smoothedTarget.current.x) * TARGET_SMOOTH;
    smoothedTarget.current.y += (targetY - smoothedTarget.current.y) * TARGET_SMOOTH;
    smoothedTarget.current.z += (targetZ - smoothedTarget.current.z) * TARGET_SMOOTH;

    // Smooth the yaw too — prevents camera from swinging on angular jitter
    const rawYaw = -euler.z;
    let yawDelta = rawYaw - smoothedYaw.current;
    // Handle wrap-around
    if (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
    if (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
    smoothedYaw.current += yawDelta * 0.03;

    // ── Layer 2: Camera follows smoothed target softly ────────
    const yaw = smoothedYaw.current;
    const offsetDist = 28;  // Further back for cinematic feel
    const offsetHeight = 10; // Higher up for better overview

    const idealX = smoothedTarget.current.x - Math.cos(yaw) * offsetDist;
    const idealY = smoothedTarget.current.y + offsetHeight;
    const idealZ = smoothedTarget.current.z - Math.sin(yaw) * offsetDist;

    if (!initialized.current) {
      // Snap camera to ideal position on first frame (no lerp jank)
      camera.position.set(idealX, idealY, idealZ);
      initialized.current = true;
    } else {
      // Very soft position follow — allows deviation, pulls back gently
      const CAM_SMOOTH = 0.018;
      camera.position.x += (idealX - camera.position.x) * CAM_SMOOTH;
      camera.position.y += (idealY - camera.position.y) * CAM_SMOOTH;
      camera.position.z += (idealZ - camera.position.z) * CAM_SMOOTH;
    }

    // ── Camera shake on collision (gentle) ────────────────────
    if (collision) {
      shakeRef.current = Math.max(shakeRef.current, 0.5);
    }
    if (shakeRef.current > 0.005) {
      const intensity = shakeRef.current * 0.25;
      camera.position.x += (Math.random() - 0.5) * intensity;
      camera.position.y += (Math.random() - 0.5) * intensity * 0.4;
      camera.position.z += (Math.random() - 0.5) * intensity;
      shakeRef.current *= 0.92;
    }

    // ── Look at smoothed target (not raw drone!) ──────────────
    const lookAhead = 6;
    const lookX = smoothedTarget.current.x + Math.cos(yaw) * lookAhead;
    const lookZ = smoothedTarget.current.z + Math.sin(yaw) * lookAhead;
    camera.lookAt(lookX, smoothedTarget.current.y, lookZ);
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
    const idealY = targetY + 120;
    const idealZ = targetZ;

    camera.position.x += (idealX - camera.position.x) * 0.05;
    camera.position.y += (idealY - camera.position.y) * 0.05;
    camera.position.z += (idealZ - camera.position.z) * 0.05;

    camera.lookAt(targetX, targetY, targetZ);
  });

  return null;
}
