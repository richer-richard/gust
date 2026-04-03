use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use anyhow::{Context, Result, anyhow};
use gust_sim_bridge::{NativeFrame, Simulator};
use gust_types::{
    AssistLevel, ControllerMode, EvaluationReport, FlightPhase, PlayerInput, RunState,
    ScenarioConfig, ScenarioSummary, SimulationSnapshot, WorldLayout,
};
use parking_lot::{Mutex, RwLock};

use crate::controllers::ControllerState;
use crate::evaluation::run_quick_evaluation;
use crate::scenarios::load_built_in_scenarios;
use crate::world::{apply_world_to_scenario, resolve_world_layout};

const STEP_DT_S: f64 = 1.0 / 120.0;

pub struct SimulationService {
    engine: Arc<Mutex<Engine>>,
    snapshot: Arc<RwLock<SimulationSnapshot>>,
    shutdown: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}

impl SimulationService {
    pub fn new() -> Result<Self> {
        let scenarios = load_built_in_scenarios()?;
        let base_scenario = scenarios
            .first()
            .cloned()
            .context("no built-in scenarios were loaded")?;
        let world_layout = resolve_world_layout(&base_scenario.id);
        let active_scenario = apply_world_to_scenario(&base_scenario, &world_layout);

        let mut simulator = Simulator::new(&active_scenario)?;
        let mut controller = ControllerState::new(ControllerMode::Player);
        controller.reset();

        let initial_frame = simulator.frame();
        let initial_snapshot = build_snapshot(
            &initial_frame,
            RunState::Stopped,
            controller.mode(),
            controller.assist_level(),
            controller.flight_phase(),
            controller.motors_armed(),
            &active_scenario,
            "Landing ready | launch Flyover Mode to enter the city.".into(),
            None,
        );

        let engine = Arc::new(Mutex::new(Engine {
            simulator,
            scenarios,
            active_scenario_id: base_scenario.id.clone(),
            resolved_scenario: active_scenario.clone(),
            world_layout,
            controller,
            run_state: RunState::Stopped,
            last_status: "Landing ready | launch Flyover Mode to enter the city.".into(),
            last_snapshot: initial_snapshot.clone(),
        }));
        let snapshot = Arc::new(RwLock::new(initial_snapshot));
        let shutdown = Arc::new(AtomicBool::new(false));

        let worker = Some(spawn_worker(
            Arc::clone(&engine),
            Arc::clone(&snapshot),
            Arc::clone(&shutdown),
        ));

        Ok(Self {
            engine,
            snapshot,
            shutdown,
            worker,
        })
    }

    pub fn get_snapshot(&self) -> SimulationSnapshot {
        self.snapshot.read().clone()
    }

    pub fn list_scenarios(&self) -> Vec<ScenarioSummary> {
        let engine = self.engine.lock();
        engine
            .scenarios
            .iter()
            .map(ScenarioConfig::summary)
            .collect()
    }

    pub fn get_world_layout(&self) -> WorldLayout {
        let engine = self.engine.lock();
        engine.world_layout.clone()
    }

    pub fn set_run_state(&self, next_state: RunState) -> Result<SimulationSnapshot> {
        let mut engine = self.engine.lock();
        engine.set_run_state(next_state)?;
        let snapshot = engine.last_snapshot.clone();
        *self.snapshot.write() = snapshot.clone();
        Ok(snapshot)
    }

    pub fn set_controller_mode(&self, mode: ControllerMode) -> Result<SimulationSnapshot> {
        let mut engine = self.engine.lock();
        engine.set_controller_mode(mode)?;
        let snapshot = engine.last_snapshot.clone();
        *self.snapshot.write() = snapshot.clone();
        Ok(snapshot)
    }

    pub fn activate_scenario(&self, scenario_id: &str) -> Result<SimulationSnapshot> {
        let mut engine = self.engine.lock();
        engine.activate_scenario(scenario_id)?;
        let snapshot = engine.last_snapshot.clone();
        *self.snapshot.write() = snapshot.clone();
        Ok(snapshot)
    }

    pub fn set_player_input(&self, input: PlayerInput) {
        let mut engine = self.engine.lock();
        engine.controller.set_player_input(input);
    }

    pub fn set_assist_level(&self, level: AssistLevel) -> Result<SimulationSnapshot> {
        let mut engine = self.engine.lock();
        engine.controller.set_assist_level(level);
        engine.last_status = format!("Assist level: {:?}", level);
        engine.sync_snapshot(None)?;
        let snapshot = engine.last_snapshot.clone();
        *self.snapshot.write() = snapshot.clone();
        Ok(snapshot)
    }

    pub fn take_damage(&self, amount: f64) {
        let mut engine = self.engine.lock();
        engine.simulator.take_damage(amount);
    }

    pub fn run_quick_evaluation(&self) -> Result<EvaluationReport> {
        let scenario = {
            let engine = self.engine.lock();
            engine.active_scenario()?.clone()
        };
        run_quick_evaluation(&scenario)
    }
}

impl Drop for SimulationService {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

fn spawn_worker(
    engine: Arc<Mutex<Engine>>,
    snapshot: Arc<RwLock<SimulationSnapshot>>,
    shutdown: Arc<AtomicBool>,
) -> JoinHandle<()> {
    thread::spawn(move || {
        let step_duration = Duration::from_secs_f64(STEP_DT_S);
        let mut next_deadline = Instant::now() + step_duration;
        let mut tick_count: u64 = 0;

        while !shutdown.load(Ordering::Relaxed) {
            {
                let mut engine = engine.lock();
                if matches!(engine.run_state, RunState::Running) {
                    if engine.tick().is_ok() {
                        tick_count += 1;
                        // Write snapshot at 30 Hz (every 4th tick) instead of 120 Hz
                        if tick_count % 4 == 0 {
                            *snapshot.write() = engine.last_snapshot.clone();
                        }
                    }
                } else {
                    *snapshot.write() = engine.last_snapshot.clone();
                }
            }

            let now = Instant::now();
            if next_deadline > now {
                thread::sleep(next_deadline - now);
            }
            next_deadline += step_duration;
            if next_deadline < Instant::now() {
                next_deadline = Instant::now() + step_duration;
            }
        }
    })
}

struct Engine {
    simulator: Simulator,
    scenarios: Vec<ScenarioConfig>,
    active_scenario_id: String,
    resolved_scenario: ScenarioConfig,
    world_layout: WorldLayout,
    controller: ControllerState,
    run_state: RunState,
    last_status: String,
    last_snapshot: SimulationSnapshot,
}

impl Engine {
    fn tick(&mut self) -> Result<()> {
        let scenario = self.active_scenario()?.clone();
        let frame = self.simulator.frame();
        let output = self.controller.update(STEP_DT_S, &frame, &scenario);

        self.simulator.set_rotor_command(output.rotor_command);
        self.simulator.step(STEP_DT_S);

        let frame = self.simulator.frame();
        self.last_status = output.status_text;
        self.last_snapshot = build_snapshot(
            &frame,
            self.run_state,
            self.controller.mode(),
            self.controller.assist_level(),
            self.controller.flight_phase(),
            self.controller.motors_armed(),
            &scenario,
            self.last_status.clone(),
            output.active_waypoint_index,
        );

        Ok(())
    }

    fn set_run_state(&mut self, next_state: RunState) -> Result<()> {
        match next_state {
            RunState::Running => {
                if matches!(self.run_state, RunState::Stopped) {
                    self.reset_current("Flyover ready | hold Up for 3s to arm and take off.")?;
                }
                self.run_state = RunState::Running;
                self.last_status = if self.controller.mode() == ControllerMode::Player {
                    "Flyover ready | hold Up for 3s to arm and take off.".into()
                } else {
                    "Simulation running.".into()
                };
                self.sync_snapshot(None)?;
            }
            RunState::Paused => {
                self.run_state = RunState::Paused;
                self.last_status = "Simulation paused.".into();
                self.sync_snapshot(None)?;
            }
            RunState::Stopped => {
                self.run_state = RunState::Stopped;
                self.reset_current("Simulation reset to scenario start.")?;
            }
        }
        Ok(())
    }

    fn set_controller_mode(&mut self, mode: ControllerMode) -> Result<()> {
        let frame = self.simulator.frame();
        self.controller = ControllerState::new(mode);
        self.controller.reset();
        self.controller.sync_with_frame(self.run_state, &frame);
        self.last_status = format!("Controller switched to {:?}.", mode);
        self.sync_snapshot(None)
    }

    fn activate_scenario(&mut self, scenario_id: &str) -> Result<()> {
        if self.active_scenario_id == scenario_id {
            return Ok(());
        }

        let scenario = self
            .scenarios
            .iter()
            .find(|scenario| scenario.id == scenario_id)
            .cloned()
            .ok_or_else(|| anyhow!("unknown scenario id: {scenario_id}"))?;

        self.active_scenario_id = scenario.id.clone();
        self.resolve_active_world()?;
        self.run_state = RunState::Stopped;
        self.simulator.reset(&self.resolved_scenario)?;
        self.controller.reset();
        self.last_status = format!("Scenario loaded: {}.", scenario.name);
        self.sync_snapshot(None)
    }

    fn reset_current(&mut self, status: &str) -> Result<()> {
        let scenario = self.active_scenario()?.clone();
        self.simulator.reset(&scenario)?;
        self.controller.reset();
        self.last_status = status.into();
        self.sync_snapshot(None)
    }

    fn sync_snapshot(&mut self, active_waypoint_index: Option<usize>) -> Result<()> {
        let scenario = self.active_scenario()?.clone();
        let frame = self.simulator.frame();
        let assist_level = self.controller.assist_level();
        let (flight_phase, motors_armed) = if self.controller.mode() == ControllerMode::Player {
            (
                self.controller.flight_phase(),
                self.controller.motors_armed(),
            )
        } else if matches!(self.run_state, RunState::Running | RunState::Paused) {
            (FlightPhase::Airborne, true)
        } else {
            (FlightPhase::IdleOnPad, false)
        };
        self.last_snapshot = build_snapshot(
            &frame,
            self.run_state,
            self.controller.mode(),
            assist_level,
            flight_phase,
            motors_armed,
            &scenario,
            self.last_status.clone(),
            active_waypoint_index,
        );
        Ok(())
    }

    fn active_scenario(&self) -> Result<&ScenarioConfig> {
        if self.resolved_scenario.id == self.active_scenario_id {
            Ok(&self.resolved_scenario)
        } else {
            Err(anyhow!(
                "active scenario not resolved: {}",
                self.active_scenario_id
            ))
        }
    }

    fn active_base_scenario(&self) -> Result<&ScenarioConfig> {
        self.scenarios
            .iter()
            .find(|scenario| scenario.id == self.active_scenario_id)
            .ok_or_else(|| {
                anyhow!(
                    "active base scenario not found: {}",
                    self.active_scenario_id
                )
            })
    }

    fn resolve_active_world(&mut self) -> Result<()> {
        let base = self.active_base_scenario()?.clone();
        self.world_layout = resolve_world_layout(&base.id);
        self.resolved_scenario = apply_world_to_scenario(&base, &self.world_layout);
        Ok(())
    }
}

fn build_snapshot(
    frame: &NativeFrame,
    run_state: RunState,
    controller_mode: ControllerMode,
    assist_level: Option<AssistLevel>,
    flight_phase: FlightPhase,
    motors_armed: bool,
    scenario: &ScenarioConfig,
    status_text: String,
    active_waypoint_index: Option<usize>,
) -> SimulationSnapshot {
    SimulationSnapshot {
        run_state,
        controller_mode,
        assist_level,
        flight_phase,
        motors_armed,
        tick: frame.tick,
        sim_time_s: frame.sim_time_s,
        status_text,
        active_scenario_id: scenario.id.clone(),
        scenario_name: scenario.name.clone(),
        active_waypoint_index,
        drone: frame.drone.clone(),
        sensors: frame.sensors.clone(),
        environment: frame.environment.clone(),
        obstacles: Vec::new(),
        waypoints: frame.waypoints.clone(),
    }
}
