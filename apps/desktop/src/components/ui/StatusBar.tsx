/**
 * StatusBar - Bottom bar showing simulation time, tick, status text, and quick stats.
 */
import type { SimulationSnapshot } from '../../lib/types';

interface StatusBarProps {
  snapshot: SimulationSnapshot | null;
}

export function StatusBar({ snapshot }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item">
          <span className="status-label">Scenario</span>
          <span className="status-value">{snapshot?.scenarioName ?? '—'}</span>
        </span>
        <span className="status-bar-divider">│</span>
        <span className="status-bar-item">
          <span className="status-label">Controller</span>
          <span className="status-value">{formatController(snapshot?.controllerMode)}</span>
        </span>
        <span className="status-bar-divider">│</span>
        <span className="status-bar-item">
          <span className="status-label">Status</span>
          <span className="status-value status-text-truncate">
            {snapshot?.statusText ?? 'Initializing...'}
          </span>
        </span>
      </div>
      <div className="status-bar-right">
        <span className="status-bar-item mono">
          <span className="status-label">T</span>
          <span className="status-value">{snapshot?.simTimeS.toFixed(1) ?? '0.0'}s</span>
        </span>
        <span className="status-bar-item mono">
          <span className="status-label">Tick</span>
          <span className="status-value">{snapshot?.tick ?? 0}</span>
        </span>
        <span className="status-bar-item mono">
          <span className="status-label">Collision</span>
          <span className={`status-value ${snapshot?.drone.collision ? 'warn' : ''}`}>
            {snapshot?.drone.collision ? '⚠ YES' : 'NO'}
          </span>
        </span>
      </div>
    </div>
  );
}

function formatController(mode?: string | null): string {
  switch (mode) {
    case 'adaptive_supervisor': return 'Adaptive Supervisor';
    case 'waypoint_follow': return 'Waypoint Follow';
    case 'recovery': return 'Recovery';
    default: return 'Stabilize';
  }
}
