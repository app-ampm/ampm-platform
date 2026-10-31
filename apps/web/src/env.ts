import { parseEnv } from "@ampm/core";
import { z } from "zod";

/** The public site's configuration, read once (code.md). Next inlines `NEXT_PUBLIC_*` at build time. */
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3900"),
});

/**
 * The parsed public configuration.
 *
 *   const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/health`);
 */
export const env = parseEnv(schema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
