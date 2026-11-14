import { useMutation } from "@tanstack/react-query";
import {
  devCreateClientResponse,
  devLoginResponse,
  devOtpSendResponse,
  type DevCreateClientRequest,
  type DevCreateClientResponse,
  type DevLoginResponse,
  type DevOtpSendRequest,
  type DevOtpSendResponse,
  type DevOtpVerifyRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";

/**
 * Dev-only: request a demo OTP by mobile number (`POST /auth/dev-login/request-otp`). The response
 * carries the one-time code to show on screen until the real SMS provider is wired; the API refuses
 * this outside a local, non-production config, so there is no production path.
 */
export function useRequestDevOtp() {
  const api = useApiClient();
  return useMutation<DevOtpSendResponse, Error, DevOtpSendRequest>({
    mutationFn: (body) =>
      api.request("/auth/dev-login/request-otp", {
        method: "POST",
        body,
        schema: devOtpSendResponse,
      }),
  });
}

/**
 * Dev-only: verify a demo OTP and mint the local session (`POST /auth/dev-login/verify-otp`). The app
 * stores the returned token and sends it as the Bearer, exactly as the email dev-login does.
 */
export function useVerifyDevOtp() {
  const api = useApiClient();
  return useMutation<DevLoginResponse, Error, DevOtpVerifyRequest>({
    mutationFn: (body) =>
      api.request("/auth/dev-login/verify-otp", {
        method: "POST",
        body,
        schema: devLoginResponse,
      }),
  });
}

/**
 * Dev-only: create a brand-new active client from a name and mobile
 * (`POST /auth/dev-login/create-client`), so a demo can add a client before signing them in by OTP.
 * Dev-gated like the OTP endpoints — no production path. The new account is an ordinary prospect, so its
 * own subscription purchase opens every hotel.
 */
export function useCreateDemoClient() {
  const api = useApiClient();
  return useMutation<DevCreateClientResponse, Error, DevCreateClientRequest>({
    mutationFn: (body) =>
      api.request("/auth/dev-login/create-client", {
        method: "POST",
        body,
        schema: devCreateClientResponse,
      }),
  });
}
