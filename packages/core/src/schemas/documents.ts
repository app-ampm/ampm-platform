import { z } from "zod";

import { isoDateTime } from "./common.js";

/**
 * Module N — documents (docs/data-model.md §16, D-132). A stored file belongs to an owning record and is
 * reached only through a minted, expiring access link (a `document_access_links` row) — never a permanent
 * path (security.md). The storage key, checksum and the link's token hash never reach the wire.
 *
 * The link is what a staff "View contract" action mints: `url` is relative to the API origin (resolve it
 * with the API client's base URL); it expires 15 minutes after minting and allows a few downloads, so a
 * browser's PDF viewer can re-fetch it.
 *
 * @example
 * const link = documentLinkView.parse(await api.post(`/consultancy-admin/booking-milestones/${id}/contract/link`));
 * window.open(api.resolveUrl(link.url));
 */
/**
 * The ceiling for a document of a type that takes a PDF, JPEG or PNG only (security.md: size limits per
 * document type): the milestone contract, the agreement's signed copy and the couple's consent. Shared so
 * the app refuses an oversized file before uploading it and the API enforces the same number. Every
 * type's kinds and caps are in DOCUMENT_TYPE_RULES (D-187 §3).
 *
 * @example
 * if (picked.sizeBytes > MAX_DOCUMENT_UPLOAD_BYTES) toast.show({ title: "Over the 20 MB limit" });
 */
export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * The content types those documents may be (the API checks the bytes; this list narrows the file dialog).
 *
 * @example
 * await pickFile(DOCUMENT_UPLOAD_TYPES.join(","));
 */
export const DOCUMENT_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const documentLinkView = z
  .object({
    url: z.string().min(1),
    expiresAt: isoDateTime,
  })
  .strict();
export type DocumentLinkView = z.infer<typeof documentLinkView>;
