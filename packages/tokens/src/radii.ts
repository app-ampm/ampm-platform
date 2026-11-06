/**
 * Corner radii: Peacock Night. Controls are pills (`rounded-full`: buttons, inputs, chips, tabs,
 * segmented controls, nav and tab bars); panels are soft.
 */
export const radii = {
  none: "0px",
  sm: "0.4375rem", // 7 · checkboxes, small square marks
  DEFAULT: "1rem", // 16 · rows and inner cards inside panels, OTP cells
  md: "1rem",
  lg: "1.375rem", // 22 · glass cards on a phone
  xl: "1.5rem", // 24 · glass panels on a desktop
  "2xl": "1.75rem", // 28 · page containers, sheets
  full: "9999px",
} as const;
