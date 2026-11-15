import type { MeResponse, PaymentFinanceView, SubscriptionReportRow } from "@ampm/core";

import { failure, ok, TEST_API_BASE } from "../../test/api";
import { paymentFinanceViewFixture, staffMeFixture } from "../accounts/accounts.test-utils";

export { renderWithApi } from "../../test/api";

/*
 * Test helpers for Finance & Reports: report rows in the shape `GET /crm/reports/subscriptions` returns,
 * and a fake API that answers the report by its `status` query, holds the queue as a server would (a
 * recorded payment takes its subscription out of it and adds a payment) and counts what was asked.
 */

export const PRASAD_ID = "018f0000-0000-7000-8000-0000000f0001";
export const NISHA_ID = "018f0000-0000-7000-8000-0000000f0002";
export const MEERA_ID = "018f0000-0000-7000-8000-0000000f0003";
const PLAN_ID = "018f0000-0000-7000-8000-0000000f00aa";

export function reportRowFixture(overrides: Partial<SubscriptionReportRow>): SubscriptionReportRow {
  return {
    subscriptionId: PRASAD_ID,
    accountId: "018f0000-0000-7000-8000-0000000f0101",
    accountName: "Prasad & Partner",
    planId: PLAN_ID,
    planName: "Hotel Discovery",
    amount: { minor: 5_000_000, currency: "INR" },
    status: "pending_payment",
    startsAt: null,
    endsAt: null,
    createdAt: "2026-11-15T04:07:35.000Z",
    lastPayment: {
      method: "gateway",
      status: "initiated",
      paidAt: null,
      createdAt: "2026-11-15T04:07:35.000Z",
    },
    ...overrides,
  };
}

/** The oldest awaiting subscription first, as the report orders Finance's queue. */
export function awaitingRows(): SubscriptionReportRow[] {
  return [
    reportRowFixture({}),
    reportRowFixture({
      subscriptionId: NISHA_ID,
      accountId: "018f0000-0000-7000-8000-0000000f0102",
      accountName: "Nisha & Arjun",
      createdAt: "2026-11-15T05:00:00.000Z",
    }),
  ];
}

export function activeRow(): SubscriptionReportRow {
  return reportRowFixture({
    subscriptionId: MEERA_ID,
    accountId: "018f0000-0000-7000-8000-0000000f0103",
    accountName: "Meera & Dev",
    status: "active",
    startsAt: "2026-11-15T06:00:00.000Z",
    endsAt: "2026-12-15T06:00:00.000Z",
    lastPayment: {
      method: "bank_transfer",
      status: "succeeded",
      paidAt: "2026-11-15T06:00:00.000Z",
      createdAt: "2026-11-15T06:00:00.000Z",
    },
  });
}

export interface FakeFinanceApi {
  readonly fetch: typeof fetch;
  /** The paths and queries asked for, in order ("/crm/reports/subscriptions?status=active"). */
  readonly asked: string[];
  /** The subscription ids a payment was recorded against, with the bodies sent. */
  readonly recorded: { readonly subscriptionId: string; readonly body: unknown }[];
}

interface FakeOptions {
  readonly roles: MeResponse["roles"];
  readonly awaiting?: SubscriptionReportRow[] | undefined;
  readonly payments?: PaymentFinanceView[] | undefined;
}

const RECORD_PATH = /^\/crm\/subscriptions\/([^/]+)\/record-payment$/;

/** The fake server's state: the queue awaiting payment and the payment ledger, newest first. */
interface FakeServer {
  readonly queue: SubscriptionReportRow[];
  readonly ledger: PaymentFinanceView[];
}

/** The report for a status, as the server would answer it from its queue. */
function reportFor(server: FakeServer, status: string | null): SubscriptionReportRow[] {
  if (status === "pending_payment") return server.queue;
  if (status === "active") return [activeRow()];
  return [...server.queue, activeRow()];
}

/** The export of a status's report, as the server answers it: the rows, their count, no truncation. */
function exportFor(server: FakeServer, status: string | null): Response {
  const rows = reportFor(server, status);
  return ok({
    generatedAt: "2026-11-15T10:00:00.000Z",
    rowCount: rows.length,
    truncated: false,
    filters: status ? { status } : {},
    rows,
  });
}

/** A recorded payment: the subscription leaves the queue and its transfer heads the ledger. */
function recordPayment(server: FakeServer, subscriptionId: string): Response {
  const index = server.queue.findIndex((row) => row.subscriptionId === subscriptionId);
  const [paid] = index >= 0 ? server.queue.splice(index, 1) : [];
  server.ledger.unshift(
    paymentFinanceViewFixture({
      id: "018f0000-0000-7000-8000-0000000f0f01",
      accountName: paid?.accountName ?? "Unknown",
    }),
  );
  return ok(activeRowAsSubscription(subscriptionId));
}

/** A fake API for the Finance screen, signed by the given roles. */
export function fakeFinanceApi({ roles, awaiting, payments }: FakeOptions): FakeFinanceApi {
  const server: FakeServer = {
    queue: [...(awaiting ?? awaitingRows())],
    ledger: [...(payments ?? [paymentFinanceViewFixture({ accountName: "Meera & Dev" })])],
  };
  const asked: string[] = [];
  const recorded: { subscriptionId: string; body: unknown }[] = [];
  const answer = (path: string, query: URLSearchParams, init: RequestInit | undefined) => {
    if (path === "/me") return ok(staffMeFixture(roles));
    if (path === "/crm/reports/subscriptions") {
      return ok({ items: reportFor(server, query.get("status")), nextCursor: null });
    }
    if (path === "/crm/payments") return ok({ items: server.ledger, nextCursor: null });
    if (path === "/crm/reports/subscriptions/export") return exportFor(server, query.get("status"));
    const subscriptionId = RECORD_PATH.exec(path)?.[1];
    if (!subscriptionId || init?.method !== "POST") return failure("not_found", 404);
    recorded.push({ subscriptionId, body: JSON.parse(String(init.body)) });
    return recordPayment(server, subscriptionId);
  };
  return {
    asked,
    recorded,
    fetch: (input, init) => {
      const url = new URL(String(input), TEST_API_BASE);
      asked.push(`${url.pathname}${url.search}`);
      return Promise.resolve(answer(url.pathname, url.searchParams, init));
    },
  };
}

/** The subscription view a recorded payment answers with (activated). */
function activeRowAsSubscription(id: string) {
  return {
    id,
    accountId: "018f0000-0000-7000-8000-0000000f0101",
    planId: PLAN_ID,
    status: "active",
    startsAt: "2026-11-15T07:00:00.000Z",
    endsAt: "2026-12-15T07:00:00.000Z",
    trialEndsAt: null,
    autoRenew: false,
    activationSource: "manual",
    createdAt: "2026-11-15T04:07:35.000Z",
    updatedAt: "2026-11-15T07:00:00.000Z",
  };
}
