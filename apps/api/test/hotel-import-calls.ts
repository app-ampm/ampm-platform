import type { HotelImportKind } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";

/*
 * A staff import's two calls over HTTP (TW-25; D-181), for the e2e suites: the preview, which takes the
 * file as the raw request body (read after the guards), and the import of that preview by its job id,
 * which takes no file.
 */

/**
 * The preview and import calls of one running API.
 *
 * @example
 * const imports = importCalls(app);
 * const preview = await imports.preview(admin, "rooms", csv).expect(200);
 * await imports.apply(admin, "rooms", preview.body.data.importJobId).expect(200);
 */
export function importCalls(app: NestExpressApplication) {
  const http = () => request(app.getHttpServer());
  /** Uploads a file as a preview; a null `auth` sends no token. */
  const preview = (
    auth: string | null,
    kind: HotelImportKind,
    body: string | Buffer,
    type = "application/octet-stream",
  ) => {
    const call = http().post(`/hotels-admin/imports/${kind}`).set("Content-Type", type);
    const sent = auth === null ? call : call.set("Authorization", auth);
    return sent.send(typeof body === "string" ? Buffer.from(body) : body);
  };
  /** Imports a preview by its job id, with an empty JSON body. */
  const apply = (auth: string, kind: HotelImportKind, jobId: string) =>
    http().post(`/hotels-admin/imports/${kind}/${jobId}/apply`).set("Authorization", auth).send({});
  /** Previews a file, then imports that preview; answers the import's response (asserted 200). */
  const previewAndApply = async (auth: string, kind: HotelImportKind, body: string) => {
    const previewed = await preview(auth, kind, body).expect(200);
    return apply(auth, kind, previewed.body.data.importJobId).expect(200);
  };
  return { preview, apply, previewAndApply };
}
