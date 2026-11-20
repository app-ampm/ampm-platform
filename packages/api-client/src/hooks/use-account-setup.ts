import { useMutation, useQuery } from "@tanstack/react-query";
import {
  acknowledged,
  activationPasswordResponse,
  enrolledGrant,
  invitationPreview,
  type Acknowledged,
  type ActivationConfirmRequest,
  type ActivationPasswordRequest,
  type ActivationPasswordResponse,
  type EnrolledGrant,
  type ForgotPasswordRequest,
  type InvitationPreview,
  type ResetPasswordRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";

/*
 * Setting up and recovering an account with AMPM's own sign-in (D-142): activating an invitation
 * (password, then authenticator) and resetting a forgotten password. All anonymous: the person has no
 * session yet. Tokens travel in request bodies, never in a query string.
 */

/**
 * Who an invitation is for (`POST /auth/activation/preview`), to greet them before anything is set.
 * Read once: the route is rate-limited, so it never refetches on focus.
 *
 *   const preview = useInvitationPreview(token); // preview.data?.name
 */
export function useInvitationPreview(token: string | undefined) {
  const api = useApiClient();
  return useQuery<InvitationPreview, Error>({
    queryKey: ["auth", "invitation", token],
    enabled: Boolean(token),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api.request("/auth/activation/preview", {
        method: "POST",
        body: { token },
        schema: invitationPreview,
        anonymous: true,
      }),
  });
}

/** Activation step one (`POST /auth/activation/password`): the password; answers with the authenticator to add. */
export function useActivationPassword() {
  const api = useApiClient();
  return useMutation<ActivationPasswordResponse, Error, ActivationPasswordRequest>({
    mutationFn: (body) =>
      api.request("/auth/activation/password", {
        method: "POST",
        body,
        schema: activationPasswordResponse,
        anonymous: true,
      }),
  });
}

/**
 * Activation step two (`POST /auth/activation/confirm`): the authenticator's first code. The account turns
 * active; answers with the access token and ten recovery codes, shown once.
 */
export function useActivationConfirm() {
  const api = useApiClient();
  return useMutation<EnrolledGrant, Error, ActivationConfirmRequest>({
    mutationFn: (body) =>
      api.request("/auth/activation/confirm", {
        method: "POST",
        body,
        schema: enrolledGrant,
        anonymous: true,
      }),
  });
}

/** Asks for a password-reset email (`POST /auth/password/forgot`); the same answer whether or not the account exists. */
export function useForgotPassword() {
  const api = useApiClient();
  return useMutation<Acknowledged, Error, ForgotPasswordRequest>({
    mutationFn: (body) =>
      api.request("/auth/password/forgot", {
        method: "POST",
        body,
        schema: acknowledged,
        anonymous: true,
      }),
  });
}

/** Sets a new password with the emailed link's token (`POST /auth/password/reset`); every session is signed out. */
export function useResetPassword() {
  const api = useApiClient();
  return useMutation<Acknowledged, Error, ResetPasswordRequest>({
    mutationFn: (body) =>
      api.request("/auth/password/reset", {
        method: "POST",
        body,
        schema: acknowledged,
        anonymous: true,
      }),
  });
}
