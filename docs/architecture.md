# Gust — Architecture

**Gust** is a macOS desktop app for drone autopilot simulation in turbulent air. It combines AI + physics simulation with a near-real 3D visualization of a quadcopter flying through an urban environment.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Desktop Shell (macOS)                                │
│  ┌────────────────────┐  ┌────────────────────────────────┐ │
│  │  Frontend (WebView) │  │  Rust Backend                  │ │
│  │                     │  │                                │ │
│  │  React + TypeScript │  │  gust-app-core                 │ │
│  │  React Three Fiber  │◄─┤  ├─ SimulationService          │ │
│  │  Three.js Shaders   │  │  ├─ Controllers (PID/Adaptive) │ │
│  │  Postprocessing     │  │  ├─ Evaluation engine          │ │
│  │                     │  │  └─ Scenario loader            │ │
│  │  Procedural City    │  │                                │ │
│  │  Custom Building    │  │  gust-sim-bridge               │ │
│  │    Window Shader    │  │  └─ FFI bridge to C++          │ │
│  │  Wind Particles     │  │                                │ │
│  │  Waypoint System    │  │  gust-types                    │ │
│  │  Attitude Indicator │  │  └─ Shared types (serde)       │ │
│  └────────────────────┘  └───────────┬────────────────────┘ │
│                                       │                      │
│                            ┌──────────▼──────────┐          │
│                            │  C++ Simulation Core │          │
│                            │  (libgust_sim_core)  │          │
│                            │                      │          │
│                            │  ├─ Rigid body dyn.  │          │
│                            │  ├─ Propeller thrust  │          │
│                            │  ├─ Wind/gust model   │          │
│                            │  ├─ Collision detect.  │          │
│                            │  └─ Sensor simulation  │          │
│                            └──────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### C++ (`native/sim_core/`)
- **Authoritative physics**: Rigid-body dynamics at 120Hz
- **Propeller thrust model**: 4-rotor thrust/torque with realistic motor response
- **Wind/gust simulation**: Spatiotemporal gust field with configurable amplitude/cell size
- **Collision detection**: Sphere-box collision with obstacle resolution
- **Sensor simulation**: GPS (with dropout), altimeter (with bias), IMU (with noise)
- Exposed via flat C API (`sim_c_api.h`)

### Rust (`crates/`)
- **gust-sim-bridge**: FFI wrapper around C++ sim, CMake build integration
- **gust-app-core**: Application orchestration
  - `SimulationService`: Thread-safe service with background sim worker at 120Hz
  - `controllers`: PID-based flight controllers (Stabilize, Waypoint Follow, Recovery, Adaptive Supervisor)
  - `evaluation`: Quick-eval engine comparing controllers against scenarios
  - `scenarios`: Built-in scenario loader (JSON)
- **gust-types**: Shared serde types for all layers
- **gust-desktop** (Tauri app): Exposes Tauri commands for the frontend

### Frontend (`apps/desktop/src/`)
- **3D Scene** (`components/scene/`):
  - `CityScene`: Main Canvas with camera modes (orbit/follow/topdown)
  - `ProceduralCity`: ~800+ buildings via InstancedMesh with custom GLSL shaders for procedural windows, road grid with markings
  - `DroneModel`: Detailed quadcopter with spinning props, LEDs, camera gimbal
  - `SkyAndEnvironment`: Atmospheric sky (Preetham model), directional/hemisphere lighting, fog
  - `CloudLayer`: Billboard cloud sprites for atmosphere
  - `WindParticles`: GPU-driven particle system flowing with wind
  - `WaypointMarkers`: Holographic waypoint beacons with flight path lines
  - `PostEffects`: Bloom, ACES tone mapping, vignette
- **UI Panels** (`components/ui/`):
  - `Toolbar`: Top bar with sim controls, controller/camera mode selection
  - `TelemetryHUD`: Floating left panel with attitude indicator, flight data, sensor status, rotor bars
  - `ControlPanel`: Floating right panel with scenario selection and evaluation results
  - `StatusBar`: Bottom bar with sim time, tick, status text

## Coordinate System
- **Simulation (C++/Rust)**: Right-handed, z-up: `(x, y, z)` where z is altitude
- **Three.js (Frontend)**: y-up: mapped as `three.x = sim.x`, `three.y = sim.z`, `three.z = -sim.y`

## Data Flow
1. Sim worker thread runs at 120Hz, steps C++ physics + Rust controller
2. Snapshot (position, velocity, euler, sensors, environment) published to `Arc<RwLock<Snapshot>>`
3. Frontend polls via Tauri `invoke("get_snapshot")` at ~8Hz (120ms intervals)
4. React state updated via Zustand store, deferred for smooth rendering
5. 3D scene renders at display refresh rate, interpolating visual state

## Design Decisions
- **No game engine**: Pure Three.js/R3F for full control over rendering
- **Physics in C++**: Performance-critical sim loop stays native
- **Custom shaders**: Procedural building windows, road grid, wind particles—no texture assets needed
- **InstancedMesh**: 800+ buildings rendered in a single draw call
- **Floating UI panels**: Full-viewport 3D with glass-morphism overlays for immersive feel
- **AI-ready architecture**: Controllers are pluggable; evaluation engine can score arbitrary controllers
