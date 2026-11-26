import type { HotelFormSectionKey } from "@ampm/core";
import { vi } from "vitest";

import type { HotelFormLimits } from "../hotel-form/hotel-form-limits.js";
import type { HotelFormRequestsRepository } from "../hotel-form/hotel-form-requests.repository.js";
import { HotelFormSectionSaves } from "../hotel-form/hotel-form-section-saves.service.js";
import type {
  HotelFormSectionsRepository,
  SectionRow,
} from "../hotel-form/hotel-form-sections.repository.js";
import type { FormSubmission } from "../hotel-form/hotel-form-submissions.repository.js";
import {
  FORM_NOW,
  formSession,
  formSubmission,
  formSubmissions,
  formTransactions,
} from "./hotel-form-draft-fixtures.js";

/*
 * A section's autosave (D-190 §3) built on fakes, for its unit specs: the request as the lock reads it,
 * the section as it stands, and whether a first save or a later write lands. Test-only: the build leaves
 * `testing/` folders out.
 */

export interface Built {
  readonly saves: HotelFormSectionSaves;
  readonly find: ReturnType<typeof vi.fn>;
  readonly createFirst: ReturnType<typeof vi.fn>;
  readonly updateIf: ReturnType<typeof vi.fn>;
  readonly allowSectionSave: ReturnType<typeof vi.fn>;
  readonly lock: ReturnType<typeof vi.fn>;
}

export function build(
  options: {
    readonly current?: SectionRow | null;
    readonly locked?: FormSubmission | null;
    readonly created?: boolean;
    readonly written?: number;
  } = {},
): Built {
  const submissions = formSubmissions(
    options.locked === undefined ? formSubmission() : options.locked,
  );
  const find = vi.fn(async () => options.current ?? null);
  const createFirst = vi.fn(async () => options.created ?? true);
  const updateIf = vi.fn(async () => options.written ?? 1);
  const allowSectionSave = vi.fn(async () => undefined);
  const saves = new HotelFormSectionSaves(
    formTransactions() as unknown as HotelFormRequestsRepository,
    submissions.typed,
    { find, createFirst, updateIf } as unknown as HotelFormSectionsRepository,
    { allowSectionSave } as unknown as HotelFormLimits,
  );
  return {
    saves,
    find,
    createFirst,
    updateIf,
    allowSectionSave,
    lock: submissions.repository.lock,
  };
}

export const save = (
  built: Built,
  key: HotelFormSectionKey,
  body: { answers: object; expectedVersion: number; noChanges: boolean },
  session = formSession(),
) => built.saves.save(session, key, body, FORM_NOW);
