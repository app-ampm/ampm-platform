import { useState } from "react";

import { useHotelImportApply, useHotelImportPreview } from "@ampm/api-client";
import {
  isAppError,
  type AppError,
  type HotelImportKind,
  type HotelImportResult,
} from "@ampm/core";
import { useToast, type ToastOptions } from "@ampm/ui";

import {
  dryRunDestinationsNote,
  hasChanges,
  hasRejections,
  importInputProblem,
} from "./hotel-import.format";
import { IMPORT_KIND_COPY } from "./hotel-import.kinds";

/*
 * The TW-25 import's state (D-181; Slice 3): the kind, the CSV, the last result, and the preview Import
 * would apply. Validate previews the CSV of the chosen kind; Import applies that preview by its job id,
 * never the file again, and only while the kind and the CSV are the ones validated and the preview
 * changes something. A kind change, a CSV edit or an import locks Import; a preview the server no longer
 * imports (404: not this person's of this kind; 409: imported already, or expired) clears the
 * validation and says why.
 */

/** The preview Import would apply: its kind, the CSV it checked, its job, and whether it writes. */
interface Checked {
  readonly kind: HotelImportKind;
  readonly csv: string;
  readonly jobId: string;
  readonly writes: boolean;
}

interface RunState {
  readonly result: HotelImportResult | null;
  /** The CSV the result reports on, to mark the report stale once the CSV changes. */
  readonly resultCsv: string | null;
  readonly checked: Checked | null;
  /** Why the last validation was cleared (the server's word), until the next run or edit. */
  readonly notice: string | null;
}

const NO_RUN: RunState = { result: null, resultCsv: null, checked: null, notice: null };

const LOCKED = "Validate the CSV first: Import applies the rows you validated.";
const NOTHING_TO_IMPORT = "Nothing to import: every row is unchanged or rejected.";

function previewToast(result: HotelImportResult): ToastOptions {
  const note = dryRunDestinationsNote(result);
  const rejected = hasRejections(result);
  return {
    title: rejected ? "Validated — some rows rejected" : "Validated — all rows valid",
    tone: rejected ? "warning" : "success",
    ...(note ? { description: note } : {}),
  };
}

function importedToast(result: HotelImportResult): ToastOptions {
  if (result.applied)
    return { title: IMPORT_KIND_COPY[result.kind].importedTitle, tone: "success" };
  return { title: "Nothing imported", tone: hasRejections(result) ? "danger" : "info" };
}

function failureToast(error: unknown): ToastOptions {
  return { title: isAppError(error) ? error.message : "Could not run the import", tone: "danger" };
}

/** A refusal that means the preview cannot be imported any more, so it is validated again. */
function isSpentPreview(error: unknown): error is AppError {
  return isAppError(error) && (error.code === "not_found" || error.code === "conflict");
}

/** The kind (the chosen one while it is offered, else the first offered), the CSV and the run. */
function useImportState(kinds: readonly HotelImportKind[]) {
  const [chosen, setChosen] = useState<HotelImportKind | null>(null);
  const [content, setContentText] = useState("");
  const [run, setRun] = useState<RunState>(NO_RUN);
  const kind = chosen !== null && kinds.includes(chosen) ? chosen : (kinds[0] ?? null);
  const changeKind = (next: HotelImportKind): void => {
    if (next === kind) return;
    setChosen(next);
    setRun(NO_RUN);
  };
  const setContent = (value: string): void => {
    setContentText(value);
    setRun((prev) => ({ ...prev, notice: null }));
  };
  return { kind, changeKind, content, setContent, run, setRun };
}

type ImportState = ReturnType<typeof useImportState>;

/** Validate: preview the CSV as the chosen kind; the result unlocks Import for that kind and CSV. */
function useValidate({ kind, content, setRun }: ImportState) {
  const toast = useToast();
  const preview = useHotelImportPreview();
  const validate = (csvKind: HotelImportKind): void => {
    const csv = content.trim();
    const problem = importInputProblem(csv);
    if (problem) return void toast.show({ title: problem, tone: "danger" });
    setRun(NO_RUN);
    preview.mutate(
      { kind: csvKind, csv },
      {
        onSuccess: (result) => {
          const checked = {
            kind: csvKind,
            csv,
            jobId: result.importJobId,
            writes: hasChanges(result),
          };
          setRun({ result, resultCsv: csv, checked, notice: null });
          toast.show(previewToast(result));
        },
        onError: (error) => toast.show(failureToast(error)),
      },
    );
  };
  return { validate: () => (kind === null ? undefined : validate(kind)), preview };
}

/** Import: apply the validated preview by its job; Import locks again either way it ends. */
function useApply({ setRun }: ImportState) {
  const toast = useToast();
  const apply = useHotelImportApply();
  const importChecked = (checked: Checked): void =>
    apply.mutate(
      { kind: checked.kind, jobId: checked.jobId },
      {
        onSuccess: (result) => {
          setRun((prev) => ({ ...prev, result, checked: null }));
          toast.show(importedToast(result));
        },
        onError: (error) => {
          if (isSpentPreview(error)) setRun({ ...NO_RUN, notice: error.message });
          toast.show(failureToast(error));
        },
      },
    );
  return { importChecked, apply };
}

/** Why Import is locked, or null when it may apply the checked preview. */
function lockNoteOf({ kind, content, run }: ImportState): string | null {
  const { checked } = run;
  if (checked === null || checked.kind !== kind || checked.csv !== content.trim()) {
    return run.notice ?? LOCKED;
  }
  return checked.writes ? null : NOTHING_TO_IMPORT;
}

/**
 * The import form: the kind and the CSV, Validate and Import, and the result kept on screen (marked
 * stale once the CSV is not the one it reports on).
 *
 *   const form = useHotelImportForm(kinds);
 */
export function useHotelImportForm(kinds: readonly HotelImportKind[]) {
  const state = useImportState(kinds);
  const { validate, preview } = useValidate(state);
  const { importChecked, apply } = useApply(state);
  const pending = preview.isPending || apply.isPending;
  const lockNote = lockNoteOf(state);
  const { checked, result, resultCsv } = state.run;
  return {
    kind: state.kind,
    changeKind: state.changeKind,
    content: state.content,
    setContent: state.setContent,
    result,
    isStale: result !== null && resultCsv !== state.content.trim(),
    validate: () => (pending ? undefined : validate()),
    runImport: () =>
      pending || lockNote !== null || checked === null ? undefined : importChecked(checked),
    canImport: lockNote === null,
    lockNote,
    pending,
  };
}
