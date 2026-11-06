import { useMutation } from "@tanstack/react-query";
import { devLoginResponse, type DevLoginRequest, type DevLoginResponse } from "@ampm/core";

import { useApiClient } from "../provider";

/**
 * Dev-only local sign-in (`POST /auth/dev-login`). Exchanges a seeded staff user's email for a minted
 * local access token; the app stores it and sends it as the Bearer on every later request. The API
 * refuses this outside a local, non-production config, so there is no production path.
 */
export function useDevLogin() {
  const api = useApiClient();
  return useMutation<DevLoginResponse, Error, DevLoginRequest>({
    mutationFn: (body) =>
      api.request("/auth/dev-login", { method: "POST", body, schema: devLoginResponse }),
  });
}
