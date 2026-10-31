import { Module } from "@nestjs/common";

import { ENV, type Env } from "../env.js";
import { AuthTokenService } from "./auth-token.service.js";
import { CognitoIdentityAdapter } from "./cognito.adapter.js";
import { IDENTITY_ADAPTER, type IdentityAdapter } from "./identity.types.js";
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
    AuthTokenService,
  ],
  exports: [IDENTITY_ADAPTER, AuthTokenService],
})
export class IdentityModule {}
