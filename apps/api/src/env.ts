import { parseEnv } from "@ampm/core";
import { z } from "zod";

/** The API's configuration, read once here and nowhere else (code.md). */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3900),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DATABASE_URL: z.string().url(),
    IDENTITY_PROVIDER: z.enum(["cognito", "local"]).default("cognito"),
    IDENTITY_LOCAL_SECRET: z.string().min(32).optional(),
    COGNITO_REGION: z.string().min(1).optional(),
    COGNITO_USER_POOL_ID: z.string().min(1).optional(),
    COGNITO_CLIENT_ID: z.string().min(1).optional(),
    /** The job queue's Redis; absent in development and tests, where jobs run inline (D-031). */
    REDIS_URL: z.string().url().optional(),
    /** `true` in the worker process only; the API process enqueues but does not consume (D-031). */
    JOB_WORKER: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /**
     * Enables Super-Admin custom roles (D-036): the principal resolves `role_grants` into the engine's
     * `resolvedGrants`. Off by default until the admin surface and its tests are proven; while it is
     * off custom roles grant nothing, exactly as before, and come only from the seed.
     */
    DYNAMIC_ROLES: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /** Browser origins allowed to call the API (the client portals' web build), comma-separated. */
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((value, ctx) => {
    if (value.IDENTITY_PROVIDER === "local") {
      if (value.NODE_ENV === "production") {
        ctx.addIssue({
          code: "custom",
          path: ["IDENTITY_PROVIDER"],
          message: "the local identity provider is refused in production",
        });
      }
      if (!value.IDENTITY_LOCAL_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["IDENTITY_LOCAL_SECRET"],
          message: "required with the local identity provider",
        });
      }
    } else {
      for (const key of ["COGNITO_REGION", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID"] as const) {
        if (!value[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "required with the Cognito identity provider",
          });
      }
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Readonly<Record<string, string | undefined>> = process.env): Env {
  return parseEnv(schema, source);
}

export const ENV = Symbol("ENV");
