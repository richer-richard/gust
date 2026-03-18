# Gust — Development Plan

## Current Status: v0.2.0 — Near-Real City Environment

### Completed
- [x] **C++ physics core**: Rigid-body dynamics, thrust model, wind/gust field, collision, sensors
- [x] **Rust backend**: SimulationService, FFI bridge, controllers, evaluation, scenarios
- [x] **Tauri shell**: Desktop app with IPC commands
- [x] **Procedural city**: 800+ buildings via InstancedMesh with custom GLSL window shaders
- [x] **Road grid**: Procedural asphalt, lane markings, sidewalks via shader
- [x] **Atmospheric rendering**: Sky (Preetham model), fog, hemisphere lighting, clouds
- [x] **Detailed drone model**: Spinning propellers, LEDs, camera gimbal, prop blur
- [x] **Wind particle system**: GPU-driven particles flowing with wind, turbulence coloring
- [x] **Waypoint visualization**: Holographic markers, flight path lines, obstacle zones
- [x] **Post-processing**: Bloom, ACES filmic tone mapping, vignette
- [x] **Camera system**: Orbit, follow (chase), and top-down modes
- [x] **Professional UI**: Glass-morphism floating panels, attitude indicator, rotor bars
- [x] **Controller system**: Stabilize, Waypoint Follow, Recovery, Adaptive Supervisor
- [x] **Evaluation engine**: Quick-eval comparing all controllers against scenarios
- [x] **City-scale scenarios**: Urban Survey, Downtown Canyon, Storm Flight

### Phase 3: AI Integration (Next)
- [ ] Neural network controller (inference in Rust via ONNX Runtime or candle)
- [ ] Training harness: headless sim loop with reward function
- [ ] Reinforcement learning baseline (PPO or SAC)
- [ ] Imitation learning from Adaptive Supervisor trajectories
- [ ] AI vs. PID comparison in evaluation panel
- [ ] Training progress visualization in frontend

### Phase 4: Enhanced Simulation
- [ ] Multi-drone support
- [ ] Dynamic obstacles (moving vehicles, other aircraft)
- [ ] Weather system (rain, visibility reduction)
- [ ] Terrain following / mapping
- [ ] Battery model with power-limited scenarios

### Phase 5: Polish & Export
- [ ] Flight recording and replay system
- [ ] Scenario editor UI
- [ ] Performance profiling and optimization
- [ ] Export telemetry to CSV / JSON for analysis
- [ ] Custom scenario import
- [ ] macOS notarization and distribution

## Architecture Principles
1. **Simulation is authoritative** — Physics runs in native C++ at 120Hz
2. **Frontend is visualization** — No physics logic in TypeScript
3. **Controllers are pluggable** — PID, rule-based, or neural net
4. **Vertical slices** — Each feature runs end-to-end through all layers
5. **No game engine** — Full control over rendering pipeline via Three.js/R3F
