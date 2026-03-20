/**
 * ControlPanel - Right floating panel with scenario selection and evaluation.
 * Collapsible, glass-morphism style.
 */
import { useState } from 'react';
import type {
  AssistLevel,
  EvaluationReport,
  ScenarioSummary,
  SimulationSnapshot,
} from '../../lib/types';

interface ControlPanelProps {
  snapshot: SimulationSnapshot | null;
  scenarios: ScenarioSummary[];
  evaluation: EvaluationReport | null;
  isEvaluating: boolean;
  sessionModeLabel: string;
  themeLabel: string;
  assistLevel: AssistLevel;
  onSelectScenario: (id: string) => void;
  onAssistLevelChange: (level: AssistLevel) => void;
  onRunEvaluation: () => void;
  onRecenterCamera: () => void;
  onReturnHome: () => void;
}

export function ControlPanel({
  snapshot,
  scenarios,
  evaluation,
  isEvaluating,
  sessionModeLabel,
  themeLabel,
  assistLevel,
  onSelectScenario,
  onAssistLevelChange,
  onRunEvaluation,
  onRecenterCamera,
  onReturnHome,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'session' | 'scenarios' | 'evaluation'>('session');

  if (collapsed) {
    return (
      <div className="hud-panel hud-collapsed right" onClick={() => setCollapsed(false)}>
        <span className="hud-expand-icon">CTL ▶</span>
      </div>
    );
  }

  return (
    <div className="hud-panel hud-control">
      <div className="hud-header">
        <span className="hud-title">CONTROL</span>
        <button className="hud-collapse-btn" onClick={() => setCollapsed(true)}>◀</button>
      </div>

      {/* Tab switcher */}
      <div className="hud-tabs">
        <button
          className={`hud-tab ${activeTab === 'session' ? 'active' : ''}`}
          onClick={() => setActiveTab('session')}
        >
          Session
        </button>
        <button
          className={`hud-tab ${activeTab === 'scenarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenarios')}
        >
          Scenarios
        </button>
        <button
          className={`hud-tab ${activeTab === 'evaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluation')}
        >
          Evaluation
        </button>
      </div>

      {activeTab === 'session' ? (
        <SessionTab
          snapshot={snapshot}
          sessionModeLabel={sessionModeLabel}
          themeLabel={themeLabel}
          assistLevel={assistLevel}
          onAssistLevelChange={onAssistLevelChange}
          onRecenterCamera={onRecenterCamera}
          onReturnHome={onReturnHome}
        />
      ) : activeTab === 'scenarios' ? (
        <ScenariosTab
          scenarios={scenarios}
          snapshot={snapshot}
          onSelectScenario={onSelectScenario}
        />
      ) : (
        <EvaluationTab
          evaluation={evaluation}
          isEvaluating={isEvaluating}
          onRunEvaluation={onRunEvaluation}
        />
      )}
    </div>
  );
}

const assistOptions: Array<{ value: AssistLevel; label: string }> = [
  { value: 'intent_assist', label: 'Intent Assist' },
  { value: 'stabilized', label: 'Stabilized' },
  { value: 'cruise_assist', label: 'Cruise Assist' },
  { value: 'manual', label: 'Manual' },
];

function SessionTab({
  snapshot,
  sessionModeLabel,
  themeLabel,
  assistLevel,
  onAssistLevelChange,
  onRecenterCamera,
  onReturnHome,
}: {
  snapshot: SimulationSnapshot | null;
  sessionModeLabel: string;
  themeLabel: string;
  assistLevel: AssistLevel;
  onAssistLevelChange: (level: AssistLevel) => void;
  onRecenterCamera: () => void;
  onReturnHome: () => void;
}) {
  return (
    <div className="hud-scroll-area">
      <div className="session-summary-grid">
        <SessionStat label="Mode" value={sessionModeLabel} />
        <SessionStat label="Theme" value={themeLabel} />
        <SessionStat label="Flight" value={formatFlightPhase(snapshot?.flightPhase)} />
        <SessionStat label="Motors" value={snapshot?.motorsArmed ? 'Armed' : 'Cold'} />
      </div>

      <div className="session-section">
        <div className="hud-section-label">Assist</div>
        <select
          className="toolbar-select session-select"
          value={assistLevel}
          onChange={(e) => onAssistLevelChange(e.target.value as AssistLevel)}
        >
          {assistOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="session-action-grid">
        <button className="session-action-btn" onClick={onRecenterCamera}>
          Recenter Camera
        </button>
        <button className="session-action-btn secondary" onClick={onReturnHome}>
          Return Home
        </button>
      </div>

      <div className="session-section">
        <div className="hud-section-label">Flight Keys</div>
        <div className="control-legend">
          <div className="control-legend-row">
            <span>W / S</span>
            <span>Forward / backward intent</span>
          </div>
          <div className="control-legend-row">
            <span>A / D</span>
            <span>Strafe left / right</span>
          </div>
          <div className="control-legend-row">
            <span>Left / Right</span>
            <span>Yaw left / right</span>
          </div>
          <div className="control-legend-row">
            <span>Up / Down</span>
            <span>Hold Up 3s to arm, then climb / descend</span>
          </div>
          <div className="control-legend-row">
            <span>Trackpad</span>
            <span>Orbit and zoom the chase camera</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenariosTab({
  scenarios,
  snapshot,
  onSelectScenario,
}: {
  scenarios: ScenarioSummary[];
  snapshot: SimulationSnapshot | null;
  onSelectScenario: (id: string) => void;
}) {
  return (
    <div className="hud-scroll-area">
      {scenarios.map((s) => {
        const isActive = snapshot?.activeScenarioId === s.id;
        return (
          <button
            key={s.id}
            className={`scenario-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectScenario(s.id)}
          >
            <div className="scenario-item-header">
              <span className="scenario-item-name">{s.name}</span>
              {isActive && <span className="scenario-active-badge">ACTIVE</span>}
            </div>
            <p className="scenario-item-desc">{s.description}</p>
            <div className="scenario-item-stats">
              <span>{s.obstacleCount} obs</span>
              <span>{s.waypointCount} wpt</span>
              <span>{s.gustAmplitude.toFixed(1)} m/s gust</span>
              <span>{s.durationS.toFixed(0)}s</span>
            </div>
            <div className="scenario-item-faults">
              <span className={s.faults.gpsDropoutEnabled ? 'fault-on' : 'fault-off'}>
                GPS {s.faults.gpsDropoutEnabled ? '⚠' : '✓'}
              </span>
              <span className={Math.abs(s.faults.altimeterBiasM) > 0.3 ? 'fault-on' : 'fault-off'}>
                ALT bias {s.faults.altimeterBiasM.toFixed(2)}m
              </span>
              <span className={s.faults.imuNoiseScale > 0.3 ? 'fault-on' : 'fault-off'}>
                IMU noise ×{s.faults.imuNoiseScale.toFixed(1)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EvaluationTab({
  evaluation,
  isEvaluating,
  onRunEvaluation,
}: {
  evaluation: EvaluationReport | null;
  isEvaluating: boolean;
  onRunEvaluation: () => void;
}) {
  return (
    <div className="hud-scroll-area">
      <button
        className="eval-run-btn"
        onClick={onRunEvaluation}
        disabled={isEvaluating}
      >
        {isEvaluating ? (
          <>
            <span className="eval-spinner" /> Running evaluation...
          </>
        ) : (
          '▶ Run Quick Evaluation'
        )}
      </button>

      {evaluation ? (
        <div className="eval-results">
          <div className="eval-header">
            <span>{evaluation.scenarioName}</span>
            <span>{evaluation.simDurationS.toFixed(0)}s simulated</span>
          </div>
          <div className="eval-table">
            <div className="eval-table-header">
              <span>Controller</span>
              <span>Score</span>
              <span>Path</span>
              <span>Error</span>
              <span>Col</span>
            </div>
            {evaluation.metrics
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((m) => (
                <div className="eval-table-row" key={m.controllerMode}>
                  <span className="eval-controller-name">
                    {formatMode(m.controllerMode)}
                  </span>
                  <span className={`eval-score ${m.score > 60 ? 'good' : m.score > 30 ? 'ok' : 'bad'}`}>
                    {m.score.toFixed(1)}
                  </span>
                  <span>{(m.pathCompletion * 100).toFixed(0)}%</span>
                  <span>{m.meanTrackingError.toFixed(2)}m</span>
                  <span className={m.collisions > 0 ? 'fault-on' : ''}>
                    {m.collisions}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="eval-empty">
          <p>Run evaluation to compare controller performance against the active scenario.</p>
          <p className="eval-empty-sub">
            Tests Stabilize, Waypoint, Recovery, and Adaptive Supervisor controllers.
          </p>
        </div>
      )}
    </div>
  );
}

function formatMode(mode: string): string {
  switch (mode) {
    case 'player': return 'Player';
    case 'adaptive_supervisor': return 'Adaptive';
    case 'waypoint_follow': return 'Waypoint';
    case 'recovery': return 'Recovery';
    default: return 'Stabilize';
  }
}

function formatFlightPhase(flightPhase?: string): string {
  switch (flightPhase) {
    case 'arming': return 'Arming';
    case 'airborne': return 'Airborne';
    default: return 'On Pad';
  }
}

function SessionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="session-stat">
      <span className="session-stat-label">{label}</span>
      <span className="session-stat-value">{value}</span>
    </div>
  );
}
