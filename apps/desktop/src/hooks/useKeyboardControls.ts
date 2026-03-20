/**
 * useKeyboardControls — Captures flyover controls and sends input to the backend
 * only when the effective input changes.
 */
import { useEffect, useRef, useCallback } from 'react';
import { setPlayerInput } from '../lib/tauri';
import type { PlayerInput } from '../lib/types';

const KEY_MAP: Record<string, keyof typeof AXIS_MAP> = {
  KeyW: 'pitchPos',
  KeyS: 'pitchNeg',
  KeyA: 'rollNeg',
  KeyD: 'rollPos',
  ArrowLeft: 'yawNeg',
  ArrowRight: 'yawPos',
  KeyQ: 'yawNeg',
  KeyE: 'yawPos',
  ArrowUp: 'throttlePos',
  Space: 'throttlePos',
  ArrowDown: 'throttleNeg',
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

export function useKeyboardControls(enabled: boolean) {
  const keysRef = useRef({ ...AXIS_MAP });
  const lastSentRef = useRef<PlayerInput | null>(null);

  const emitInput = useCallback(() => {
    const k = keysRef.current;
    const nextInput: PlayerInput = {
      pitch: (k.pitchPos ? 1 : 0) - (k.pitchNeg ? 1 : 0),
      roll: (k.rollPos ? 1 : 0) - (k.rollNeg ? 1 : 0),
      yaw: (k.yawPos ? 1 : 0) - (k.yawNeg ? 1 : 0),
      throttle: (k.throttlePos ? 1 : 0) - (k.throttleNeg ? 1 : 0),
    };

    const last = lastSentRef.current;
    if (
      last &&
      last.pitch === nextInput.pitch &&
      last.roll === nextInput.roll &&
      last.yaw === nextInput.yaw &&
      last.throttle === nextInput.throttle
    ) {
      return;
    }

    lastSentRef.current = nextInput;
    void setPlayerInput(nextInput);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const axis = KEY_MAP[e.code];
    if (axis) {
      e.preventDefault();
      keysRef.current[axis] = true;
      emitInput();
    }
  }, [emitInput]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const axis = KEY_MAP[e.code];
    if (axis) {
      e.preventDefault();
      keysRef.current[axis] = false;
      emitInput();
    }
  }, [emitInput]);

  const handleBlur = useCallback(() => {
    keysRef.current = { ...AXIS_MAP };
    emitInput();
  }, [emitInput]);

  useEffect(() => {
    if (!enabled) {
      keysRef.current = { ...AXIS_MAP };
      lastSentRef.current = null;
      void setPlayerInput({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    emitInput();

    return () => {
      keysRef.current = { ...AXIS_MAP };
      lastSentRef.current = null;
      void setPlayerInput({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, emitInput, handleKeyDown, handleKeyUp, handleBlur]);
}
