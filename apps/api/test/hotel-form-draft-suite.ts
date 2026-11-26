import { randomUUID } from "node:crypto";

import {
  canonicalJson,
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_DISPLAY_VERSION,
  hotelFormSectionVersionsOf,
  utf8ByteLength,
} from "@ampm/core";
import request from "supertest";

import { freshIp, type FormSuite } from "./hotel-form-suite.js";

/*
 * The hotel form's own routes for its e2e suites (D-190 §3): the draft, a section's save, submit,
 * corrections and withdrawal, each from a fresh network unless told which and inside a form session; the
 * two sections an onboarding submit needs; a submit's body; and a rooms section of a chosen size, for the
 * body parser's limit. Synthetic hotels and people only. Imported by tests only.
 */

/** The form's session routes, each from a fresh network unless told which. */
export function draftCalls(suite: () => FormSuite) {
  const http = () => request(suite().app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;
  const draft = (token: string, ip = freshIp()) =>
    http().get("/hotel-form/draft").set("X-Forwarded-For", ip).set("Authorization", as(token));
  return {
    draft,
    /**
     * A submit's body as the review page sends it: the section versions read from the draft now, as the
     * page shows them, and both declarations.
     */
    reviewedBody: async (token: string, display: "yes" | "no" = "yes", overrides: object = {}) => {
      const shown = await draft(token).expect(200);
      const sectionVersions = hotelFormSectionVersionsOf(shown.body.data.sections);
      return submitBody(display, { sectionVersions, ...overrides });
    },
    save: (token: string, section: string, body: object, ip = freshIp()) =>
      http()
        .put(`/hotel-form/draft/sections/${section}`)
        .set("X-Forwarded-For", ip)
        .set("Authorization", as(token))
        .send(body),
    submit: (token: string, body: object, ip = freshIp()) =>
      http()
        .post("/hotel-form/submit")
        .set("X-Forwarded-For", ip)
        .set("Authorization", as(token))
        .send(body),
    correct: (token: string, body: object, ip = freshIp()) =>
      http()
        .post("/hotel-form/corrections")
        .set("X-Forwarded-For", ip)
        .set("Authorization", as(token))
        .send(body),
    withdraw: (token: string, body: object, ip = freshIp()) =>
      http()
        .post("/hotel-form/consent-withdrawal")
        .set("X-Forwarded-For", ip)
        .set("Authorization", as(token))
        .send(body),
  };
}

/** What an onboarding submit needs: the hotel's name, city and state, and a reachable contact. */
export const PROPERTY = { name: "E2E Synthetic Lake Palace", city: "Udaipur", state: "Rajasthan" };
export const CONTACT = {
  contacts: [{ name: "E2E Synthetic Sales", email: "sales@synthetic-hotel.example" }],
};

/** A first save's body. */
export const firstSave = (answers: object) => ({ answers, expectedVersion: 0, noChanges: false });

/** The versions a review page read before any section was saved. */
export const UNSAVED_VERSIONS = {
  property: 0,
  contact: 0,
  rooms: 0,
  venues: 0,
  booking_terms: 0,
  food_beverage: 0,
  fact_sheet_media: 0,
};

/**
 * A submit's body: 7.4 accepted, 7.5 answered, both in the words in force, the section versions the
 * review page read (none saved, unless told), and the stub's pass.
 */
export function submitBody(display: "yes" | "no" = "yes", overrides: object = {}) {
  return {
    accuracy: { accepted: true, textVersion: HOTEL_FORM_ACCURACY_VERSION },
    display: { answer: display, textVersion: HOTEL_FORM_DISPLAY_VERSION },
    sectionVersions: UNSAVED_VERSIONS,
    botToken: "dev-bot-check",
    ...overrides,
  };
}

function roomRow(index: number, notes: string) {
  return {
    rowId: randomUUID(),
    name: `E2E Room Category ${index + 1}`,
    roomCount: 10,
    unitType: "room",
    size: { unit: "sqft", value: 450 },
    maxOccupancy: 3,
    viewLabel: "Lake view",
    bedConfiguration: "King or twin",
    notes,
  };
}

/**
 * A rooms section of 60 rows (the most it takes) whose canonical JSON is exactly `bytes` long, compact
 * and without a null, as the page sends it. Its notes are ASCII, so a character is a byte.
 *
 * @example
 * const answers = roomsOfSize(98_304 - 64); // just under the rooms section's 96 KB
 */
export function roomsOfSize(bytes: number) {
  const ROWS = 60;
  const build = (lengths: readonly number[]) => ({
    totalRooms: 600,
    rows: lengths.map((length, index) => roomRow(index, "n".repeat(length))),
  });
  const base = utf8ByteLength(canonicalJson(build(Array<number>(ROWS).fill(1)))) - ROWS;
  const each = Math.floor((bytes - base) / ROWS);
  const lengths = Array<number>(ROWS).fill(each);
  lengths[0] = each + (bytes - base - each * ROWS);
  const answers = build(lengths);
  if (utf8ByteLength(canonicalJson(answers)) !== bytes) throw new Error("roomsOfSize missed");
  return answers;
}
