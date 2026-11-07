/**
 * Opacity steps: the `/n` in `bg-surface/50`, `border-primary/16`, `bg-brand/14`, and `opacity-n`.
 * Peacock Night builds every tint from one of its four colours at one of these strengths, so this list
 * is the whole tint vocabulary (Tailwind v3 only accepts modifiers that are keys here):
 *
 *   pearl     3 6 8 10 12  fills (well, skeleton, stale chip, shimmer, rim, toggle track)
 *             16 20 24 26 32 34 40   strokes (panel, input, hover, disabled dash, locked, checkbox, outline)
 *             45 58 60 62 80         text (disabled, label, prefix, stale, body)
 *   midnight  50 70                  glass fill, scrim
 *   gold      6 14 16 18 35 50 85    internal fill, glass, waiting chip, focus halo, rim, stroke, pressed
 *   peacock   25 30 55 70            OTP fill, glass, orb, stroke
 */
export const opacity = {
  "0": "0",
  "3": "0.03",
  "5": "0.05",
  "6": "0.06",
  "8": "0.08",
  "10": "0.1",
  "12": "0.12",
  "14": "0.14",
  "16": "0.16",
  "18": "0.18",
  "20": "0.2",
  "24": "0.24",
  "25": "0.25",
  "26": "0.26",
  "30": "0.3",
  "32": "0.32",
  "34": "0.34",
  "35": "0.35",
  "40": "0.4",
  "45": "0.45",
  "50": "0.5",
  "55": "0.55",
  "58": "0.58",
  "60": "0.6",
  "62": "0.62",
  "70": "0.7",
  "75": "0.75",
  "80": "0.8",
  "85": "0.85",
  "90": "0.9",
  "95": "0.95",
  "100": "1",
} as const;
