/**
 * CityScene - Main 3D viewport with theme-aware world rendering and hybrid follow camera.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ProceduralCity } from './ProceduralCity';
import { DroneModel } from './DroneModel';
import { SkyAndEnvironment, CloudLayer } from './SkyAndEnvironment';
import { WindParticles } from './WindParticles';
import { WaypointMarkers } from './WaypointMarkers';
import { PostEffects } from './PostEffects';
import type { SceneTheme } from '../../lib/theme';
import type { SimulationSnapshot } from '../../lib/types';

interface CitySceneProps {
  snapshot: SimulationSnapshot | null;
  cameraMode: 'orbit' | 'follow' | 'topdown';
  theme: SceneTheme;
  previewMode?: boolean;
  showScenarioVisuals?: boolean;
  interactiveCamera?: boolean;
  recenterSignal?: number;
  onDroneFramingChange?: (lost: boolean) => void;
}

export function CityScene({
  snapshot,
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
        position: [70, 52, 96],
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SkyAndEnvironment theme={theme} />
        <CloudLayer theme={theme} />
        <ProceduralCity theme={theme} />
        <DroneModel snapshot={snapshot} />
        <WindParticles snapshot={snapshot} />
        {showScenarioVisuals && <WaypointMarkers snapshot={snapshot} />}
        <CameraController
          snapshot={snapshot}
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
  mode,
  previewMode,
  interactiveCamera,
  recenterSignal,
  onDroneFramingChange,
}: {
  snapshot: SimulationSnapshot | null;
  mode: 'orbit' | 'follow' | 'topdown';
  previewMode: boolean;
  interactiveCamera: boolean;
  recenterSignal: number;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  const dronePos = snapshot?.drone.position ?? { x: 0, y: 0, z: 0.2 };
  const target = useMemo(
    () => new THREE.Vector3(dronePos.x, dronePos.z + 1.4, -dronePos.y),
    [dronePos.x, dronePos.y, dronePos.z]
  );

  if (previewMode) {
    return <LandingPreviewCamera target={target} onDroneFramingChange={onDroneFramingChange} />;
  }

  if (mode === 'topdown') {
    return <TopDownCamera target={target} onDroneFramingChange={onDroneFramingChange} />;
  }

  return (
    <HybridFollowCamera
      target={target}
      yaw={-(snapshot?.drone.euler.z ?? 0)}
      collision={snapshot?.drone.collision ?? false}
      mode={mode}
      interactive={interactiveCamera}
      recenterSignal={recenterSignal}
      onDroneFramingChange={onDroneFramingChange}
    />
  );
}

function LandingPreviewCamera({
  target,
  onDroneFramingChange,
}: {
  target: THREE.Vector3;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.08;
    camera.position.set(Math.cos(t) * 210, 80, Math.sin(t) * 160);
    camera.lookAt(target.x, 16, target.z);
    onDroneFramingChange?.(false);
  });

  return null;
}

function HybridFollowCamera({
  target,
  yaw,
  collision,
  mode,
  interactive,
  recenterSignal,
  onDroneFramingChange,
}: {
  target: THREE.Vector3;
  yaw: number;
  collision: boolean;
  mode: 'orbit' | 'follow';
  interactive: boolean;
  recenterSignal: number;
  onDroneFramingChange?: (lost: boolean) => void;
}) {
  const controlsRef = useRef<any>(null);
  const smoothedTarget = useRef(target.clone());
  const desiredDefaultPos = useRef(new THREE.Vector3());
  const lastManualInputAt = useRef(0);
  const initialized = useRef(false);
  const lastLostState = useRef(false);
  const shakeRef = useRef(0);
  const lastHandledRecenter = useRef(recenterSignal);

  useEffect(() => {
    if (!interactive) return;
    const controls = controlsRef.current;
    if (!controls) return;

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

  useFrame(({ camera }) => {
    const controls = controlsRef.current;
    if (!controls) return;

    smoothedTarget.current.lerp(target, 0.1);
    controls.target.lerp(smoothedTarget.current, 0.12);

    const defaultDistance = mode === 'orbit' ? 46 : 34;
    const defaultHeight = mode === 'orbit' ? 30 : 22;
    desiredDefaultPos.current.set(
      smoothedTarget.current.x - Math.cos(yaw) * defaultDistance,
      smoothedTarget.current.y + defaultHeight,
      smoothedTarget.current.z - Math.sin(yaw) * defaultDistance
    );

    if (!initialized.current) {
      camera.position.copy(desiredDefaultPos.current);
      controls.target.copy(smoothedTarget.current);
      controls.update();
      initialized.current = true;
    }

    const idleMs = performance.now() - lastManualInputAt.current;
    if (mode === 'follow' && (lastManualInputAt.current === 0 || idleMs > 2600)) {
      camera.position.lerp(desiredDefaultPos.current, 0.025);
    }

    if (collision) {
      shakeRef.current = Math.max(shakeRef.current, 0.35);
    }
    if (shakeRef.current > 0.004) {
      const intensity = shakeRef.current * 0.18;
      camera.position.x += (Math.random() - 0.5) * intensity;
      camera.position.y += (Math.random() - 0.5) * intensity * 0.35;
      camera.position.z += (Math.random() - 0.5) * intensity;
      shakeRef.current *= 0.92;
    }

    controls.update();

    const projected = smoothedTarget.current.clone().project(camera);
    const cameraDistance = camera.position.distanceTo(smoothedTarget.current);
    const framingLost =
      projected.z < -1 ||
      projected.z > 1 ||
      Math.abs(projected.x) > 0.82 ||
      Math.abs(projected.y) > 0.82 ||
      cameraDistance > 140;

    if (framingLost !== lastLostState.current) {
      lastLostState.current = framingLost;
      onDroneFramingChange?.(framingLost);
    }
  });

  useEffect(() => {
    if (recenterSignal <= 0 || recenterSignal === lastHandledRecenter.current) return;
    const controls = controlsRef.current;
    if (!controls) return;
    controls.reset();
    lastHandledRecenter.current = recenterSignal;
    lastManualInputAt.current = 0;
    initialized.current = false;
  }, [recenterSignal]);

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={interactive}
      enableDamping
      dampingFactor={0.065}
      enablePan={interactive && mode === 'orbit'}
      enableZoom
      enableRotate
      minDistance={14}
      maxDistance={420}
      minPolarAngle={0.16}
      maxPolarAngle={Math.PI * 0.98}
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
    const idealY = target.y + 140;
    camera.position.x += (target.x - camera.position.x) * 0.06;
    camera.position.y += (idealY - camera.position.y) * 0.06;
    camera.position.z += (target.z - camera.position.z) * 0.06;
    camera.lookAt(target);
    onDroneFramingChange?.(false);
  });

  return null;
}
