import { useMutation } from "@tanstack/react-query";
import {
  clientActivationCodeSent,
  clientCodeSent,
  signInGrant,
  type ClientActivationCodeSent,
  type ClientActivationConfirmRequest,
  type ClientCodeRequest,
  type ClientCodeSent,
  type ClientSignInRequest,
  type InvitationTokenRequest,
  type SignInGrant,
} from "@ampm/core";

import { useApiClient } from "../provider";

/*
 * Client sign-in by a one-time code sent to the mobile AMPM has on file (D-147). Every call is anonymous:
 * whoever is signing in is nobody yet, and a stale token must never go out with these requests.
 */

/**
 * Ask for a sign-in code by mobile (`POST /auth/client/code`). The code goes out by SMS; while SMS
 * delivery is not live the answer also carries it as `screenCode`, for the screen to show. A number with
 * no client gets the same answer, without a code.
 *
 *   const sent = await useRequestClientCode().mutateAsync({ phone });
 */
export function useRequestClientCode() {
  const api = useApiClient();
  return useMutation<ClientCodeSent, Error, ClientCodeRequest>({
    mutationFn: (body) =>
      api.request("/auth/client/code", {
        method: "POST",
        body,
        schema: clientCodeSent,
        anonymous: true,
      }),
  });
}

/**
 * Exchange the mobile and its code for a session (`POST /auth/client/sign-in`); the caller stores the
 * returned token as the session.
 *
 *   const { accessToken } = await useClientSignIn().mutateAsync({ phone, code });
 */
export function useClientSignIn() {
  const api = useApiClient();
  return useMutation<SignInGrant, Error, ClientSignInRequest>({
    mutationFn: (body) =>
      api.request("/auth/client/sign-in", {
        method: "POST",
        body,
        schema: signInGrant,
        anonymous: true,
      }),
  });
}

/**
 * Send an invited client's activation code to the mobile on file (`POST /auth/activation/client/code`),
 * answered with that mobile masked and, while SMS delivery is not live, the code to show on screen.
 *
 *   const sent = await useSendClientActivationCode().mutateAsync({ token });
 */
export function useSendClientActivationCode() {
  const api = useApiClient();
  return useMutation<ClientActivationCodeSent, Error, InvitationTokenRequest>({
    mutationFn: (body) =>
      api.request("/auth/activation/client/code", {
        method: "POST",
        body,
        schema: clientActivationCodeSent,
        anonymous: true,
      }),
  });
}

/**
 * Activate an invited client with the invitation and the code (`POST /auth/activation/client/confirm`);
 * the account turns active and the returned token starts the session.
 *
 *   const { accessToken } = await useConfirmClientActivation().mutateAsync({ token, code });
 */
export function useConfirmClientActivation() {
  const api = useApiClient();
  return useMutation<SignInGrant, Error, ClientActivationConfirmRequest>({
    mutationFn: (body) =>
      api.request("/auth/activation/client/confirm", {
        method: "POST",
        body,
        schema: signInGrant,
        anonymous: true,
      }),
  });
}
