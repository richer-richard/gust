/**
 * Gust - Drone Autopilot Simulation
 * Main application component with full-screen 3D viewport and floating UI panels.
 */
import { useState, useDeferredValue } from 'react';
import { CityScene } from './components/scene/CityScene';
import { Toolbar } from './components/ui/Toolbar';
import { TelemetryHUD } from './components/ui/TelemetryHUD';
import { ControlPanel } from './components/ui/ControlPanel';
import { StatusBar } from './components/ui/StatusBar';
import { useSimulation } from './hooks/useSimulation';
import { useSimulationStore } from './lib/store';

export default function App() {
  useSimulation();

  const snapshot = useSimulationStore((s) => s.snapshot);
  const scenarios = useSimulationStore((s) => s.scenarios);
  const evaluation = useSimulationStore((s) => s.evaluation);
  const isEvaluating = useSimulationStore((s) => s.isEvaluating);
  const error = useSimulationStore((s) => s.error);
  const setRunState = useSimulationStore((s) => s.setRunState);
  const setControllerMode = useSimulationStore((s) => s.setControllerMode);
  const activateScenario = useSimulationStore((s) => s.activateScenario);
  const runEvaluation = useSimulationStore((s) => s.runEvaluation);

  const [cameraMode, setCameraMode] = useState<'orbit' | 'follow' | 'topdown'>('follow');
  const deferredSnapshot = useDeferredValue(snapshot);

  return (
    <div className="app-shell">
      {/* Full-screen 3D viewport */}
      <div className="viewport-container">
        <CityScene snapshot={deferredSnapshot} cameraMode={cameraMode} />
      </div>

      {/* UI overlay on top of viewport */}
      <div className="overlay">
        {/* Top toolbar */}
        <Toolbar
          snapshot={snapshot}
          onRunStateChange={(s) => void setRunState(s)}
          onControllerChange={(m) => void setControllerMode(m)}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
        />

        {/* Error banner */}
        {error && <div className="error-banner">{error}</div>}

        {/* Main body: telemetry left, control right */}
        <div className="overlay-body">
          <TelemetryHUD snapshot={snapshot} />
          <ControlPanel
            snapshot={snapshot}
            scenarios={scenarios}
            evaluation={evaluation}
            isEvaluating={isEvaluating}
            onSelectScenario={(id) => void activateScenario(id)}
            onRunEvaluation={() => void runEvaluation()}
          />
        </div>

        {/* Bottom status bar */}
        <StatusBar snapshot={snapshot} />
      </div>
    </div>
  );
}
