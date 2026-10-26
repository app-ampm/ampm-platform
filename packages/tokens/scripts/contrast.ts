/** WCAG 2.x relative luminance and contrast ratio, shared by the generator and its tests. */
import type { Hex } from "../src/colors.ts";

export function channels(hex: Hex): [number, number, number] {
  const value = hex.slice(1);
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`tokens: ${hex} is not a 6-digit hex colour`);
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

export function luminance(hex: Hex): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Hex, b: Hex): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
