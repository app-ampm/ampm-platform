import type { IdentityProvisioner, ProvisionUserInput } from "./identity.types.js";

/**
 * Development and tests (the dev-login path): there is no external identity service to provision against —
 * local tokens are minted from the seed, not from a provider account — so provisioning is a no-op. The
 * invite flow under `IDENTITY_PROVIDER=local` is therefore unchanged.
 */
export class LocalIdentityProvisioner implements IdentityProvisioner {
  provisionUser(_input: ProvisionUserInput): Promise<void> {
    return Promise.resolve();
  }
}
