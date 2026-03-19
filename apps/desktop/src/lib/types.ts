export type RunState = "stopped" | "running" | "paused";
export type ControllerMode =
  | "player"
  | "stabilize"
  | "waypoint_follow"
  | "recovery"
  | "adaptive_supervisor";

export type AssistLevel = "manual" | "stabilized" | "cruise_assist";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ObstacleBox {
  center: Vec3;
  size: Vec3;
}

export interface Waypoint {
  position: Vec3;
  holdS: number;
}

export interface FaultProfile {
  gpsDropoutEnabled: boolean;
  altimeterBiasM: number;
  imuNoiseScale: number;
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  baseWind: Vec3;
  gustAmplitude: number;
  durationS: number;
  faults: FaultProfile;
  obstacleCount: number;
  waypointCount: number;
}

export interface DroneTelemetry {
  position: Vec3;
  velocity: Vec3;
  euler: Vec3;
  angularVelocity: Vec3;
  rotorRpm: [number, number, number, number];
  collision: boolean;
  closestObstacleDistance: number;
  recoveryMargin: number;
  health: number;
}

export interface SensorTelemetry {
  gpsPosition: Vec3;
  gpsValid: boolean;
  imuAccel: Vec3;
  imuGyro: Vec3;
  altimeterAltitude: number;
  altimeterValid: boolean;
}

export interface EnvironmentTelemetry {
  windWorld: Vec3;
  gustStrength: number;
  turbulenceIndex: number;
}

export interface SimulationSnapshot {
  runState: RunState;
  controllerMode: ControllerMode;
  tick: number;
  simTimeS: number;
  statusText: string;
  activeScenarioId: string;
  scenarioName: string;
  activeWaypointIndex: number | null;
  drone: DroneTelemetry;
  sensors: SensorTelemetry;
  environment: EnvironmentTelemetry;
  obstacles: ObstacleBox[];
  waypoints: Waypoint[];
}

export interface EvaluationMetric {
  controllerMode: ControllerMode;
  score: number;
  pathCompletion: number;
  meanTrackingError: number;
  collisions: number;
  recoveryEvents: number;
}

export interface EvaluationReport {
  scenarioId: string;
  scenarioName: string;
  simDurationS: number;
  metrics: EvaluationMetric[];
}

export interface PlayerInput {
  pitch: number;
  roll: number;
  yaw: number;
  throttle: number;
}
