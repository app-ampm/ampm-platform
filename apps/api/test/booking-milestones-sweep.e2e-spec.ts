import type { NestExpressApplication } from "@nestjs/platform-express";
import { STAFF_ROLES } from "@ampm/policy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { MilestoneOverdueService } from "../src/modules/consultancy/milestones.overdue.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-MileSweep";
const PREFIX = "e2e-milesweep";
const OVERDUE_JOB = "consultancy.booking_milestone.overdue_sweep";
const OVERDUE_TEMPLATE = "consultancy.milestone_overdue";

/**
 * Module D feature 10.5 — the booking-milestone overdue sweep end to end: a past-due pending milestone is
 * marked `overdue` and its enquiry's assignee is notified exactly once (a rerun is a no-op), the
 * pending→overdue transition is audited under the sweep's system context, and the sweep is recorded on a
 * job_runs row. Seeded directly through Prisma (the create/read routes are covered in the main spec).
 */
describe("Booking-milestone overdue sweep (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let htUserId: string;
  let enquiryId: string;

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    const enquiries = await prisma.hotelEnquiry.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true },
    });
    const enquiryIds = enquiries.map((e) => e.id);
    await prisma.bookingMilestone.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.jobRun.deleteMany({ where: { jobName: OVERDUE_JOB } });
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const htUser = await prisma.user.create({
      data: {
        userType: "staff",
        name: `${TAG} HT`,
        email: `${PREFIX}-ht@example.com`,
        status: "active",
        identitySubject: `local:${PREFIX}-ht`,
      },
      select: { id: true },
    });
    htUserId = htUser.id;
    const role = await prisma.role.findUniqueOrThrow({ where: { roleKey: STAFF_ROLES.HT.key } });
    await prisma.userRole.create({ data: { userId: htUserId, roleId: role.id } });
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} Account`, status: "active" },
      select: { id: true },
    });
    enquiryId = (
      await prisma.hotelEnquiry.create({
        data: {
          accountId: account.id,
          hotelId: "00000000-0000-7000-8000-0000000000a1",
          requestedByUserId: htUserId,
          assignedUserId: htUserId,
          dateFrom: new Date("2027-02-14"),
          dateTo: new Date("2027-02-16"),
          guestEstimate: 120,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("marks a past-due milestone overdue, notifies the assignee once, and audits the transition", async () => {
    const milestone = await prisma.bookingMilestone.create({
      data: {
        enquiryId,
        milestoneType: "balance_due",
        status: "pending",
        dueAt: new Date("2020-01-01T00:00:00.000Z"),
      },
      select: { id: true },
    });
    const sweep = app.get(MilestoneOverdueService);
    const now = new Date();

    expect(await sweep.runSweep(now)).toBeGreaterThanOrEqual(1);
    const marked = await prisma.bookingMilestone.findUniqueOrThrow({ where: { id: milestone.id } });
    expect(marked.status).toBe("overdue");

    await sweep.runSweep(now); // a rerun marks nothing and does not re-notify
    const notices = await prisma.notification.count({
      where: { recipientId: htUserId, templateKey: OVERDUE_TEMPLATE, entityId: milestone.id },
    });
    expect(notices).toBe(1);
    expect(await prisma.jobRun.count({ where: { jobName: OVERDUE_JOB } })).toBeGreaterThanOrEqual(
      2,
    );
    const audited = await prisma.auditEvent.count({
      where: { entityType: "booking_milestone", entityId: milestone.id, action: "update" },
    });
    expect(audited).toBeGreaterThanOrEqual(1);
  });
});
