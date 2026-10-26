import { describe, expect, it } from "vitest";

import { cognitoIdentityFromClaims } from "./cognito.adapter.js";
import { LocalIdentityAdapter } from "./local.adapter.js";

const SECRET = "a-development-secret-that-is-long-enough-32";

describe("LocalIdentityAdapter", () => {
  it("verifies the tokens it mints and rejects others", async () => {
    const adapter = new LocalIdentityAdapter(SECRET);
    const token = await adapter.mint("local:admin", { email: "admin@example.com" });
    await expect(adapter.verifyAccessToken(token)).resolves.toMatchObject({
      subject: "local:admin",
      provider: "local",
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

describe("cognitoIdentityFromClaims", () => {
  const claims = {
    sub: "c0gn1t0-sub",
    token_use: "access",
    client_id: "client-1",
    email: "x@example.com",
  };

  it("accepts an access token for the app client", () => {
    expect(cognitoIdentityFromClaims(claims, "client-1")).toEqual({
      subject: "c0gn1t0-sub",
      provider: "cognito",
      email: "x@example.com",
      phone: null,
    });
  });

  it("rejects id tokens, other clients and empty subjects", () => {
    expect(() => cognitoIdentityFromClaims({ ...claims, token_use: "id" }, "client-1")).toThrow();
    expect(() => cognitoIdentityFromClaims(claims, "client-2")).toThrow();
    expect(() => cognitoIdentityFromClaims({ ...claims, sub: "" }, "client-1")).toThrow();
  });
});
