import { parseEnv } from "@ampm/core";
import { z } from "zod";

/**
 * The public site's configuration, read once (code.md). Next inlines `NEXT_PUBLIC_*` at build time.
 *
 * - `NEXT_PUBLIC_API_URL`: the API the enquiry form posts to (and the CSP's connect-src).
 * - `NEXT_PUBLIC_PORTAL_URL`: the client portal (the Expo web export) that "Client sign-in" opens at
 *   its `/sign-in`; locally the Expo dev server on 8082.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3900"),
  NEXT_PUBLIC_PORTAL_URL: z.string().url().default("http://localhost:8082"),
});

/**
 * The parsed public configuration.
 *
 *   const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/health`);
 */
export const env = parseEnv(publicEnvSchema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_PORTAL_URL: process.env.NEXT_PUBLIC_PORTAL_URL,
});
