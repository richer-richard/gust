/**
 * DroneTrail - Glowing trail that follows the drone position.
 * Uses a ring buffer of positions rendered as a fading line.
 */
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { SimulationSnapshot } from '../../lib/types';

const MAX_POINTS = 150;
const MIN_DISTANCE = 0.3;

interface DroneTrailProps {
  snapshot: SimulationSnapshot | null;
  enabled: boolean;
}

export function DroneTrail({ snapshot, enabled }: DroneTrailProps) {
  const lineRef = useRef<THREE.Line>(null);
  const headRef = useRef(0);
  const countRef = useRef(0);
  const lastPosRef = useRef(new THREE.Vector3());

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(MAX_POINTS * 3);
    const opacities = new Float32Array(MAX_POINTS);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          gl_FragColor = vec4(uColor, vOpacity * 0.7);
        }
      `,
      uniforms: {
        uColor: { value: new THREE.Color(0.3, 0.7, 1.0) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame(() => {
    if (!lineRef.current || !snapshot || !enabled) {
      geometry.setDrawRange(0, 0);
      return;
    }

    const pos = snapshot.drone.position;
    const current = new THREE.Vector3(pos.x, pos.z, -pos.y);

    if (current.distanceTo(lastPosRef.current) < MIN_DISTANCE && countRef.current > 0) {
      return;
    }

    lastPosRef.current.copy(current);

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const opAttr = geometry.attributes.opacity as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const opArr = opAttr.array as Float32Array;

    const head = headRef.current;
    posArr[head * 3] = current.x;
    posArr[head * 3 + 1] = current.y;
    posArr[head * 3 + 2] = current.z;
    headRef.current = (head + 1) % MAX_POINTS;
    if (countRef.current < MAX_POINTS) countRef.current++;

    const count = countRef.current;
    const h = headRef.current;

    const reorderedPos = new Float32Array(count * 3);
    const reorderedOp = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const srcIdx = (h - count + i + MAX_POINTS) % MAX_POINTS;
      reorderedPos[i * 3] = posArr[srcIdx * 3];
      reorderedPos[i * 3 + 1] = posArr[srcIdx * 3 + 1];
      reorderedPos[i * 3 + 2] = posArr[srcIdx * 3 + 2];
      reorderedOp[i] = i / count;
    }

    posAttr.array.set(reorderedPos);
    opAttr.array.set(reorderedOp);
    posAttr.needsUpdate = true;
    opAttr.needsUpdate = true;
    geometry.setDrawRange(0, count);
  });

  if (!enabled) return null;

  return (
    <primitive ref={lineRef} object={new THREE.Line(geometry, material)} />
  );
}
