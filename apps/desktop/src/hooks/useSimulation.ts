import { useEffect } from "react";
import { useSimulationStore } from "../lib/store";

export function useSimulation() {
  const bootstrap = useSimulationStore((state) => state.bootstrap);
  const refreshSnapshot = useSimulationStore((state) => state.refreshSnapshot);

  useEffect(() => {
    void bootstrap();

    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, 120);

    return () => {
      window.clearInterval(interval);
    };
  }, [bootstrap, refreshSnapshot]);
}

