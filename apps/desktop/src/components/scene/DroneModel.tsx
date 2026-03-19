/**
 * DroneModel - Detailed quadcopter with spinning propellers, LEDs, and camera gimbal.
 * Receives position/rotation from simulation state.
 */
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { SimulationSnapshot } from '../../lib/types';

const SMOKE_COLOR = new THREE.Color(0.15, 0.12, 0.1);

interface DroneModelProps {
  snapshot: SimulationSnapshot | null;
}

const ARM_LENGTH = 0.28;
const ARM_ANGLE_OFFSETS = [
  Math.PI / 4,         // front-right
  (3 * Math.PI) / 4,   // front-left
  (5 * Math.PI) / 4,   // back-left
  (7 * Math.PI) / 4,   // back-right
];

const BODY_COLOR = new THREE.Color(0.15, 0.15, 0.18);
const ARM_COLOR = new THREE.Color(0.08, 0.08, 0.1);
const MOTOR_COLOR = new THREE.Color(0.25, 0.25, 0.3);
const PROP_COLOR = new THREE.Color(0.05, 0.05, 0.06);
const LED_FRONT = new THREE.Color(0.0, 1.0, 0.3);
const LED_BACK = new THREE.Color(1.0, 0.1, 0.0);
const CAMERA_COLOR = new THREE.Color(0.02, 0.02, 0.02);
const COLLISION_COLOR = new THREE.Color(1.0, 0.4, 0.0);

export function DroneModel({ snapshot }: DroneModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const propRefs = useRef<THREE.Mesh[]>([]);
  const ledRefs = useRef<THREE.Mesh[]>([]);
  const propBlurRefs = useRef<THREE.Mesh[]>([]);

  const position = snapshot?.drone.position ?? { x: 0, y: 0, z: 0.5 };
  const euler = snapshot?.drone.euler ?? { x: 0, y: 0, z: 0 };
  const rotorRpm = snapshot?.drone.rotorRpm ?? [4000, 4000, 4000, 4000];
  const collision = snapshot?.drone.collision ?? false;
  const health = snapshot?.drone.health ?? 1;

  const smokeParticlesRef = useRef<THREE.Mesh[]>([]);

  // Animate propellers + health-based visual effects
  useFrame((_, delta) => {
    // Health-based prop speed modifier
    const healthSpeedMod = health <= 0 ? 0 : health < 0.2 ? 0.4 : 1;

    propRefs.current.forEach((prop, i) => {
      if (prop) {
        const rpm = (rotorRpm[i] ?? 4000) * healthSpeedMod;
        const rps = rpm / 60;
        prop.rotation.y += rps * Math.PI * 2 * delta;
      }
    });

    // Pulse LEDs — dimmer at low health
    ledRefs.current.forEach((led) => {
      if (led && led.material instanceof THREE.MeshStandardMaterial) {
        const t = performance.now() * 0.003;
        const healthDim = health < 0.2 ? 0.3 : 1;
        led.material.emissiveIntensity = (1.5 + Math.sin(t) * 0.5) * healthDim;
      }
    });

    // Prop blur opacity based on RPM and health
    propBlurRefs.current.forEach((blur, i) => {
      if (blur && blur.material instanceof THREE.MeshStandardMaterial) {
        const rpm = (rotorRpm[i] ?? 4000) * healthSpeedMod;
        blur.material.opacity = Math.min(0.3, rpm / 15000);
      }
    });

    // Animate smoke particles when health < 0.5
    smokeParticlesRef.current.forEach((smoke, i) => {
      if (smoke) {
        if (health < 0.5) {
          smoke.visible = true;
          const speed = health < 0.2 ? 3 : 1.5;
          smoke.position.y += speed * delta;
          // Reset when too high
          if (smoke.position.y > 1.5) {
            smoke.position.y = 0.02;
            smoke.position.x = (Math.random() - 0.5) * 0.08;
            smoke.position.z = (Math.random() - 0.5) * 0.08;
          }
          const opacity = health < 0.2 ? 0.6 : 0.3;
          if (smoke.material instanceof THREE.MeshStandardMaterial) {
            smoke.material.opacity = opacity * (1 - smoke.position.y / 1.5);
          }
        } else {
          smoke.visible = false;
        }
      }
    });
  });

  // Motor positions
  const motorPositions = useMemo(
    () =>
      ARM_ANGLE_OFFSETS.map((angle) => [
        Math.cos(angle) * ARM_LENGTH,
        0,
        Math.sin(angle) * ARM_LENGTH,
      ] as [number, number, number]),
    []
  );

  // Health-based body color: normal → orange flicker → red at critical
  const bodyColorFinal =
    health <= 0 ? new THREE.Color(0.4, 0.05, 0.0) :
    health < 0.2 ? COLLISION_COLOR :
    health < 0.5 && Math.sin(performance.now() * 0.01) > 0.3 ? COLLISION_COLOR :
    collision ? COLLISION_COLOR :
    BODY_COLOR;

  return (
    <group
      ref={groupRef}
      // Sim uses (x, y, z) with z=up; Three.js uses y=up
      // So map: sim.x -> three.x, sim.y -> three.z, sim.z -> three.y
      position={[position.x, position.z, -position.y]}
      rotation={[euler.x, -euler.z, euler.y]}
    >
      {/* Central body - main fuselage */}
      <mesh castShadow>
        <boxGeometry args={[0.12, 0.045, 0.12]} />
        <meshStandardMaterial
          color={bodyColorFinal}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Top cover / flight controller */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[0.08, 0.015, 0.06]} />
        <meshStandardMaterial color="#1a3a5c" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Battery underneath */}
      <mesh position={[0, -0.025, 0]} castShadow>
        <boxGeometry args={[0.1, 0.025, 0.035]} />
        <meshStandardMaterial color="#1a1a20" metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Camera/gimbal underneath */}
      <group position={[0.03, -0.05, 0]}>
        <mesh>
          <sphereGeometry args={[0.015, 12, 8]} />
          <meshStandardMaterial
            color={CAMERA_COLOR}
            metalness={0.8}
            roughness={0.15}
          />
        </mesh>
        {/* Camera lens */}
        <mesh position={[0.012, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.008, 0.005, 12]} />
          <meshStandardMaterial
            color="#000510"
            metalness={0.9}
            roughness={0.1}
            emissive="#001830"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      {/* Landing gear - 4 legs */}
      {[
        [0.06, -0.04, 0.04],
        [0.06, -0.04, -0.04],
        [-0.06, -0.04, 0.04],
        [-0.06, -0.04, -0.04],
      ].map((pos, i) => (
        <group key={`gear-${i}`} position={pos as [number, number, number]}>
          <mesh>
            <cylinderGeometry args={[0.003, 0.003, 0.04, 6]} />
            <meshStandardMaterial color="#2a2a30" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <sphereGeometry args={[0.005, 6, 4]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Arms + Motors + Propellers */}
      {ARM_ANGLE_OFFSETS.map((angle, i) => {
        const motorPos = motorPositions[i];
        const isFront = i < 2;
        const ledColor = isFront ? LED_FRONT : LED_BACK;
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
              <boxGeometry args={[ARM_LENGTH, 0.015, 0.02]} />
              <meshStandardMaterial
                color={ARM_COLOR}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>

            {/* Motor housing */}
            <mesh position={motorPos} castShadow>
              <cylinderGeometry args={[0.018, 0.02, 0.025, 12]} />
              <meshStandardMaterial
                color={MOTOR_COLOR}
                metalness={0.7}
                roughness={0.2}
              />
            </mesh>

            {/* Propeller */}
            <mesh
              position={[motorPos[0], motorPos[1] + 0.018, motorPos[2]]}
              ref={(el) => {
                if (el) propRefs.current[i] = el;
              }}
            >
              <boxGeometry args={[0.22, 0.003, 0.018]} />
              <meshStandardMaterial
                color={PROP_COLOR}
                metalness={0.3}
                roughness={0.5}
                transparent
                opacity={0.9}
              />
            </mesh>

            {/* Prop disc blur effect */}
            <mesh
              position={[motorPos[0], motorPos[1] + 0.019, motorPos[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
              ref={(el) => {
                if (el) propBlurRefs.current[i] = el;
              }}
            >
              <circleGeometry args={[0.11, 24]} />
              <meshStandardMaterial
                color="#8899aa"
                transparent
                opacity={0.15}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            {/* LED at motor tip */}
            <mesh
              position={[motorPos[0], motorPos[1] - 0.01, motorPos[2]]}
              ref={(el) => {
                if (el) ledRefs.current[i] = el;
              }}
            >
              <sphereGeometry args={[0.006, 8, 6]} />
              <meshStandardMaterial
                color={ledColor}
                emissive={ledColor}
                emissiveIntensity={2.0}
              />
            </mesh>

            {/* LED point light */}
            <pointLight
              position={motorPos}
              color={ledColor}
              intensity={0.3}
              distance={2}
            />
          </group>
        );
      })}

      {/* Downward light (landing light) — dims with health */}
      <spotLight
        position={[0, -0.06, 0]}
        target-position={[0, -5, 0]}
        color="#ffffff"
        intensity={health > 0.2 ? 0.8 : 0.2}
        distance={15}
        angle={0.6}
        penumbra={0.5}
      />

      {/* Smoke particles — visible when health < 50% */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={`smoke-${i}`}
          position={[
            (Math.random() - 0.5) * 0.06,
            0.02 + i * 0.2,
            (Math.random() - 0.5) * 0.06,
          ]}
          visible={false}
          ref={(el) => {
            if (el) smokeParticlesRef.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.02 + i * 0.005, 6, 4]} />
          <meshStandardMaterial
            color={SMOKE_COLOR}
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
