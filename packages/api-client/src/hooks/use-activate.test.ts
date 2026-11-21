import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActivate } from "./use-activate";

interface Seen {
  mutationFn: ((variables: unknown) => Promise<unknown>) | null;
  readonly requests: { path: string; options: Record<string, unknown> }[];
}

/** What the hook handed to useMutation, and the request its mutation then made. */
const seen = vi.hoisted((): Seen => ({ mutationFn: null, requests: [] }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: (variables: unknown) => Promise<unknown> }) => {
    seen.mutationFn = options.mutationFn;
    return {};
  },
}));

vi.mock("../provider", () => ({
  useApiClient: () => ({
    request: (path: string, options: Record<string, unknown>) => {
      seen.requests.push({ path, options });
      return Promise.resolve(null);
    },
  }),
}));

describe("useActivate", () => {
  beforeEach(() => {
    seen.mutationFn = null;
    seen.requests.length = 0;
  });

  it("presents a given provider token as the Bearer and keeps it out of the body", async () => {
    useActivate();
    await seen.mutationFn?.({ token: "invite", accessToken: "provider" });
    expect(seen.requests).toEqual([
      {
        path: "/auth/activate",
        options: expect.objectContaining({
          method: "POST",
          body: { token: "invite" },
          accessToken: "provider",
        }),
      },
    ]);
  });
});
