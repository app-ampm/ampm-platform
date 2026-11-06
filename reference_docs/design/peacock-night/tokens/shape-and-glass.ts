/**
 * Shape, elevation and glass: Peacock Night.
 * radii.ts and shadows.ts replace the originals; glass.ts is new.
 */

// ---- radii.ts ---------------------------------------------------------------
// Controls are pills. Panels are soft. Phones are 54, tablets 40.
export const radii = {
  none: "0px",
  sm: "0.5rem",    // 8  · small square chips, checkboxes (7px in mocks)
  DEFAULT: "1rem", // 16 · inner cards and list rows inside panels
  md: "1rem",
  lg: "1.375rem",  // 22 · glass cards (mobile)
  xl: "1.5rem",    // 24 · glass panels (desktop)
  "2xl": "1.75rem",// 28 · page-level containers, sheets
  full: "9999px",  // buttons, inputs, chips, tabs, segmented controls, nav bars
} as const;

// ---- shadows.ts -------------------------------------------------------------
// No drop shadows. Depth comes from glass, a 1px pearl rim and the glow orbs.
export const shadows = {
  none: "none",
  rim: "inset 0 1px 0 0 rgba(241,235,221,0.12)",
  "rim-gold": "inset 0 1px 0 0 rgba(221,184,97,0.35)",
  focus: "0 0 0 4px rgba(221,184,97,0.18)",
  device: "0 60px 100px -50px rgba(19,138,133,0.5)",
} as const;

// ---- glass.ts ---------------------------------------------------------------
/**
 * Three glass recipes. Only top-level panels blur; anything nested inside a panel
 * uses a flat tint (`surface-inset`) so text stays crisp. On native, use
 * expo-blur's BlurView (tint="dark", intensity 40) under the fill colour, or the
 * opaque fallback when blur is disabled for performance.
 */
export const glass = {
  base: {
    fill: "rgba(14,21,52,0.50)",
    blur: 24,
    saturate: 1.5,
    stroke: "rgba(241,235,221,0.16)",
    rim: "rgba(241,235,221,0.12)",
    fallback: "#1D2440",
  },
  peacock: {
    fill: "rgba(19,138,133,0.30)",
    blur: 24,
    saturate: 1.5,
    stroke: "rgba(19,138,133,0.70)",
    rim: "rgba(241,235,221,0.20)",
    fallback: "#0F4157",
  },
  gold: {
    fill: "rgba(221,184,97,0.14)",
    blur: 24,
    saturate: 1.5,
    stroke: "rgba(221,184,97,0.50)",
    rim: "rgba(221,184,97,0.35)",
    fallback: "#2A2D3A",
  },
} as const;

/** Background glow orbs that give the glass something to refract. */
export const glow = {
  peacock: "radial-gradient(circle, rgba(19,138,133,0.55) 0%, rgba(19,138,133,0) 66%)",
  gold: "radial-gradient(circle, rgba(221,184,97,0.30) 0%, rgba(221,184,97,0) 66%)",
} as const;
