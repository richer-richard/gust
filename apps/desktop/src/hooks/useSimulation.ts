import { useEffect } from "react";
import { useSimulationStore } from "../lib/store";
import { useKeyboardControls } from "./useKeyboardControls";

export function useSimulation(playerControlsEnabled: boolean) {
  const bootstrap = useSimulationStore((state) => state.bootstrap);
  const refreshSnapshot = useSimulationStore((state) => state.refreshSnapshot);

  useKeyboardControls(playerControlsEnabled);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const schedulePoll = () => {
      if (cancelled) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        void pollSnapshot();
      }, 120);
    };

    const pollSnapshot = async () => {
      try {
        await refreshSnapshot();
      } finally {
        schedulePoll();
      }
    };

    const start = async () => {
      await bootstrap();
      schedulePoll();
    };

    void start();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [bootstrap, refreshSnapshot]);
}
