import { ACTIVATION_ERRORS, AppError } from "@ampm/core";

import { activationRefusal } from "./activation-outcome";

describe("activationRefusal", () => {
  it("ends the link on the refusals the API names (ACTIVATION_ERRORS)", () => {
    expect(
      activationRefusal(new AppError("unauthenticated", ACTIVATION_ERRORS.invalidInvite)),
    ).toEqual({ kind: "expired" });
    expect(activationRefusal(new AppError("conflict", ACTIVATION_ERRORS.inviteUsed))).toEqual({
      kind: "expired",
    });
    expect(activationRefusal(new AppError("conflict", ACTIVATION_ERRORS.alreadyActive))).toEqual({
      kind: "already-active",
    });
  });

  it("keeps every other refusal one that can be tried again, with its reason", () => {
    const cases = [
      [new AppError("network_error", "x"), "network"],
      [new AppError("rate_limited", "x"), "rate-limited"],
      [new AppError("forbidden", "x"), "email-mismatch"],
      [
        new AppError("conflict", "That sign-in is already linked to another account"),
        "linked-elsewhere",
      ],
      // Outside a local config the stand-in does not exist (denial equals absence).
      [new AppError("not_found", "Not found"), "unknown"],
      [new AppError("unauthenticated", "Sign in to continue"), "unknown"],
      [new Error("boom"), "unknown"],
    ] as const;
    for (const [error, reason] of cases) {
      expect(activationRefusal(error)).toEqual({ kind: "failed", reason });
    }
  });
});
