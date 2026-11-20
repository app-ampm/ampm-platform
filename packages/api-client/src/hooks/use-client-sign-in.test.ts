import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useClientSignIn,
  useConfirmClientActivation,
  useRequestClientCode,
  useSendClientActivationCode,
} from "./use-client-sign-in";

interface Seen {
  fn: ((variables?: unknown) => Promise<unknown>) | null;
  readonly requests: { path: string; method: string | undefined; anonymous: boolean | undefined }[];
}

/** The function each hook handed to React Query, and every request it then made. */
const seen = vi.hoisted((): Seen => ({ fn: null, requests: [] }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: (variables: unknown) => Promise<unknown> }) => {
    seen.fn = options.mutationFn;
    return {};
  },
}));

vi.mock("../provider", () => ({
  useApiClient: () => ({
    request: (path: string, options: { method?: string; anonymous?: boolean }) => {
      seen.requests.push({ path, method: options.method, anonymous: options.anonymous });
      return Promise.resolve(null);
    },
  }),
}));

const HOOKS = [
  { name: "useRequestClientCode", hook: useRequestClientCode, path: "/auth/client/code" },
  { name: "useClientSignIn", hook: useClientSignIn, path: "/auth/client/sign-in" },
  {
    name: "useSendClientActivationCode",
    hook: useSendClientActivationCode,
    path: "/auth/activation/client/code",
  },
  {
    name: "useConfirmClientActivation",
    hook: useConfirmClientActivation,
    path: "/auth/activation/client/confirm",
  },
];

describe("client sign-in hooks (D-147)", () => {
  beforeEach(() => {
    seen.fn = null;
    seen.requests.length = 0;
  });

  it.each(HOOKS)("$name posts to $path without any session token", async ({ hook, path }) => {
    hook();
    await seen.fn?.({});
    expect(seen.requests).toEqual([{ path, method: "POST", anonymous: true }]);
  });
});
