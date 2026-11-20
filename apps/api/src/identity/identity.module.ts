import { Module } from "@nestjs/common";

import { ENV, type Env } from "../env.js";
import { AuthTokenService } from "./auth-token.service.js";
import { ClientUserService } from "./client-user.service.js";
import { IDENTITY_ADAPTER, type IdentityAdapter } from "./identity.types.js";
import { SIGN_IN_KEYS, signInKeysFor, type SignInKeys } from "./sign-in-keys.js";

/**
 * Identity is the API's own (D-142): the adapter verifies the tokens the API's signer minted, under the
 * development provider (`local`) or AMPM's own sign-in (`ampm`), whose keys the environment decides.
 */
@Module({
  providers: [
    { provide: SIGN_IN_KEYS, inject: [ENV], useFactory: (env: Env) => signInKeysFor(env) },
    {
      provide: IDENTITY_ADAPTER,
      inject: [SIGN_IN_KEYS],
      useFactory: (keys: SignInKeys): IdentityAdapter => keys.tokens,
    },
    AuthTokenService,
    ClientUserService,
  ],
  exports: [IDENTITY_ADAPTER, SIGN_IN_KEYS, AuthTokenService, ClientUserService],
})
export class IdentityModule {}
