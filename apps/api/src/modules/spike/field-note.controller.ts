import { Controller, Get, Post } from "@nestjs/common";
import {
  fieldNoteUpsert,
  uuid,
  type FieldNoteList,
  type FieldNoteUpsert,
  type FieldNoteUpsertResult,
} from "@ampm/core";
import { z } from "zod";

import type { Access } from "../../common/request-context.js";
import { ZodBody, ZodParams } from "../../common/zod.js";
import { recordScope } from "../../db/scoping.js";
import { CurrentAccess, CurrentPrincipal, RequirePermission } from "../../policy/decorators.js";
import { toPolicyPrincipal, type Principal } from "../../policy/principal.types.js";
import { FieldNoteService } from "./field-note.service.js";

const projectParams = z.object({ projectId: uuid });
type ProjectParams = z.infer<typeof projectParams>;

/**
 * SPIKE STAND-IN — sprint 2 offline spike (docs/review/build-plan.md §11.4). The offline-capable
 * mutation end to end, behind the real pipeline: the global AuthGuard resolves the principal and the
 * PermissionGuard checks the incidents key scoped to the project (a staff member records incidents on
 * an assigned wedding — offline.md's example of a write that must work with no signal); the service
 * asks for the update key before a write changes a note that exists. The project
 * id and the body are validated at the edge (api.md) by the Zod decorators; a bad value is the
 * typed validation_failed error AppErrorFilter answers as a 400. Removed when the real operational records
 * arrive.
 */
@Controller("spike/projects/:projectId/field-notes")
export class FieldNoteController {
  constructor(private readonly notes: FieldNoteService) {}

  /** The reads the app refreshes into its local store, inside the scope the guard resolved. */
  @Get()
  @RequirePermission("tasks.incidents.read", { projectParam: "projectId" })
  list(
    @ZodParams(projectParams) params: ProjectParams,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): FieldNoteList {
    return this.notes.list(params.projectId, recordScope(principal, access.scope));
  }

  /**
   * One queued write; idempotent on (id, baseVersion) for the same writer, so a replayed queue
   * never duplicates. The guard checks the create key; changing a note that exists also needs the
   * update key (service).
   */
  @Post()
  @RequirePermission("tasks.incidents.create", { projectParam: "projectId" })
  upsert(
    @ZodParams(projectParams) params: ProjectParams,
    @ZodBody(fieldNoteUpsert) body: FieldNoteUpsert,
    @CurrentPrincipal() principal: Principal,
  ): FieldNoteUpsertResult {
    return this.notes.upsert(params.projectId, body, toPolicyPrincipal(principal));
  }
}
