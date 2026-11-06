import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";

/** A service-type catalogue row as read for the reference list (data-model §4). */
export interface ServiceTypeRow {
  readonly id: string;
  readonly serviceKey: string;
  readonly name: string;
  readonly category: string;
}

@Injectable()
export class ServiceTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The active, non-deleted service types, by name — the only ones an agreement may be drafted against. */
  async listActive(): Promise<ServiceTypeRow[]> {
    return this.prisma.serviceType.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, serviceKey: true, name: true, category: true },
    });
  }
}
