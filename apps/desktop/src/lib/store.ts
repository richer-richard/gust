import { create } from "zustand";
import {
  activateScenario,
  getWorldLayout,
  getSnapshot,
  listScenarios,
  runQuickEvaluation,
  setAssistLevel,
  setControllerMode,
  setRunState,
} from "./tauri";
import type {
  AssistLevel,
  ControllerMode,
  EvaluationReport,
  RunState,
  ScenarioSummary,
  SimulationSnapshot,
  WorldLayout,
} from "./types";

interface SimulationStore {
  snapshot: SimulationSnapshot | null;
  worldLayout: WorldLayout | null;
  scenarios: ScenarioSummary[];
  evaluation: EvaluationReport | null;
  isEvaluating: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  setRunState: (runState: RunState) => Promise<void>;
  setControllerMode: (controllerMode: ControllerMode) => Promise<void>;
  setAssistLevel: (assistLevel: AssistLevel) => Promise<void>;
  activateScenario: (scenarioId: string) => Promise<void>;
  runEvaluation: () => Promise<void>;
}

export const useSimulationStore = create<SimulationStore>((set) => {
  let snapshotWriteVersion = 0;
  let latestRefreshToken = 0;
  let inFlightRefresh: Promise<void> | null = null;

  const commitSnapshot = (snapshot: SimulationSnapshot) => {
    snapshotWriteVersion += 1;
    set({ snapshot, error: null });
  };

  const toThrownError = (error: unknown): Error => {
    if (error instanceof Error) {
      return error;
    }
    return new Error(stringifyError(error));
  };

  return {
    snapshot: null,
    worldLayout: null,
    scenarios: [],
    evaluation: null,
    isEvaluating: false,
    error: null,
    async bootstrap() {
      try {
        const [snapshot, scenarios, worldLayout] = await Promise.all([
          getSnapshot(),
          listScenarios(),
          getWorldLayout(),
        ]);
        snapshotWriteVersion += 1;
        set({ snapshot, worldLayout, scenarios, error: null });
      } catch (error) {
        set({ error: stringifyError(error) });
      }
    },
    async refreshSnapshot() {
      if (inFlightRefresh) {
        return inFlightRefresh;
      }

      const refreshToken = ++latestRefreshToken;
      const baselineVersion = snapshotWriteVersion;

      inFlightRefresh = (async () => {
        try {
          const snapshot = await getSnapshot();
          if (
            refreshToken !== latestRefreshToken ||
            baselineVersion !== snapshotWriteVersion
          ) {
            return;
          }

          commitSnapshot(snapshot);
        } catch (error) {
          if (refreshToken === latestRefreshToken) {
            set({ error: stringifyError(error) });
          }
        } finally {
          inFlightRefresh = null;
        }
      })();

      return inFlightRefresh;
    },
    async setRunState(runState) {
      try {
        const snapshot = await setRunState(runState);
        commitSnapshot(snapshot);
      } catch (error) {
        set({ error: stringifyError(error) });
        throw toThrownError(error);
      }
    },
    async setControllerMode(controllerMode) {
      try {
        const snapshot = await setControllerMode(controllerMode);
        commitSnapshot(snapshot);
      } catch (error) {
        set({ error: stringifyError(error) });
        throw toThrownError(error);
      }
    },
    async setAssistLevel(assistLevel) {
      try {
        const snapshot = await setAssistLevel(assistLevel);
        commitSnapshot(snapshot);
      } catch (error) {
        set({ error: stringifyError(error) });
        throw toThrownError(error);
      }
    },
    async activateScenario(scenarioId) {
      try {
        const snapshot = await activateScenario(scenarioId);
        const worldLayout = await getWorldLayout();
        snapshotWriteVersion += 1;
        set({ snapshot, worldLayout, error: null });
      } catch (error) {
        set({ error: stringifyError(error) });
        throw toThrownError(error);
      }
    },
    async runEvaluation() {
      set({ isEvaluating: true, error: null });
      try {
        const evaluation = await runQuickEvaluation();
        set({ evaluation, isEvaluating: false, error: null });
      } catch (error) {
        set({ error: stringifyError(error), isEvaluating: false });
        throw toThrownError(error);
      }
    },
  };
});

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Tauri invocation error";
}
