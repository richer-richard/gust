/**
 * useKeyboardControls — Captures WASD/Arrow/Space/Shift/Q/E keys
 * and sends PlayerInput to the Tauri backend every animation frame.
 */
import { useEffect, useRef, useCallback } from 'react';
import { setPlayerInput } from '../lib/tauri';
import type { PlayerInput } from '../lib/types';

const KEY_MAP: Record<string, keyof typeof AXIS_MAP> = {
  KeyW: 'pitchPos',
  ArrowUp: 'pitchPos',
  KeyS: 'pitchNeg',
  ArrowDown: 'pitchNeg',
  KeyA: 'rollNeg',
  ArrowLeft: 'rollNeg',
  KeyD: 'rollPos',
  ArrowRight: 'rollPos',
  KeyQ: 'yawNeg',
  KeyE: 'yawPos',
  Space: 'throttlePos',
  ShiftLeft: 'throttleNeg',
  ShiftRight: 'throttleNeg',
};

const AXIS_MAP = {
  pitchPos: false,
  pitchNeg: false,
  rollPos: false,
  rollNeg: false,
  yawPos: false,
  yawNeg: false,
  throttlePos: false,
  throttleNeg: false,
};

export function useKeyboardControls() {
  const keysRef = useRef({ ...AXIS_MAP });
  const rafRef = useRef<number>(0);
  const activeRef = useRef(true);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const axis = KEY_MAP[e.code];
    if (axis) {
      e.preventDefault();
      keysRef.current[axis] = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const axis = KEY_MAP[e.code];
    if (axis) {
      e.preventDefault();
      keysRef.current[axis] = false;
    }
  }, []);

  const handleBlur = useCallback(() => {
    // Release all keys on window blur
    keysRef.current = { ...AXIS_MAP };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    const sendLoop = () => {
      if (!activeRef.current) return;

      const k = keysRef.current;
      const input: PlayerInput = {
        pitch: (k.pitchPos ? 1 : 0) - (k.pitchNeg ? 1 : 0),
        roll: (k.rollPos ? 1 : 0) - (k.rollNeg ? 1 : 0),
        yaw: (k.yawPos ? 1 : 0) - (k.yawNeg ? 1 : 0),
        throttle: (k.throttlePos ? 1 : 0) - (k.throttleNeg ? 1 : 0),
      };

      // Only send if there's actual input to avoid unnecessary IPC
      if (
        input.pitch !== 0 ||
        input.roll !== 0 ||
        input.yaw !== 0 ||
        input.throttle !== 0
      ) {
        void setPlayerInput(input);
      } else {
        // Send zero input to stop drone movement
        void setPlayerInput({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
      }

      rafRef.current = requestAnimationFrame(sendLoop);
    };

    rafRef.current = requestAnimationFrame(sendLoop);

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);
}
