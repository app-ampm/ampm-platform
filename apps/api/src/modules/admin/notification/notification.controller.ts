import { Controller, Get } from "@nestjs/common";
import { cursorQuery, type CursorQuery, type NotificationView } from "@ampm/core";

import type { Access } from "../../../common/request-context.js";
import { ZodQuery } from "../../../common/zod.js";
import { CurrentAccess, CurrentPrincipal, RequirePermission } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { NotificationService } from "./notification.service.js";

/**
 * `GET /notifications` — the signed-in user's own notifications (the in-app inbox). Gated by
 * `admin.notifications.read`: a normal staff role holds it at own scope, so the repository returns
 * only the caller's; the Super Admin holds it at all scope and reads the whole user log
 * (permission-matrix §5.1). Client reads wait for the client-authorisation path (guard is staff-only).
 */
@Controller("notifications")
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @RequirePermission("admin.notifications.read")
  list(
    @ZodQuery(cursorQuery) query: CursorQuery,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<{ items: NotificationView[]; nextCursor: string | null }> {
    return this.notifications.listOwn(principal, access.scope, query);
  }
}
