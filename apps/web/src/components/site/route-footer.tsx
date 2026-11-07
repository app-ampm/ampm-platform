"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "./site-footer";

/**
 * The root layout's footer for the page on screen: W1's full footer on the home page, the compact
 * W2–W6 one on every other page. The layout keeps it after <main>, so it stays the page's contentinfo
 * landmark (a footer a page rendered would sit inside <main>); a client component only to read the
 * path, which the server render knows too, so nothing changes at hydration.
 */
export function RouteFooter() {
  const pathname = usePathname();
  return <SiteFooter variant={pathname === "/" ? "home" : "page"} />;
}
