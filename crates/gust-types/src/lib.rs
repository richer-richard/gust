use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub fn magnitude(self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObstacleBox {
    pub center: Vec3,
    pub size: Vec3,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Waypoint {
    pub position: Vec3,
    pub hold_s: f64,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FaultProfile {
    pub gps_dropout_enabled: bool,
    pub altimeter_bias_m: f64,
    pub imu_noise_scale: f64,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_wind: Vec3,
    pub gust_amplitude: f64,
    pub gust_cell_size: f64,
    pub duration_s: f64,
    pub faults: FaultProfile,
    pub obstacles: Vec<ObstacleBox>,
    pub waypoints: Vec<Waypoint>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_wind: Vec3,
    pub gust_amplitude: f64,
    pub duration_s: f64,
    pub faults: FaultProfile,
    pub obstacle_count: usize,
    pub waypoint_count: usize,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DroneTelemetry {
    pub position: Vec3,
    pub velocity: Vec3,
    pub euler: Vec3,
    pub angular_velocity: Vec3,
    pub rotor_rpm: [f64; 4],
    pub collision: bool,
    pub closest_obstacle_distance: f64,
    pub recovery_margin: f64,
    pub health: f64,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorTelemetry {
    pub gps_position: Vec3,
    pub gps_valid: bool,
    pub imu_accel: Vec3,
    pub imu_gyro: Vec3,
    pub altimeter_altitude: f64,
    pub altimeter_valid: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentTelemetry {
    pub wind_world: Vec3,
    pub gust_strength: f64,
    pub turbulence_index: f64,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunState {
    #[default]
    Stopped,
    Running,
    Paused,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ControllerMode {
    #[default]
    Player,
    Stabilize,
    WaypointFollow,
    Recovery,
    AdaptiveSupervisor,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssistLevel {
    Manual,
    Stabilized,
    CruiseAssist,
    #[default]
    IntentAssist,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlightPhase {
    #[default]
    IdleOnPad,
    Arming,
    Airborne,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerInput {
    pub pitch: f64,
    pub roll: f64,
    pub yaw: f64,
    pub throttle: f64,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationSnapshot {
    pub run_state: RunState,
    pub controller_mode: ControllerMode,
    pub assist_level: Option<AssistLevel>,
    pub flight_phase: FlightPhase,
    pub motors_armed: bool,
    pub tick: u64,
    pub sim_time_s: f64,
    pub status_text: String,
    pub active_scenario_id: String,
    pub scenario_name: String,
    pub active_waypoint_index: Option<usize>,
    pub drone: DroneTelemetry,
    pub sensors: SensorTelemetry,
    pub environment: EnvironmentTelemetry,
    pub obstacles: Vec<ObstacleBox>,
    pub waypoints: Vec<Waypoint>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationMetric {
    pub controller_mode: ControllerMode,
    pub score: f64,
    pub path_completion: f64,
    pub mean_tracking_error: f64,
    pub collisions: u32,
    pub recovery_events: u32,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationReport {
    pub scenario_id: String,
    pub scenario_name: String,
    pub sim_duration_s: f64,
    pub metrics: Vec<EvaluationMetric>,
}

impl ScenarioConfig {
    pub fn summary(&self) -> ScenarioSummary {
        ScenarioSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            base_wind: self.base_wind,
            gust_amplitude: self.gust_amplitude,
            duration_s: self.duration_s,
            faults: self.faults.clone(),
            obstacle_count: self.obstacles.len(),
            waypoint_count: self.waypoints.len(),
        }
    }
}
