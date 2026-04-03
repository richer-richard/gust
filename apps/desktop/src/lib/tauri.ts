import { invoke } from "@tauri-apps/api/core";
import type {
  AssistLevel,
  ControllerMode,
  EvaluationReport,
  PlayerInput,
  RunState,
  ScenarioSummary,
  SimulationSnapshot,
  WorldLayout,
} from "./types";

export async function getSnapshot(): Promise<SimulationSnapshot> {
  return invoke<SimulationSnapshot>("get_snapshot");
}

export async function listScenarios(): Promise<ScenarioSummary[]> {
  return invoke<ScenarioSummary[]>("list_scenarios");
}

export async function getWorldLayout(): Promise<WorldLayout> {
  return invoke<WorldLayout>("get_world_layout");
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

export async function setPlayerInput(input: PlayerInput): Promise<void> {
  return invoke<void>("set_player_input", { input });
}

export async function setAssistLevel(level: AssistLevel): Promise<SimulationSnapshot> {
  return invoke<SimulationSnapshot>("set_assist_level", { level });
}

export async function runQuickEvaluation(): Promise<EvaluationReport> {
  return invoke<EvaluationReport>("run_quick_evaluation");
}
