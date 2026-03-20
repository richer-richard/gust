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
    vignetteDarkness: number;
  };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "sunny",
    label: "Sunny",
    description: "Clear daylight over the plaza and the surrounding city.",
    available: true,
  },
  {
    id: "cloudy",
    label: "Cloudy",
    description: "Daytime under a darker overcast sky.",
    available: false,
  },
  {
    id: "night",
    label: "Night",
    description: "Git City-inspired night flyover with luminous windows.",
    available: false,
  },
];

export const SUNNY_THEME: SceneTheme = {
  id: "sunny",
  name: "Sunny",
  fogColor: "#bfcad9",
  fogNear: 1400,
  fogFar: 7200,
  sky: {
    distance: 450000,
    sunPosition: [260, 180, -120],
    rayleigh: 1.35,
    turbidity: 2.2,
    mieCoefficient: 0.001,
    mieDirectionalG: 0.76,
  },
  lighting: {
    keyColor: "#fff4dd",
    keyIntensity: 2.6,
    keyPosition: [260, 180, -120],
    fillColor: "#d7e7ff",
    fillIntensity: 0.7,
    fillPosition: [-180, 120, 180],
    ambientColor: "#c4d8f2",
    ambientIntensity: 0.35,
    hemiSky: "#d7ebff",
    hemiGround: "#786a5d",
    hemiIntensity: 0.45,
  },
  clouds: {
    color: "#ffffff",
    opacityMin: 0.08,
    opacityMax: 0.18,
  },
  city: {
    faceColor: "#d9d6cc",
    windowOff: "#8f9bad",
    windowLitColors: ["#f6f2e7", "#d9e6f5", "#f4e3c1", "#e3edf9"],
    fogColor: "#c6ced8",
    fogNear: 1400,
    fogFar: 7200,
    roofWarmth: 0.18,
    windowEmissive: 0.04,
    groundRoad: "#7a8088",
    groundSidewalk: "#c4bcaf",
    groundLine: "#f4f1d8",
    groundPark: "#8ea48a",
    groundPlaza: "#d7d1c5",
    groundPlazaAccent: "#efe4c6",
  },
  post: {
    bloomIntensity: 0.1,
    vignetteDarkness: 0.3,
  },
};

export const SCENE_THEME_BY_ID: Record<ThemeId, SceneTheme> = {
  sunny: SUNNY_THEME,
  cloudy: SUNNY_THEME,
  night: SUNNY_THEME,
};
