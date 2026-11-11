import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { describe, expect, it, vi } from "vitest";

import { CognitoIdentityProvisioner } from "./cognito-provisioner.adapter.js";

const POOL_ID = "ap-south-1_testpool";

/**
 * Offline contract test for the Cognito provisioner (the `*.contract.spec.ts` convention): a fake SDK
 * client stands in for the `.send()` transport, so the exact admin commands the adapter issues — suppressed
 * invite email, administratively verified contacts, the username per audience, the passwordless-client
 * confirm, and the idempotent reconcile — are proven with no network and no AWS credentials. A live
 * Mumbai-sandbox variant is covered manually (the throwaway-user run in cognito-setup §11), not in CI.
 */
describe("CognitoIdentityProvisioner (offline SDK contract)", () => {
  function harness(sendImpl?: (command: unknown) => Promise<unknown>) {
    const send = vi.fn(sendImpl ?? (async () => ({})));
    const client = { send } as unknown as CognitoIdentityProviderClient;
    const provisioner = new CognitoIdentityProvisioner(
      { region: "ap-south-1", userPoolId: POOL_ID },
      client,
    );
    return { provisioner, send };
  }

  const commandsOf = (send: ReturnType<typeof vi.fn>) =>
    send.mock.calls.map(([command]) => command as { input: Record<string, unknown> });

  it("provisions staff: creates by email with a suppressed invite and a verified email, no password", async () => {
    const { provisioner, send } = harness();
    await provisioner.provisionUser({ kind: "staff", email: "staff@ampm.example", phone: null });

    const commands = commandsOf(send);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(AdminCreateUserCommand);
    expect(commands[0]?.input).toEqual({
      UserPoolId: POOL_ID,
      Username: "staff@ampm.example",
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: "staff@ampm.example" },
        { Name: "email_verified", Value: "true" },
      ],
    });
    // Staff keep the Cognito-generated temporary password (first-run new-password flow); none is set here.
    expect(send.mock.calls.some(([c]) => c instanceof AdminSetUserPasswordCommand)).toBe(false);
  });

  it("provisions a client: creates by phone with verified email+phone, then a permanent password", async () => {
    const { provisioner, send } = harness();
    await provisioner.provisionUser({
      kind: "client",
      email: "rep@example.com",
      phone: "+911234567890",
    });

    const commands = commandsOf(send);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toBeInstanceOf(AdminCreateUserCommand);
    expect(commands[0]?.input).toEqual({
      UserPoolId: POOL_ID,
      Username: "+911234567890",
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: "rep@example.com" },
        { Name: "email_verified", Value: "true" },
        { Name: "phone_number", Value: "+911234567890" },
        { Name: "phone_number_verified", Value: "true" },
      ],
    });
    // Passwordless client (OTP, §5): a random permanent password only moves the account to CONFIRMED.
    expect(commands[1]).toBeInstanceOf(AdminSetUserPasswordCommand);
    expect(commands[1]?.input).toMatchObject({
      UserPoolId: POOL_ID,
      Username: "+911234567890",
      Permanent: true,
    });
    const password = commands[1]?.input.Password as string;
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("refuses to provision a client with no phone (nothing to host OTP sign-in)", async () => {
    const { provisioner, send } = harness();
    await expect(
      provisioner.provisionUser({ kind: "client", email: "rep@example.com", phone: null }),
    ).rejects.toThrow(/phone/);
    expect(send).not.toHaveBeenCalled();
  });

  it("is idempotent: an existing user is reconciled via update, not re-created (the reinvite path)", async () => {
    const existing = new UsernameExistsException({ message: "exists", $metadata: {} });
    const { provisioner, send } = harness(async (command) => {
      if (command instanceof AdminCreateUserCommand) throw existing;
      return {};
    });
    await provisioner.provisionUser({ kind: "staff", email: "staff@ampm.example", phone: null });

    const commands = commandsOf(send);
    expect(commands[0]).toBeInstanceOf(AdminCreateUserCommand);
    expect(commands[1]).toBeInstanceOf(AdminUpdateUserAttributesCommand);
    expect(commands[1]?.input).toEqual({
      UserPoolId: POOL_ID,
      Username: "staff@ampm.example",
      UserAttributes: [
        { Name: "email", Value: "staff@ampm.example" },
        { Name: "email_verified", Value: "true" },
      ],
    });
  });

  it("propagates an unexpected create error (caught best-effort by the caller, not here)", async () => {
    const { provisioner } = harness(async (command) => {
      if (command instanceof AdminCreateUserCommand) throw new Error("AccessDenied");
      return {};
    });
    await expect(
      provisioner.provisionUser({ kind: "staff", email: "staff@ampm.example", phone: null }),
    ).rejects.toThrow("AccessDenied");
  });
});
