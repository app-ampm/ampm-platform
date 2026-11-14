import { useState, type ReactNode } from "react";
import type { UseMutationResult } from "@tanstack/react-query";

import { ConfirmSheet, useToast } from "@ampm/ui";

import { SubresourceRow, SubresourceSection } from "./subresource-section";

/** The minimum a managed subresource needs: a stable id and a display name. */
interface SubresourceItem {
  readonly id: string;
  readonly name: string;
}

/** A soft-delete mutation keyed by the subresource's id (useDeleteRoom / Venue / Contact). */
type DeleteMutation = UseMutationResult<unknown, Error, string>;

export interface ManagedSectionProps<T extends SubresourceItem> {
  readonly title: string;
  readonly items: readonly T[];
  readonly summaryOf: (item: T) => string;
  /** How many lines a row's summary may wrap to (a narrow side column); default 1. */
  readonly summaryLines?: number | undefined;
  /** A side column's smaller title (see `SubresourceSection`). */
  readonly compact?: boolean | undefined;
  /** An optional chip beside the name, e.g. "Primary" for the primary contact. */
  readonly tagOf?: ((item: T) => string | undefined) | undefined;
  readonly addLabel: string;
  readonly emptyText: string;
  /** A persistent "never shown to clients" marker for a RESTRICTED collection (e.g. contacts). */
  readonly internalNote?: string | undefined;
  /** The singular noun for the confirm copy, e.g. "room category". */
  readonly noun: string;
  readonly testIdPrefix: string;
  readonly remove: DeleteMutation;
  readonly renderEditor: (args: {
    readonly open: boolean;
    readonly item: T | null;
    readonly onClose: () => void;
  }) => ReactNode;
}

/** The add / edit / delete state for one managed section, kept out of the view. */
function useManagedSection<T extends SubresourceItem>(remove: DeleteMutation, noun: string) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ readonly item: T | null } | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const confirmDelete = (): void => {
    if (!deleting || remove.isPending) return;
    const { name } = deleting;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.show({ title: `${name} removed`, tone: "success" });
        setDeleting(null);
      },
      onError: () => toast.show({ title: `Could not remove the ${noun}`, tone: "danger" }),
    });
  };
  return { editing, setEditing, deleting, setDeleting, confirmDelete, pending: remove.isPending };
}

/** The confirm shown before a subresource is removed (gold outline, never red). */
function SubresourceDeleteConfirm({
  name,
  noun,
  pending,
  onClose,
  onConfirm,
  testID,
}: {
  readonly name: string | undefined;
  readonly noun: string;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly testID: string;
}) {
  return (
    <ConfirmSheet
      open={name !== undefined}
      onClose={onClose}
      title={name ? `Remove ${name}?` : `Remove ${noun}?`}
      description={`This removes the ${noun} from the hotel.`}
      confirmLabel="Remove"
      destructive
      loading={pending}
      onConfirm={onConfirm}
      testID={testID}
    />
  );
}

/** A row's name, summary, tag and labels, from the section's per-entity readers. */
function rowProps<T extends SubresourceItem>(props: ManagedSectionProps<T>, item: T) {
  return {
    name: item.name,
    summary: props.summaryOf(item),
    summaryLines: props.summaryLines,
    tag: props.tagOf?.(item),
    editLabel: `Edit ${item.name}`,
    deleteLabel: `Delete ${item.name}`,
    testID: `${props.testIdPrefix}-${item.id}`,
  };
}

/**
 * One titled subresource section — rooms, venues or contacts — that owns its own add / edit / delete:
 * the list of rows, an "Add" action, the edit sheet (supplied by `renderEditor`) and the remove confirm.
 * Presentational rows come from `SubresourceRow`; the editor and the delete hook are passed in per entity.
 */
export function ManagedSection<T extends SubresourceItem>(props: ManagedSectionProps<T>) {
  const { title, items, addLabel, emptyText, internalNote, noun, testIdPrefix } = props;
  const m = useManagedSection<T>(props.remove, noun);
  return (
    <>
      <SubresourceSection
        title={title}
        addLabel={addLabel}
        onAdd={() => m.setEditing({ item: null })}
        isEmpty={items.length === 0}
        emptyText={emptyText}
        internalNote={internalNote}
        compact={props.compact}
        testID={`${testIdPrefix}-section`}
      >
        {items.map((item) => (
          <SubresourceRow
            key={item.id}
            {...rowProps(props, item)}
            onEdit={() => m.setEditing({ item })}
            onDelete={() => m.setDeleting(item)}
          />
        ))}
      </SubresourceSection>
      {props.renderEditor({
        open: m.editing !== null,
        item: m.editing?.item ?? null,
        onClose: () => m.setEditing(null),
      })}
      <SubresourceDeleteConfirm
        name={m.deleting?.name}
        noun={noun}
        pending={m.pending}
        onClose={() => m.setDeleting(null)}
        onConfirm={m.confirmDelete}
        testID={`${testIdPrefix}-remove`}
      />
    </>
  );
}
