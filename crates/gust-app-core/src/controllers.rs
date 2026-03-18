use gust_sim_bridge::NativeFrame;
use gust_types::{ControllerMode, ScenarioConfig, Vec3};

const HOVER_THROTTLE: f64 = 0.615;

#[derive(Clone, Debug)]
pub struct ControllerOutput {
    pub rotor_command: [f64; 4],
    pub status_text: String,
    pub active_waypoint_index: Option<usize>,
    pub recovery_event: bool,
}

pub(crate) enum ControllerState {
    Stabilize(StabilizeController),
    WaypointFollow(WaypointController),
    Recovery(RecoveryController),
    AdaptiveSupervisor(AdaptiveSupervisorController),
}

impl ControllerState {
    pub fn new(mode: ControllerMode) -> Self {
        match mode {
            ControllerMode::Stabilize => Self::Stabilize(StabilizeController::default()),
            ControllerMode::WaypointFollow => Self::WaypointFollow(WaypointController::default()),
            ControllerMode::Recovery => Self::Recovery(RecoveryController::default()),
            ControllerMode::AdaptiveSupervisor => {
                Self::AdaptiveSupervisor(AdaptiveSupervisorController::default())
            }
        }
    }

    pub fn mode(&self) -> ControllerMode {
        match self {
            Self::Stabilize(_) => ControllerMode::Stabilize,
            Self::WaypointFollow(_) => ControllerMode::WaypointFollow,
            Self::Recovery(_) => ControllerMode::Recovery,
            Self::AdaptiveSupervisor(_) => ControllerMode::AdaptiveSupervisor,
        }
    }

    pub fn reset(&mut self) {
        match self {
            Self::Stabilize(controller) => controller.reset(),
            Self::WaypointFollow(controller) => controller.reset(),
            Self::Recovery(controller) => controller.reset(),
            Self::AdaptiveSupervisor(controller) => controller.reset(),
        }
    }

    pub fn update(
        &mut self,
        dt: f64,
        frame: &NativeFrame,
        scenario: &ScenarioConfig,
    ) -> ControllerOutput {
        match self {
            Self::Stabilize(controller) => controller.update(dt, frame, scenario),
            Self::WaypointFollow(controller) => controller.update(dt, frame, scenario),
            Self::Recovery(controller) => controller.update(dt, frame, scenario),
            Self::AdaptiveSupervisor(controller) => controller.update(dt, frame, scenario),
        }
    }
}

#[derive(Default)]
pub(crate) struct StabilizeController {
    hold_altitude_m: f64,
}

impl StabilizeController {
    fn reset(&mut self) {
        self.hold_altitude_m = 25.0;
    }

    fn update(
        &mut self,
        _dt: f64,
        frame: &NativeFrame,
        _scenario: &ScenarioConfig,
    ) -> ControllerOutput {
        if self.hold_altitude_m <= 0.1 {
            self.hold_altitude_m = frame.drone.position.z.max(20.0);
        }

        let altitude = if frame.sensors.altimeter_valid {
            frame.sensors.altimeter_altitude
        } else {
            frame.drone.position.z
        };
        let thrust = altitude_hold(self.hold_altitude_m, altitude, frame.drone.velocity.z, 0.25);
        let roll = attitude_hold(
            0.0,
            frame.drone.euler.x,
            frame.drone.angular_velocity.x,
            0.18,
        );
        let pitch = attitude_hold(
            0.0,
            frame.drone.euler.y,
            frame.drone.angular_velocity.y,
            0.18,
        );
        let yaw = attitude_hold(
            0.0,
            frame.drone.euler.z,
            frame.drone.angular_velocity.z,
            0.08,
        );

        ControllerOutput {
            rotor_command: mix_rotors(thrust, roll, pitch, yaw),
            status_text: format!(
                "Stabilize hold at {:.1} m, gust index {:.2}",
                self.hold_altitude_m, frame.environment.turbulence_index
            ),
            active_waypoint_index: None,
            recovery_event: frame.drone.recovery_margin < 0.3,
        }
    }
}

#[derive(Default)]
pub(crate) struct WaypointController {
    active_index: usize,
    hold_elapsed_s: f64,
    last_position_estimate: Vec3,
}

impl WaypointController {
    fn reset(&mut self) {
        self.active_index = 0;
        self.hold_elapsed_s = 0.0;
        self.last_position_estimate = Vec3::default();
    }

    fn update(
        &mut self,
        dt: f64,
        frame: &NativeFrame,
        scenario: &ScenarioConfig,
    ) -> ControllerOutput {
        if scenario.waypoints.is_empty() {
            return StabilizeController {
                hold_altitude_m: 25.0,
            }
            .update(dt, frame, scenario);
        }

        let position = observed_position(frame, &mut self.last_position_estimate);
        let target_index = self
            .active_index
            .min(scenario.waypoints.len().saturating_sub(1));
        let target = &scenario.waypoints[target_index];
        let error = sub(target.position, position);

        if magnitude(error) < 3.0 {
            self.hold_elapsed_s += dt;
            if self.hold_elapsed_s >= target.hold_s
                && self.active_index + 1 < scenario.waypoints.len()
            {
                self.active_index += 1;
                self.hold_elapsed_s = 0.0;
            }
        } else {
            self.hold_elapsed_s = 0.0;
        }

        let active = &scenario.waypoints[self.active_index.min(scenario.waypoints.len() - 1)];
        let active_error = sub(active.position, position);
        let desired_pitch = clamp(
            active_error.x * 0.075 - frame.drone.velocity.x * 0.04,
            -0.32,
            0.32,
        );
        let desired_roll = clamp(
            -active_error.y * 0.085 + frame.drone.velocity.y * 0.04,
            -0.32,
            0.32,
        );
        let desired_yaw = clamp(active_error.y.atan2(active_error.x), -0.8, 0.8);
        let altitude = if frame.sensors.altimeter_valid {
            frame.sensors.altimeter_altitude
        } else {
            frame.drone.position.z
        };
        let thrust = altitude_hold(active.position.z, altitude, frame.drone.velocity.z, 0.22);
        let roll = attitude_hold(
            desired_roll,
            frame.drone.euler.x,
            frame.drone.angular_velocity.x,
            0.16,
        );
        let pitch = attitude_hold(
            desired_pitch,
            frame.drone.euler.y,
            frame.drone.angular_velocity.y,
            0.16,
        );
        let yaw = attitude_hold(
            desired_yaw,
            frame.drone.euler.z,
            frame.drone.angular_velocity.z,
            0.07,
        );

        ControllerOutput {
            rotor_command: mix_rotors(thrust, roll, pitch, yaw),
            status_text: format!(
                "Waypoint {}/{} | hold {:.1}/{:.1}s",
                self.active_index + 1,
                scenario.waypoints.len(),
                self.hold_elapsed_s,
                active.hold_s
            ),
            active_waypoint_index: Some(self.active_index),
            recovery_event: frame.drone.recovery_margin < 0.25,
        }
    }
}

#[derive(Default)]
pub(crate) struct RecoveryController {
    target_altitude_m: f64,
}

impl RecoveryController {
    fn reset(&mut self) {
        self.target_altitude_m = 28.0;
    }

    fn update(
        &mut self,
        _dt: f64,
        frame: &NativeFrame,
        _scenario: &ScenarioConfig,
    ) -> ControllerOutput {
        let altitude = if frame.sensors.altimeter_valid {
            frame.sensors.altimeter_altitude
        } else {
            frame.drone.position.z
        };
        let fallback_altitude = if frame.drone.collision {
            self.target_altitude_m + 0.4
        } else {
            self.target_altitude_m
        };

        let thrust = altitude_hold(fallback_altitude, altitude, frame.drone.velocity.z, 0.38);
        let roll = attitude_hold(
            0.0,
            frame.drone.euler.x,
            frame.drone.angular_velocity.x,
            0.24,
        );
        let pitch = attitude_hold(
            0.0,
            frame.drone.euler.y,
            frame.drone.angular_velocity.y,
            0.24,
        );
        let yaw = attitude_hold(
            0.0,
            frame.drone.euler.z,
            frame.drone.angular_velocity.z,
            0.1,
        );

        let mut notes = Vec::new();
        if !frame.sensors.gps_valid {
            notes.push("gps dropout");
        }
        if !frame.sensors.altimeter_valid {
            notes.push("altimeter degraded");
        }
        if frame.drone.closest_obstacle_distance < 5.0 {
            notes.push("tight obstacle margin");
        }
        if frame.drone.collision {
            notes.push("post-collision damping");
        }
        if notes.is_empty() {
            notes.push("re-centering attitude");
        }

        ControllerOutput {
            rotor_command: mix_rotors(thrust, roll, pitch, yaw),
            status_text: format!("Recovery mode: {}", notes.join(", ")),
            active_waypoint_index: None,
            recovery_event: true,
        }
    }
}

#[derive(Default)]
pub(crate) struct AdaptiveSupervisorController {
    stabilize: StabilizeController,
    waypoint: WaypointController,
    recovery: RecoveryController,
}

impl AdaptiveSupervisorController {
    fn reset(&mut self) {
        self.stabilize.reset();
        self.waypoint.reset();
        self.recovery.reset();
    }

    fn update(
        &mut self,
        dt: f64,
        frame: &NativeFrame,
        scenario: &ScenarioConfig,
    ) -> ControllerOutput {
        let risk_score = risk_score(frame);

        if risk_score > 0.62 {
            let mut output = self.recovery.update(dt, frame, scenario);
            output.status_text = format!("Adaptive supervisor -> {}", output.status_text);
            return output;
        }

        if !scenario.waypoints.is_empty() {
            let mut output = self.waypoint.update(dt, frame, scenario);
            output.status_text = format!("Adaptive supervisor -> {}", output.status_text);
            return output;
        }

        let mut output = self.stabilize.update(dt, frame, scenario);
        output.status_text = format!("Adaptive supervisor -> {}", output.status_text);
        output
    }
}

fn risk_score(frame: &NativeFrame) -> f64 {
    let attitude = frame.drone.euler.x.abs().max(frame.drone.euler.y.abs()) / 0.9;
    let margin = 1.0 - frame.drone.recovery_margin;
    let obstacle = clamp(1.0 - frame.drone.closest_obstacle_distance / 2.0, 0.0, 1.0);
    let faults = if frame.sensors.gps_valid && frame.sensors.altimeter_valid {
        0.0
    } else {
        0.35
    };
    let collision = if frame.drone.collision { 0.4 } else { 0.0 };

    clamp(
        0.28 * attitude
            + 0.22 * margin
            + 0.18 * obstacle
            + 0.18 * frame.environment.turbulence_index
            + faults
            + collision,
        0.0,
        1.2,
    )
}

fn observed_position(frame: &NativeFrame, last_fix: &mut Vec3) -> Vec3 {
    if frame.sensors.gps_valid {
        *last_fix = frame.sensors.gps_position;
        frame.sensors.gps_position
    } else if last_fix.magnitude() > 0.1 {
        *last_fix
    } else {
        frame.drone.position
    }
}

fn altitude_hold(target_altitude: f64, altitude: f64, vertical_velocity: f64, gain: f64) -> f64 {
    clamp(
        HOVER_THROTTLE + (target_altitude - altitude) * gain - vertical_velocity * 0.035,
        0.28,
        0.9,
    )
}

fn attitude_hold(target: f64, angle: f64, rate: f64, gain: f64) -> f64 {
    clamp((target - angle) * gain - rate * 0.03, -0.18, 0.18)
}

fn mix_rotors(thrust: f64, roll: f64, pitch: f64, yaw: f64) -> [f64; 4] {
    [
        clamp(thrust - pitch - roll + yaw, 0.0, 1.0),
        clamp(thrust - pitch + roll - yaw, 0.0, 1.0),
        clamp(thrust + pitch + roll + yaw, 0.0, 1.0),
        clamp(thrust + pitch - roll - yaw, 0.0, 1.0),
    ]
}

fn clamp(value: f64, low: f64, high: f64) -> f64 {
    value.max(low).min(high)
}

fn sub(lhs: Vec3, rhs: Vec3) -> Vec3 {
    Vec3 {
        x: lhs.x - rhs.x,
        y: lhs.y - rhs.y,
        z: lhs.z - rhs.z,
    }
}

fn magnitude(value: Vec3) -> f64 {
    value.magnitude()
}
