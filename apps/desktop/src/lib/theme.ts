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
  fogColor: "#9bbada",
  fogNear: 1200,
  fogFar: 8200,
  sky: {
    distance: 450000,
    sunPosition: [210, 170, -110],
    rayleigh: 1.9,
    turbidity: 1.7,
    mieCoefficient: 0.00055,
    mieDirectionalG: 0.72,
  },
  lighting: {
    keyColor: "#fff2d4",
    keyIntensity: 2.45,
    keyPosition: [210, 170, -110],
    fillColor: "#bad9ff",
    fillIntensity: 0.88,
    fillPosition: [-220, 110, 210],
    ambientColor: "#d4e6fb",
    ambientIntensity: 0.42,
    hemiSky: "#bfe0ff",
    hemiGround: "#6f6458",
    hemiIntensity: 0.55,
  },
  clouds: {
    color: "#f2f8ff",
    opacityMin: 0.04,
    opacityMax: 0.12,
  },
  city: {
    faceColor: "#d5d4cf",
    windowOff: "#7f91a8",
    windowLitColors: ["#f6f2e7", "#d7e6fb", "#f4e0b8", "#dfeefe"],
    fogColor: "#a8c0db",
    fogNear: 1200,
    fogFar: 8200,
    roofWarmth: 0.13,
    windowEmissive: 0.035,
    groundRoad: "#748092",
    groundSidewalk: "#cbc4b8",
    groundLine: "#f7f2d2",
    groundPark: "#9ab191",
    groundPlaza: "#d9d2c4",
    groundPlazaAccent: "#f0e4bf",
  },
  post: {
    bloomIntensity: 0.08,
    vignetteDarkness: 0.26,
  },
};

export const SCENE_THEME_BY_ID: Record<ThemeId, SceneTheme> = {
  sunny: SUNNY_THEME,
  cloudy: SUNNY_THEME,
  night: SUNNY_THEME,
};
