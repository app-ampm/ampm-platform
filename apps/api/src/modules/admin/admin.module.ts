import { Module } from "@nestjs/common";

import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";

/** Module A: identity, access and administration. `/me` first; users, roles and configurations follow. */
@Module({ controllers: [MeController], providers: [MeService] })
export class AdminModule {}
