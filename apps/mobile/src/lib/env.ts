import { parseEnv } from "@ampm/core";
import { z } from "zod";

/** The app's public configuration, read once (code.md). Expo inlines `EXPO_PUBLIC_*` at build time. */
const schema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().default("http://localhost:3900"),
  /**
   * Which identity provider the app signs in against, mirroring the API's `IDENTITY_PROVIDER`.
   * `local` (the default) keeps the dev-login path; `cognito` drives the real Amazon Cognito sign-in.
   */
  EXPO_PUBLIC_IDENTITY_PROVIDER: z.enum(["cognito", "local"]).default("local"),
  /** The Cognito user pool the app signs in against; required when the provider is `cognito`. Public ids, not secrets. */
  EXPO_PUBLIC_COGNITO_REGION: z.string().optional(),
  EXPO_PUBLIC_COGNITO_USER_POOL_ID: z.string().optional(),
  EXPO_PUBLIC_COGNITO_CLIENT_ID: z.string().optional(),
  /** Development only: a local access token until the sign-in screens arrive (sprint 2). */
  EXPO_PUBLIC_DEV_ACCESS_TOKEN: z.string().optional(),
});

/**
 * The parsed public configuration. The dev access token is read only in a development build:
 * `__DEV__` is false in a production export, so the minifier drops the inlined literal and the
 * token never ships, whatever `.env` holds (security.md: secrets never in code or images).
 *
 *   const response = await fetch(`${env.EXPO_PUBLIC_API_URL}/health`);
 */
export const env = parseEnv(schema, {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_IDENTITY_PROVIDER: process.env.EXPO_PUBLIC_IDENTITY_PROVIDER,
  EXPO_PUBLIC_COGNITO_REGION: process.env.EXPO_PUBLIC_COGNITO_REGION,
  EXPO_PUBLIC_COGNITO_USER_POOL_ID: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
  EXPO_PUBLIC_COGNITO_CLIENT_ID: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
  EXPO_PUBLIC_DEV_ACCESS_TOKEN: __DEV__ ? process.env.EXPO_PUBLIC_DEV_ACCESS_TOKEN : undefined,
});
