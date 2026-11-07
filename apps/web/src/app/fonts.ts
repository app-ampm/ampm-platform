import { Gilda_Display, Manrope, Rozha_One } from "next/font/google";

/*
 * Peacock Night's three typefaces (packages/tokens/src/typography.ts), self-hosted by next/font at build
 * time, so the site makes no request to Google and the CSP's `font-src 'self'` holds. Each loader
 * declares the CSS variable the tokens' web preset points its families at (`webFontVariables`);
 * next/font only accepts literal options, so the names are spelled out here and fonts.test.ts checks
 * them against the tokens. Manrope is a variable font: every weight from 200 to 800 comes in one file.
 */
const display = Gilda_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const devanagari = Rozha_One({
  weight: "400",
  subsets: ["devanagari", "latin"],
  display: "swap",
  variable: "--font-devanagari",
});

/** The classes that declare the three variables; the root layout puts them on <html>. */
export const fontVariables = [display.variable, sans.variable, devanagari.variable].join(" ");
