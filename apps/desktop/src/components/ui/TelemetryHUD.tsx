/**
 * TelemetryHUD - Floating left panel showing real-time flight data.
 * Styled like professional avionics / robotics telemetry displays.
 */
import { useState } from 'react';
import type { SimulationSnapshot, Vec3 } from '../../lib/types';

interface TelemetryHUDProps {
  snapshot: SimulationSnapshot | null;
}

export function TelemetryHUD({ snapshot }: TelemetryHUDProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="hud-panel hud-collapsed" onClick={() => setCollapsed(false)}>
        <span className="hud-expand-icon">◀ TLM</span>
      </div>
    );
  }

  const d = snapshot?.drone;
  const s = snapshot?.sensors;
  const e = snapshot?.environment;

  return (
    <div className="hud-panel hud-telemetry">
      <div className="hud-header">
        <span className="hud-title">TELEMETRY</span>
        <button className="hud-collapse-btn" onClick={() => setCollapsed(true)}>▶</button>
      </div>

      {/* Attitude Indicator */}
      {snapshot && (
        <div className="hud-attitude-container">
          <AttitudeIndicator
            roll={d?.euler.x ?? 0}
            pitch={d?.euler.y ?? 0}
            heading={d?.euler.z ?? 0}
          />
        </div>
      )}

      <div className="hud-grid">
        <HudMetric
          label="ALT"
          value={d ? `${d.position.z.toFixed(1)}` : '--'}
          unit="m"
          warn={d ? d.position.z < 2 : false}
        />
        <HudMetric
          label="SPD"
          value={d ? `${vecMag(d.velocity).toFixed(1)}` : '--'}
          unit="m/s"
        />
        <HudMetric
          label="HDG"
          value={d ? `${((d.euler.z * 180) / Math.PI).toFixed(0)}` : '--'}
          unit="°"
        />
        <HudMetric
          label="V/S"
          value={d ? `${d.velocity.z.toFixed(1)}` : '--'}
          unit="m/s"
          warn={d ? d.velocity.z < -3 : false}
        />
      </div>

      <div className="hud-separator" />

      <div className="hud-section-label">POSITION</div>
      <div className="hud-mono-row">
        <span>X</span><span className="hud-val">{d?.position.x.toFixed(2) ?? '--'}</span>
        <span>Y</span><span className="hud-val">{d?.position.y.toFixed(2) ?? '--'}</span>
        <span>Z</span><span className="hud-val">{d?.position.z.toFixed(2) ?? '--'}</span>
      </div>

      <div className="hud-section-label">VELOCITY</div>
      <div className="hud-mono-row">
        <span>X</span><span className="hud-val">{d?.velocity.x.toFixed(2) ?? '--'}</span>
        <span>Y</span><span className="hud-val">{d?.velocity.y.toFixed(2) ?? '--'}</span>
        <span>Z</span><span className="hud-val">{d?.velocity.z.toFixed(2) ?? '--'}</span>
      </div>

      <div className="hud-separator" />

      <div className="hud-section-label">SENSORS</div>
      <div className="hud-sensor-grid">
        <SensorStatus label="GPS" valid={s?.gpsValid ?? true} />
        <SensorStatus label="ALT" valid={s?.altimeterValid ?? true} />
        <HudMetric
          label="IMU σ"
          value={s ? vecMag(s.imuAccel).toFixed(1) : '--'}
          unit=""
          small
        />
        <HudMetric
          label="ALT→"
          value={s ? s.altimeterAltitude.toFixed(1) : '--'}
          unit="m"
          small
        />
      </div>

      <div className="hud-separator" />

      <div className="hud-section-label">ENVIRONMENT</div>
      <div className="hud-grid">
        <HudMetric
          label="WIND"
          value={e ? `${vecMag(e.windWorld).toFixed(1)}` : '--'}
          unit="m/s"
        />
        <HudMetric
          label="GUST"
          value={e ? `${e.gustStrength.toFixed(1)}` : '--'}
          unit="m/s"
          warn={e ? e.gustStrength > 2.0 : false}
        />
        <HudMetric
          label="TURB"
          value={e ? `${(e.turbulenceIndex * 100).toFixed(0)}` : '--'}
          unit="%"
          warn={e ? e.turbulenceIndex > 0.6 : false}
        />
        <HudMetric
          label="RECV"
          value={d ? `${(d.recoveryMargin * 100).toFixed(0)}` : '--'}
          unit="%"
          warn={d ? d.recoveryMargin < 0.3 : false}
        />
      </div>

      <div className="hud-separator" />

      <div className="hud-section-label">ROTORS (RPM)</div>
      <div className="hud-rotor-grid">
        {(d?.rotorRpm ?? [0, 0, 0, 0]).map((rpm, i) => (
          <div key={i} className="hud-rotor-item">
            <div className="hud-rotor-label">M{i + 1}</div>
            <div className="hud-rotor-bar-bg">
              <div
                className="hud-rotor-bar"
                style={{ width: `${Math.min(100, (rpm / 10000) * 100)}%` }}
              />
            </div>
            <div className="hud-rotor-val">{rpm.toFixed(0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HudMetric({
  label,
  value,
  unit,
  warn = false,
  small = false,
}: {
  label: string;
  value: string;
  unit: string;
  warn?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`hud-metric ${warn ? 'warn' : ''} ${small ? 'small' : ''}`}>
      <span className="hud-metric-label">{label}</span>
      <span className="hud-metric-value">{value}</span>
      {unit && <span className="hud-metric-unit">{unit}</span>}
    </div>
  );
}

function SensorStatus({ label, valid }: { label: string; valid: boolean }) {
  return (
    <div className={`hud-sensor ${valid ? 'ok' : 'fault'}`}>
      <span className="hud-sensor-dot" />
      <span>{label}</span>
      <span className="hud-sensor-state">{valid ? 'OK' : 'FAULT'}</span>
    </div>
  );
}

function AttitudeIndicator({
  roll,
  pitch,
  heading,
}: {
  roll: number;
  pitch: number;
  heading: number;
}) {
  const rollDeg = (roll * 180) / Math.PI;
  const pitchDeg = (pitch * 180) / Math.PI;
  const pitchOffset = Math.max(-30, Math.min(30, pitchDeg * 1.5));

  return (
    <div className="attitude-indicator">
      <div
        className="attitude-ball"
        style={{
          transform: `rotate(${-rollDeg}deg) translateY(${pitchOffset}px)`,
        }}
      >
        <div className="attitude-sky" />
        <div className="attitude-ground" />
        <div className="attitude-horizon-line" />
        {/* Pitch lines */}
        {[-20, -10, 10, 20].map((deg) => (
          <div
            key={deg}
            className="attitude-pitch-line"
            style={{ top: `${50 - deg * 1.5}%` }}
          >
            <span>{Math.abs(deg)}</span>
          </div>
        ))}
      </div>
      {/* Fixed aircraft symbol */}
      <div className="attitude-aircraft">
        <div className="attitude-wing left" />
        <div className="attitude-center-dot" />
        <div className="attitude-wing right" />
      </div>
      {/* Roll indicator */}
      <div className="attitude-roll-text">{rollDeg.toFixed(1)}°</div>
      <div className="attitude-heading-text">
        {((heading * 180) / Math.PI).toFixed(0)}°
      </div>
    </div>
  );
}

function vecMag(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
