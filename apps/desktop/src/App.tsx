import { useDeferredValue, useMemo, useState } from 'react';
import { CityScene } from './components/scene/CityScene';
import { Toolbar } from './components/ui/Toolbar';
import { TelemetryHUD } from './components/ui/TelemetryHUD';
import { ControlPanel } from './components/ui/ControlPanel';
import { StatusBar } from './components/ui/StatusBar';
import { LandingOverlay } from './components/ui/LandingOverlay';
import { CameraRecoveryInset } from './components/ui/CameraRecoveryInset';
import { useSimulation } from './hooks/useSimulation';
import { useSimulationStore } from './lib/store';
import { SCENE_THEME_BY_ID, THEME_OPTIONS, type ThemeId } from './lib/theme';
import type { AssistLevel } from './lib/types';

type SessionStage = 'landing' | 'launching' | 'active';

const FLYOVER_SCENARIO_BY_THEME: Record<ThemeId, string> = {
  sunny: 'city_flyover_sunny',
  cloudy: 'city_flyover_cloudy',
  night: 'city_flyover_night',
};

export default function App() {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const worldLayout = useSimulationStore((s) => s.worldLayout);
  const scenarios = useSimulationStore((s) => s.scenarios);
  const evaluation = useSimulationStore((s) => s.evaluation);
  const isEvaluating = useSimulationStore((s) => s.isEvaluating);
  const error = useSimulationStore((s) => s.error);
  const setRunState = useSimulationStore((s) => s.setRunState);
  const setControllerMode = useSimulationStore((s) => s.setControllerMode);
  const setAssistLevel = useSimulationStore((s) => s.setAssistLevel);
  const activateScenario = useSimulationStore((s) => s.activateScenario);
  const runEvaluation = useSimulationStore((s) => s.runEvaluation);

  const [sessionStage, setSessionStage] = useState<SessionStage>('landing');
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('sunny');
  const [cameraMode, setCameraMode] = useState<'orbit' | 'follow' | 'topdown'>('follow');
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [droneFramingLost, setDroneFramingLost] = useState(false);

  const playerControlsEnabled =
    sessionStage === 'active' &&
    snapshot?.controllerMode === 'player' &&
    snapshot.runState !== 'stopped';
  useSimulation(playerControlsEnabled);

  const deferredSnapshot = useDeferredValue(snapshot);
  const theme = useMemo(() => SCENE_THEME_BY_ID[selectedThemeId], [selectedThemeId]);
  const assistLevel = (snapshot?.assistLevel ?? 'intent_assist') as AssistLevel;
  const sessionIsActive = sessionStage === 'active';
  const activeFlyoverScenarioId = FLYOVER_SCENARIO_BY_THEME[selectedThemeId];
  const showScenarioVisuals =
    sessionIsActive && !(snapshot?.activeScenarioId ?? '').startsWith('city_flyover_');
  const sceneReady = Boolean(snapshot && worldLayout);

  const ignoreCommandError = (promise: Promise<void>) => {
    void promise.catch(() => {});
  };

  const recenterCamera = () => {
    setCameraMode('follow');
    setDroneFramingLost(false);
    setRecenterSignal((signal) => signal + 1);
  };

  const launchFlyover = async () => {
    setSessionStage('launching');
    setDroneFramingLost(false);
    setCameraMode('follow');
    setRecenterSignal((signal) => signal + 1);

    try {
      await setRunState('stopped');
      await activateScenario(activeFlyoverScenarioId);
      await setControllerMode('player');
      await setAssistLevel('intent_assist');
      await setRunState('running');
      setSessionStage('active');
    } catch {
      setSessionStage('landing');
    }
  };

  const returnToLanding = async () => {
    setSessionStage('launching');
    setDroneFramingLost(false);

    try {
      await setRunState('stopped');
      await activateScenario(activeFlyoverScenarioId);
      await setControllerMode('player');
      await setAssistLevel('intent_assist');
      setCameraMode('follow');
      setRecenterSignal((signal) => signal + 1);
      setSessionStage('landing');
    } catch {
      setSessionStage('landing');
    }
  };

  return (
    <div className="app-shell">
      <div className="viewport-container">
        {snapshot && worldLayout ? (
          <CityScene
            snapshot={deferredSnapshot}
            worldLayout={worldLayout}
            cameraMode={cameraMode}
            theme={theme}
            previewMode={!sessionIsActive}
            showScenarioVisuals={showScenarioVisuals}
            recenterSignal={recenterSignal}
            onDroneFramingChange={sessionIsActive ? setDroneFramingLost : undefined}
          />
        ) : null}
      </div>

      <div className="overlay">
        {error && <div className="error-banner">{error}</div>}

        {!sceneReady && (
          <div className="loading-overlay">
            <div className="loading-logo">GUST</div>
            <div className="loading-text">Booting the flyover scene</div>
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
          </div>
        )}

        {snapshot && worldLayout && sessionStage === 'landing' && (
          <LandingOverlay
            selectedThemeId={selectedThemeId}
            themeOptions={THEME_OPTIONS}
            onSelectTheme={setSelectedThemeId}
            onStart={launchFlyover}
            isLaunching={false}
          />
        )}

        {sessionIsActive && snapshot && (
          <>
            <Toolbar
              snapshot={snapshot}
              onRunStateChange={(s) => ignoreCommandError(setRunState(s))}
              onControllerChange={(m) => ignoreCommandError(setControllerMode(m))}
              sessionModeLabel="Flyover"
              themeLabel={theme.name}
              cameraMode={cameraMode}
              onCameraModeChange={setCameraMode}
              onReturnHome={() => void returnToLanding()}
            />

            <div className="overlay-body">
              <TelemetryHUD snapshot={snapshot} />
              <ControlPanel
                snapshot={snapshot}
                scenarios={scenarios}
                evaluation={evaluation}
                isEvaluating={isEvaluating}
                sessionModeLabel="Flyover"
                themeLabel={theme.name}
                assistLevel={assistLevel}
                onSelectScenario={(id) => ignoreCommandError(activateScenario(id))}
                onAssistLevelChange={(level) => ignoreCommandError(setAssistLevel(level))}
                onRunEvaluation={() => ignoreCommandError(runEvaluation())}
                onRecenterCamera={recenterCamera}
                onReturnHome={() => void returnToLanding()}
              />
            </div>

            <StatusBar snapshot={snapshot} />
          </>
        )}

        {snapshot && sessionIsActive && droneFramingLost && cameraMode !== 'topdown' && (
          <CameraRecoveryInset
            snapshot={snapshot}
            onClick={recenterCamera}
          />
        )}

        {sessionStage === 'launching' && (
          <div className="loading-overlay loading-overlay-session">
            <div className="loading-logo">GUST</div>
            <div className="loading-text">
              Preparing {theme.name} flyover and plaza takeoff
            </div>
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
