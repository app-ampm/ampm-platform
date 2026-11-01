import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { CognitoIdentityAdapter } from "./cognito.adapter.js";

const REGION = "ap-south-1";
const POOL_ID = "ap-south-1_testpool";
const CLIENT_ID = "test-client";
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;
const KID = "test-key-1";

interface SignOptions {
  issuer?: string;
  key?: CryptoKey;
  expired?: boolean;
}

/**
 * Offline contract test for the Cognito adapter (the `*.contract.spec.ts` convention): a locally
 * generated RS256 keypair stands in for the pool's JWKS and is injected into the adapter, so the real
 * signature / issuer / client / expiry verification and the D-041 verified-email gate are proven with
 * no network and no AWS credentials. A live Mumbai-sandbox variant is deferred until the pool exists.
 */
describe("CognitoIdentityAdapter (offline JWKS contract)", () => {
  let adapter: CognitoIdentityAdapter;
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair("RS256")).privateKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: "RS256", use: "sig" };
    const jwks = createLocalJWKSet({ keys: [jwk] });
    adapter = new CognitoIdentityAdapter(
      { region: REGION, userPoolId: POOL_ID, clientId: CLIENT_ID },
      jwks,
    );
  });

  function sign(claims: Record<string, unknown>, opts: SignOptions = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer(opts.issuer ?? ISSUER)
      .setIssuedAt(now)
      .setExpirationTime(opts.expired ? now - 60 : now + 3600)
      .sign(opts.key ?? privateKey);
  }

  const access = () => ({
    token_use: "access",
    client_id: CLIENT_ID,
    sub: "cognito-sub-1",
    jti: "jti-1",
    email: "pat@example.com",
    email_verified: true,
  });

  it("verifies a well-formed access token to the right identity", async () => {
    const identity = await adapter.verifyAccessToken(await sign(access()));
    expect(identity).toMatchObject({
      subject: "cognito-sub-1",
      provider: "cognito",
      tokenId: "jti-1",
      email: "pat@example.com",
      phone: null,
    });
    // The session is kept until the token's own expiry (A2); the signed token expires an hour out.
    expect(identity.expiresAt).toBeInstanceOf(Date);
    expect(identity.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('surfaces a verified email when email_verified is the string "true" (the Lambda shape)', async () => {
    const token = await sign({ ...access(), email_verified: "true" });
    expect((await adapter.verifyAccessToken(token)).email).toBe("pat@example.com");
  });

  it("rejects a token signed by the wrong key", async () => {
    await expect(
      adapter.verifyAccessToken(await sign(access(), { key: otherKey })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects a token from the wrong issuer", async () => {
    await expect(
      adapter.verifyAccessToken(await sign(access(), { issuer: "https://evil.example/pool" })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects an expired token", async () => {
    await expect(
      adapter.verifyAccessToken(await sign(access(), { expired: true })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects a token whose algorithm is not the pinned RS256", async () => {
    const secret = new TextEncoder().encode("a-development-secret-that-is-long-enough-32");
    const token = await new SignJWT(access())
      .setProtectedHeader({ alg: "HS256", kid: KID })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    await expect(adapter.verifyAccessToken(token)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects an id token and a token for another app client", async () => {
    await expect(
      adapter.verifyAccessToken(await sign({ ...access(), token_use: "id" })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(
      adapter.verifyAccessToken(await sign({ ...access(), client_id: "other-client" })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("surfaces no email when the access token omits or does not verify it (the D-041 go-live gap)", async () => {
    const unverified = await sign({ ...access(), email_verified: false });
    expect((await adapter.verifyAccessToken(unverified)).email).toBeNull();
    const noEmail = await sign({
      token_use: "access",
      client_id: CLIENT_ID,
      sub: "cognito-sub-1",
      jti: "jti-2",
      email_verified: true,
    });
    expect((await adapter.verifyAccessToken(noEmail)).email).toBeNull();
  });
});
