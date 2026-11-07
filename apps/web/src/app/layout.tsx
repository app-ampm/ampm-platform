import type { Metadata, Viewport } from "next";

import { colors } from "@ampm/tokens";

import { ChatPill, MAIN_ID, RouteFooter, SiteHeader, SkipLink } from "@/components/site";

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
 * Peacock Night is dark only: the midnight canvas, pearl text and the next/font variables on <html>.
 * Every page sits in one frame between the glass top bar and the footer (the home page's full one,
 * the compact one elsewhere), with the chat pill floating over it; the frame is `relative` so a page's
 * GlowOrbs light it from the bar to the footer. `scroll-pt-28` keeps in-page links (the home page's
 * selected work, the contact page's chat anchor) clear of the sticky bar.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} scroll-pt-28`}>
      <body className="min-h-screen bg-surface font-sans text-primary antialiased">
        <SkipLink />
        <div className="relative isolate flex min-h-screen flex-col">
          <SiteHeader />
          <main id={MAIN_ID} className="flex flex-1 flex-col">
            {children}
          </main>
          <RouteFooter />
          <ChatPill />
        </div>
      </body>
    </html>
  );
}
