import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AMPM",
  description: "AMPM wedding platform",
};

/**
 * The strict nonce CSP (middleware.ts) only reaches Next's own scripts when the page renders per request:
 * a statically prerendered page ships its bootstrap scripts with no nonce, and `strict-dynamic` then
 * blocks every one, so nothing hydrates. Rendering per request lets Next stamp the request nonce on each
 * script. The public marketing site can win static generation back with a hashed CSP when it is actually
 * built (the site is one placeholder screen until then); the trade-off is recorded in D-046.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  // suppressHydrationWarning: the scheme toggle puts `dark` on <html> before React hydrates.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-surface font-sans text-primary antialiased">{children}</body>
    </html>
  );
}
