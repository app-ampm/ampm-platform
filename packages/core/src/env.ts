import type { ZodType } from "zod";

import { errors, type ErrorDetail } from "./errors";

/**
 * Validates an environment once per app (code.md: `process.env` is read in one `env.ts` only).
 * Pure: the source is passed in, so the same helper serves the API and the apps' public config.
 */
export function parseEnv<T>(
  schema: ZodType<T>,
  source: Readonly<Record<string, string | undefined>>,
): T {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const details: ErrorDetail[] = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
  throw errors.validation(
    details,
    `Environment is not valid: ${details.map((d) => `${d.path} ${d.message}`).join("; ")}`,
  );
}
