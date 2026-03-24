#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use gust_app_core::SimulationService;
use gust_types::{
    AssistLevel, ControllerMode, EvaluationReport, PlayerInput, RunState, ScenarioSummary,
    SimulationSnapshot, WorldLayout,
};
use tauri::Manager;

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
fn get_world_layout(service: tauri::State<'_, SimulationService>) -> Result<WorldLayout, String> {
    Ok(service.get_world_layout())
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
fn set_player_input(
    input: PlayerInput,
    service: tauri::State<'_, SimulationService>,
) -> Result<(), String> {
    service.set_player_input(input);
    Ok(())
}

#[tauri::command]
fn take_damage(amount: f64, service: tauri::State<'_, SimulationService>) -> Result<(), String> {
    service.take_damage(amount);
    Ok(())
}

#[tauri::command]
fn set_assist_level(
    level: AssistLevel,
    service: tauri::State<'_, SimulationService>,
) -> Result<SimulationSnapshot, String> {
    service
        .set_assist_level(level)
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
            get_world_layout,
            set_run_state,
            set_controller_mode,
            activate_scenario,
            set_player_input,
            take_damage,
            set_assist_level,
            run_quick_evaluation
        ])
        .setup(|app| {
            // Create default native menu (macOS: Cmd+Q quit, Cmd+C/V copy/paste, etc.)
            let menu = tauri::menu::Menu::default(app.handle())?;
            app.set_menu(menu)?;

            if let Some(window) = app.get_webview_window("main") {
                window.maximize()?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Gust desktop app");
}
