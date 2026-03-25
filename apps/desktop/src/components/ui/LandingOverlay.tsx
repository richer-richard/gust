import type { ThemeId, ThemeOption } from '../../lib/theme';

interface LandingOverlayProps {
  selectedThemeId: ThemeId;
  themeOptions: ThemeOption[];
  onSelectTheme: (themeId: ThemeId) => void;
  onStart: () => void;
  isLaunching: boolean;
}

export function LandingOverlay({
  selectedThemeId,
  themeOptions,
  onSelectTheme,
  onStart,
  isLaunching,
}: LandingOverlayProps) {
  return (
    <div className="landing-shell">
      <div className="landing-panel">
        <div className="landing-panel-scroll">
          <div className="landing-eyebrow">Gust Flyover</div>
          <h1 className="landing-title">Take a city tour from the plaza.</h1>
          <p className="landing-copy">
            Start cold on the central plaza, arm with Up, and thread through a bright
            downtown ring with a camera built around aerial follow instead of a bottom-up chase.
          </p>

          <div className="landing-section">
            <div className="landing-section-title">Mode</div>
            <div className="landing-card-grid">
              <button className="landing-card active" type="button">
                <span className="landing-card-label">Flyover Mode</span>
                <span className="landing-card-copy">
                  Scenic assisted flight with live telemetry and the advanced control panel.
                </span>
              </button>
              <button className="landing-card disabled" type="button" disabled>
                <span className="landing-card-label">Combat Mode</span>
                <span className="landing-card-badge">Coming soon</span>
              </button>
            </div>
          </div>

          <div className="landing-section">
            <div className="landing-section-title">Theme</div>
            <div className="landing-card-grid">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  className={[
                    'landing-card',
                    option.available ? '' : 'disabled',
                    selectedThemeId === option.id ? 'active' : '',
                  ].filter(Boolean).join(' ')}
                  type="button"
                  disabled={!option.available}
                  onClick={() => option.available && onSelectTheme(option.id)}
                >
                  <span className="landing-card-label">{option.label}</span>
                  <span className="landing-card-copy">{option.description}</span>
                  {!option.available && <span className="landing-card-badge">Coming soon</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="landing-footer">
            <div className="landing-keyline">
              <span>WASD</span>
              <span>Horizontal motion</span>
            </div>
            <div className="landing-keyline">
              <span>Arrow keys</span>
              <span>Yaw and altitude control</span>
            </div>
            <div className="landing-keyline">
              <span>Trackpad</span>
              <span>Zoom and orbit around the drone</span>
            </div>
          </div>
        </div>

        <button className="landing-launch-btn" onClick={onStart} disabled={isLaunching}>
          {isLaunching ? 'Launching...' : 'Launch Flyover'}
        </button>
      </div>
    </div>
  );
}
