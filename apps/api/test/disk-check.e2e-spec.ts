import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import type { UserStatus, UserType } from "../src/generated/prisma/client.js";
import { DiskCheckRepository } from "../src/modules/admin/disk-check/disk-check.repository.js";
import { DISK_CHECK_JOB_NAME, GIB } from "../src/modules/admin/disk-check/disk-check.rules.js";
import { DiskCheckService } from "../src/modules/admin/disk-check/disk-check.service.js";
import { DiskSpaceProbe } from "../src/modules/admin/disk-check/disk-space.probe.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-disk-";
const T0 = new Date("2026-11-24T10:00:00.000Z");
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const after = (ms: number) => new Date(T0.getTime() + ms);
const DISK_NOTICES = { templateKey: { startsWith: "system.disk_" } };

/**
 * The worker's disk check (D-177) against the migrated test database: who it tells, the notices it
 * writes (in-app and email for an alert, in-app only for the recovery), and its alert history, read back
 * from `job_runs` by JSON path, so a restarted application neither repeats an alert nor forgets one. The
 * free space is set through the probe; the rules themselves are in the unit specs. Synthetic users only.
 */
describe("The disk check (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const users: Record<string, string> = {};

  /** Starts (or restarts) the application with the disk reporting `freeGiB` free. */
  async function start(freeGiB: number): Promise<DiskCheckService> {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    setFree(freeGiB);
    return app.get(DiskCheckService);
  }
  function setFree(freeGiB: number): void {
    vi.spyOn(app.get(DiskSpaceProbe), "measure").mockResolvedValue({
      freeBytes: freeGiB * GIB,
      totalBytes: 193 * GIB,
    });
  }
  /** A user's disk notices as [channel, template, status], sorted. */
  async function noticesOf(name: string): Promise<string[][]> {
    const rows = await prisma.notification.findMany({
      where: { recipientId: users[name], ...DISK_NOTICES },
      select: { channel: true, templateKey: true, status: true },
    });
    return rows.map((row) => [row.channel, row.templateKey, row.status]).sort();
  }
  async function person(name: string, roleKey: string, extra: PersonExtra = {}): Promise<void> {
    const role = await prisma.role.findFirstOrThrow({ where: { roleKey } });
    const user = await prisma.user.create({
      data: {
        userType: extra.userType ?? "staff",
        name: `E2E Disk ${name}`,
        email: `${PREFIX}${name}@example.com`,
        status: extra.status ?? "active",
        identitySubject: `${PREFIX}${name}`,
        deletedAt: extra.deletedAt ?? null,
        roles: { create: { roleId: role.id } },
      },
    });
    users[name] = user.id;
  }
  async function clean(): Promise<void> {
    await prisma.notification.deleteMany({ where: DISK_NOTICES });
    await prisma.jobRun.deleteMany({ where: { jobName: DISK_CHECK_JOB_NAME } });
    const ids = (
      await prisma.user.findMany({
        where: { identitySubject: { startsWith: PREFIX } },
        select: { id: true },
      })
    ).map((user) => user.id);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    await start(30);
    await clean();
    await person("sa", "super_admin");
    await person("ht", "hotel_team");
    await person("ht-disabled", "hotel_team", { status: "disabled" });
    await person("sa-deleted", "super_admin", { deletedAt: new Date() });
    await person("sales", "sales");
    await person("client", "hotel_team", { userType: "client" });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await clean();
    await app.close();
  });

  it("tells the active staff who hold the Super Admin or Hotel team role, and no one else", async () => {
    const ids = await app.get(DiskCheckRepository).recipientIds();
    expect(ids).toEqual(expect.arrayContaining([users["sa"], users["ht"]]));
    for (const other of ["ht-disabled", "sa-deleted", "sales", "client"]) {
      expect(ids).not.toContain(users[other]);
    }
  });

  it("alerts once, keeps quiet across a restart, reminds a day later and sends one recovery", async () => {
    let check = app.get(DiskCheckService);
    setFree(8);
    expect(await check.run(T0)).toEqual({
      freeBytes: 8 * GIB,
      totalBytes: 193 * GIB,
      level: "critical",
      alerted: true,
    });
    const alert = [
      ["email", "system.disk_critical", "sent"],
      ["in_app", "system.disk_critical", "delivered"],
    ];
    expect(await noticesOf("sa")).toEqual(alert);
    expect(await noticesOf("ht")).toEqual(alert);
    expect(await noticesOf("ht-disabled")).toEqual([]);
    expect(await noticesOf("sales")).toEqual([]);
    expect((await check.run(after(15 * MINUTE))).alerted).toBe(false);

    await app.close();
    check = await start(8);
    expect((await check.run(after(30 * MINUTE))).alerted).toBe(false);
    expect(await noticesOf("sa")).toEqual(alert);

    expect((await check.run(after(24 * HOUR))).alerted).toBe(true);
    expect(await noticesOf("sa")).toHaveLength(4);

    setFree(30);
    expect(await check.run(after(24 * HOUR + 15 * MINUTE))).toMatchObject({
      level: "ok",
      alerted: true,
    });
    const recovered = (await noticesOf("ht")).filter(([, key]) => key === "system.disk_recovered");
    expect(recovered).toEqual([["in_app", "system.disk_recovered", "delivered"]]);
    expect((await check.run(after(24 * HOUR + 30 * MINUTE))).alerted).toBe(false);

    const runs = await prisma.jobRun.findMany({
      where: { jobName: DISK_CHECK_JOB_NAME },
      orderBy: { startedAt: "asc" },
    });
    expect(runs.map((run) => [run.idempotencyKey, run.status])).toEqual([
      ["system.disk_check.2026-11-24T10:00", "succeeded"],
      ["system.disk_check.2026-11-24T10:15", "succeeded"],
      ["system.disk_check.2026-11-24T10:30", "succeeded"],
      ["system.disk_check.2026-11-25T10:00", "succeeded"],
      ["system.disk_check.2026-11-25T10:15", "succeeded"],
      ["system.disk_check.2026-11-25T10:30", "succeeded"],
    ]);
    expect(runs.map((run) => run.detailJson)).toContainEqual({
      freeBytes: 30 * GIB,
      totalBytes: 193 * GIB,
      level: "ok",
      alerted: false,
    });
  });

  it("records a failed measurement and alerts no one", async () => {
    await prisma.jobRun.deleteMany({ where: { jobName: DISK_CHECK_JOB_NAME } });
    await prisma.notification.deleteMany({ where: DISK_NOTICES });
    vi.spyOn(app.get(DiskSpaceProbe), "measure").mockRejectedValue(
      new Error("ENOENT: no such file or directory, statfs"),
    );
    await expect(app.get(DiskCheckService).run(after(48 * HOUR))).rejects.toThrow("ENOENT");
    const runs = await prisma.jobRun.findMany({ where: { jobName: DISK_CHECK_JOB_NAME } });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "failed", detailJson: null });
    expect(runs[0]?.error).toContain("ENOENT");
    expect(await prisma.notification.count({ where: DISK_NOTICES })).toBe(0);
  });
});

interface PersonExtra {
  readonly status?: UserStatus;
  readonly userType?: UserType;
  readonly deletedAt?: Date;
}
