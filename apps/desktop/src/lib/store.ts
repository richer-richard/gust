import { create } from "zustand";
import {
  activateScenario,
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
} from "./types";

interface SimulationStore {
  snapshot: SimulationSnapshot | null;
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

export const useSimulationStore = create<SimulationStore>((set) => ({
  snapshot: null,
  scenarios: [],
  evaluation: null,
  isEvaluating: false,
  error: null,
  async bootstrap() {
    try {
      const [snapshot, scenarios] = await Promise.all([
        getSnapshot(),
        listScenarios(),
      ]);
      set({ snapshot, scenarios, error: null });
    } catch (error) {
      set({ error: stringifyError(error) });
    }
  },
  async refreshSnapshot() {
    try {
      const snapshot = await getSnapshot();
      set({ snapshot, error: null });
    } catch (error) {
      set({ error: stringifyError(error) });
    }
  },
  async setRunState(runState) {
    try {
      const snapshot = await setRunState(runState);
      set({ snapshot, error: null });
    } catch (error) {
      set({ error: stringifyError(error) });
    }
  },
  async setControllerMode(controllerMode) {
    try {
      const snapshot = await setControllerMode(controllerMode);
      set({ snapshot, error: null });
    } catch (error) {
      set({ error: stringifyError(error) });
    }
  },
  async setAssistLevel(assistLevel) {
    try {
      const snapshot = await setAssistLevel(assistLevel);
      set({ snapshot, error: null });
    } catch (error) {
      set({ error: stringifyError(error) });
    }
  },
  async activateScenario(scenarioId) {
    try {
      const snapshot = await activateScenario(scenarioId);
      set({ snapshot, error: null });
    } catch (error) {
      set({ error: stringifyError(error) });
    }
  },
  async runEvaluation() {
    set({ isEvaluating: true, error: null });
    try {
      const evaluation = await runQuickEvaluation();
      set({ evaluation, isEvaluating: false });
    } catch (error) {
      set({ error: stringifyError(error), isEvaluating: false });
    }
  },
}));

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Tauri invocation error";
}
