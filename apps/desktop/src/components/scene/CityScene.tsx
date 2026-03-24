/**
 * CityScene - Main 3D viewport with a shared backend-authored city and chase camera.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ProceduralCity } from './ProceduralCity';
import { DroneModel } from './DroneModel';
import { SkyAndEnvironment, CloudLayer } from './SkyAndEnvironment';
import { WindParticles } from './WindParticles';
import { WaypointMarkers } from './WaypointMarkers';
import { PostEffects } from './PostEffects';
import type { SceneTheme } from '../../lib/theme';
import type { ObstacleBox, SimulationSnapshot, Vec3, WorldLayout } from '../../lib/types';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FOLLOW_DEFAULT_DISTANCE = 18;
const FOLLOW_MIN_DISTANCE = 9;
const FOLLOW_MAX_DISTANCE = 84;
const ORBIT_DEFAULT_DISTANCE = 38;
const PREVIEW_DISTANCE = 56;

interface CitySceneProps {
  snapshot: SimulationSnapshot | null;
  worldLayout: WorldLayout;
  cameraMode: 'orbit' | 'follow' | 'topdown';
  theme: SceneTheme;
  previewMode?: boolean;
  showScenarioVisuals?: boolean;
  interactiveCamera?: boolean;
  recenterSignal?: number;
  onDroneFramingChange?: (lost: boolean) => void;
}

interface SurfaceQuery {
  heightAt: (x: number, y: number) => number;
}

interface SurfaceFootprint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  topZ: number;
}

export function CityScene({
  snapshot,
  worldLayout,
  cameraMode,
  theme,
  previewMode = false,
  showScenarioVisuals = true,
  interactiveCamera = true,
  recenterSignal = 0,
  onDroneFramingChange,
}: CitySceneProps) {
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
        far: 9000,
        position: [48, 18, 28],
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SkyAndEnvironment theme={theme} />
        <CloudLayer theme={theme} />
        <ProceduralCity theme={theme} worldLayout={worldLayout} />
        <DroneModel snapshot={snapshot} />
        <WindParticles snapshot={snapshot} />
        {showScenarioVisuals && <WaypointMarkers snapshot={snapshot} />}
        <CameraController
          snapshot={snapshot}
          worldLayout={worldLayout}
          mode={cameraMode}
          previewMode={previewMode}
          interactiveCamera={interactiveCamera}
          recenterSignal={recenterSignal}
          onDroneFramingChange={onDroneFramingChange}
        />
        <PostEffects theme={theme} />
      </Suspense>
    </Canvas>
  );
}

function CameraController({
  snapshot,
  worldLayout,
  mode,
  previewMode,
  interactiveCamera,
  recenterSignal,
  onDroneFramingChange,
}: {
  snapshot: SimulationSnapshot | null;
  worldLayout: WorldLayout;
  mode: 'orbit' | 'follow' | 'topdown';
  previewMode: boolean;
  interactiveCamera: boolean;
  recenterSignal: number;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  const dronePosition = snapshot?.drone.position ?? worldLayout.spawnPosition;
  const target = useMemo(() => toThreeTarget(dronePosition), [dronePosition]);
  const previewForward = useMemo(
    () => toThreeForwardFromYaw(worldLayout.previewYaw),
    [worldLayout.previewYaw],
  );
  const forward = useMemo(() => {
    const fromVelocity = toThreeForwardFromVelocity(snapshot?.drone.velocity ?? null);
    if (fromVelocity) {
      return fromVelocity;
    }
    const yaw = -(snapshot?.drone.euler.z ?? worldLayout.previewYaw);
    return toThreeForwardFromYaw(yaw);
  }, [snapshot?.drone.euler.z, snapshot?.drone.velocity, worldLayout.previewYaw]);
  const surfaceQuery = useMemo(() => createSurfaceQuery(worldLayout), [worldLayout]);

  if (previewMode) {
    return (
      <PlazaPreviewCamera
        target={target}
        forward={previewForward}
        surfaceQuery={surfaceQuery}
        onDroneFramingChange={onDroneFramingChange}
      />
    );
  }

  if (mode === 'topdown') {
    return <TopDownCamera target={target} onDroneFramingChange={onDroneFramingChange} />;
  }

  if (mode === 'orbit') {
    return (
      <OrbitFollowCamera
        target={target}
        forward={forward}
        surfaceQuery={surfaceQuery}
        interactive={interactiveCamera}
        recenterSignal={recenterSignal}
        onDroneFramingChange={onDroneFramingChange}
      />
    );
  }

  return (
    <FollowChaseCamera
      target={target}
      forward={forward}
      collision={snapshot?.drone.collision ?? false}
      surfaceQuery={surfaceQuery}
      recenterSignal={recenterSignal}
      onDroneFramingChange={onDroneFramingChange}
    />
  );
}

function PlazaPreviewCamera({
  target,
  forward,
  surfaceQuery,
  onDroneFramingChange,
}: {
  target: THREE.Vector3;
  forward: THREE.Vector3;
  surfaceQuery: SurfaceQuery;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  const smoothedLook = useRef(target.clone());

  useFrame(({ camera, clock }) => {
    const angle = Math.sin(clock.elapsedTime * 0.08) * 0.12;
    const previewForward = forward.clone().applyAxisAngle(WORLD_UP, angle).normalize();
    const right = new THREE.Vector3().crossVectors(previewForward, WORLD_UP).normalize();
    const idealPosition = makeCameraPosition(
      target,
      previewForward,
      PREVIEW_DISTANCE,
      surfaceQuery,
      18,
      10,
    ).addScaledVector(right, 8);
    const lookTarget = makeLookTarget(target, previewForward, 30, 6);

    camera.position.lerp(idealPosition, 0.06);
    smoothedLook.current.lerp(lookTarget, 0.08);
    camera.lookAt(smoothedLook.current);
    onDroneFramingChange?.(false);
  });

  return null;
}

function FollowChaseCamera({
  target,
  forward,
  collision,
  surfaceQuery,
  recenterSignal,
  onDroneFramingChange,
}: {
  target: THREE.Vector3;
  forward: THREE.Vector3;
  collision: boolean;
  surfaceQuery: SurfaceQuery;
  recenterSignal: number;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  const gl = useThree((state) => state.gl);
  const desiredDistance = useRef(FOLLOW_DEFAULT_DISTANCE);
  const currentDistance = useRef(FOLLOW_DEFAULT_DISTANCE);
  const smoothedTarget = useRef(target.clone());
  const smoothedLook = useRef(target.clone());
  const smoothedForward = useRef(forward.clone());
  const initialized = useRef(false);
  const shakeRef = useRef(0);
  const lastHandledRecenter = useRef(recenterSignal);

  useEffect(() => {
    const element = gl.domElement;
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      desiredDistance.current = clamp(
        desiredDistance.current + event.deltaY * 0.02,
        FOLLOW_MIN_DISTANCE,
        FOLLOW_MAX_DISTANCE,
      );
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [gl]);

  useEffect(() => {
    if (recenterSignal <= 0 || recenterSignal === lastHandledRecenter.current) {
      return;
    }
    desiredDistance.current = FOLLOW_DEFAULT_DISTANCE;
    currentDistance.current = FOLLOW_DEFAULT_DISTANCE;
    initialized.current = false;
    lastHandledRecenter.current = recenterSignal;
  }, [recenterSignal]);

  useFrame(({ camera }) => {
    smoothedTarget.current.lerp(target, 0.16);
    blendForward(smoothedForward.current, forward, 0.14);

    currentDistance.current += (desiredDistance.current - currentDistance.current) * 0.12;

    const idealPosition = makeCameraPosition(
      smoothedTarget.current,
      smoothedForward.current,
      currentDistance.current,
      surfaceQuery,
      6.2,
      2.4,
    );
    const lookTarget = makeLookTarget(smoothedTarget.current, smoothedForward.current, 18, 3.4);

    if (!initialized.current) {
      camera.position.copy(idealPosition);
      smoothedLook.current.copy(lookTarget);
      initialized.current = true;
    } else {
      camera.position.lerp(idealPosition, 0.18);
      smoothedLook.current.lerp(lookTarget, 0.2);
    }

    if (collision) {
      shakeRef.current = Math.max(shakeRef.current, 0.32);
    }
    if (shakeRef.current > 0.003) {
      const intensity = shakeRef.current * 0.16;
      camera.position.x += (Math.random() - 0.5) * intensity;
      camera.position.y += (Math.random() - 0.5) * intensity * 0.32;
      camera.position.z += (Math.random() - 0.5) * intensity;
      shakeRef.current *= 0.9;
    }

    camera.lookAt(smoothedLook.current);
    onDroneFramingChange?.(false);
  });

  return null;
}

function OrbitFollowCamera({
  target,
  forward,
  surfaceQuery,
  interactive,
  recenterSignal,
  onDroneFramingChange,
}: {
  target: THREE.Vector3;
  forward: THREE.Vector3;
  surfaceQuery: SurfaceQuery;
  interactive: boolean;
  recenterSignal: number;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  const controlsRef = useRef<any>(null);
  const lastManualInputAt = useRef(0);
  const smoothedTarget = useRef(target.clone());
  const initialized = useRef(false);
  const lastHandledRecenter = useRef(recenterSignal);
  const lastLostState = useRef(false);

  useEffect(() => {
    if (!interactive) {
      return;
    }
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const markManualInput = () => {
      lastManualInputAt.current = performance.now();
    };

    controls.addEventListener('start', markManualInput);
    controls.addEventListener('change', markManualInput);

    return () => {
      controls.removeEventListener('start', markManualInput);
      controls.removeEventListener('change', markManualInput);
    };
  }, [interactive]);

  useEffect(() => {
    if (recenterSignal <= 0 || recenterSignal === lastHandledRecenter.current) {
      return;
    }
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    controls.reset();
    lastManualInputAt.current = 0;
    initialized.current = false;
    lastHandledRecenter.current = recenterSignal;
  }, [recenterSignal]);

  useFrame(({ camera }) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    smoothedTarget.current.lerp(target, 0.16);
    controls.target.lerp(smoothedTarget.current, 0.18);

    const desiredPosition = makeCameraPosition(
      smoothedTarget.current,
      forward,
      ORBIT_DEFAULT_DISTANCE,
      surfaceQuery,
      10.5,
      4,
    );

    const idleMs = performance.now() - lastManualInputAt.current;
    if (!initialized.current) {
      camera.position.copy(desiredPosition);
      initialized.current = true;
    } else if (lastManualInputAt.current === 0 || idleMs > 2400) {
      camera.position.lerp(desiredPosition, 0.08);
    }

    controls.update();

    const projected = smoothedTarget.current.clone().project(camera);
    const framingLost =
      projected.z < -1 ||
      projected.z > 1 ||
      Math.abs(projected.x) > 0.84 ||
      Math.abs(projected.y) > 0.84 ||
      camera.position.distanceTo(smoothedTarget.current) > 180;

    if (framingLost !== lastLostState.current) {
      lastLostState.current = framingLost;
      onDroneFramingChange?.(framingLost);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={interactive}
      enableDamping
      dampingFactor={0.07}
      enablePan={false}
      enableZoom
      enableRotate
      minDistance={12}
      maxDistance={360}
      minPolarAngle={0.2}
      maxPolarAngle={1.52}
    />
  );
}

function TopDownCamera({
  target,
  onDroneFramingChange,
}: {
  target: THREE.Vector3;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  useFrame(({ camera }) => {
    const idealY = target.y + 160;
    camera.position.x += (target.x - camera.position.x) * 0.08;
    camera.position.y += (idealY - camera.position.y) * 0.08;
    camera.position.z += (target.z - camera.position.z) * 0.08;
    camera.lookAt(target);
    onDroneFramingChange?.(false);
  });

  return null;
}

function createSurfaceQuery(worldLayout: WorldLayout): SurfaceQuery {
  const cellSize = worldLayout.blockSize + worldLayout.roadWidth;
  const buckets = new Map<string, SurfaceFootprint[]>();
  const colliders = [worldLayout.plaza, ...worldLayout.buildings.map((building) => building.collider)];

  for (const collider of colliders) {
    const footprint = colliderToFootprint(collider);
    const minCellX = Math.floor(footprint.minX / cellSize);
    const maxCellX = Math.floor(footprint.maxX / cellSize);
    const minCellY = Math.floor(footprint.minY / cellSize);
    const maxCellY = Math.floor(footprint.maxY / cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        const key = `${cellX}:${cellY}`;
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.push(footprint);
        } else {
          buckets.set(key, [footprint]);
        }
      }
    }
  }

  return {
    heightAt(x: number, y: number) {
      const key = `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
      const bucket = buckets.get(key);
      if (!bucket) {
        return 0;
      }

      let top = 0;
      for (const footprint of bucket) {
        if (
          x >= footprint.minX &&
          x <= footprint.maxX &&
          y >= footprint.minY &&
          y <= footprint.maxY
        ) {
          top = Math.max(top, footprint.topZ);
        }
      }
      return top;
    },
  };
}

function colliderToFootprint(collider: ObstacleBox): SurfaceFootprint {
  const halfWidth = collider.size.x * 0.5;
  const halfDepth = collider.size.y * 0.5;
  return {
    minX: collider.center.x - halfWidth,
    maxX: collider.center.x + halfWidth,
    minY: collider.center.y - halfDepth,
    maxY: collider.center.y + halfDepth,
    topZ: collider.center.z + collider.size.z * 0.5,
  };
}

function toThreeTarget(position: Vec3): THREE.Vector3 {
  return new THREE.Vector3(position.x, position.z + 1.4, -position.y);
}

function toThreeForwardFromVelocity(velocity: Vec3 | null): THREE.Vector3 | null {
  if (!velocity) {
    return null;
  }
  const magnitude = Math.hypot(velocity.x, velocity.y);
  if (magnitude < 0.75) {
    return null;
  }
  return new THREE.Vector3(velocity.x / magnitude, 0, -velocity.y / magnitude);
}

function toThreeForwardFromYaw(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)).normalize();
}

function blendForward(current: THREE.Vector3, next: THREE.Vector3, alpha: number) {
  current.lerp(next, alpha);
  if (current.lengthSq() < 0.0001) {
    current.copy(next);
  }
  current.normalize();
}

function makeCameraPosition(
  target: THREE.Vector3,
  forward: THREE.Vector3,
  distance: number,
  surfaceQuery: SurfaceQuery,
  extraHeight: number,
  lateralOffset: number,
): THREE.Vector3 {
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
  const position = target
    .clone()
    .addScaledVector(forward, -distance)
    .addScaledVector(WORLD_UP, extraHeight + distance * 0.24)
    .addScaledVector(right, lateralOffset);

  const surfaceHeight = surfaceQuery.heightAt(position.x, -position.z);
  position.y = Math.max(position.y, surfaceHeight + 7.5);
  return position;
}

function makeLookTarget(
  target: THREE.Vector3,
  forward: THREE.Vector3,
  lookAhead: number,
  lift: number,
): THREE.Vector3 {
  return target.clone().addScaledVector(forward, lookAhead).addScaledVector(WORLD_UP, lift);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
