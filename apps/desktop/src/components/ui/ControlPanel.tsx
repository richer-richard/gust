/**
 * ControlPanel - Right floating panel with scenario selection and evaluation.
 * Collapsible, glass-morphism style.
 */
import { useState } from 'react';
import type {
  EvaluationReport,
  ScenarioSummary,
  SimulationSnapshot,
} from '../../lib/types';

interface ControlPanelProps {
  snapshot: SimulationSnapshot | null;
  scenarios: ScenarioSummary[];
  evaluation: EvaluationReport | null;
  isEvaluating: boolean;
  onSelectScenario: (id: string) => void;
  onRunEvaluation: () => void;
}

export function ControlPanel({
  snapshot,
  scenarios,
  evaluation,
  isEvaluating,
  onSelectScenario,
  onRunEvaluation,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'scenarios' | 'evaluation'>('scenarios');

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

      {activeTab === 'scenarios' ? (
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
    case 'adaptive_supervisor': return 'Adaptive';
    case 'waypoint_follow': return 'Waypoint';
    case 'recovery': return 'Recovery';
    default: return 'Stabilize';
  }
}
