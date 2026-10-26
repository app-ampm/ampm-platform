import { env } from "./env";

/**
 * Where the access token comes from. Until the sign-in screens exist, development builds may carry
 * a local token from the environment; production builds never do (the API refuses local tokens).
 */
export function getAccessToken(): string | null {
  return __DEV__ ? (env.EXPO_PUBLIC_DEV_ACCESS_TOKEN ?? null) : null;
}
