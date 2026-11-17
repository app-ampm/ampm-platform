import { useMutation } from "@tanstack/react-query";
import { activateResponse, type ActivateRequest, type ActivateResponse } from "@ampm/core";

import { useApiClient } from "../provider";

/** The invite token to redeem, and the provider access token to present when it is not the session's. */
export interface ActivateVariables extends ActivateRequest {
  /**
   * The provider access token to send as the Bearer. Omitted, the session's goes (Cognito: the invitee
   * has just signed in to the pool); the local provider passes the token `useDevInviteSignIn` minted,
   * which is not the app's session until activation has linked it.
   */
  readonly accessToken?: string | undefined;
}

/**
 * First-run identity activation (`POST /auth/activate`). The caller must hold a provider access token —
 * the session's (Cognito), or one passed as `accessToken` (the local stand-in). Exchanges the one-time
 * invite token for the linked account: the API verifies the token, matches its verified email to the
 * invited user, binds `identity_subject` and flips the account and its memberships active (D-041). The
 * API refuses it unless the bearer is a valid access token and the invite is still pending; the refusals
 * a screen tells apart carry the messages in `ACTIVATION_ERRORS`.
 *
 *   const activate = useActivate();
 *   await activate.mutateAsync({ token: inviteToken, accessToken });
 */
export function useActivate() {
  const api = useApiClient();
  return useMutation<ActivateResponse, Error, ActivateVariables>({
    mutationFn: ({ accessToken, ...body }) =>
      api.request("/auth/activate", {
        method: "POST",
        body,
        schema: activateResponse,
        accessToken,
      }),
  });
}
