import { Injectable } from "@nestjs/common";
import { errors } from "@ampm/core";

import { PrismaService } from "../db/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";

/** What a module supplies to provision a client login for one of its records. */
export interface ProvisionInvitedClientInput {
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly createdBy: string;
}

/**
 * Kernel identity service for provisioning client logins. The kernel owns the `users` table, so business
 * modules (CRM conversion, feature 8.2) call this rather than writing `users` directly — the downward
 * module boundary holds (architecture §5, api.md). The user is created `invited`/`client` and activates
 * later through the existing `/auth/activate` flow (feature 5.2, AUTH-02); there is no self-registration
 * (security.md).
 */
@Injectable()
export class ClientUserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an `invited` client user. Runs in the caller's transaction so the user, its invite token and
   * the owning record commit together. A duplicate email is a 409 — reusing one client across accounts
   * (A-5) is a later increment.
   */
  async provisionInvitedClient(
    input: ProvisionInvitedClientInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<{ userId: string }> {
    try {
      const user = await client.user.create({
        data: {
          userType: "client",
          name: input.name,
          email: input.email,
          status: "invited",
          createdBy: input.createdBy,
          ...(input.phone ? { phone: input.phone } : {}),
        },
        select: { id: true },
      });
      return { userId: user.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict("A user with that email already exists");
      }
      throw error;
    }
  }
}
