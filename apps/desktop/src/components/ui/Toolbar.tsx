/**
 * Toolbar - Compact Dark Studio top bar.
 * Flyover-only: no controller dropdown.
 */
import type { RunState, SimulationSnapshot } from '../../lib/types';

interface ToolbarProps {
  snapshot: SimulationSnapshot | null;
  onRunStateChange: (state: RunState) => void;
  themeLabel: string;
  cameraMode: 'orbit' | 'follow' | 'topdown';
  onCameraModeChange: (mode: 'orbit' | 'follow' | 'topdown') => void;
  onReturnHome: () => void;
}

export function Toolbar({
  snapshot,
  onRunStateChange,
  themeLabel,
  cameraMode,
  onCameraModeChange,
  onReturnHome,
}: ToolbarProps) {
  const runState = snapshot?.runState ?? 'stopped';
  const isRunning = runState === 'running';
  const isPaused = runState === 'paused';

  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-logo">{'\u25C6'}</span>
        <span className="toolbar-title">GUST</span>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isRunning ? 'active' : ''}`}
          onClick={() => onRunStateChange('running')}
          title="Start"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
            <polygon points="2,0 14,7 2,14" />
          </svg>
        </button>
        <button
          className={`toolbar-btn ${isPaused ? 'active' : ''}`}
          onClick={() => onRunStateChange('paused')}
          title="Pause"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
            <rect x="1" y="0" width="4" height="14" />
            <rect x="9" y="0" width="4" height="14" />
          </svg>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => onRunStateChange('stopped')}
          title="Reset"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
            <rect x="0" y="0" width="14" height="14" rx="2" />
          </svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      <span className="toolbar-chip">{themeLabel}</span>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <div className="toolbar-toggle-group">
          {(['follow', 'orbit', 'topdown'] as const).map((mode) => (
            <button
              key={mode}
              className={`toolbar-toggle ${cameraMode === mode ? 'active' : ''}`}
              onClick={() => onCameraModeChange(mode)}
            >
              {mode === 'orbit' ? '\u2299' : mode === 'follow' ? '\u25B7' : '\u22A4'}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-spacer" />

      <button className="toolbar-btn" onClick={onReturnHome} title="Return home">
        Home
      </button>

      <div className="toolbar-group">
        <div className={`toolbar-status-dot ${runState}`} />
        <span className="toolbar-status-text">
          {runState === 'running' ? 'LIVE' : runState === 'paused' ? 'PAUSED' : 'IDLE'}
        </span>
      </div>
    </div>
  );
}
