export type ThemeId = "sunny" | "cloudy" | "night";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  available: boolean;
}

export interface SceneTheme {
  id: ThemeId;
  name: string;
  backgroundColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
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
    contactOpacity: number;
    contactBlur: number;
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
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "sunny",
    label: "Sunny",
    description: "Blue-sky daylight with the longest scenic flyover around the core towers.",
    available: true,
  },
  {
    id: "cloudy",
    label: "Cloudy",
    description: "Overcast air with stronger gusts and a lower downtown corridor route.",
    available: true,
  },
  {
    id: "night",
    label: "Night",
    description: "Dark skyline, luminous windows, and a shorter route along lit boulevards.",
    available: true,
  },
];

export const SUNNY_THEME: SceneTheme = {
  id: "sunny",
  name: "Sunny",
  backgroundColor: "#5aa8ff",
  fogColor: "#7fb5f1",
  fogNear: 1350,
  fogFar: 7600,
  sky: {
    distance: 450000,
    sunPosition: [118, 96, -72],
    rayleigh: 3.5,
    turbidity: 0.72,
    mieCoefficient: 0.00009,
    mieDirectionalG: 0.58,
  },
  lighting: {
    keyColor: "#fff0cf",
    keyIntensity: 2.48,
    keyPosition: [118, 96, -72],
    fillColor: "#9cd2ff",
    fillIntensity: 1.05,
    fillPosition: [-220, 105, 220],
    ambientColor: "#d7ecff",
    ambientIntensity: 0.38,
    hemiSky: "#b7deff",
    hemiGround: "#695f55",
    hemiIntensity: 0.58,
  },
  shadows: {
    area: 118,
    far: 460,
    bias: -0.00018,
    normalBias: 0.02,
    contactOpacity: 0.4,
    contactBlur: 1.55,
  },
  clouds: {
    color: "#eef7ff",
    opacityMin: 0.03,
    opacityMax: 0.1,
  },
  city: {
    faceColor: "#d5d4cf",
    windowOff: "#8091a8",
    windowLitColors: ["#f8f2e7", "#d6e8ff", "#f3dfb7", "#dfeefe"],
    fogColor: "#9cbfe0",
    fogNear: 1350,
    fogFar: 7600,
    roofWarmth: 0.13,
    windowEmissive: 0.03,
    groundRoad: "#758395",
    groundSidewalk: "#cbc4b8",
    groundLine: "#f7f2d2",
    groundPark: "#9cb58e",
    groundPlaza: "#ddd4c5",
    groundPlazaAccent: "#f0e4c2",
  },
  post: {
    bloomIntensity: 0.08,
    bloomThreshold: 0.65,
    bloomSmoothing: 0.26,
    vignetteDarkness: 0.24,
  },
};

export const CLOUDY_THEME: SceneTheme = {
  id: "cloudy",
  name: "Cloudy",
  backgroundColor: "#7c8794",
  fogColor: "#7f8d9d",
  fogNear: 380,
  fogFar: 2900,
  sky: {
    distance: 450000,
    sunPosition: [80, 52, -20],
    rayleigh: 0.9,
    turbidity: 8.7,
    mieCoefficient: 0.0048,
    mieDirectionalG: 0.84,
  },
  lighting: {
    keyColor: "#d6d9de",
    keyIntensity: 1.25,
    keyPosition: [80, 52, -20],
    fillColor: "#b7c5d4",
    fillIntensity: 0.7,
    fillPosition: [-160, 88, 150],
    ambientColor: "#c9d2dc",
    ambientIntensity: 0.42,
    hemiSky: "#b0becb",
    hemiGround: "#5d5d60",
    hemiIntensity: 0.44,
  },
  shadows: {
    area: 150,
    far: 500,
    bias: -0.00012,
    normalBias: 0.018,
    contactOpacity: 0.22,
    contactBlur: 2.4,
  },
  clouds: {
    color: "#d4d8dd",
    opacityMin: 0.16,
    opacityMax: 0.28,
  },
  city: {
    faceColor: "#c8c8c6",
    windowOff: "#6d7684",
    windowLitColors: ["#dfe4ea", "#c9d5e2", "#d8d2c7"],
    fogColor: "#8691a0",
    fogNear: 380,
    fogFar: 2900,
    roofWarmth: 0.06,
    windowEmissive: 0.02,
    groundRoad: "#646b75",
    groundSidewalk: "#b8b1a8",
    groundLine: "#dddac9",
    groundPark: "#8a9488",
    groundPlaza: "#c9c2b7",
    groundPlazaAccent: "#e0d7c4",
  },
  post: {
    bloomIntensity: 0.05,
    bloomThreshold: 0.64,
    bloomSmoothing: 0.35,
    vignetteDarkness: 0.32,
  },
};

export const NIGHT_THEME: SceneTheme = {
  id: "night",
  name: "Night",
  backgroundColor: "#081225",
  fogColor: "#091426",
  fogNear: 220,
  fogFar: 1900,
  sky: {
    distance: 450000,
    sunPosition: [-30, -12, -30],
    rayleigh: 0.22,
    turbidity: 1.9,
    mieCoefficient: 0.0012,
    mieDirectionalG: 0.58,
  },
  lighting: {
    keyColor: "#95b8ff",
    keyIntensity: 0.38,
    keyPosition: [-30, 34, -30],
    fillColor: "#4c67a0",
    fillIntensity: 0.28,
    fillPosition: [80, 48, 60],
    ambientColor: "#182745",
    ambientIntensity: 0.16,
    hemiSky: "#10233f",
    hemiGround: "#080b11",
    hemiIntensity: 0.16,
  },
  shadows: {
    area: 135,
    far: 420,
    bias: -0.00022,
    normalBias: 0.024,
    contactOpacity: 0.26,
    contactBlur: 1.6,
  },
  clouds: {
    color: "#293649",
    opacityMin: 0.02,
    opacityMax: 0.08,
  },
  city: {
    faceColor: "#1b2638",
    windowOff: "#1a2333",
    windowLitColors: ["#ffd98a", "#9fd1ff", "#ffb487", "#d4e3ff"],
    fogColor: "#0d182c",
    fogNear: 220,
    fogFar: 1900,
    roofWarmth: 0.02,
    windowEmissive: 0.18,
    groundRoad: "#131c2c",
    groundSidewalk: "#242d3a",
    groundLine: "#7b90af",
    groundPark: "#16251d",
    groundPlaza: "#2a303c",
    groundPlazaAccent: "#45516a",
  },
  post: {
    bloomIntensity: 0.36,
    bloomThreshold: 0.42,
    bloomSmoothing: 0.2,
    vignetteDarkness: 0.48,
  },
};

export const SCENE_THEME_BY_ID: Record<ThemeId, SceneTheme> = {
  sunny: SUNNY_THEME,
  cloudy: CLOUDY_THEME,
  night: NIGHT_THEME,
};
