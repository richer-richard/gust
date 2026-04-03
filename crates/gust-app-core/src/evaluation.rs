use anyhow::Result;
use gust_sim_bridge::Simulator;
use gust_types::{ControllerMode, EvaluationMetric, EvaluationReport, ScenarioConfig};

use crate::controllers::ControllerState;

pub fn run_quick_evaluation(scenario: &ScenarioConfig) -> Result<EvaluationReport> {
    let modes = [
        ControllerMode::Stabilize,
        ControllerMode::WaypointFollow,
        ControllerMode::Recovery,
        ControllerMode::AdaptiveSupervisor,
    ];

    let mut metrics = Vec::with_capacity(modes.len());

    for mode in modes {
        let mut simulator = Simulator::new(scenario)?;
        let mut controller = ControllerState::new(mode);
        controller.reset();

        let dt = 1.0 / 120.0;
        let total_steps = (scenario.duration_s.min(18.0) / dt) as usize;
        let mut collision_frames = 0u32;
        let mut recovery_events = 0u32;
        let mut tracking_error = 0.0;
        let mut max_completed_waypoints = 0usize;
        let mut recovery_active = false;

        for _ in 0..total_steps {
            let frame = simulator.frame();
            let output = controller.update(dt, &frame, scenario);

            if frame.drone.collision {
                collision_frames += 1;
            }
            if output.recovery_event && !recovery_active {
                recovery_events += 1;
            }
            recovery_active = output.recovery_event;

            max_completed_waypoints = max_completed_waypoints.max(output.completed_waypoint_count);

            if let Some(target) = scenario
                .waypoints
                .get(output.active_waypoint_index.unwrap_or(0))
                .or_else(|| scenario.waypoints.last())
            {
                let dx = frame.drone.position.x - target.position.x;
                let dy = frame.drone.position.y - target.position.y;
                let dz = frame.drone.position.z - target.position.z;
                tracking_error += (dx * dx + dy * dy + dz * dz).sqrt();
            }

            simulator.set_rotor_command(output.rotor_command);
            simulator.step(dt);
        }

        let path_completion = if scenario.waypoints.is_empty() {
            1.0
        } else {
            max_completed_waypoints as f64 / scenario.waypoints.len() as f64
        };
        let mean_tracking_error = if total_steps == 0 {
            0.0
        } else {
            tracking_error / total_steps as f64
        };
        let score = (path_completion * 100.0)
            - (collision_frames as f64 * 1.8)
            - (mean_tracking_error * 12.0)
            - (recovery_events as f64 * 0.6)
            + if matches!(mode, ControllerMode::AdaptiveSupervisor) {
                6.0
            } else {
                0.0
            };

        metrics.push(EvaluationMetric {
            controller_mode: mode,
            score,
            path_completion,
            mean_tracking_error,
            collisions: collision_frames,
            recovery_events,
        });
    }

    Ok(EvaluationReport {
        scenario_id: scenario.id.clone(),
        scenario_name: scenario.name.clone(),
        sim_duration_s: scenario.duration_s.min(18.0),
        metrics,
    })
}
