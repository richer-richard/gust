import { CityScene } from '../scene/CityScene';
import type { SceneTheme } from '../../lib/theme';
import type { SimulationSnapshot } from '../../lib/types';

interface CameraRecoveryInsetProps {
  snapshot: SimulationSnapshot;
  theme: SceneTheme;
  onClick: () => void;
}

export function CameraRecoveryInset({
  snapshot,
  theme,
  onClick,
}: CameraRecoveryInsetProps) {
  return (
    <button className="camera-inset" onClick={onClick} type="button">
      <div className="camera-inset-header">
        <span>Drone view</span>
        <span>Click to recenter</span>
      </div>
      <div className="camera-inset-view">
        <CityScene
          snapshot={snapshot}
          cameraMode="follow"
          theme={theme}
          showScenarioVisuals={false}
          interactiveCamera={false}
        />
      </div>
    </button>
  );
}
