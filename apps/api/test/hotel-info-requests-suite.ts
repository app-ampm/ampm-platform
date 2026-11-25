import { randomBytes } from "node:crypto";

import { CONFIG_REGISTRY, type HotelFormPolicy } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";

import { PrismaService } from "../src/db/prisma.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { startApi, type CustomiseApi } from "./start-api.js";

/*
 * The hotel information requests' e2e suites (D-188 §3 to §5): a running API with a token for each
 * role, a destination with an active and a draft hotel, the staff routes as each role, the hotel form's
 * mode switched in the configuration row (read past the cache), and the clean-up of everything a suite
 * made: its requests, their events, emails and audits, its hotels and destination, and the policy as it
 * was. Synthetic data only. Imported by tests only.
 */

/** The roles the suites call as. */
export type Role = "sa" | "ht" | "sm" | "pm" | "cd" | "fa" | "client";

const ROLES: readonly Role[] = ["sa", "ht", "sm", "pm", "cd", "fa", "client"];

const SUBJECTS: Readonly<Record<Role, string>> = {
  sa: "local:admin",
  ht: "local:ht",
  sm: "local:sm",
  pm: "local:pm",
  cd: "local:cd",
  fa: "local:fa",
  client: "local:client",
};

/** A suite's running API and what it made. */
export interface RequestSuite {
  readonly app: NestExpressApplication;
  readonly prisma: PrismaService;
  readonly bearer: Readonly<Record<Role, string>>;
  readonly destinationId: string;
  /** An active hotel and a draft one, for the suite's requests. */
  readonly hotelId: string;
  readonly draftHotelId: string;
  /** The slug prefix of the suite's destination and hotels. */
  readonly prefix: string;
  /** The stored hotel_form.policy before the suite, put back after it (null: there was no row). */
  readonly policyBefore: Prisma.JsonValue | null;
}

/** A new hotel in the suite's destination, written straight to the table. */
export async function newSuiteHotel(
  suite: Pick<RequestSuite, "prisma" | "destinationId" | "prefix">,
  suffix: string,
  extra: Partial<Prisma.HotelUncheckedCreateInput> = {},
): Promise<string> {
  const hotel = await suite.prisma.hotel.create({
    data: {
      destinationId: suite.destinationId,
      name: `E2E Request Hotel ${suffix}`,
      slug: `${suite.prefix}${suffix}`,
      ...extra,
    },
  });
  return hotel.id;
}

/**
 * Starts the API (customised first, when asked), mints each role's token and makes the suite's
 * destination and two hotels.
 *
 * @example
 * beforeAll(async () => (suite = await startRequestSuite("e2e-hir-a-")));
 */
export async function startRequestSuite(
  name: string,
  customise?: CustomiseApi,
): Promise<RequestSuite> {
  const { app, mint } = await startApi(customise);
  const prisma = app.get(PrismaService);
  const prefix = `${name}${randomBytes(3).toString("hex")}-`;
  const bearer: Record<Role, string> = {
    sa: "",
    ht: "",
    sm: "",
    pm: "",
    cd: "",
    fa: "",
    client: "",
  };
  for (const role of ROLES) bearer[role] = `Bearer ${await mint(SUBJECTS[role])}`;
  const destination = await prisma.destination.create({
    data: { name: `E2E Request Coast ${prefix}`, slug: `${prefix}coast`, country: "India" },
  });
  const made = { prisma, destinationId: destination.id, prefix };
  const hotelId = await newSuiteHotel(made, "active", { status: "active" });
  const draftHotelId = await newSuiteHotel(made, "draft", { status: "draft" });
  const stored = await prisma.configuration.findUnique({
    where: { configKey: "hotel_form.policy" },
  });
  return { app, ...made, bearer, hotelId, draftHotelId, policyBefore: stored?.valueJson ?? null };
}

/** How many rows of each table hold a text anywhere: where a link's secret must never be. */
export async function rowsHolding(
  prisma: PrismaService,
  text: string,
): Promise<Record<"requests" | "events" | "audits" | "notifications", number>> {
  const pattern = `%${text}%`;
  const [counts] = await prisma.$queryRaw<
    { requests: bigint; events: bigint; audits: bigint; notifications: bigint }[]
  >`
    SELECT
      (SELECT count(*) FROM hotel_info_requests t WHERE t::text LIKE ${pattern}) AS requests,
      (SELECT count(*) FROM hotel_info_request_events t WHERE t::text LIKE ${pattern}) AS events,
      (SELECT count(*) FROM audit_events t WHERE t::text LIKE ${pattern}) AS audits,
      (SELECT count(*) FROM notifications t WHERE t::text LIKE ${pattern}) AS notifications`;
  return {
    requests: Number(counts?.requests ?? -1),
    events: Number(counts?.events ?? -1),
    audits: Number(counts?.audits ?? -1),
    notifications: Number(counts?.notifications ?? -1),
  };
}

/** The secret of a link a create or reissue answered. */
export function secretOf(url: string): string {
  return url.slice(url.indexOf("#k=") + 3);
}

/** Switches the hotel form's policy in its row, as a Super Admin would; read fresh, it applies at once. */
export async function setFormPolicy(
  suite: RequestSuite,
  policy: Partial<HotelFormPolicy>,
): Promise<void> {
  const value = { ...CONFIG_REGISTRY["hotel_form.policy"].default, ...policy };
  await suite.prisma.configuration.upsert({
    where: { configKey: "hotel_form.policy" },
    create: { configKey: "hotel_form.policy", valueJson: value, scope: "global" },
    update: { valueJson: value },
  });
}

/** Removes what the suite made, puts the policy back and stops the API. */
export async function stopRequestSuite(suite: RequestSuite): Promise<void> {
  const { prisma } = suite;
  const hotels = await prisma.hotel.findMany({
    where: { slug: { startsWith: suite.prefix } },
    select: { id: true },
  });
  const hotelIds = hotels.map((hotel) => hotel.id);
  const mine = {
    OR: [{ hotelId: { in: hotelIds } }, { proposedDestinationId: suite.destinationId }],
  };
  const requests = await prisma.hotelInfoRequest.findMany({ where: mine, select: { id: true } });
  const ids = requests.map((row) => row.id);
  await prisma.notification.deleteMany({ where: { recipientId: { in: ids } } });
  await prisma.auditEvent.deleteMany({
    where: { entityId: { in: [...ids, ...hotelIds] } },
  });
  await prisma.hotelInfoRequestEvent.deleteMany({ where: { requestId: { in: ids } } });
  await prisma.hotelInfoRequest.deleteMany({ where: { id: { in: ids } } });
  await prisma.hotel.deleteMany({ where: { id: { in: hotelIds } } });
  await prisma.destination.deleteMany({ where: { id: suite.destinationId } });
  const value = suite.policyBefore ?? CONFIG_REGISTRY["hotel_form.policy"].default;
  await prisma.configuration.update({
    where: { configKey: "hotel_form.policy" },
    data: { valueJson: value },
  });
  await suite.app.close();
}

/**
 * The staff routes of hotel information requests, as a role.
 *
 * @example
 * const { create } = requestCalls(() => suite);
 * await create("ht", { target: "existing", hotelId }).expect(201);
 */
export function requestCalls(suite: () => RequestSuite) {
  const http = () => request(suite().app.getHttpServer());
  const as = (role: Role) => suite().bearer[role];
  return {
    create: (role: Role, body: object) =>
      http().post("/hotels-admin/info-requests").set("Authorization", as(role)).send(body),
    reissue: (role: Role, id: string, body: object = {}) =>
      http()
        .post(`/hotels-admin/info-requests/${id}/reissue`)
        .set("Authorization", as(role))
        .send(body),
    shareRecord: (role: Role, id: string, body: object) =>
      http()
        .post(`/hotels-admin/info-requests/${id}/share-record`)
        .set("Authorization", as(role))
        .send(body),
    revoke: (role: Role, id: string, body: object) =>
      http()
        .post(`/hotels-admin/info-requests/${id}/revoke`)
        .set("Authorization", as(role))
        .send(body),
    patch: (role: Role, id: string, body: object) =>
      http().patch(`/hotels-admin/info-requests/${id}`).set("Authorization", as(role)).send(body),
    get: (role: Role, id: string) =>
      http().get(`/hotels-admin/info-requests/${id}`).set("Authorization", as(role)),
    list: (role: Role, query: Record<string, string> = {}) =>
      http().get("/hotels-admin/info-requests").query(query).set("Authorization", as(role)),
    history: (role: Role, hotelId: string) =>
      http().get(`/hotels-admin/hotels/${hotelId}/info-requests`).set("Authorization", as(role)),
    hints: (role: Role, query: Record<string, string>) =>
      http().get("/hotels-admin/hotel-duplicate-hints").query(query).set("Authorization", as(role)),
    mode: (role: Role) =>
      http().get("/hotels-admin/hotel-form-mode").set("Authorization", as(role)),
  };
}
