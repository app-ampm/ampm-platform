/**
 * Elevation: Peacock Night has no drop shadows. Depth comes from glass (glass.ts), a 1px pearl rim
 * along the top edge, and the glow orbs behind the content. `shadow-rim` and `shadow-rim-gold` draw the
 * rim on the web; native draws it as a hairline inside the panel (GlassPanel). `shadow-halo` is the
 * 4px gold halo of a focused control (not `focus`: that name is a colour, and the shadow-colour utility
 * would win).
 */
export const shadows = {
  none: "none",
  rim: "inset 0 1px 0 0 rgba(241, 235, 221, 0.12)",
  "rim-peacock": "inset 0 1px 0 0 rgba(241, 235, 221, 0.2)",
  "rim-gold": "inset 0 1px 0 0 rgba(221, 184, 97, 0.35)",
  halo: "0 0 0 4px rgba(221, 184, 97, 0.18)",
} as const;
