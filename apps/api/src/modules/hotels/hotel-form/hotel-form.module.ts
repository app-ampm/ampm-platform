import { Module } from "@nestjs/common";

import { BotCheckModule } from "../../../common/bot-check/bot-check.module.js";
import { IdentityModule } from "../../../identity/identity.module.js";
import { PolicyModule } from "../../../policy/policy.module.js";
import { NotificationModule } from "../../admin/notification/notification.module.js";
import { HotelsModule } from "../hotels.module.js";
import { HotelFormChallengeSweepService } from "./hotel-form-challenge-sweep.service.js";
import { HotelFormChallengesRepository } from "./hotel-form-challenges.repository.js";
import { HotelFormCodeIssuer } from "./hotel-form-code-issuer.service.js";
import { HotelFormCodeVerifier } from "./hotel-form-code-verifier.service.js";
import { HotelFormEnrolment } from "./hotel-form-enrolment.service.js";
import { HotelFormGate } from "./hotel-form-gate.js";
import { HotelFormLimits } from "./hotel-form-limits.js";
import { HotelFormMe } from "./hotel-form-me.service.js";
import { HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import { HotelFormSessionGuard } from "./hotel-form-session.guard.js";
import { HotelFormSessionsRepository } from "./hotel-form-sessions.repository.js";
import { HotelFormSessions } from "./hotel-form-sessions.service.js";
import { HotelFormSmsCapAlert } from "./hotel-form-sms-cap-alert.js";
import { HotelFormController } from "./hotel-form.controller.js";

/**
 * The hotel form's identity step (D-189; Module C, docs/data-model.md §5): the public `/hotel-form` routes,
 * their code challenges, people, consents and sessions, the limits of D-189 §3, and the hourly sweep of
 * abandoned claims. IdentityModule gives the hotel form's keys (SIGN_IN_KEYS), PolicyModule the limiter's
 * store, BotCheckModule the bot check, NotificationModule the code's SMS and the cap's alert, and
 * HotelsModule the requests' journal. PrismaService, ConfigService, JobQueue, AuditService, ENV and
 * AppLogger are global.
 */
@Module({
  imports: [HotelsModule, IdentityModule, PolicyModule, BotCheckModule, NotificationModule],
  controllers: [HotelFormController],
  providers: [
    HotelFormRequestsRepository,
    HotelFormChallengesRepository,
    HotelFormPeopleRepository,
    HotelFormSessionsRepository,
    HotelFormGate,
    HotelFormLimits,
    HotelFormSmsCapAlert,
    HotelFormCodeIssuer,
    HotelFormCodeVerifier,
    HotelFormEnrolment,
    HotelFormSessions,
    HotelFormSessionGuard,
    HotelFormMe,
    HotelFormChallengeSweepService,
  ],
})
export class HotelFormModule {}
