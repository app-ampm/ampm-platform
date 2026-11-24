import { readFileSync } from "node:fs";

import type { DocumentType } from "@ampm/core";
import { vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { AvScanner } from "../../../storage/av-scanner.js";
import type { ImageProcessor } from "../../../storage/image.processor.js";
import type { StorageAdapter } from "../../../storage/storage.types.js";
import type { DocumentsRepository, DocumentWriteData } from "../documents.repository.js";
import { DocumentsService, type StoreDocumentInput } from "../documents.service.js";

/*
 * Spec helpers for DocumentsService over mocks (test-only: the build leaves `testing/` folders out). The
 * collaborators record the order they are called in, so a spec can tell what ran before a refusal.
 */

const FIXTURES = new URL("../../../../test/fixtures/content/", import.meta.url);

/** One of the committed content fixtures (apps/api/test/fixtures/content; README.md names each source). */
export const contentFixture = (name: string): Buffer => readFileSync(new URL(name, FIXTURES));

export interface LoggedEvent {
  readonly event: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface DocumentsHarness {
  readonly service: DocumentsService;
  /** "scan <bytes>", "reencode <format>" and "put <type>", in the order they ran. */
  readonly calls: string[];
  readonly written: DocumentWriteData[];
  readonly stored: Map<string, Buffer>;
  readonly images: ImageProcessor;
  readonly logged: LoggedEvent[];
}

export interface HarnessOptions {
  readonly reencode?: ImageProcessor["reencode"];
  readonly verdict?: "clean" | "rejected";
}

/** A documents service over mocks: nothing stored before, every scan `verdict` (clean by default). */
export function documentsHarness(options: HarnessOptions = {}): DocumentsHarness {
  const calls: string[] = [];
  const written: DocumentWriteData[] = [];
  const stored = new Map<string, Buffer>();
  const logged: LoggedEvent[] = [];
  const repo = {
    findOwned: vi.fn(async () => null),
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    create: vi.fn(async (data: DocumentWriteData) => {
      written.push(data);
      return { id: "doc-1", ...data.owner, versionNumber: data.versionNumber };
    }),
  } as unknown as DocumentsRepository;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const storage = {
    putObject: vi.fn(async (key: string, bytes: Buffer, mimeType: string) => {
      calls.push(`put ${mimeType}`);
      stored.set(key, bytes);
    }),
    deleteObject: vi.fn(async (key: string) => void stored.delete(key)),
  } as unknown as StorageAdapter;
  const scanner = {
    scan: vi.fn(async (bytes: Buffer) => {
      calls.push(`scan ${bytes.length}`);
      return options.verdict ?? "clean";
    }),
  } as unknown as AvScanner;
  const images = imageMock(calls, options.reencode ?? (async (bytes: Buffer) => bytes));
  const logger = recordingLogger(logged);
  const service = new DocumentsService(repo, audit, storage, scanner, images, logger);
  return { service, calls, written, stored, images, logged };
}

/** An image processor whose re-encode is `reencode`, recorded in `calls`. */
function imageMock(calls: string[], reencode: ImageProcessor["reencode"]): ImageProcessor {
  return {
    derive: vi.fn(),
    reencode: vi.fn(async (bytes: Buffer, format: "jpeg" | "png") => {
      calls.push(`reencode ${format}`);
      return reencode(bytes, format);
    }),
  } as unknown as ImageProcessor;
}

/** A logger that keeps each event it is given, at any level, in `logged`. */
function recordingLogger(logged: LoggedEvent[]): AppLogger {
  const record = (event: string, fields: Record<string, unknown> = {}) =>
    void logged.push({ event, fields });
  return { info: record, warn: record, error: record } as unknown as AppLogger;
}

/** A first version of a document of `documentType`, filed on a synthetic hotel. */
export function storeInput(bytes: Buffer, documentType: DocumentType): StoreDocumentInput {
  return {
    owner: { ownerType: "hotel", ownerId: "0192f1a0-0000-7000-8000-0000000000a1" },
    accountId: null,
    projectId: null,
    documentType,
    title: "Sample Hotel",
    bytes,
    previousVersionId: null,
  };
}
