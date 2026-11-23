import { useMutation } from "@tanstack/react-query";
import { activateResponse, type ActivateRequest, type ActivateResponse } from "@ampm/core";

import { useApiClient } from "../provider";

/** The invite token to redeem, and the provider access token to present with it. */
export interface ActivateVariables extends ActivateRequest {
  /**
   * The provider access token to send as the Bearer: the token `useDevInviteSignIn` minted for the
   * invited account, which is not the app's session until activation has linked it.
   */
  readonly accessToken: string;
}

/**
 * First-run identity activation under the development provider (`POST /auth/activate`); AMPM's own
 * sign-in activates through its own routes (D-142), and outside a dev build this route is a 404 (D-162).
 * Exchanges the one-time invite token, presented with
 * the provider access token, for the linked account: the API verifies the token, matches its verified email to the
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
