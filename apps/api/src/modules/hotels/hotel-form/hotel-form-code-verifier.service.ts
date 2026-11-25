import { Inject, Injectable } from "@nestjs/common";
import type { HotelFormVerified, HotelFormVerifyRequest } from "@ampm/core";

import { oneTimeCodeMatches } from "../../../identity/one-time-code.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../../identity/sign-in-keys.js";
import type { FormClient } from "./hotel-form-code-issuer.service.js";
import { HotelFormChallengesRepository } from "./hotel-form-challenges.repository.js";
import { HotelFormEnrolment } from "./hotel-form-enrolment.service.js";
import { HotelFormGate } from "./hotel-form-gate.js";
import { invalidCode } from "./hotel-form-refusal.js";

/**
 * Tries a hotel form code (D-189 §2 and §4). The link must be open to the form (the gate), the challenge
 * this request's and on its current link; a try is then reserved by an atomic increment before the code
 * is compared in constant time, so guesses sent at once share the five. A wrong code that spends the last
 * try retires the challenge at once, clearing its claim. A right one goes to the enrolment, which makes
 * the person, records the consent and opens the session in one transaction.
 */
@Injectable()
export class HotelFormCodeVerifier {
  constructor(
    private readonly gate: HotelFormGate,
    private readonly challenges: HotelFormChallengesRepository,
    private readonly enrolment: HotelFormEnrolment,
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys,
  ) {}

  async verify(
    body: HotelFormVerifyRequest,
    client: FormClient,
    now: Date = new Date(),
  ): Promise<HotelFormVerified> {
    const { policy, request } = await this.gate.openLink(body.token, now);
    const challenge = await this.challenges.find(body.challengeId, request.id);
    if (challenge === null || challenge.linkGeneration !== request.tokenGeneration) {
      throw invalidCode();
    }
    if (!(await this.challenges.reserveTry(challenge.id, now))) throw invalidCode();
    const key = this.keys.hotelFormCode;
    if (!oneTimeCodeMatches(challenge.id, body.oneTimeCode, challenge.codeHmac, key)) {
      await this.challenges.retireIfSpent(challenge.id, now);
      throw invalidCode();
    }
    return this.enrolment.enrol({ requestId: request.id, policy, challenge, ip: client.ip }, now);
  }
}
