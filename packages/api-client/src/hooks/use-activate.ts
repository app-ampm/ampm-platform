import { useMutation } from "@tanstack/react-query";
import { activateResponse, type ActivateRequest, type ActivateResponse } from "@ampm/core";

import { useApiClient } from "../provider";

/**
 * First-run identity activation (`POST /auth/activate`). The caller must already hold a provider
 * (Cognito) access token — the typed client attaches it as the Bearer. Exchanges the one-time invite
 * token for the linked account: the API verifies the token, matches its verified email to the invited
 * user, binds `identity_subject` and flips the account and its memberships active (D-041). The API
 * refuses it unless the bearer is a valid access token and the invite is still pending.
 */
export function useActivate() {
  const api = useApiClient();
  return useMutation<ActivateResponse, Error, ActivateRequest>({
    mutationFn: (body) =>
      api.request("/auth/activate", { method: "POST", body, schema: activateResponse }),
  });
}
