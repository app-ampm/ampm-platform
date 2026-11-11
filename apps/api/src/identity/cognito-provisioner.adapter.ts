import { randomBytes } from "node:crypto";

import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";

import type { IdentityProvisioner, ProvisionUserInput } from "./identity.types.js";

export interface CognitoProvisionerOptions {
  readonly region: string;
  readonly userPoolId: string;
  /** Scoped admin IAM credentials (SOPS app zone); omit to use the default AWS provider chain. */
  readonly credentials?: { readonly accessKeyId: string; readonly secretAccessKey: string };
}

/**
 * Provisions sign-in accounts in the Cognito pool at invite time (cognito-setup §6) — the control-plane
 * counterpart to the verify-only {@link CognitoIdentityAdapter}. These are admin calls, so unlike
 * verification this adapter needs scoped IAM credentials; it is invoked best-effort after the AMPM user
 * commits, never inside a request transaction. It is idempotent: a user that already exists is reconciled,
 * so the reinvite recovery path is safe to retry. The invite email is suppressed — AMPM sends its own.
 */
export class CognitoIdentityProvisioner implements IdentityProvisioner {
  private readonly client: CognitoIdentityProviderClient;

  constructor(
    private readonly options: CognitoProvisionerOptions,
    client?: CognitoIdentityProviderClient,
  ) {
    this.client =
      client ??
      new CognitoIdentityProviderClient({
        region: options.region,
        ...(options.credentials ? { credentials: options.credentials } : {}),
      });
  }

  async provisionUser(input: ProvisionUserInput): Promise<void> {
    const username = usernameFor(input);
    const attributes = verifiedAttributes(input);
    await this.ensureUser(username, attributes);
    if (input.kind === "client") {
      // A client signs in passwordless by OTP (CUSTOM_AUTH, §5); a random permanent password only moves
      // the account to CONFIRMED so the custom-auth flow can run. It is never surfaced, delivered or stored.
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.options.userPoolId,
          Username: username,
          Password: randomPassword(),
          Permanent: true,
        }),
      );
    }
  }

  /** Create the user with its invite email suppressed; reconcile the verified contacts if it already exists. */
  private async ensureUser(username: string, attributes: AttributeType[]): Promise<void> {
    try {
      await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.options.userPoolId,
          Username: username,
          MessageAction: "SUPPRESS",
          UserAttributes: attributes,
        }),
      );
    } catch (error) {
      if (!(error instanceof UsernameExistsException)) throw error;
      // Idempotent recovery (the reinvite path): keep the verified contacts converged on a retry.
      await this.client.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: this.options.userPoolId,
          Username: username,
          UserAttributes: attributes,
        }),
      );
    }
  }
}

/** A client's username is their phone (their sign-in handle); staff sign in by email. */
function usernameFor(input: ProvisionUserInput): string {
  if (input.kind === "client") {
    if (!input.phone)
      throw new Error("a client login needs a phone number to provision OTP sign-in");
    return input.phone;
  }
  return input.email;
}

/**
 * Both contacts are stamped verified administratively: the email because activation matches the
 * invitation's email exactly (D-041) and a client never types one; the phone because it is the client's
 * sign-in handle. Staff authenticate by email only, so no phone is stamped.
 */
function verifiedAttributes(input: ProvisionUserInput): AttributeType[] {
  const attributes: AttributeType[] = [
    { Name: "email", Value: input.email },
    { Name: "email_verified", Value: "true" },
  ];
  if (input.kind === "client" && input.phone) {
    attributes.push(
      { Name: "phone_number", Value: input.phone },
      { Name: "phone_number_verified", Value: "true" },
    );
  }
  return attributes;
}

/**
 * A random password that satisfies the pool policy (≥12 chars with an upper, lower, digit and symbol).
 * Used only to confirm a passwordless client account; never surfaced, delivered or stored.
 */
function randomPassword(): string {
  return `Aa1!${randomBytes(24).toString("base64url")}`;
}
