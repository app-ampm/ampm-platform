import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDemoSignIn, useDevLogin } from "./use-dev-login";
import { useCreateDemoClient, useRequestDevOtp, useVerifyDevOtp } from "./use-dev-otp";

interface Seen {
  mutationFn: ((variables: unknown) => Promise<unknown>) | null;
  readonly requests: { path: string; anonymous: boolean | undefined }[];
}

/** What each hook handed to useMutation, and every request its mutation then made. */
const seen = vi.hoisted((): Seen => ({ mutationFn: null, requests: [] }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: (variables: unknown) => Promise<unknown> }) => {
    seen.mutationFn = options.mutationFn;
    return {};
  },
}));

vi.mock("../provider", () => ({
  useApiClient: () => ({
    request: (path: string, options: { anonymous?: boolean }) => {
      seen.requests.push({ path, anonymous: options.anonymous });
      return Promise.resolve(null);
    },
  }),
}));

const SIGN_IN_HOOKS = [
  { name: "useDevLogin", hook: useDevLogin, path: "/auth/dev-login" },
  { name: "useDemoSignIn", hook: useDemoSignIn, path: "/auth/dev-login/demo" },
  { name: "useRequestDevOtp", hook: useRequestDevOtp, path: "/auth/dev-login/request-otp" },
  { name: "useVerifyDevOtp", hook: useVerifyDevOtp, path: "/auth/dev-login/verify-otp" },
  { name: "useCreateDemoClient", hook: useCreateDemoClient, path: "/auth/dev-login/create-client" },
];

describe("the dev sign-in hooks", () => {
  beforeEach(() => {
    seen.mutationFn = null;
    seen.requests.length = 0;
  });

  // A stale token sent to the password-gated `/_api/auth/dev-login*` on the test box replaces the
  // browser's Basic-Auth credentials: Apache logs a failed login per try and fail2ban bans the IP.
  it.each(SIGN_IN_HOOKS)("$name sends its request without the Bearer", async ({ hook, path }) => {
    hook();
    await seen.mutationFn?.({});
    expect(seen.requests).toEqual([{ path, anonymous: true }]);
  });
});
