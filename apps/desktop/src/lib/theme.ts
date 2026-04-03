export type WeatherId = 'sunny' | 'cloudy' | 'snowy';
export type TimeOfDay = 'day' | 'night';
export type ThemeKey = `${WeatherId}_${TimeOfDay}`;

export interface SceneTheme {
  key: ThemeKey;
  weather: WeatherId;
  timeOfDay: TimeOfDay;
  name: string;
  backgroundColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  useSkyShader: boolean;
  sky: {
    distance: number;
    sunPosition: [number, number, number];
    rayleigh: number;
    turbidity: number;
    mieCoefficient: number;
    mieDirectionalG: number;
  };
  lighting: {
    keyColor: string;
    keyIntensity: number;
    keyPosition: [number, number, number];
    fillColor: string;
    fillIntensity: number;
    fillPosition: [number, number, number];
    ambientColor: string;
    ambientIntensity: number;
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
  };
  shadows: {
    area: number;
    far: number;
    bias: number;
    normalBias: number;
  };
  clouds: {
    color: string;
    opacityMin: number;
    opacityMax: number;
  };
  city: {
    faceColor: string;
    windowOff: string;
    windowLitColors: string[];
    fogColor: string;
    fogNear: number;
    fogFar: number;
    roofWarmth: number;
    windowEmissive: number;
    groundRoad: string;
    groundSidewalk: string;
    groundLine: string;
    groundPark: string;
    groundPlaza: string;
    groundPlazaAccent: string;
  };
  post: {
    bloomIntensity: number;
    bloomThreshold: number;
    bloomSmoothing: number;
    vignetteDarkness: number;
  };
  snow: boolean;
  stars: boolean;
}

// ── Sunny Day ────────────────────────────────────────
export const SUNNY_DAY: SceneTheme = {
  key: 'sunny_day',
  weather: 'sunny',
  timeOfDay: 'day',
  name: 'Sunny Day',
  backgroundColor: '#5aa8ff',
  fogColor: '#7fb5f1',
  fogNear: 1350,
  fogFar: 7600,
  useSkyShader: true,
  sky: {
    distance: 450000,
    sunPosition: [100, 120, -50],
    rayleigh: 1.8,
    turbidity: 3.0,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
  },
  lighting: {
    keyColor: '#fff0cf',
    keyIntensity: 2.48,
    keyPosition: [100, 120, -50],
    fillColor: '#9cd2ff',
    fillIntensity: 1.05,
    fillPosition: [-220, 105, 220],
    ambientColor: '#d7ecff',
    ambientIntensity: 0.38,
    hemiSky: '#b7deff',
    hemiGround: '#695f55',
    hemiIntensity: 0.58,
  },
  shadows: {
    area: 118,
    far: 460,
    bias: -0.00018,
    normalBias: 0.02,
  },
  clouds: {
    color: '#eef7ff',
    opacityMin: 0.03,
    opacityMax: 0.1,
  },
  city: {
    faceColor: '#d5d4cf',
    windowOff: '#8091a8',
    windowLitColors: ['#f8f2e7', '#d6e8ff', '#f3dfb7', '#dfeefe'],
    fogColor: '#9cbfe0',
    fogNear: 1350,
    fogFar: 7600,
    roofWarmth: 0.13,
    windowEmissive: 0.03,
    groundRoad: '#758395',
    groundSidewalk: '#cbc4b8',
    groundLine: '#f7f2d2',
    groundPark: '#9cb58e',
    groundPlaza: '#ddd4c5',
    groundPlazaAccent: '#f0e4c2',
  },
  post: {
    bloomIntensity: 0.08,
    bloomThreshold: 0.65,
    bloomSmoothing: 0.26,
    vignetteDarkness: 0.24,
  },
  snow: false,
  stars: false,
};

// ── Sunny Night ──────────────────────────────────────
export const SUNNY_NIGHT: SceneTheme = {
  key: 'sunny_night',
  weather: 'sunny',
  timeOfDay: 'night',
  name: 'Clear Night',
  backgroundColor: '#060e1f',
  fogColor: '#081428',
  fogNear: 250,
  fogFar: 2200,
  useSkyShader: false,
  sky: {
    distance: 450000,
    sunPosition: [-30, -20, -30],
    rayleigh: 0.2,
    turbidity: 1.5,
    mieCoefficient: 0.001,
    mieDirectionalG: 0.5,
  },
  lighting: {
    keyColor: '#8ab0ff',
    keyIntensity: 0.35,
    keyPosition: [-30, 40, -30],
    fillColor: '#3c5590',
    fillIntensity: 0.22,
    fillPosition: [80, 48, 60],
    ambientColor: '#141e35',
    ambientIntensity: 0.14,
    hemiSky: '#0e1d38',
    hemiGround: '#060910',
    hemiIntensity: 0.14,
  },
  shadows: {
    area: 135,
    far: 420,
    bias: -0.00022,
    normalBias: 0.024,
  },
  clouds: {
    color: '#1a2840',
    opacityMin: 0.01,
    opacityMax: 0.05,
  },
  city: {
    faceColor: '#1b2638',
    windowOff: '#1a2333',
    windowLitColors: ['#ffd98a', '#9fd1ff', '#ffb487', '#d4e3ff'],
    fogColor: '#0d182c',
    fogNear: 250,
    fogFar: 2200,
    roofWarmth: 0.02,
    windowEmissive: 0.22,
    groundRoad: '#131c2c',
    groundSidewalk: '#242d3a',
    groundLine: '#7b90af',
    groundPark: '#16251d',
    groundPlaza: '#2a303c',
    groundPlazaAccent: '#45516a',
  },
  post: {
    bloomIntensity: 0.38,
    bloomThreshold: 0.4,
    bloomSmoothing: 0.2,
    vignetteDarkness: 0.5,
  },
  snow: false,
  stars: true,
};

// ── Cloudy Day ───────────────────────────────────────
export const CLOUDY_DAY: SceneTheme = {
  key: 'cloudy_day',
  weather: 'cloudy',
  timeOfDay: 'day',
  name: 'Overcast',
  backgroundColor: '#7c8794',
  fogColor: '#7f8d9d',
  fogNear: 380,
  fogFar: 2900,
  useSkyShader: true,
  sky: {
    distance: 450000,
    sunPosition: [80, 52, -20],
    rayleigh: 0.9,
    turbidity: 8.7,
    mieCoefficient: 0.0048,
    mieDirectionalG: 0.84,
  },
  lighting: {
    keyColor: '#d6d9de',
    keyIntensity: 1.25,
    keyPosition: [80, 52, -20],
    fillColor: '#b7c5d4',
    fillIntensity: 0.7,
    fillPosition: [-160, 88, 150],
    ambientColor: '#c9d2dc',
    ambientIntensity: 0.42,
    hemiSky: '#b0becb',
    hemiGround: '#5d5d60',
    hemiIntensity: 0.44,
  },
  shadows: {
    area: 150,
    far: 500,
    bias: -0.00012,
    normalBias: 0.018,
  },
  clouds: {
    color: '#d4d8dd',
    opacityMin: 0.16,
    opacityMax: 0.28,
  },
  city: {
    faceColor: '#c8c8c6',
    windowOff: '#6d7684',
    windowLitColors: ['#dfe4ea', '#c9d5e2', '#d8d2c7'],
    fogColor: '#8691a0',
    fogNear: 380,
    fogFar: 2900,
    roofWarmth: 0.06,
    windowEmissive: 0.02,
    groundRoad: '#646b75',
    groundSidewalk: '#b8b1a8',
    groundLine: '#dddac9',
    groundPark: '#8a9488',
    groundPlaza: '#c9c2b7',
    groundPlazaAccent: '#e0d7c4',
  },
  post: {
    bloomIntensity: 0.05,
    bloomThreshold: 0.64,
    bloomSmoothing: 0.35,
    vignetteDarkness: 0.32,
  },
  snow: false,
  stars: false,
};

// ── Cloudy Night ─────────────────────────────────────
export const CLOUDY_NIGHT: SceneTheme = {
  key: 'cloudy_night',
  weather: 'cloudy',
  timeOfDay: 'night',
  name: 'Overcast Night',
  backgroundColor: '#0a1020',
  fogColor: '#0c1524',
  fogNear: 180,
  fogFar: 1600,
  useSkyShader: false,
  sky: {
    distance: 450000,
    sunPosition: [-40, -15, -20],
    rayleigh: 0.15,
    turbidity: 2.0,
    mieCoefficient: 0.001,
    mieDirectionalG: 0.5,
  },
  lighting: {
    keyColor: '#7088b0',
    keyIntensity: 0.28,
    keyPosition: [-40, 30, -20],
    fillColor: '#3a4d70',
    fillIntensity: 0.18,
    fillPosition: [80, 48, 60],
    ambientColor: '#121a2a',
    ambientIntensity: 0.12,
    hemiSky: '#0c1628',
    hemiGround: '#060810',
    hemiIntensity: 0.12,
  },
  shadows: {
    area: 135,
    far: 420,
    bias: -0.00022,
    normalBias: 0.024,
  },
  clouds: {
    color: '#1e2a3c',
    opacityMin: 0.08,
    opacityMax: 0.18,
  },
  city: {
    faceColor: '#181f2e',
    windowOff: '#161e2c',
    windowLitColors: ['#ffd98a', '#8ac4ff', '#ffb487', '#c8d8f0'],
    fogColor: '#0a1220',
    fogNear: 180,
    fogFar: 1600,
    roofWarmth: 0.01,
    windowEmissive: 0.2,
    groundRoad: '#101828',
    groundSidewalk: '#1e2636',
    groundLine: '#5a6e8a',
    groundPark: '#0e1a16',
    groundPlaza: '#222838',
    groundPlazaAccent: '#384560',
  },
  post: {
    bloomIntensity: 0.32,
    bloomThreshold: 0.42,
    bloomSmoothing: 0.22,
    vignetteDarkness: 0.52,
  },
  snow: false,
  stars: false,
};

// ── Snowy Day ────────────────────────────────────────
export const SNOWY_DAY: SceneTheme = {
  key: 'snowy_day',
  weather: 'snowy',
  timeOfDay: 'day',
  name: 'Snowy Day',
  backgroundColor: '#c8cdd5',
  fogColor: '#b8c0cc',
  fogNear: 200,
  fogFar: 1800,
  useSkyShader: true,
  sky: {
    distance: 450000,
    sunPosition: [60, 35, -30],
    rayleigh: 0.6,
    turbidity: 12.0,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.9,
  },
  lighting: {
    keyColor: '#d8dce5',
    keyIntensity: 0.95,
    keyPosition: [60, 35, -30],
    fillColor: '#b5c2d0',
    fillIntensity: 0.55,
    fillPosition: [-120, 60, 100],
    ambientColor: '#c5cdd8',
    ambientIntensity: 0.48,
    hemiSky: '#c0c8d5',
    hemiGround: '#8a8a8e',
    hemiIntensity: 0.5,
  },
  shadows: {
    area: 140,
    far: 480,
    bias: -0.00015,
    normalBias: 0.02,
  },
  clouds: {
    color: '#d5dae2',
    opacityMin: 0.2,
    opacityMax: 0.35,
  },
  city: {
    faceColor: '#c5c8cc',
    windowOff: '#7a828e',
    windowLitColors: ['#e2e6ec', '#ced6e0', '#d8d4cc'],
    fogColor: '#a8b0be',
    fogNear: 200,
    fogFar: 1800,
    roofWarmth: 0.04,
    windowEmissive: 0.03,
    groundRoad: '#8090a0',
    groundSidewalk: '#c8c4be',
    groundLine: '#ddd8c8',
    groundPark: '#bcc5be',
    groundPlaza: '#d0ccc5',
    groundPlazaAccent: '#ddd8cc',
  },
  post: {
    bloomIntensity: 0.06,
    bloomThreshold: 0.62,
    bloomSmoothing: 0.3,
    vignetteDarkness: 0.28,
  },
  snow: true,
  stars: false,
};

// ── Snowy Night ──────────────────────────────────────
export const SNOWY_NIGHT: SceneTheme = {
  key: 'snowy_night',
  weather: 'snowy',
  timeOfDay: 'night',
  name: 'Snowy Night',
  backgroundColor: '#080d18',
  fogColor: '#0a1220',
  fogNear: 150,
  fogFar: 1400,
  useSkyShader: false,
  sky: {
    distance: 450000,
    sunPosition: [-30, -18, -30],
    rayleigh: 0.18,
    turbidity: 2.0,
    mieCoefficient: 0.001,
    mieDirectionalG: 0.5,
  },
  lighting: {
    keyColor: '#7090c0',
    keyIntensity: 0.3,
    keyPosition: [-30, 35, -30],
    fillColor: '#3a5080',
    fillIntensity: 0.2,
    fillPosition: [80, 48, 60],
    ambientColor: '#141c30',
    ambientIntensity: 0.14,
    hemiSky: '#0c1530',
    hemiGround: '#060810',
    hemiIntensity: 0.14,
  },
  shadows: {
    area: 135,
    far: 420,
    bias: -0.00022,
    normalBias: 0.024,
  },
  clouds: {
    color: '#1a2538',
    opacityMin: 0.06,
    opacityMax: 0.14,
  },
  city: {
    faceColor: '#1a2030',
    windowOff: '#161c28',
    windowLitColors: ['#ffd98a', '#90c0ff', '#ffb487', '#c0d4f0'],
    fogColor: '#0a1020',
    fogNear: 150,
    fogFar: 1400,
    roofWarmth: 0.01,
    windowEmissive: 0.2,
    groundRoad: '#121824',
    groundSidewalk: '#1c2434',
    groundLine: '#506080',
    groundPark: '#101a18',
    groundPlaza: '#202838',
    groundPlazaAccent: '#303e55',
  },
  post: {
    bloomIntensity: 0.35,
    bloomThreshold: 0.4,
    bloomSmoothing: 0.2,
    vignetteDarkness: 0.5,
  },
  snow: true,
  stars: true,
};

export const SCENE_THEMES: Record<ThemeKey, SceneTheme> = {
  sunny_day: SUNNY_DAY,
  sunny_night: SUNNY_NIGHT,
  cloudy_day: CLOUDY_DAY,
  cloudy_night: CLOUDY_NIGHT,
  snowy_day: SNOWY_DAY,
  snowy_night: SNOWY_NIGHT,
};

export function resolveTheme(weather: WeatherId, timeOfDay: TimeOfDay): SceneTheme {
  return SCENE_THEMES[`${weather}_${timeOfDay}`];
}
