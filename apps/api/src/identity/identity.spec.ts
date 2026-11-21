import { describe, expect, it } from "vitest";

import { LocalIdentityAdapter } from "./local.adapter.js";

const SECRET = "a-development-secret-that-is-long-enough-32";

describe("LocalIdentityAdapter", () => {
  it("verifies the tokens it mints and rejects others", async () => {
    const adapter = new LocalIdentityAdapter(SECRET);
    const token = await adapter.mint("local:admin", {
      email: "admin@example.com",
      jti: "jti-local",
    });
    await expect(adapter.verifyAccessToken(token)).resolves.toMatchObject({
      subject: "local:admin",
      provider: "local",
      tokenId: "jti-local",
      email: "admin@example.com",
    });
    await expect(adapter.verifyAccessToken(`${token}x`)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(
      new LocalIdentityAdapter("another-secret-that-is-also-32-chars!!").verifyAccessToken(token),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});
