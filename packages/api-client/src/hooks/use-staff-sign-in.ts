import { useMutation } from "@tanstack/react-query";
import {
  acknowledged,
  enrolledGrant,
  signInGrant,
  signInResponse,
  type Acknowledged,
  type EnrolledGrant,
  type SignInCodeRequest,
  type SignInEnrolRequest,
  type SignInGrant,
  type SignInRequest,
  type SignInResponse,
} from "@ampm/core";

import { useApiClient } from "../provider";

/*
 * AMPM's own staff sign-in (D-142): the password, then the authenticator code. Every call before the
 * session exists is anonymous: whoever is signing in is nobody yet, and a stale token must never go out.
 */

/**
 * Step one (`POST /auth/sign-in`): the email and password. Answers with a challenge for the code, or an
 * authenticator to add first when an administrator reset it. One message covers every refusal
 * (`SIGN_IN_ERRORS.invalidCredentials`), so the screen never learns which emails have accounts.
 *
 *   const step = await useSignIn().mutateAsync({ email, password });
 */
export function useSignIn() {
  const api = useApiClient();
  return useMutation<SignInResponse, Error, SignInRequest>({
    mutationFn: (body) =>
      api.request("/auth/sign-in", {
        method: "POST",
        body,
        schema: signInResponse,
        anonymous: true,
      }),
  });
}

/**
 * Step two (`POST /auth/sign-in/code`): the authenticator code, or a recovery code instead. Answers with
 * the access token; the caller stores it as the session.
 *
 *   const { accessToken } = await useSignInCode().mutateAsync({ challenge, code });
 */
export function useSignInCode() {
  const api = useApiClient();
  return useMutation<SignInGrant, Error, SignInCodeRequest>({
    mutationFn: (body) =>
      api.request("/auth/sign-in/code", {
        method: "POST",
        body,
        schema: signInGrant,
        anonymous: true,
      }),
  });
}

/**
 * Step two after a reset (`POST /auth/sign-in/enrol`): confirm the newly added authenticator with its
 * first code. Answers with the access token and ten new recovery codes, shown once.
 */
export function useSignInEnrol() {
  const api = useApiClient();
  return useMutation<EnrolledGrant, Error, SignInEnrolRequest>({
    mutationFn: (body) =>
      api.request("/auth/sign-in/enrol", {
        method: "POST",
        body,
        schema: enrolledGrant,
        anonymous: true,
      }),
  });
}

/** Ends the current session on the server (`POST /auth/sign-out`), with the session's own token. */
export function useSignOut() {
  const api = useApiClient();
  return useMutation<Acknowledged, Error, void>({
    mutationFn: () => api.request("/auth/sign-out", { method: "POST", schema: acknowledged }),
  });
}
