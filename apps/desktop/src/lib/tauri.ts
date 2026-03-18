import { invoke } from "@tauri-apps/api/core";
import type {
  ControllerMode,
  EvaluationReport,
  RunState,
  ScenarioSummary,
  SimulationSnapshot,
} from "./types";

export async function getSnapshot(): Promise<SimulationSnapshot> {
  return invoke<SimulationSnapshot>("get_snapshot");
}

export async function listScenarios(): Promise<ScenarioSummary[]> {
  return invoke<ScenarioSummary[]>("list_scenarios");
}

export async function setRunState(runState: RunState): Promise<SimulationSnapshot> {
  return invoke<SimulationSnapshot>("set_run_state", { runState });
}

export async function setControllerMode(
  controllerMode: ControllerMode,
): Promise<SimulationSnapshot> {
  return invoke<SimulationSnapshot>("set_controller_mode", { controllerMode });
}

export async function activateScenario(
  scenarioId: string,
): Promise<SimulationSnapshot> {
  return invoke<SimulationSnapshot>("activate_scenario", { scenarioId });
}

export async function runQuickEvaluation(): Promise<EvaluationReport> {
  return invoke<EvaluationReport>("run_quick_evaluation");
}

