import { parseEnv } from "@ampm/core";
import { z } from "zod";

/** The app's public configuration, read once (code.md). Expo inlines `EXPO_PUBLIC_*` at build time. */
const schema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().default("http://localhost:3900"),
  /** Development only: a local access token until the sign-in screens arrive (sprint 2). */
  EXPO_PUBLIC_DEV_ACCESS_TOKEN: z.string().optional(),
});

export const env = parseEnv(schema, {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_DEV_ACCESS_TOKEN: process.env.EXPO_PUBLIC_DEV_ACCESS_TOKEN,
});
