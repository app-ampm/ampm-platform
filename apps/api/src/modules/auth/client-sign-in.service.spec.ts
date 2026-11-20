import { describe, expect, it, vi } from "vitest";
import { SIGN_IN_ERRORS, type ClientCodeSent } from "@ampm/core";

import type { AppLogger } from "../../common/logger.service.js";
import type { ClientCodes } from "./client-codes.service.js";
import { ClientSignInService } from "./client-sign-in.service.js";
import type { CredentialsRepository } from "./credentials.repository.js";
import type { SignInGrants } from "./sign-in-grant.js";

const CLIENT = { id: "client-1", phone: "+919876543210" };
const NOTHING: ClientCodeSent = { expiresInSeconds: 300, resendAfterSeconds: 30 };

/** The service over fakes; `release` lets a held lookup finish, to show the answer did not wait for it. */
function harness(options: { onScreen: boolean; known: boolean }) {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  const send = vi.fn(async () => ({ ...NOTHING, screenCode: "482913" }));
  const codes = {
    signer: vi.fn(),
    allow: vi.fn(async () => undefined),
    showsOnScreen: () => options.onScreen,
    send,
    nothingSent: () => NOTHING,
    verify: vi.fn(async () => undefined),
  };
  const findActiveClientByPhone = vi.fn(async () => {
    if (!options.onScreen) await held;
    return options.known ? CLIENT : null;
  });
  const service = new ClientSignInService(
    codes as unknown as ClientCodes,
    { findActiveClientByPhone } as unknown as CredentialsRepository,
    { grant: vi.fn() } as unknown as SignInGrants,
    { warn: vi.fn() } as unknown as AppLogger,
  );
  return { service, send, release };
}

describe("ClientSignInService (D-147)", () => {
  it("with the code off screen, answers at once and sends after, so timing reveals nothing", async () => {
    const { service, send, release } = harness({ onScreen: false, known: true });
    expect(await service.requestCode({ phone: CLIENT.phone })).toEqual(NOTHING);
    expect(send).not.toHaveBeenCalled();
    release();
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(CLIENT));
  });

  it("texts nobody for a number with no client", async () => {
    const { service, send, release } = harness({ onScreen: false, known: false });
    release();
    expect(await service.requestCode({ phone: "+919000000000" })).toEqual(NOTHING);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(send).not.toHaveBeenCalled();
  });

  it("while codes are shown on screen, waits for the code to answer with it", async () => {
    const { service } = harness({ onScreen: true, known: true });
    expect((await service.requestCode({ phone: CLIENT.phone })).screenCode).toBe("482913");
  });

  it("refuses a number with no client exactly as it refuses a wrong code", async () => {
    const { service, release } = harness({ onScreen: false, known: false });
    release();
    await expect(service.signIn({ phone: "+919000000000", code: "123456" })).rejects.toThrow(
      SIGN_IN_ERRORS.invalidClientCode,
    );
  });
});
