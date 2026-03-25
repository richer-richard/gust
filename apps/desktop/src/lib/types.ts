export type RunState = "stopped" | "running" | "paused";
export type ControllerMode =
  | "player"
  | "stabilize"
  | "waypoint_follow"
  | "recovery"
  | "adaptive_supervisor";

export type AssistLevel =
  | "manual"
  | "stabilized"
  | "cruise_assist"
  | "intent_assist";
export type FlightPhase = "idle_on_pad" | "arming" | "airborne";

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
  clearanceAgl: number;
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
  assistLevel: AssistLevel | null;
  flightPhase: FlightPhase;
  motorsArmed: boolean;
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

export interface WorldBuilding {
  collider: ObstacleBox;
  colorR: number;
  colorG: number;
  colorB: number;
  windowSeed: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
  litPercentage: number;
}

export interface WorldLandmark {
  center: Vec3;
  pedestal: ObstacleBox;
  collisionBoxes: ObstacleBox[];
  scale: number;
}

export interface WorldLayout {
  seed: number;
  gridSize: number;
  blockSize: number;
  roadWidth: number;
  plazaHalfExtent: number;
  plazaBase: ObstacleBox;
  plazaPlatforms: ObstacleBox[];
  launchSurfaceZ: number;
  spawnPosition: Vec3;
  previewYaw: number;
  landmark: WorldLandmark;
  buildings: WorldBuilding[];
}
