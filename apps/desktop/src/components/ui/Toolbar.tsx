/**
 * Toolbar - Top application bar with simulation controls, scenario/controller selection,
 * and camera mode toggle. Designed to feel like professional simulation software.
 */
import type { ControllerMode, RunState, SimulationSnapshot } from '../../lib/types';

const controllerOptions: Array<{ value: ControllerMode; label: string }> = [
  { value: 'adaptive_supervisor', label: 'Adaptive Supervisor' },
  { value: 'waypoint_follow', label: 'Waypoint Follow' },
  { value: 'stabilize', label: 'Stabilize' },
  { value: 'recovery', label: 'Recovery' },
];

interface ToolbarProps {
  snapshot: SimulationSnapshot | null;
  onRunStateChange: (state: RunState) => void;
  onControllerChange: (mode: ControllerMode) => void;
  cameraMode: 'orbit' | 'follow' | 'topdown';
  onCameraModeChange: (mode: 'orbit' | 'follow' | 'topdown') => void;
}

export function Toolbar({
  snapshot,
  onRunStateChange,
  onControllerChange,
  cameraMode,
  onCameraModeChange,
}: ToolbarProps) {
  const runState = snapshot?.runState ?? 'stopped';
  const isRunning = runState === 'running';
  const isPaused = runState === 'paused';

  return (
    <div className="toolbar">
      {/* App identity */}
      <div className="toolbar-brand">
        <span className="toolbar-logo">◆</span>
        <span className="toolbar-title">GUST</span>
        <span className="toolbar-subtitle">AUTOPILOT SIM</span>
      </div>

      <div className="toolbar-divider" />

      {/* Simulation controls */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isRunning ? 'active' : ''}`}
          onClick={() => onRunStateChange('running')}
          title="Start simulation"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <polygon points="2,0 14,7 2,14" />
          </svg>
          <span>Start</span>
        </button>
        <button
          className={`toolbar-btn ${isPaused ? 'active' : ''}`}
          onClick={() => onRunStateChange('paused')}
          title="Pause simulation"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="1" y="0" width="4" height="14" />
            <rect x="9" y="0" width="4" height="14" />
          </svg>
          <span>Pause</span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => onRunStateChange('stopped')}
          title="Reset simulation"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="0" width="14" height="14" rx="2" />
          </svg>
          <span>Reset</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Controller selection */}
      <div className="toolbar-group">
        <label className="toolbar-label">Controller</label>
        <select
          className="toolbar-select"
          value={snapshot?.controllerMode ?? 'adaptive_supervisor'}
          onChange={(e) => onControllerChange(e.target.value as ControllerMode)}
        >
          {controllerOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-divider" />

      {/* Camera mode */}
      <div className="toolbar-group">
        <label className="toolbar-label">Camera</label>
        <div className="toolbar-toggle-group">
          {(['orbit', 'follow', 'topdown'] as const).map((mode) => (
            <button
              key={mode}
              className={`toolbar-toggle ${cameraMode === mode ? 'active' : ''}`}
              onClick={() => onCameraModeChange(mode)}
            >
              {mode === 'orbit' ? '⊙' : mode === 'follow' ? '⊳' : '⊤'}
              <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status indicator */}
      <div className="toolbar-spacer" />
      <div className="toolbar-group">
        <div className={`toolbar-status-dot ${runState}`} />
        <span className="toolbar-status-text">
          {runState === 'running'
            ? 'LIVE'
            : runState === 'paused'
              ? 'PAUSED'
              : 'IDLE'}
        </span>
      </div>
    </div>
  );
}
