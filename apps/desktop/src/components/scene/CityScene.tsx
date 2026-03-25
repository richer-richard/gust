/**
 * CityScene - Main 3D viewport with shared-world rendering and recoverable hybrid follow.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
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
const FOLLOW_MAX_DISTANCE = 92;
const ORBIT_DEFAULT_DISTANCE = 36;
const LOST_DISTANCE_FOLLOW = 105;
const LOST_DISTANCE_ORBIT = 180;
const RECENTER_SETTLE_DISTANCE = 0.45;

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
  isOccluded: (from: THREE.Vector3, to: THREE.Vector3) => boolean;
}

interface SurfaceFootprint {
  id: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  topZ: number;
  box: THREE.Box3;
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
        position: [46, 18, 28],
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
        <ContactShadows
          position={[0, 0.06, 0]}
          opacity={theme.shadows.contactOpacity}
          scale={260}
          blur={theme.shadows.contactBlur}
          far={56}
          resolution={1024}
          color="#000000"
        />
        <ContactShadows
          position={[0, worldLayout.launchSurfaceZ + 0.06, 0]}
          opacity={theme.shadows.contactOpacity * 0.82}
          scale={110}
          blur={Math.max(1.0, theme.shadows.contactBlur * 0.8)}
          far={30}
          resolution={1024}
          color="#000000"
        />
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
  const worldQuery = useMemo(() => createSurfaceQuery(worldLayout), [worldLayout]);

  if (previewMode) {
    return (
      <PlazaPreviewCamera
        target={target}
        forward={previewForward}
        worldQuery={worldQuery}
      />
    );
  }

  if (mode === 'topdown') {
    return <TopDownCamera target={target} onDroneFramingChange={onDroneFramingChange} />;
  }

  return (
    <TrackingOrbitCamera
      target={target}
      forward={forward}
      worldQuery={worldQuery}
      interactive={interactiveCamera}
      mode={mode}
      recenterSignal={recenterSignal}
      onDroneFramingChange={onDroneFramingChange}
    />
  );
}

function PlazaPreviewCamera({
  target,
  forward,
  worldQuery,
}: {
  target: THREE.Vector3;
  forward: THREE.Vector3;
  worldQuery: SurfaceQuery;
}) {
  const smoothedLook = useRef(target.clone());

  useFrame(({ camera, clock }) => {
    const angle = Math.sin(clock.elapsedTime * 0.08) * 0.1;
    const previewForward = forward.clone().applyAxisAngle(WORLD_UP, angle).normalize();
    const right = new THREE.Vector3().crossVectors(previewForward, WORLD_UP).normalize();
    const idealPosition = makeCameraPosition(
      target,
      previewForward,
      52,
      worldQuery,
      14,
      7,
    ).addScaledVector(right, 5);
    const lookTarget = makeLookTarget(target, previewForward, 26, 5.2);

    camera.position.lerp(idealPosition, 0.06);
    smoothedLook.current.lerp(lookTarget, 0.08);
    camera.lookAt(smoothedLook.current);
  });

  return null;
}

function TrackingOrbitCamera({
  target,
  forward,
  worldQuery,
  interactive,
  mode,
  recenterSignal,
  onDroneFramingChange,
}: {
  target: THREE.Vector3;
  forward: THREE.Vector3;
  worldQuery: SurfaceQuery;
  interactive: boolean;
  mode: 'orbit' | 'follow';
  recenterSignal: number;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  const controlsRef = useRef<any>(null);
  const smoothedTarget = useRef(target.clone());
  const smoothedForward = useRef(forward.clone());
  const initialized = useRef(false);
  const manualInteracting = useRef(false);
  const lastManualInputAt = useRef(0);
  const lastLostState = useRef(false);
  const lastHandledRecenter = useRef(recenterSignal);
  const recoveryActive = useRef(false);

  useEffect(() => {
    if (!interactive) {
      return;
    }
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const markManualPulse = () => {
      lastManualInputAt.current = performance.now();
      recoveryActive.current = false;
    };
    const markManualStart = () => {
      manualInteracting.current = true;
      markManualPulse();
    };
    const markManualEnd = () => {
      manualInteracting.current = false;
      markManualPulse();
    };

    const domElement = controls.domElement as HTMLElement | undefined;

    controls.addEventListener('start', markManualStart);
    controls.addEventListener('end', markManualEnd);
    domElement?.addEventListener('wheel', markManualPulse, { passive: true });

    return () => {
      manualInteracting.current = false;
      controls.removeEventListener('start', markManualStart);
      controls.removeEventListener('end', markManualEnd);
      domElement?.removeEventListener('wheel', markManualPulse);
    };
  }, [interactive]);

  useEffect(() => {
    if (recenterSignal <= 0 || recenterSignal === lastHandledRecenter.current) {
      return;
    }

    recoveryActive.current = true;
    manualInteracting.current = false;
    lastManualInputAt.current = 0;
    initialized.current = false;
    lastHandledRecenter.current = recenterSignal;
  }, [recenterSignal]);

  useFrame(({ camera }) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    smoothedTarget.current.lerp(target, 0.18);
    blendForward(smoothedForward.current, forward, 0.14);
    controls.target.lerp(smoothedTarget.current, 0.22);

    const currentDistance = camera.position.distanceTo(controls.target);
    const targetDistance =
      recoveryActive.current
        ? FOLLOW_DEFAULT_DISTANCE
        : mode === 'follow'
          ? clamp(currentDistance, FOLLOW_MIN_DISTANCE, FOLLOW_MAX_DISTANCE)
          : ORBIT_DEFAULT_DISTANCE;
    const desiredPosition = makeCameraPosition(
      smoothedTarget.current,
      smoothedForward.current,
      targetDistance,
      worldQuery,
      mode === 'follow' ? 5.8 : 10.5,
      mode === 'follow' ? 2.2 : 4.0,
    );

    if (!initialized.current) {
      camera.position.copy(desiredPosition);
      controls.target.copy(smoothedTarget.current);
      initialized.current = true;
    } else if (mode === 'follow') {
      const idleMs = performance.now() - lastManualInputAt.current;
      const shouldAutoCorrect =
        recoveryActive.current ||
        (!manualInteracting.current &&
          (lastManualInputAt.current === 0 || idleMs > 1100));
      if (shouldAutoCorrect) {
        camera.position.lerp(desiredPosition, recoveryActive.current ? 0.18 : 0.06);
        if (recoveryActive.current && camera.position.distanceTo(desiredPosition) < RECENTER_SETTLE_DISTANCE) {
          recoveryActive.current = false;
        }
      }
    }

    controls.update();

    const lost = isTargetLost(camera, smoothedTarget.current, worldQuery, mode);
    if (lost !== lastLostState.current) {
      lastLostState.current = lost;
      onDroneFramingChange?.(lost);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={interactive}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enableZoom
      enableRotate
      minDistance={FOLLOW_MIN_DISTANCE}
      maxDistance={360}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI * 0.96}
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
  const colliders = [
    ...worldLayout.plazaPlatforms,
    worldLayout.landmark.pedestal,
    ...worldLayout.landmark.collisionBoxes,
    ...worldLayout.buildings.map((building) => building.collider),
  ];
  const footprints = colliders.map((collider, id) => colliderToFootprint(collider, id));

  footprints.forEach((footprint) => {
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
  });

  return {
    heightAt(x: number, y: number) {
      const bucket = buckets.get(makeBucketKey(x, y, cellSize));
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
    isOccluded(from: THREE.Vector3, to: THREE.Vector3) {
      const candidateIds = new Set<number>();
      const distance = from.distanceTo(to);
      const steps = Math.max(4, Math.ceil(distance / cellSize * 1.5));

      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const sample = new THREE.Vector3().lerpVectors(from, to, t);
        const bucket = buckets.get(makeBucketKey(sample.x, -sample.z, cellSize));
        if (!bucket) {
          continue;
        }
        for (const footprint of bucket) {
          candidateIds.add(footprint.id);
        }
      }

      const ray = new THREE.Ray(from.clone(), to.clone().sub(from).normalize());
      const hitPoint = new THREE.Vector3();

      for (const candidateId of candidateIds) {
        const footprint = footprints[candidateId];
        if (!footprint) {
          continue;
        }
        const hit = ray.intersectBox(footprint.box, hitPoint);
        if (hit && from.distanceTo(hit) < distance - 1.2) {
          return true;
        }
      }

      return false;
    },
  };
}

function isTargetLost(
  camera: THREE.Camera,
  target: THREE.Vector3,
  worldQuery: SurfaceQuery,
  mode: 'orbit' | 'follow',
) {
  const projected = target.clone().project(camera);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const toTarget = target.clone().sub(camera.position).normalize();
  const alignment = direction.dot(toTarget);
  const distance = camera.position.distanceTo(target);

  return (
    projected.z < -1 ||
    projected.z > 1 ||
    Math.abs(projected.x) > 0.86 ||
    Math.abs(projected.y) > 0.86 ||
    alignment < 0.05 ||
    distance > (mode === 'follow' ? LOST_DISTANCE_FOLLOW : LOST_DISTANCE_ORBIT) ||
    worldQuery.isOccluded(camera.position, target)
  );
}

function colliderToFootprint(collider: ObstacleBox, id: number): SurfaceFootprint {
  const halfWidth = collider.size.x * 0.5;
  const halfDepth = collider.size.y * 0.5;
  return {
    id,
    minX: collider.center.x - halfWidth,
    maxX: collider.center.x + halfWidth,
    minY: collider.center.y - halfDepth,
    maxY: collider.center.y + halfDepth,
    topZ: collider.center.z + collider.size.z * 0.5,
    box: new THREE.Box3(
      new THREE.Vector3(
        collider.center.x - halfWidth,
        collider.center.z - collider.size.z * 0.5,
        -(collider.center.y + halfDepth),
      ),
      new THREE.Vector3(
        collider.center.x + halfWidth,
        collider.center.z + collider.size.z * 0.5,
        -(collider.center.y - halfDepth),
      ),
    ),
  };
}

function makeBucketKey(x: number, y: number, cellSize: number) {
  return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
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
  worldQuery: SurfaceQuery,
  extraHeight: number,
  lateralOffset: number,
): THREE.Vector3 {
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
  const position = target
    .clone()
    .addScaledVector(forward, -distance)
    .addScaledVector(WORLD_UP, extraHeight + distance * 0.24)
    .addScaledVector(right, lateralOffset);

  const surfaceHeight = worldQuery.heightAt(position.x, -position.z);
  position.y = Math.max(position.y, surfaceHeight + 6.8);
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
