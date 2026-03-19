use std::ffi::c_void;
use std::ptr::NonNull;

use anyhow::{Result, anyhow};
use gust_types::{
    DroneTelemetry, EnvironmentTelemetry, FaultProfile, ObstacleBox, ScenarioConfig,
    SensorTelemetry, Vec3, Waypoint,
};

const MAX_OBSTACLES: usize = 16;
const MAX_WAYPOINTS: usize = 16;

#[derive(Clone, Debug)]
pub struct NativeFrame {
    pub tick: u64,
    pub sim_time_s: f64,
    pub drone: DroneTelemetry,
    pub sensors: SensorTelemetry,
    pub environment: EnvironmentTelemetry,
    pub obstacles: Vec<ObstacleBox>,
    pub waypoints: Vec<Waypoint>,
}

pub struct Simulator {
    raw: NonNull<GustSimHandle>,
}

// Safety: the native simulator handle is owned by this wrapper and only accessed through
// `&mut self`. The higher layers keep it behind a mutex, so moving it between threads is safe.
unsafe impl Send for Simulator {}

impl Simulator {
    pub fn new(config: &ScenarioConfig) -> Result<Self> {
        let ffi_config = GustScenarioConfig::from(config);
        let raw = unsafe { gust_sim_create(&ffi_config) };
        let raw = NonNull::new(raw).ok_or_else(|| anyhow!("failed to create Gust simulator"))?;
        Ok(Self { raw })
    }

    pub fn reset(&mut self, config: &ScenarioConfig) {
        let ffi_config = GustScenarioConfig::from(config);
        unsafe {
            gust_sim_reset(self.raw.as_ptr(), &ffi_config);
        }
    }

    pub fn set_rotor_command(&mut self, normalized: [f64; 4]) {
        let command = GustRotorCommand { normalized };
        unsafe {
            gust_sim_set_rotor_command(self.raw.as_ptr(), command);
        }
    }

    pub fn step(&mut self, dt: f64) {
        unsafe {
            gust_sim_step(self.raw.as_ptr(), dt);
        }
    }

    pub fn take_damage(&mut self, amount: f64) {
        unsafe {
            gust_sim_take_damage(self.raw.as_ptr(), amount);
        }
    }

    pub fn frame(&mut self) -> NativeFrame {
        let frame = unsafe { gust_sim_get_frame(self.raw.as_ptr()) };
        NativeFrame::from(frame)
    }
}

impl Drop for Simulator {
    fn drop(&mut self) {
        unsafe {
            gust_sim_destroy(self.raw.as_ptr());
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct GustVec3 {
    x: f64,
    y: f64,
    z: f64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct GustObstacleBox {
    center: GustVec3,
    size: GustVec3,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct GustWaypoint {
    position: GustVec3,
    hold_s: f64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct GustFaultProfile {
    gps_dropout_enabled: u32,
    altimeter_bias_m: f64,
    imu_noise_scale: f64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct GustScenarioConfig {
    base_wind: GustVec3,
    gust_amplitude: f64,
    gust_cell_size: f64,
    duration_s: f64,
    faults: GustFaultProfile,
    obstacle_count: u32,
    obstacles: [GustObstacleBox; MAX_OBSTACLES],
    waypoint_count: u32,
    waypoints: [GustWaypoint; MAX_WAYPOINTS],
}

impl Default for GustScenarioConfig {
    fn default() -> Self {
        Self {
            base_wind: GustVec3::default(),
            gust_amplitude: 0.0,
            gust_cell_size: 6.0,
            duration_s: 30.0,
            faults: GustFaultProfile::default(),
            obstacle_count: 0,
            obstacles: [GustObstacleBox::default(); MAX_OBSTACLES],
            waypoint_count: 0,
            waypoints: [GustWaypoint::default(); MAX_WAYPOINTS],
        }
    }
}

impl From<&ScenarioConfig> for GustScenarioConfig {
    fn from(value: &ScenarioConfig) -> Self {
        let mut config = Self {
            base_wind: value.base_wind.into(),
            gust_amplitude: value.gust_amplitude,
            gust_cell_size: value.gust_cell_size,
            duration_s: value.duration_s,
            faults: GustFaultProfile::from(&value.faults),
            ..Self::default()
        };

        for (index, obstacle) in value.obstacles.iter().take(MAX_OBSTACLES).enumerate() {
            config.obstacles[index] = GustObstacleBox::from(obstacle);
        }
        config.obstacle_count = value.obstacles.len().min(MAX_OBSTACLES) as u32;

        for (index, waypoint) in value.waypoints.iter().take(MAX_WAYPOINTS).enumerate() {
            config.waypoints[index] = GustWaypoint::from(waypoint);
        }
        config.waypoint_count = value.waypoints.len().min(MAX_WAYPOINTS) as u32;

        config
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct GustRotorCommand {
    normalized: [f64; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct GustSensorPacket {
    gps_position: GustVec3,
    gps_valid: u32,
    imu_accel: GustVec3,
    imu_gyro: GustVec3,
    altimeter_altitude: f64,
    altimeter_valid: u32,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct GustDroneFrame {
    position: GustVec3,
    velocity: GustVec3,
    euler: GustVec3,
    angular_velocity: GustVec3,
    rotor_rpm: [f64; 4],
    collision: u32,
    closest_obstacle_distance: f64,
    recovery_margin: f64,
    health: f64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct GustEnvironmentFrame {
    wind_world: GustVec3,
    gust_strength: f64,
    turbulence_index: f64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct GustStateFrame {
    tick: u64,
    sim_time_s: f64,
    drone: GustDroneFrame,
    sensors: GustSensorPacket,
    environment: GustEnvironmentFrame,
    obstacle_count: u32,
    obstacles: [GustObstacleBox; MAX_OBSTACLES],
    waypoint_count: u32,
    waypoints: [GustWaypoint; MAX_WAYPOINTS],
}

impl Default for GustStateFrame {
    fn default() -> Self {
        Self {
            tick: 0,
            sim_time_s: 0.0,
            drone: GustDroneFrame::default(),
            sensors: GustSensorPacket::default(),
            environment: GustEnvironmentFrame::default(),
            obstacle_count: 0,
            obstacles: [GustObstacleBox::default(); MAX_OBSTACLES],
            waypoint_count: 0,
            waypoints: [GustWaypoint::default(); MAX_WAYPOINTS],
        }
    }
}

impl From<GustStateFrame> for NativeFrame {
    fn from(value: GustStateFrame) -> Self {
        let obstacles = value.obstacles[..value.obstacle_count as usize]
            .iter()
            .copied()
            .map(ObstacleBox::from)
            .collect();
        let waypoints = value.waypoints[..value.waypoint_count as usize]
            .iter()
            .copied()
            .map(Waypoint::from)
            .collect();

        Self {
            tick: value.tick,
            sim_time_s: value.sim_time_s,
            drone: DroneTelemetry {
                position: value.drone.position.into(),
                velocity: value.drone.velocity.into(),
                euler: value.drone.euler.into(),
                angular_velocity: value.drone.angular_velocity.into(),
                rotor_rpm: value.drone.rotor_rpm,
                collision: value.drone.collision != 0,
                closest_obstacle_distance: value.drone.closest_obstacle_distance,
                recovery_margin: value.drone.recovery_margin,
                health: value.drone.health,
            },
            sensors: SensorTelemetry {
                gps_position: value.sensors.gps_position.into(),
                gps_valid: value.sensors.gps_valid != 0,
                imu_accel: value.sensors.imu_accel.into(),
                imu_gyro: value.sensors.imu_gyro.into(),
                altimeter_altitude: value.sensors.altimeter_altitude,
                altimeter_valid: value.sensors.altimeter_valid != 0,
            },
            environment: EnvironmentTelemetry {
                wind_world: value.environment.wind_world.into(),
                gust_strength: value.environment.gust_strength,
                turbulence_index: value.environment.turbulence_index,
            },
            obstacles,
            waypoints,
        }
    }
}

impl From<Vec3> for GustVec3 {
    fn from(value: Vec3) -> Self {
        Self {
            x: value.x,
            y: value.y,
            z: value.z,
        }
    }
}

impl From<GustVec3> for Vec3 {
    fn from(value: GustVec3) -> Self {
        Self {
            x: value.x,
            y: value.y,
            z: value.z,
        }
    }
}

impl From<&FaultProfile> for GustFaultProfile {
    fn from(value: &FaultProfile) -> Self {
        Self {
            gps_dropout_enabled: u32::from(value.gps_dropout_enabled),
            altimeter_bias_m: value.altimeter_bias_m,
            imu_noise_scale: value.imu_noise_scale,
        }
    }
}

impl From<&ObstacleBox> for GustObstacleBox {
    fn from(value: &ObstacleBox) -> Self {
        Self {
            center: value.center.into(),
            size: value.size.into(),
        }
    }
}

impl From<GustObstacleBox> for ObstacleBox {
    fn from(value: GustObstacleBox) -> Self {
        Self {
            center: value.center.into(),
            size: value.size.into(),
        }
    }
}

impl From<&Waypoint> for GustWaypoint {
    fn from(value: &Waypoint) -> Self {
        Self {
            position: value.position.into(),
            hold_s: value.hold_s,
        }
    }
}

impl From<GustWaypoint> for Waypoint {
    fn from(value: GustWaypoint) -> Self {
        Self {
            position: value.position.into(),
            hold_s: value.hold_s,
        }
    }
}

type GustSimHandle = c_void;
unsafe extern "C" {
    fn gust_sim_create(config: *const GustScenarioConfig) -> *mut GustSimHandle;
    fn gust_sim_destroy(handle: *mut GustSimHandle);
    fn gust_sim_reset(handle: *mut GustSimHandle, config: *const GustScenarioConfig);
    fn gust_sim_set_rotor_command(handle: *mut GustSimHandle, command: GustRotorCommand);
    fn gust_sim_step(handle: *mut GustSimHandle, dt: f64);
    fn gust_sim_take_damage(handle: *mut GustSimHandle, amount: f64);
    fn gust_sim_get_frame(handle: *const GustSimHandle) -> GustStateFrame;
}
