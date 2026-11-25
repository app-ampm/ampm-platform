import type { Metadata, Viewport } from "next";

import { colors } from "@ampm/tokens";

import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMPM · Destination weddings in India",
  description: "Destination weddings in India, planned and run by one team.",
};

/** The browser's own bars take the midnight canvas; Peacock Night has no light scheme. */
export const viewport: Viewport = {
  themeColor: colors.surface.dark,
  colorScheme: "dark",
};

/**
 * The strict nonce CSP (middleware.ts) only reaches Next's own scripts when the page renders per request:
 * a statically prerendered page ships its bootstrap scripts with no nonce, and `strict-dynamic` then
 * blocks every one, so nothing hydrates. Rendering per request lets Next stamp the request nonce on each
 * script. The public marketing site can win static generation back with a hashed CSP later; every page
 * repeats `dynamic` so none is prerendered by accident. The trade-off is recorded in D-046.
 */
export const dynamic = "force-dynamic";

/**
 * The document every page shares: Peacock Night is dark only, so the midnight canvas, pearl text and the
 * next/font variables sit on <html> and <body>. The frame around a page is its section's own layout: the
 * (site) group's for the marketing pages (the top bar, the footer and the chat pill, SiteFrame), the
 * hotel form's for /hotel-form (D-189 §8), which has no chat pill and none of the site's navigation.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} scroll-pt-28`}>
      <body className="min-h-screen bg-surface font-sans text-primary antialiased">{children}</body>
    </html>
  );
}
