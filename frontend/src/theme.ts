export const colors = {
  background: "#FBF8FC",
  backgroundWarm: "#FFFDF4",
  surface: "#FFFFFF",
  surfaceLow: "#F6F3F6",
  surfaceMid: "#F0EDF0",
  surfaceHigh: "#E4E1E5",
  primary: "#555C82",
  primarySoft: "#CCD3FF",
  primaryPale: "#DDE1FF",
  primaryText: "#11193B",
  accent: "#E7E5B6",
  accentStrong: "#715C28",
  text: "#1B1B1E",
  textMuted: "#666673",
  textSoft: "#8B8B99",
  outline: "#C6C5CF",
  danger: "#BA1A1A",
  dangerSoft: "#FFDAD6",
  white: "#FFFFFF",
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  full: 999,
} as const;

export const shadows = {
  ambient: {
    shadowColor: "#CCD3FF",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 7,
  },
  soft: {
    shadowColor: "#555C82",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  button: {
    shadowColor: "#555C82",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;
