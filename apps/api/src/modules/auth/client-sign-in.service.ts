import { Injectable } from "@nestjs/common";
import {
  errors,
  SIGN_IN_ERRORS,
  type ClientCodeRequest,
  type ClientCodeSent,
  type ClientSignInRequest,
  type SignInGrant,
} from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { ClientCodes } from "./client-codes.service.js";
import { CredentialsRepository } from "./credentials.repository.js";
import { CLIENT_TOKEN_TTL, SignInGrants } from "./sign-in-grant.js";

/**
 * Client sign-in by a one-time code to the mobile AMPM has on file (D-147). No password and no sign-up:
 * only an active client account with exactly that mobile can sign in.
 * - Asking for a code answers the same for any number, and texts nobody but a client. With the code
 *   off screen the answer goes back at once and the lookup and the SMS happen after it, as the password
 *   reset does, so not even its timing tells which numbers have accounts. While codes are shown on screen
 *   (temporary, behind the curtain) a known number's answer carries its code, by design.
 * - Every refusal of a code, a number with no client included, reads the same.
 */
@Injectable()
export class ClientSignInService {
  constructor(
    private readonly codes: ClientCodes,
    private readonly credentials: CredentialsRepository,
    private readonly grants: SignInGrants,
    private readonly logger: AppLogger,
  ) {}

  /** Sends a sign-in code to the client with this mobile, if there is exactly one. */
  async requestCode(request: ClientCodeRequest): Promise<ClientCodeSent> {
    this.codes.signer();
    await this.codes.allow(request.phone);
    if (this.codes.showsOnScreen()) return this.sendIfClient(request.phone);
    void this.sendIfClient(request.phone).catch((error: unknown) =>
      this.logger.warn("auth.client_code_send_failed", { error: String(error) }),
    );
    return this.codes.nothingSent();
  }

  /** Exchanges the mobile and its live code for a client session. */
  async signIn(request: ClientSignInRequest, now: Date = new Date()): Promise<SignInGrant> {
    this.codes.signer();
    const client = await this.credentials.findActiveClientByPhone(request.phone);
    if (!client) throw errors.unauthenticated(SIGN_IN_ERRORS.invalidClientCode);
    await this.codes.verify(client.id, request.code);
    return this.grants.grant(client, now, CLIENT_TOKEN_TTL);
  }

  private async sendIfClient(phone: string): Promise<ClientCodeSent> {
    const client = await this.credentials.findActiveClientByPhone(phone);
    return client ? this.codes.send(client) : this.codes.nothingSent();
  }
}
