use gust_sim_bridge::NativeFrame;
use gust_types::{
    AssistLevel, ControllerMode, FlightPhase, PlayerInput, RunState, ScenarioConfig, Vec3,
};

const HOVER_THROTTLE: f64 = 0.615;
const TAKEOFF_HOLD_S: f64 = 3.0;
const TAKEOFF_TARGET_ALTITUDE_M: f64 = 6.0;
const MAX_FLIGHT_ALTITUDE_M: f64 = 220.0;

#[derive(Clone, Debug)]
pub struct ControllerOutput {
    pub rotor_command: [f64; 4],
    pub status_text: String,
    pub active_waypoint_index: Option<usize>,
    pub completed_waypoint_count: usize,
    pub recovery_event: bool,
}

pub(crate) enum ControllerState {
    Player(PlayerController),
    Stabilize(StabilizeController),
    WaypointFollow(WaypointController),
    Recovery(RecoveryController),
    AdaptiveSupervisor(AdaptiveSupervisorController),
}

impl ControllerState {
    pub fn new(mode: ControllerMode) -> Self {
        match mode {
            ControllerMode::Player => Self::Player(PlayerController::default()),
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
            Self::Player(_) => ControllerMode::Player,
            Self::Stabilize(_) => ControllerMode::Stabilize,
            Self::WaypointFollow(_) => ControllerMode::WaypointFollow,
            Self::Recovery(_) => ControllerMode::Recovery,
            Self::AdaptiveSupervisor(_) => ControllerMode::AdaptiveSupervisor,
        }
    }

    pub fn reset(&mut self) {
        match self {
            Self::Player(controller) => controller.reset(),
            Self::Stabilize(controller) => controller.reset(),
            Self::WaypointFollow(controller) => controller.reset(),
            Self::Recovery(controller) => controller.reset(),
            Self::AdaptiveSupervisor(controller) => controller.reset(),
        }
    }

    pub fn set_player_input(&mut self, input: PlayerInput) {
        if let Self::Player(controller) = self {
            controller.input = input;
        }
    }

    pub fn set_assist_level(&mut self, level: AssistLevel) {
        if let Self::Player(controller) = self {
            controller.assist_level = level;
        }
    }

    pub fn assist_level(&self) -> Option<AssistLevel> {
        match self {
            Self::Player(controller) => Some(controller.assist_level),
            _ => None,
        }
    }

    pub fn flight_phase(&self) -> FlightPhase {
        match self {
            Self::Player(controller) => controller.flight_phase,
            _ => FlightPhase::Airborne,
        }
    }

    pub fn motors_armed(&self) -> bool {
        match self {
            Self::Player(controller) => controller.motors_armed,
            _ => true,
        }
    }

    pub fn update(
        &mut self,
        dt: f64,
        frame: &NativeFrame,
        scenario: &ScenarioConfig,
    ) -> ControllerOutput {
        match self {
            Self::Player(controller) => controller.update(dt, frame, scenario),
            Self::Stabilize(controller) => controller.update(dt, frame, scenario),
            Self::WaypointFollow(controller) => controller.update(dt, frame, scenario),
            Self::Recovery(controller) => controller.update(dt, frame, scenario),
            Self::AdaptiveSupervisor(controller) => controller.update(dt, frame, scenario),
        }
    }

    pub fn sync_with_frame(&mut self, run_state: RunState, frame: &NativeFrame) {
        if let Self::Player(controller) = self {
            controller.adopt_vehicle_state(run_state, frame);
        }
    }
}

pub(crate) struct PlayerController {
    pub input: PlayerInput,
    pub assist_level: AssistLevel,
    hold_altitude: f64,
    flight_phase: FlightPhase,
    motors_armed: bool,
    takeoff_hold_s: f64,
}

impl Default for PlayerController {
    fn default() -> Self {
        Self {
            input: PlayerInput::default(),
            assist_level: AssistLevel::IntentAssist,
            hold_altitude: 0.0,
            flight_phase: FlightPhase::IdleOnPad,
            motors_armed: false,
            takeoff_hold_s: 0.0,
        }
    }
}

impl PlayerController {
    fn reset(&mut self) {
        self.input = PlayerInput::default();
        self.hold_altitude = 0.0;
        self.flight_phase = FlightPhase::IdleOnPad;
        self.motors_armed = false;
        self.takeoff_hold_s = 0.0;
    }

    fn update(
        &mut self,
        dt: f64,
        frame: &NativeFrame,
        _scenario: &ScenarioConfig,
    ) -> ControllerOutput {
        let input = self.input;
        let altitude = if frame.sensors.altimeter_valid {
            frame.sensors.altimeter_altitude
        } else {
            frame.drone.position.z
        };

        if !self.motors_armed {
            let climb_intent = input.throttle.max(0.0);
            if climb_intent > 0.6 {
                self.takeoff_hold_s = clamp(self.takeoff_hold_s + dt, 0.0, TAKEOFF_HOLD_S);
                self.flight_phase = FlightPhase::Arming;
            } else {
                self.takeoff_hold_s = 0.0;
                self.flight_phase = FlightPhase::IdleOnPad;
            }

            let arming_progress = self.takeoff_hold_s / TAKEOFF_HOLD_S;
            let spool = if self.flight_phase == FlightPhase::Arming {
                0.05 + arming_progress * 0.09
            } else {
                0.0
            };

            if self.takeoff_hold_s >= TAKEOFF_HOLD_S {
                self.motors_armed = true;
                self.flight_phase = FlightPhase::Airborne;
                self.hold_altitude = TAKEOFF_TARGET_ALTITUDE_M.max(altitude + 1.5);
            }

            return ControllerOutput {
                rotor_command: [spool; 4],
                status_text: if self.flight_phase == FlightPhase::Arming {
                    format!(
                        "Arming motors {:.0}% | hold Up to launch",
                        arming_progress * 100.0
                    )
                } else {
                    "On plaza | hold Up for 3s to arm and take off".into()
                },
                active_waypoint_index: None,
                completed_waypoint_count: 0,
                recovery_event: false,
            };
        }

        if altitude < 0.25 && input.throttle < -0.75 && frame.drone.velocity.z.abs() < 0.5 {
            self.motors_armed = false;
            self.flight_phase = FlightPhase::IdleOnPad;
            self.takeoff_hold_s = 0.0;
            self.hold_altitude = 0.0;
            return ControllerOutput {
                rotor_command: [0.0; 4],
                status_text: "Landed on plaza | hold Up for 3s to arm and take off".into(),
                active_waypoint_index: None,
                completed_waypoint_count: 0,
                recovery_event: false,
            };
        }

        match self.assist_level {
            AssistLevel::Manual => {
                // Raw input maps directly to rotor mixer
                let thrust = clamp(HOVER_THROTTLE + input.throttle * 0.38, 0.0, 1.0);
                let roll_cmd = clamp(input.roll * 0.18, -0.18, 0.18);
                let pitch_cmd = clamp(input.pitch * 0.18, -0.18, 0.18);
                let yaw_cmd = clamp(input.yaw * 0.12, -0.18, 0.18);

                ControllerOutput {
                    rotor_command: mix_rotors(thrust, roll_cmd, pitch_cmd, yaw_cmd),
                    status_text: format!(
                        "Player Manual | HP {:.0}% | alt {:.1}m",
                        frame.drone.health * 100.0,
                        frame.drone.position.z
                    ),
                    active_waypoint_index: None,
                    completed_waypoint_count: 0,
                    recovery_event: false,
                }
            }
            AssistLevel::IntentAssist => {
                if self.hold_altitude <= 0.1 {
                    self.hold_altitude = altitude.max(2.5);
                }

                if input.throttle.abs() > 0.05 {
                    self.hold_altitude = clamp(
                        self.hold_altitude + input.throttle * dt * 7.5,
                        1.5,
                        MAX_FLIGHT_ALTITUDE_M,
                    );
                } else {
                    self.hold_altitude = clamp(self.hold_altitude, 1.5, MAX_FLIGHT_ALTITUDE_M);
                }

                let desired_pitch = clamp(
                    input.pitch * 0.30 - frame.drone.velocity.x * 0.055,
                    -0.34,
                    0.34,
                );
                let desired_roll = clamp(
                    -input.roll * 0.30 - frame.drone.velocity.y * 0.055,
                    -0.34,
                    0.34,
                );
                let target_yaw_rate = input.yaw * 1.45;
                let thrust =
                    altitude_hold(self.hold_altitude, altitude, frame.drone.velocity.z, 0.24);

                let roll = attitude_hold(
                    desired_roll,
                    frame.drone.euler.x,
                    frame.drone.angular_velocity.x,
                    0.20,
                );
                let pitch = attitude_hold(
                    desired_pitch,
                    frame.drone.euler.y,
                    frame.drone.angular_velocity.y,
                    0.20,
                );
                let yaw = clamp(
                    (target_yaw_rate - frame.drone.angular_velocity.z) * 0.10
                        - frame.drone.angular_velocity.z * 0.02,
                    -0.18,
                    0.18,
                );

                ControllerOutput {
                    rotor_command: mix_rotors(thrust, roll, pitch, yaw),
                    status_text: format!(
                        "Flyover | hold {:.1}m | HP {:.0}% | yaw {:.0}°",
                        self.hold_altitude,
                        frame.drone.health * 100.0,
                        frame.drone.euler.z.to_degrees()
                    ),
                    active_waypoint_index: None,
                    completed_waypoint_count: 0,
                    recovery_event: frame.drone.recovery_margin < 0.18,
                }
            }
            AssistLevel::Stabilized => {
                // Player sets desired lean angle; PD inner loop achieves it
                let target_pitch = input.pitch * 0.40;
                let target_roll = input.roll * 0.40;
                let target_yaw_rate = input.yaw * 1.2;
                let thrust = clamp(HOVER_THROTTLE + input.throttle * 0.38, 0.0, 1.0);

                let roll = attitude_hold(
                    target_roll,
                    frame.drone.euler.x,
                    frame.drone.angular_velocity.x,
                    0.20,
                );
                let pitch = attitude_hold(
                    target_pitch,
                    frame.drone.euler.y,
                    frame.drone.angular_velocity.y,
                    0.20,
                );
                // Yaw: rate control — target_yaw_rate is desired angular velocity
                let yaw = clamp(
                    (target_yaw_rate - frame.drone.angular_velocity.z) * 0.10
                        - frame.drone.angular_velocity.z * 0.02,
                    -0.18,
                    0.18,
                );

                ControllerOutput {
                    rotor_command: mix_rotors(thrust, roll, pitch, yaw),
                    status_text: format!(
                        "Player Stabilized | HP {:.0}% | alt {:.1}m",
                        frame.drone.health * 100.0,
                        frame.drone.position.z
                    ),
                    active_waypoint_index: None,
                    completed_waypoint_count: 0,
                    recovery_event: false,
                }
            }
            AssistLevel::CruiseAssist => {
                // Like Stabilized + altitude hold when throttle is neutral
                let target_pitch = input.pitch * 0.40;
                let target_roll = input.roll * 0.40;
                let target_yaw_rate = input.yaw * 1.2;

                let throttle_deadzone = input.throttle.abs() < 0.05;
                let thrust = if throttle_deadzone {
                    // Update and maintain hold altitude
                    if self.hold_altitude < 0.5 {
                        self.hold_altitude = frame.drone.position.z;
                    }
                    altitude_hold(
                        self.hold_altitude,
                        frame.drone.position.z,
                        frame.drone.velocity.z,
                        0.25,
                    )
                } else {
                    self.hold_altitude = 0.0; // release hold
                    clamp(HOVER_THROTTLE + input.throttle * 0.38, 0.0, 1.0)
                };

                let roll = attitude_hold(
                    target_roll,
                    frame.drone.euler.x,
                    frame.drone.angular_velocity.x,
                    0.20,
                );
                let pitch = attitude_hold(
                    target_pitch,
                    frame.drone.euler.y,
                    frame.drone.angular_velocity.y,
                    0.20,
                );
                let yaw = clamp(
                    (target_yaw_rate - frame.drone.angular_velocity.z) * 0.10
                        - frame.drone.angular_velocity.z * 0.02,
                    -0.18,
                    0.18,
                );

                ControllerOutput {
                    rotor_command: mix_rotors(thrust, roll, pitch, yaw),
                    status_text: format!(
                        "Player Cruise | HP {:.0}% | alt {:.1}m",
                        frame.drone.health * 100.0,
                        frame.drone.position.z
                    ),
                    active_waypoint_index: None,
                    completed_waypoint_count: 0,
                    recovery_event: false,
                }
            }
        }
    }

    fn adopt_vehicle_state(&mut self, run_state: RunState, frame: &NativeFrame) {
        if matches!(run_state, RunState::Stopped) {
            return;
        }

        let altitude = if frame.sensors.altimeter_valid {
            frame.sensors.altimeter_altitude
        } else {
            frame.drone.position.z
        };
        let airborne =
            altitude > 0.5 || frame.drone.position.z > 0.5 || frame.drone.velocity.z.abs() > 0.5;

        if airborne {
            self.motors_armed = true;
            self.flight_phase = FlightPhase::Airborne;
            self.takeoff_hold_s = TAKEOFF_HOLD_S;
            self.hold_altitude = clamp(altitude.max(1.5), 1.5, MAX_FLIGHT_ALTITUDE_M);
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
        let yaw = heading_hold(
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
            completed_waypoint_count: 0,
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
        let yaw = heading_hold(
            desired_yaw,
            frame.drone.euler.z,
            frame.drone.angular_velocity.z,
            0.07,
        );

        let completed_waypoint_count = if self.active_index + 1 >= scenario.waypoints.len()
            && self.hold_elapsed_s >= active.hold_s
        {
            scenario.waypoints.len()
        } else {
            self.active_index
        };

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
            completed_waypoint_count,
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
        let yaw = heading_hold(
            0.0,
            frame.drone.euler.z,
            frame.drone.angular_velocity.z,
            0.1,
        );

        let recovery_event = !frame.sensors.gps_valid
            || !frame.sensors.altimeter_valid
            || frame.drone.closest_obstacle_distance < 5.0
            || frame.drone.collision
            || frame.drone.recovery_margin < 0.35;

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
            completed_waypoint_count: 0,
            recovery_event,
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

fn heading_hold(target: f64, angle: f64, rate: f64, gain: f64) -> f64 {
    clamp(wrap_angle(target - angle) * gain - rate * 0.03, -0.18, 0.18)
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

fn wrap_angle(angle: f64) -> f64 {
    (angle + std::f64::consts::PI).rem_euclid(std::f64::consts::TAU) - std::f64::consts::PI
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
