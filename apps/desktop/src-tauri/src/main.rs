#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use gust_app_core::SimulationService;
use gust_types::{ControllerMode, EvaluationReport, RunState, ScenarioSummary, SimulationSnapshot};

#[tauri::command]
fn get_snapshot(
    service: tauri::State<'_, SimulationService>,
) -> Result<SimulationSnapshot, String> {
    Ok(service.get_snapshot())
}

#[tauri::command]
fn list_scenarios(
    service: tauri::State<'_, SimulationService>,
) -> Result<Vec<ScenarioSummary>, String> {
    Ok(service.list_scenarios())
}

#[tauri::command]
fn set_run_state(
    run_state: RunState,
    service: tauri::State<'_, SimulationService>,
) -> Result<SimulationSnapshot, String> {
    service
        .set_run_state(run_state)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_controller_mode(
    controller_mode: ControllerMode,
    service: tauri::State<'_, SimulationService>,
) -> Result<SimulationSnapshot, String> {
    service
        .set_controller_mode(controller_mode)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn activate_scenario(
    scenario_id: String,
    service: tauri::State<'_, SimulationService>,
) -> Result<SimulationSnapshot, String> {
    service
        .activate_scenario(&scenario_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn run_quick_evaluation(
    service: tauri::State<'_, SimulationService>,
) -> Result<EvaluationReport, String> {
    service
        .run_quick_evaluation()
        .map_err(|error| error.to_string())
}

fn main() {
    let simulation_service =
        SimulationService::new().expect("failed to initialize Gust simulation service");

    tauri::Builder::default()
        .manage(simulation_service)
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            list_scenarios,
            set_run_state,
            set_controller_mode,
            activate_scenario,
            run_quick_evaluation
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Gust desktop app");
}
