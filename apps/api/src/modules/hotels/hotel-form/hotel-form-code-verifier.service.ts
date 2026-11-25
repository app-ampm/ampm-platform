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
 * is compared in constant time, so guesses sent at once share the five. A right code goes to the enrolment,
 * which makes the person, records the consent and opens the session in one transaction. Whenever a try is
 * refused (a wrong code, or a right one the enrolment refuses and rolls back) and it was the last, the
 * challenge is retired at once, clearing its claim; a try that finds no try left retires it too, so a retire
 * that failed before is repaired then.
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
    if (!(await this.challenges.reserveTry(challenge.id, now))) {
      await this.retireIfSpent(challenge.id, now);
      throw invalidCode();
    }
    const key = this.keys.hotelFormCode;
    if (!oneTimeCodeMatches(challenge.id, body.oneTimeCode, challenge.codeHmac, key)) {
      await this.retireIfSpent(challenge.id, now);
      throw invalidCode();
    }
    try {
      return await this.enrolment.enrol(
        { requestId: request.id, policy, challenge, ip: client.ip },
        now,
      );
    } catch (refusal) {
      // The enrolment rolled back but its try stays spent: if that was the last, nothing can use the claim.
      await this.retireIfSpent(challenge.id, now);
      throw refusal;
    }
  }

  /**
   * Retires the challenge if its tries are spent, clearing its claim. A retire that fails leaves the answer
   * as it was: the challenge's next try repairs it, or the hourly sweep once its code expires.
   */
  private async retireIfSpent(id: string, now: Date): Promise<void> {
    await this.challenges.retireIfSpent(id, now).catch(() => false);
  }
}
