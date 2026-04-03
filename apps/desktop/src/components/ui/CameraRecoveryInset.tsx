import type { SimulationSnapshot } from '../../lib/types';

interface CameraRecoveryInsetProps {
  snapshot: SimulationSnapshot;
  onClick: () => void;
}

export function CameraRecoveryInset({
  snapshot,
  onClick,
}: CameraRecoveryInsetProps) {
  const headingDeg = (((snapshot.drone.euler.z * 180) / Math.PI) % 360 + 360) % 360;
  const horizontalDistance = Math.hypot(snapshot.drone.position.x, snapshot.drone.position.y);
  const speed = Math.hypot(
    snapshot.drone.velocity.x,
    snapshot.drone.velocity.y,
    snapshot.drone.velocity.z,
  );

  return (
    <button className="camera-inset" onClick={onClick} type="button">
      <div className="camera-inset-header">
        <span>Recovery assist</span>
        <span>Return to drone</span>
      </div>
      <div className="camera-inset-view">
        <div className="camera-inset-radar" aria-hidden="true">
          <div className="camera-inset-radar-ring outer" />
          <div className="camera-inset-radar-ring inner" />
          <div className="camera-inset-crosshair horizontal" />
          <div className="camera-inset-crosshair vertical" />
          <div
            className="camera-inset-arrow"
            style={{ transform: `translate(-50%, -50%) rotate(${headingDeg}deg)` }}
          >
            ▲
          </div>
        </div>
        <div className="camera-inset-stats">
          <div className="camera-inset-stat">
            <span className="camera-inset-label">Heading</span>
            <span className="camera-inset-value">{headingDeg.toFixed(0)}°</span>
          </div>
          <div className="camera-inset-stat">
            <span className="camera-inset-label">Clearance</span>
            <span className="camera-inset-value">{snapshot.drone.clearanceAgl.toFixed(1)} m</span>
          </div>
          <div className="camera-inset-stat">
            <span className="camera-inset-label">Speed</span>
            <span className="camera-inset-value">{speed.toFixed(1)} m/s</span>
          </div>
          <div className="camera-inset-stat">
            <span className="camera-inset-label">Offset</span>
            <span className="camera-inset-value">{horizontalDistance.toFixed(0)} m</span>
          </div>
        </div>
      </div>
    </button>
  );
}
