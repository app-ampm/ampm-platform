import { describe, expect, it } from "vitest";

import { cognitoIdentityFromClaims } from "./cognito.adapter.js";
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

describe("cognitoIdentityFromClaims", () => {
  const EXP = 2_000_000_000; // a fixed future `exp` (seconds); jwtVerify has already enforced it live
  const claims = {
    sub: "c0gn1t0-sub",
    token_use: "access",
    client_id: "client-1",
    jti: "jti-cognito",
    exp: EXP,
    email: "x@example.com",
    email_verified: true,
  };

  it("accepts an access token for the app client and surfaces its verified email", () => {
    expect(cognitoIdentityFromClaims(claims, "client-1")).toEqual({
      subject: "c0gn1t0-sub",
      provider: "cognito",
      tokenId: "jti-cognito",
      expiresAt: new Date(EXP * 1000),
      email: "x@example.com",
      phone: null,
    });
  });

  it("rejects an access token with no expiry (A2)", () => {
    const { exp: _omit, ...noExp } = claims;
    expect(() => cognitoIdentityFromClaims(noExp, "client-1")).toThrow();
  });

  it('accepts email_verified as the boolean true or the string "true"', () => {
    expect(cognitoIdentityFromClaims({ ...claims, email_verified: "true" }, "client-1").email).toBe(
      "x@example.com",
    );
  });

  it("treats an unverified or absent email as no email (D-041 fails closed)", () => {
    expect(
      cognitoIdentityFromClaims({ ...claims, email_verified: false }, "client-1").email,
    ).toBeNull();
    expect(
      cognitoIdentityFromClaims({ ...claims, email_verified: undefined }, "client-1").email,
    ).toBeNull();
    const withoutEmail = {
      sub: "c0gn1t0-sub",
      token_use: "access",
      client_id: "client-1",
      jti: "jti-cognito",
      exp: EXP,
      email_verified: true,
    };
    expect(cognitoIdentityFromClaims(withoutEmail, "client-1").email).toBeNull();
  });

  it("surfaces phone only when phone_number_verified is true", () => {
    const withPhone = { ...claims, phone_number: "+15550001111" };
    expect(
      cognitoIdentityFromClaims({ ...withPhone, phone_number_verified: true }, "client-1").phone,
    ).toBe("+15550001111");
    expect(
      cognitoIdentityFromClaims({ ...withPhone, phone_number_verified: false }, "client-1").phone,
    ).toBeNull();
    expect(cognitoIdentityFromClaims(withPhone, "client-1").phone).toBeNull();
  });

  it("rejects id tokens, other clients, empty subjects and a missing token id", () => {
    expect(() => cognitoIdentityFromClaims({ ...claims, token_use: "id" }, "client-1")).toThrow();
    expect(() => cognitoIdentityFromClaims(claims, "client-2")).toThrow();
    expect(() => cognitoIdentityFromClaims({ ...claims, sub: "" }, "client-1")).toThrow();
    expect(() => cognitoIdentityFromClaims({ ...claims, jti: undefined }, "client-1")).toThrow();
  });
});
