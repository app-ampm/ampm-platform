import { Module } from "@nestjs/common";

import { ENV, type Env } from "../env.js";
import { AuthTokenService } from "./auth-token.service.js";
import { ClientUserService } from "./client-user.service.js";
import { CognitoIdentityProvisioner } from "./cognito-provisioner.adapter.js";
import { CognitoIdentityAdapter } from "./cognito.adapter.js";
import {
  IDENTITY_ADAPTER,
  IDENTITY_PROVISIONER,
  type IdentityAdapter,
  type IdentityProvisioner,
} from "./identity.types.js";
import { LocalIdentityProvisioner } from "./local-provisioner.adapter.js";
import { LocalIdentityAdapter } from "./local.adapter.js";

/** One adapter per provider behind one interface (api.md); the environment picks the implementation. */
@Module({
  providers: [
    {
      provide: IDENTITY_ADAPTER,
      inject: [ENV],
      useFactory: (env: Env): IdentityAdapter => {
        if (env.IDENTITY_PROVIDER === "local")
          return new LocalIdentityAdapter(env.IDENTITY_LOCAL_SECRET ?? "");
        return new CognitoIdentityAdapter({
          region: env.COGNITO_REGION ?? "",
          userPoolId: env.COGNITO_USER_POOL_ID ?? "",
          clientId: env.COGNITO_CLIENT_ID ?? "",
        });
      },
    },
    {
      // The control-plane provisioner (cognito-setup §6): local is a no-op; Cognito uses the admin SDK with
      // the optional scoped IAM credentials. Absent credentials fall back to the default AWS chain, so a
      // verify-only node still boots — a provisioning call then fails best-effort and is logged, not fatal.
      provide: IDENTITY_PROVISIONER,
      inject: [ENV],
      useFactory: (env: Env): IdentityProvisioner => {
        if (env.IDENTITY_PROVIDER === "local") return new LocalIdentityProvisioner();
        return new CognitoIdentityProvisioner({
          region: env.COGNITO_REGION ?? "",
          userPoolId: env.COGNITO_USER_POOL_ID ?? "",
          ...(env.COGNITO_PROVISIONING_ACCESS_KEY_ID && env.COGNITO_PROVISIONING_SECRET_ACCESS_KEY
            ? {
                credentials: {
                  accessKeyId: env.COGNITO_PROVISIONING_ACCESS_KEY_ID,
                  secretAccessKey: env.COGNITO_PROVISIONING_SECRET_ACCESS_KEY,
                },
              }
            : {}),
        });
      },
    },
    AuthTokenService,
    ClientUserService,
  ],
  exports: [IDENTITY_ADAPTER, IDENTITY_PROVISIONER, AuthTokenService, ClientUserService],
})
export class IdentityModule {}
