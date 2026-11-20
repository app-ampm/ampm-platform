import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useActivationConfirm,
  useActivationPassword,
  useForgotPassword,
  useInvitationPreview,
  useResetPassword,
} from "./use-account-setup";
import { useSignIn, useSignInCode, useSignOut } from "./use-staff-sign-in";

interface Seen {
  fn: ((variables?: unknown) => Promise<unknown>) | null;
  readonly requests: { path: string; anonymous: boolean | undefined }[];
}

/** The function each hook handed to React Query, and every request it then made. */
const seen = vi.hoisted((): Seen => ({ fn: null, requests: [] }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: (variables: unknown) => Promise<unknown> }) => {
    seen.fn = options.mutationFn;
    return {};
  },
  useQuery: (options: { queryFn: () => Promise<unknown> }) => {
    seen.fn = options.queryFn;
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

/** The invitation preview takes its token; a named hook keeps the call a hook call (rules-of-hooks). */
function useInvitationPreviewOfToken() {
  return useInvitationPreview("invite-token");
}

const ANONYMOUS_HOOKS = [
  { name: "useSignIn", hook: useSignIn, path: "/auth/sign-in" },
  { name: "useSignInCode", hook: useSignInCode, path: "/auth/sign-in/code" },
  {
    name: "useInvitationPreview",
    hook: useInvitationPreviewOfToken,
    path: "/auth/activation/preview",
  },
  { name: "useActivationPassword", hook: useActivationPassword, path: "/auth/activation/password" },
  { name: "useActivationConfirm", hook: useActivationConfirm, path: "/auth/activation/confirm" },
  { name: "useForgotPassword", hook: useForgotPassword, path: "/auth/password/forgot" },
  { name: "useResetPassword", hook: useResetPassword, path: "/auth/password/reset" },
];

describe("AMPM's own sign-in hooks", () => {
  beforeEach(() => {
    seen.fn = null;
    seen.requests.length = 0;
  });

  // Whoever is signing in is nobody yet: a stale token from an earlier session must never go out.
  it.each(ANONYMOUS_HOOKS)("$name calls its route without the Bearer", async ({ hook, path }) => {
    hook();
    await seen.fn?.({});
    expect(seen.requests).toEqual([{ path, anonymous: true }]);
  });

  it("signs out with the session's own token", async () => {
    useSignOut();
    await seen.fn?.();
    expect(seen.requests).toEqual([{ path: "/auth/sign-out", anonymous: undefined }]);
  });
});
