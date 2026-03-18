/**
 * WaypointMarkers - Visualizes waypoints as glowing holographic markers
 * with connecting flight path lines.
 */
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { SimulationSnapshot } from '../../lib/types';

interface WaypointMarkersProps {
  snapshot: SimulationSnapshot | null;
}

export function WaypointMarkers({ snapshot }: WaypointMarkersProps) {
  if (!snapshot || snapshot.waypoints.length === 0) return null;

  const activeIndex = snapshot.activeWaypointIndex ?? 0;

  // Convert sim coords to Three.js: sim(x,y,z) -> three(x,z,-y)
  const points = snapshot.waypoints.map((wp) => [
    wp.position.x,
    wp.position.z,
    -wp.position.y,
  ] as [number, number, number]);

  // Drone position in Three.js coords
  const droneThree: [number, number, number] = [
    snapshot.drone.position.x,
    snapshot.drone.position.z,
    -snapshot.drone.position.y,
  ];

  // Flight path including current drone position
  const pathPoints = [droneThree, ...points];

  return (
    <group>
      {/* Flight path line */}
      <Line
        points={pathPoints}
        color="#00ccff"
        lineWidth={1.5}
        transparent
        opacity={0.4}
        dashed
        dashSize={2}
        gapSize={1}
      />

      {/* Active segment highlight */}
      {activeIndex < points.length && (
        <Line
          points={[droneThree, points[activeIndex]]}
          color="#00ff88"
          lineWidth={2}
          transparent
          opacity={0.7}
        />
      )}

      {/* Waypoint markers */}
      {points.map((pos, i) => (
        <WaypointBeacon
          key={i}
          position={pos}
          index={i}
          isActive={i === activeIndex}
          isCompleted={i < activeIndex}
        />
      ))}

      {/* Obstacle visualization */}
      {snapshot.obstacles.map((obs, i) => (
        <ObstacleZone
          key={`obs-${i}`}
          center={[obs.center.x, obs.center.z, -obs.center.y]}
          size={[obs.size.x, obs.size.z, obs.size.y]}
        />
      ))}
    </group>
  );
}

function WaypointBeacon({
  position,
  index,
  isActive,
  isCompleted,
}: {
  position: [number, number, number];
  index: number;
  isActive: boolean;
  isCompleted: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const pillarRef = useRef<THREE.Mesh>(null);

  const color = isActive ? '#00ff88' : isCompleted ? '#4488aa' : '#00ccff';
  const emissiveColor = new THREE.Color(color);
  const intensity = isActive ? 2.0 : isCompleted ? 0.5 : 1.0;

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = clock.elapsedTime * (isActive ? 2.0 : 0.5);
      if (isActive) {
        const scale = 1.0 + Math.sin(clock.elapsedTime * 3) * 0.15;
        ringRef.current.scale.setScalar(scale);
      }
    }
  });

  return (
    <group position={position}>
      {/* Vertical pillar to ground */}
      <mesh ref={pillarRef} position={[0, -position[1] / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, position[1], 4]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.15}
          emissive={emissiveColor}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Rotating ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.08, 8, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={intensity}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Inner diamond marker */}
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.5]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={intensity * 1.5}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Point light for glow */}
      <pointLight
        color={color}
        intensity={isActive ? 3 : 1}
        distance={15}
      />
    </group>
  );
}

function ObstacleZone({
  center,
  size,
}: {
  center: [number, number, number];
  size: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
      meshRef.current.material.opacity =
        0.08 + Math.sin(clock.elapsedTime * 2) * 0.03;
    }
  });

  return (
    <group position={center}>
      {/* Danger zone wireframe */}
      <mesh ref={meshRef}>
        <boxGeometry args={[size[0] + 2, size[1] + 2, size[2] + 2]} />
        <meshStandardMaterial
          color="#ff3333"
          emissive="#ff0000"
          emissiveIntensity={0.5}
          transparent
          opacity={0.08}
          wireframe
        />
      </mesh>

      {/* Solid inner warning */}
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color="#ff2200"
          emissive="#ff0000"
          emissiveIntensity={0.3}
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
