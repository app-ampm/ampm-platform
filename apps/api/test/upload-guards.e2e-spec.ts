import { mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest, type ClientRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UploadSlots } from "../src/common/upload-slot/upload-slots.js";
import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-upguard-";
const OCTET = "application/octet-stream";
const MIB = 1024 * 1024;
const NO_RECORD = "0192f1a0-0000-7000-8000-00000000e2e1";
const NO_REFERENCE = "0192f1a0-0000-7000-8000-00000000e2e2";
// A declared length over every route's cap and over the 26 MB the old pre-guard parser read: a 413
// would mean the body was measured before the guards answered.
const OVER_EVERY_CAP = String(26 * MIB + 1);

/** Every route that reads a file, for a record no row has: the guards answer before any lookup. */
const UPLOAD_ROUTES = [
  `/media/${NO_RECORD}/upload`,
  `/consultancy-admin/booking-milestones/${NO_RECORD}/contract`,
  `/crm/service-agreements/${NO_RECORD}/signed-copy`,
  `/hotels-admin/hotels/${NO_RECORD}/wedding-references/${NO_REFERENCE}/consent`,
  "/hotels-admin/imports/hotels",
  "/hotels-admin/imports/rooms",
  "/hotels-admin/imports/venues",
  "/hotels-admin/imports/rates",
];

/**
 * Every upload route reads its body after the guards, in a bounded slot (D-187 §1): an anonymous or
 * unauthorised caller is answered before a byte is read, a body must declare its length, and an API
 * process reads at most two uploads per principal (four in all) at once, answering a busy 503 with
 * Retry-After, and giving each slot back once its response ends, however it ends.
 */
describe("Uploads after the guards, in a bounded slot (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let slots: UploadSlots;
  let port: number;
  let storageDir: string;
  let admin: string;
  let hotelId: string;

  const http = () => request(app.getHttpServer());

  /** Polls until the process holds this many upload slots. */
  async function slotsHeld(count: number): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (slots.inUse() !== count) {
      if (Date.now() > deadline) throw new Error(`expected ${count} slots, ${slots.inUse()} held`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /** A raw upload to the running API, sending its headers once written to or flushed. */
  function rawUpload(path: string, headers: Record<string, string>): ClientRequest {
    return httpRequest({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: { "content-type": OCTET, ...headers },
    });
  }

  /** The API's answer to a raw upload: its status and its JSON body. */
  function answerOf(call: ClientRequest): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      call.on("error", reject);
      call.on("response", (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => (text += chunk));
        response.on("end", () => {
          call.destroy();
          try {
            resolve({ status: response.statusCode ?? 0, body: JSON.parse(text) as unknown });
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      });
    });
  }

  /**
   * Sends only an upload's headers, declaring a body over every cap unless told otherwise, and answers
   * what the API says before a byte of the body is sent. A route that waited for the body would never
   * answer.
   */
  function answerBeforeBody(path: string, auth?: string, declared = OVER_EVERY_CAP) {
    const call = rawUpload(path, {
      "content-length": declared,
      ...(auth ? { authorization: auth } : {}),
    });
    const answer = answerOf(call);
    call.flushHeaders();
    return answer;
  }

  /** An upload that sends 1 KiB of the 1 MiB it declares, then waits: it holds a slot until destroyed. */
  function stalledUpload(path: string, auth: string): ClientRequest {
    const call = rawUpload(path, { authorization: auth, "content-length": String(MIB) });
    call.on("error", () => undefined); // destroyed on purpose
    call.write(Buffer.alloc(1024));
    return call;
  }

  async function newImageAsset(): Promise<string> {
    const created = await http()
      .post("/media")
      .set("Authorization", admin)
      .send({
        ownerType: "hotel",
        ownerId: hotelId,
        kind: "image",
        mimeType: "image/jpeg",
        sizeBytes: 4,
      })
      .expect(201);
    return created.body.data.id as string;
  }

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((hotel) => hotel.id);
    await prisma.mediaAsset.deleteMany({ where: { ownerType: "hotel", ownerId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "ampm-upguard-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    slots = app.get(UploadSlots);
    const server = app.getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Upload Guards Destination", slug: `${PREFIX}dest` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", admin)
      .send({
        destinationId: destination.body.data.id,
        name: "E2E Upload Guards",
        slug: `${PREFIX}hotel`,
      })
      .expect(201);
    hotelId = hotel.body.data.id as string;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it.each(UPLOAD_ROUTES)(
    "answers an anonymous upload to %s 401, before reading its body",
    async (path) => {
      expect(await answerBeforeBody(path)).toMatchObject({
        status: 401,
        body: { error: { code: "unauthenticated" } },
      });
      expect(slots.inUse()).toBe(0); // refused before the slot, as before the body
    },
  );

  it("refuses a staff member without the route's key with 403, before reading the body", async () => {
    const sm = `Bearer ${await mint("local:sm")}`; // SM reads milestones and references, never writes
    for (const path of [UPLOAD_ROUTES[1] ?? "", UPLOAD_ROUTES[3] ?? ""]) {
      expect(await answerBeforeBody(path, sm)).toMatchObject({
        status: 403,
        body: { error: { code: "forbidden" } },
      });
    }
    expect(slots.inUse()).toBe(0);
  });

  it("refuses a body declared over the route's cap with 413 before reading it", async () => {
    const answer = await answerBeforeBody(UPLOAD_ROUTES[1] ?? "", admin, String(20 * MIB + 1));
    expect(answer).toEqual({
      status: 413,
      body: { error: { code: "payload_too_large", message: "The file is larger than 20 MB" } },
    });
    await slotsHeld(0);
  });

  it.each(UPLOAD_ROUTES)("takes only raw bytes at %s: a JSON body is 415", async (path) => {
    const res = await http().post(path).set("Authorization", admin).send({ file: "x" }).expect(415);
    expect(res.body.error.code).toBe("unsupported_media_type");
  });

  it("refuses a chunked body: an upload declares its length", async () => {
    const call = rawUpload(UPLOAD_ROUTES[1] ?? "", { authorization: admin });
    const answer = answerOf(call);
    call.write(Buffer.from("%PDF-1.4\n")); // no Content-Length: Node sends the body chunked
    call.end(Buffer.from("%%EOF\n"));
    expect(await answer).toMatchObject({
      status: 400,
      body: {
        error: {
          code: "validation_failed",
          message: "Send the file with its length (a Content-Length header)",
        },
      },
    });
    await slotsHeld(0);
  });

  it("answers a third upload from one principal 503 with Retry-After, and frees the slots of aborted ones", async () => {
    const first = stalledUpload(UPLOAD_ROUTES[0] ?? "", admin);
    const second = stalledUpload(UPLOAD_ROUTES[1] ?? "", admin);
    await slotsHeld(2);

    const busy = await http()
      .post(UPLOAD_ROUTES[2] ?? "")
      .set("Authorization", admin)
      .set("Content-Type", OCTET)
      .send(Buffer.from("%PDF-1.4\n%%EOF\n"))
      .expect(503);
    expect(busy.headers["retry-after"]).toBe("5");
    expect(busy.body.error).toEqual({
      code: "unavailable",
      message: "The server is busy with other uploads. Try again in 5 seconds.",
    });

    first.destroy();
    second.destroy();
    await slotsHeld(0);
    // With the slots back, the same upload reaches its handler: the agreement does not exist.
    await http()
      .post(UPLOAD_ROUTES[2] ?? "")
      .set("Authorization", admin)
      .set("Content-Type", OCTET)
      .send(Buffer.from("%PDF-1.4\n%%EOF\n"))
      .expect(404);
  });

  it("gives the slot back after a stored upload and after a refused one", async () => {
    const id = await newImageAsset();
    const jpeg = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    const upload = (bytes: Buffer) =>
      http()
        .post(`/media/${id}/upload`)
        .set("Authorization", admin)
        .set("Content-Type", OCTET)
        .send(bytes);
    await upload(jpeg).expect(200);
    await slotsHeld(0);
    await upload(Buffer.from("MZ a renamed executable")).expect(400);
    await slotsHeld(0);
  });
});
