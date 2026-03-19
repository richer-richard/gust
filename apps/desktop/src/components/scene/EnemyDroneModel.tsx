/**
 * EnemyDroneModel — Smaller, red-tinted hostile quadcopter.
 * 0.65× scale, red LEDs, dark body, no camera/gimbal/landing gear.
 * Position comes from frontend AI, not the physics engine.
 */
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { EnemyDrone } from '../../hooks/useEnemyDrones';

const SCALE = 0.65;
const ARM_LENGTH = 0.28 * SCALE;
const ARM_ANGLE_OFFSETS = [
  Math.PI / 4,
  (3 * Math.PI) / 4,
  (5 * Math.PI) / 4,
  (7 * Math.PI) / 4,
];

const BODY_COLOR = new THREE.Color(0.06, 0.06, 0.08);
const ARM_COLOR = new THREE.Color(0.04, 0.04, 0.06);
const MOTOR_COLOR = new THREE.Color(0.15, 0.08, 0.08);
const PROP_COLOR = new THREE.Color(0.04, 0.04, 0.05);
const LED_COLOR = new THREE.Color(1.0, 0.05, 0.0);
const FLASH_COLOR = new THREE.Color(1.0, 0.3, 0.0);

interface EnemyDroneModelProps {
  enemy: EnemyDrone;
}

export function EnemyDroneModel({ enemy }: EnemyDroneModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const propRefs = useRef<THREE.Mesh[]>([]);
  const ledRefs = useRef<THREE.Mesh[]>([]);

  const motorPositions = useMemo(
    () =>
      ARM_ANGLE_OFFSETS.map((angle) => [
        Math.cos(angle) * ARM_LENGTH,
        0,
        Math.sin(angle) * ARM_LENGTH,
      ] as [number, number, number]),
    []
  );

  // Animate propellers (constant spin — enemies don't have real RPM)
  useFrame((_, delta) => {
    propRefs.current.forEach((prop) => {
      if (prop) {
        prop.rotation.y += 80 * Math.PI * 2 * delta; // Fast constant spin
      }
    });
    // Pulse LEDs with flash on hit
    ledRefs.current.forEach((led) => {
      if (led && led.material instanceof THREE.MeshStandardMaterial) {
        const flashBoost = enemy.flash * 8;
        led.material.emissiveIntensity = 2.0 + Math.sin(performance.now() * 0.005) * 0.5 + flashBoost;
      }
    });
  });

  // Map sim coords to Three.js: sim(x,y,z) -> three(x,z,-y)
  const pos = enemy.position;
  const bodyColor = enemy.flash > 0.1 ? FLASH_COLOR : BODY_COLOR;

  return (
    <group
      ref={groupRef}
      position={[pos.x, pos.z, -pos.y]}
      scale={[SCALE, SCALE, SCALE]}
    >
      {/* Central body — angular/aggressive */}
      <mesh castShadow>
        <boxGeometry args={[0.14, 0.04, 0.10]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>

      {/* Arms + Motors + Propellers */}
      {ARM_ANGLE_OFFSETS.map((angle, i) => {
        const motorPos = motorPositions[i];
        const midX = Math.cos(angle) * ARM_LENGTH * 0.5;
        const midZ = Math.sin(angle) * ARM_LENGTH * 0.5;

        return (
          <group key={`arm-${i}`}>
            {/* Arm */}
            <mesh
              position={[midX, 0, midZ]}
              rotation={[0, -angle, 0]}
              castShadow
            >
              <boxGeometry args={[ARM_LENGTH, 0.012, 0.016]} />
              <meshStandardMaterial
                color={ARM_COLOR}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>

            {/* Motor housing */}
            <mesh position={motorPos} castShadow>
              <cylinderGeometry args={[0.015, 0.018, 0.022, 10]} />
              <meshStandardMaterial
                color={MOTOR_COLOR}
                metalness={0.7}
                roughness={0.2}
              />
            </mesh>

            {/* Propeller */}
            <mesh
              position={[motorPos[0], motorPos[1] + 0.015, motorPos[2]]}
              ref={(el) => {
                if (el) propRefs.current[i] = el;
              }}
            >
              <boxGeometry args={[0.18, 0.003, 0.014]} />
              <meshStandardMaterial
                color={PROP_COLOR}
                metalness={0.3}
                roughness={0.5}
                transparent
                opacity={0.85}
              />
            </mesh>

            {/* Red LED — all 4 corners red (hostile indicator) */}
            <mesh
              position={[motorPos[0], motorPos[1] - 0.008, motorPos[2]]}
              ref={(el) => {
                if (el) ledRefs.current[i] = el;
              }}
            >
              <sphereGeometry args={[0.005, 8, 6]} />
              <meshStandardMaterial
                color={LED_COLOR}
                emissive={LED_COLOR}
                emissiveIntensity={2.0}
              />
            </mesh>

            {/* Red point light */}
            <pointLight
              position={motorPos}
              color={LED_COLOR}
              intensity={0.4}
              distance={3}
            />
          </group>
        );
      })}
    </group>
  );
}
