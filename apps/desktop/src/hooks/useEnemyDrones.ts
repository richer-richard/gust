/**
 * useEnemyDrones — Frontend-only enemy drone AI system.
 * Spawns, updates AI behavior, detects collisions, and manages damage to the player.
 */
import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { takeDamage } from '../lib/tauri';
import type { SimulationSnapshot, Vec3 } from '../lib/types';

export interface EnemyDrone {
  id: string;
  position: Vec3;
  velocity: Vec3;
  phase: 'stalking' | 'pursuing' | 'charging';
  spawnTime: number;
  lastDamageTime: number;
  flash: number; // 0-1, red flash on hit
  alive: boolean;
}

const MAX_ENEMIES = 6;
const SPAWN_INTERVAL_S = 8;
const SPAWN_DIST_MIN = 80;
const SPAWN_DIST_MAX = 140;
const MAX_PURSUIT_SPEED = 14;
const COLLISION_RADIUS = 1.5;
const DAMAGE_PER_HIT = 0.12;
const DAMAGE_COOLDOWN_S = 1.0;
const DESPAWN_DISTANCE = 300;
const BUILDING_KILL_DISTANCE = 0.5;

let nextId = 0;

export function useEnemyDrones(snapshot: SimulationSnapshot | null): EnemyDrone[] {
  const enemiesRef = useRef<EnemyDrone[]>([]);
  const lastSpawnRef = useRef(0);
  const clockRef = useRef(0);

  useFrame((_, delta) => {
    if (!snapshot || snapshot.runState !== 'running') return;
    if (snapshot.drone.health <= 0) {
      // Game over — freeze all enemies
      return;
    }

    clockRef.current += delta;
    const now = clockRef.current;
    const playerPos = snapshot.drone.position;
    const enemies = enemiesRef.current;

    // Spawn new enemies
    if (now - lastSpawnRef.current > SPAWN_INTERVAL_S && enemies.filter(e => e.alive).length < MAX_ENEMIES) {
      const angle = Math.random() * Math.PI * 2;
      const dist = SPAWN_DIST_MIN + Math.random() * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);
      const spawnPos: Vec3 = {
        x: playerPos.x + Math.cos(angle) * dist,
        y: playerPos.y + Math.sin(angle) * dist,
        z: playerPos.z + (Math.random() - 0.5) * 40,
      };
      
      enemies.push({
        id: `enemy-${nextId++}`,
        position: spawnPos,
        velocity: { x: 0, y: 0, z: 0 },
        phase: 'stalking',
        spawnTime: now,
        lastDamageTime: 0,
        flash: 0,
        alive: true,
      });
      lastSpawnRef.current = now;
    }

    // Update each enemy
    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      const dx = playerPos.x - enemy.position.x;
      const dy = playerPos.y - enemy.position.y;
      const dz = playerPos.z - enemy.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Update phase
      if (dist > 60) enemy.phase = 'stalking';
      else if (dist > 20) enemy.phase = 'pursuing';
      else enemy.phase = 'charging';

      // Compute acceleration toward player
      const nx = dist > 0.1 ? dx / dist : 0;
      const ny = dist > 0.1 ? dy / dist : 0;
      const nz = dist > 0.1 ? dz / dist : 0;

      let accelMag: number;
      let weave = 0;

      switch (enemy.phase) {
        case 'stalking':
          accelMag = 3;
          weave = Math.sin(now * 2 + enemy.spawnTime * 7) * 4;
          break;
        case 'pursuing':
          accelMag = 8;
          weave = Math.sin(now * 3 + enemy.spawnTime * 11) * 2;
          break;
        case 'charging':
          accelMag = 14;
          weave = 0;
          break;
      }

      // Perpendicular weave direction (in XY plane)
      const perpX = -ny;
      const perpY = nx;

      enemy.velocity.x += (nx * accelMag + perpX * weave) * delta;
      enemy.velocity.y += (ny * accelMag + perpY * weave) * delta;
      enemy.velocity.z += nz * accelMag * delta;

      // Clamp speed
      const speed = Math.sqrt(
        enemy.velocity.x ** 2 + enemy.velocity.y ** 2 + enemy.velocity.z ** 2
      );
      if (speed > MAX_PURSUIT_SPEED) {
        const scale = MAX_PURSUIT_SPEED / speed;
        enemy.velocity.x *= scale;
        enemy.velocity.y *= scale;
        enemy.velocity.z *= scale;
      }

      // Drag
      enemy.velocity.x *= 0.98;
      enemy.velocity.y *= 0.98;
      enemy.velocity.z *= 0.98;

      // Update position
      enemy.position.x += enemy.velocity.x * delta;
      enemy.position.y += enemy.velocity.y * delta;
      enemy.position.z += enemy.velocity.z * delta;

      // Keep above ground
      if (enemy.position.z < 1) {
        enemy.position.z = 1;
        enemy.velocity.z = Math.abs(enemy.velocity.z) * 0.5;
      }

      // Decay flash
      enemy.flash *= 0.9;

      // Collision with player
      if (dist < COLLISION_RADIUS && now - enemy.lastDamageTime > DAMAGE_COOLDOWN_S) {
        enemy.lastDamageTime = now;
        enemy.flash = 1;
        void takeDamage(DAMAGE_PER_HIT);

        // Bounce enemy away
        enemy.velocity.x = -nx * 12;
        enemy.velocity.y = -ny * 12;
        enemy.velocity.z = -nz * 6;
      }

      // Despawn if too far from player
      if (dist > DESPAWN_DISTANCE) {
        enemy.alive = false;
      }
    }

    // Clean up dead enemies
    enemiesRef.current = enemies.filter(e => e.alive);
  });

  return enemiesRef.current;
}
