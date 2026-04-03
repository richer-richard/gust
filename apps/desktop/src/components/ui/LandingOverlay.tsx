import type { WeatherId, TimeOfDay } from '../../lib/theme';

interface LandingOverlayProps {
  weather: WeatherId;
  timeOfDay: TimeOfDay;
  trailEnabled: boolean;
  onWeatherChange: (w: WeatherId) => void;
  onTimeOfDayChange: (t: TimeOfDay) => void;
  onTrailToggle: (v: boolean) => void;
  onStart: () => void;
  isLaunching: boolean;
}

const WEATHER_OPTIONS: { id: WeatherId; label: string; icon: string }[] = [
  { id: 'sunny', label: 'Sunny', icon: '\u2600\uFE0F' },
  { id: 'cloudy', label: 'Cloudy', icon: '\u26C5' },
  { id: 'snowy', label: 'Snow', icon: '\u2744\uFE0F' },
];

export function LandingOverlay({
  weather,
  timeOfDay,
  trailEnabled,
  onWeatherChange,
  onTimeOfDayChange,
  onTrailToggle,
  onStart,
  isLaunching,
}: LandingOverlayProps) {
  return (
    <div className="landing-shell">
      <div className="landing-panel">
        <div className="landing-panel-inner">
          {/* Brand */}
          <div className="landing-brand">
            <h1 className="landing-title">GUST</h1>
            <p className="landing-subtitle">drone flight studio</p>
          </div>

          {/* Weather */}
          <div className="landing-section">
            <div className="landing-label">Environment</div>
            <div className="landing-weather-row">
              {WEATHER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`landing-weather-pill${weather === opt.id ? ' active' : ''}`}
                  onClick={() => onWeatherChange(opt.id)}
                >
                  <span className="landing-weather-icon">{opt.icon}</span>
                  <span className="landing-weather-name">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="landing-section">
            <div className="landing-toggle-row">
              <span className="landing-toggle-text">Night Mode</span>
              <button
                type="button"
                className={`landing-toggle${timeOfDay === 'night' ? ' on' : ''}`}
                onClick={() => onTimeOfDayChange(timeOfDay === 'day' ? 'night' : 'day')}
              >
                <span className="landing-toggle-knob" />
              </button>
            </div>
            <div className="landing-toggle-row">
              <span className="landing-toggle-text">Drone Trail</span>
              <button
                type="button"
                className={`landing-toggle${trailEnabled ? ' on' : ''}`}
                onClick={() => onTrailToggle(!trailEnabled)}
              >
                <span className="landing-toggle-knob" />
              </button>
            </div>
          </div>

          <div className="landing-sep" />

          {/* Controls */}
          <div className="landing-section">
            <div className="landing-label">Controls</div>
            <div className="landing-controls-grid">
              <div className="landing-ctrl"><kbd>W / &uarr;</kbd><span>Forward</span></div>
              <div className="landing-ctrl"><kbd>S / &darr;</kbd><span>Back</span></div>
              <div className="landing-ctrl"><kbd>A / &larr;</kbd><span>Left</span></div>
              <div className="landing-ctrl"><kbd>D / &rarr;</kbd><span>Right</span></div>
              <div className="landing-ctrl"><kbd>Space</kbd><span>Ascend</span></div>
              <div className="landing-ctrl"><kbd>Shift</kbd><span>Descend</span></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="landing-footer">
          <button
            className="landing-launch-btn"
            onClick={onStart}
            disabled={isLaunching}
            type="button"
          >
            {isLaunching ? 'Launching...' : 'Launch'}
          </button>
          <div className="landing-version">v0.1.0</div>
        </div>
      </div>
    </div>
  );
}
