import { parseEnv } from "@ampm/core";
import { z } from "zod";

/**
 * Cloudflare's always-pass test site key: it works on any hostname, localhost included, and its dummy
 * token passes only a stub bot check (the local and test APIs); production's API refuses it.
 */
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

/**
 * The public site's configuration, read once (code.md). Next inlines `NEXT_PUBLIC_*` at build time.
 *
 * - `NEXT_PUBLIC_API_URL`: the API the enquiry form posts to (and the CSP's connect-src).
 * - `NEXT_PUBLIC_PORTAL_URL`: the client portal (the Expo web export) that "Client sign-in" opens at
 *   its `/sign-in`; locally the Expo dev server on 8082.
 * - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: the Cloudflare Turnstile widget the enquiry form draws, whose
 *   token is the enquiry's bot check. Public by design (it names the widget, the secret stays with the
 *   API). Production builds pass the widget "AMPM website"'s key (web.Dockerfile requires it).
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3900"),
  NEXT_PUBLIC_PORTAL_URL: z.string().url().default("http://localhost:8082"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z
    .string()
    .regex(/^\dx[\w-]+$/, "must be a Cloudflare Turnstile site key, such as 0x4AAAAAAA…")
    .default(TURNSTILE_TEST_SITE_KEY),
});

/**
 * The parsed public configuration.
 *
 *   const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/health`);
 */
export const env = parseEnv(publicEnvSchema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_PORTAL_URL: process.env.NEXT_PUBLIC_PORTAL_URL,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
});
