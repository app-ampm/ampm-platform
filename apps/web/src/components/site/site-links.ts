import { env } from "@/env";

/** A page of the site in the top navigation, the phone menu and the phone footer. */
export interface SiteNavLink {
  readonly href: string;
  readonly label: string;
}

/** The five pages of the top navigation, in the mock's order (W1). */
export const SITE_NAV_LINKS: readonly SiteNavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/destinations", label: "Destinations" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/** The contact page opened on its demo request (PUB-06); the gold action on every page. */
export const DEMO_HREF = "/contact?type=demo";
/** The contact page's enquiry form (PUB-06). */
export const ENQUIRY_HREF = "/contact";
/** The chat pill's destination: there is no chat service yet, so it opens the contact page. */
export const CHAT_HREF = "/contact#chat";
/**
 * The privacy notice and the terms of use: their own pages, which hold a placeholder line until AMPM
 * publishes the documents (before the site launches).
 */
export const PRIVACY_HREF = "/privacy";
export const TERMS_HREF = "/terms";

/**
 * AMPM's Instagram profile. The design package does not give its address yet, so the footer leaves
 * Instagram out until this holds it (a guessed handle would send visitors to someone else).
 */
export const INSTAGRAM_URL: string | null = null;

/**
 * An address in the client portal (the Expo web export, its own origin), keeping any path the base
 * carries: `portalUrl("/sign-in")` is `http://localhost:8082/sign-in` by default.
 */
export function portalUrl(path: string, base: string = env.NEXT_PUBLIC_PORTAL_URL): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

/** "Client sign-in": the portal's sign-in screen (AUTH-06). AMPM creates every account. */
export const CLIENT_SIGN_IN_URL = portalUrl("/sign-in");

/** Whether a nav link is the page on screen (its own page or one beneath it). */
export function isCurrentPath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
