# Gust

**Drone autopilot simulation in turbulent air** — A macOS desktop app combining AI, physics simulation, and near-real 3D visualization.

Gust simulates a quadcopter flying through a procedurally generated city environment with dynamic wind, sensor faults, and obstacle pressure. Multiple flight controllers (PID, waypoint following, recovery, adaptive supervisor) can be evaluated and compared.

## Visual Features

- **Procedural city** — 800+ buildings with custom GLSL shaders for lit windows, varied building styles, and road grids with lane markings
- **Atmospheric rendering** — Preetham sky model, distance fog, hemisphere lighting, billboard clouds
- **Detailed drone** — Spinning propellers, navigation LEDs, camera gimbal, prop blur discs
- **Wind visualization** — GPU-driven particle system that flows with wind direction and changes color with turbulence
- **Waypoint system** — Holographic markers with rotating rings, flight path lines, obstacle danger zones
- **Post-processing** — Bloom for lit windows/LEDs, ACES filmic tone mapping, vignette
- **Professional UI** — Glass-morphism floating panels with attitude indicator, rotor RPM bars, sensor status

## Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| Physics | C++ | Rigid-body dynamics, thrust, wind, collision, sensors |
| Backend | Rust | App orchestration, controllers, evaluation, FFI bridge |
| Frontend | React + TypeScript + React Three Fiber | 3D visualization, UI panels |
| Shell | Tauri | macOS desktop app |

See [docs/architecture.md](docs/architecture.md) for full details.

## Prerequisites

- macOS 13+
- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (20+)
- [pnpm](https://pnpm.io/) (10+)
- CMake (for C++ build): `brew install cmake`
- Xcode Command Line Tools

## Getting Started

```bash
# Install frontend dependencies
pnpm install

# Run the desktop app (builds C++, Rust, and frontend)
pnpm dev

# Or build for production
pnpm build
```

## Project Structure

```
gust/
├── apps/desktop/           # Tauri desktop app
│   ├── src/                # React + TypeScript frontend
│   │   ├── components/
│   │   │   ├── scene/      # 3D scene (city, drone, sky, particles)
│   │   │   └── ui/         # UI panels (toolbar, telemetry, controls)
│   │   ├── hooks/          # React hooks
│   │   └── lib/            # Store, types, Tauri bridge, city generator
│   └── src-tauri/          # Rust Tauri backend
├── crates/
│   ├── gust-app-core/      # Simulation service, controllers, evaluation
│   ├── gust-sim-bridge/    # C++ FFI bridge
│   └── gust-types/         # Shared types
├── native/sim_core/        # C++ physics simulation
└── docs/                   # Architecture and development plan
```

## Scenarios

| Scenario | Description |
|----------|-------------|
| **Urban Survey** | Survey flight through a city district with moderate gusts |
| **Downtown Canyon** | Navigate between tall buildings with severe canyon winds |
| **Storm Flight** | GPS dropout, altimeter bias, and high IMU noise |

## Controllers

| Controller | Strategy |
|-----------|----------|
| **Stabilize** | Altitude hold with attitude centering |
| **Waypoint Follow** | Navigate through waypoint sequence with position tracking |
| **Recovery** | Emergency attitude recovery and obstacle avoidance |
| **Adaptive Supervisor** | Dynamically switches between controllers based on risk score |

## License

MIT
