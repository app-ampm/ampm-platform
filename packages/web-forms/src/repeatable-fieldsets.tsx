import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  buttonLabelStyles,
  buttonStyles,
  cn,
  fieldHelpStyles,
  flatTintStyles,
  focusRingStyles,
  textStyles,
} from "@ampm/ui/styles";

import { FieldMessage } from "./field-message";
import { useIsReadOnly } from "./read-only";

/** A row of the list: its key (kept while it is renamed or moved) and the legend that names it. */
export interface RepeatableRow {
  readonly key: string;
  /** The row's own name as typed, or the form's word for an unnamed row ("Room category 2"). */
  readonly legend: string;
}

export interface RepeatableFieldsetsProps<R extends RepeatableRow> {
  /** The list's id: each row's fieldset is `rowFieldsetId(id, key)`, Add is `<id>-add`. */
  readonly id: string;
  readonly legend: string;
  readonly rows: readonly R[];
  /** A row's fields, inside its fieldset. */
  readonly renderRow: (row: R, index: number) => ReactNode;
  readonly onAdd: () => void;
  readonly onRemove: (key: string) => void;
  readonly addLabel: string;
  /** Remove's words on every row ("Remove"). */
  readonly removeText: string;
  /** Remove's name for screen readers, from the row's legend ("Remove Deluxe"). */
  readonly removeLabel: (legend: string) => string;
  /** What a polite region says once a row is removed ("Deluxe removed"). */
  readonly removedText: (legend: string) => string;
  /** The most rows the form takes; Add gives way to `capText` there. */
  readonly max: number;
  readonly capText: string;
  /** What shows while there are no rows; Add creates the first. */
  readonly emptyText?: string | undefined;
  readonly help?: string | undefined;
  readonly error?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * A row's fieldset id, from the list's id and the row's key.
 *
 * @example
 * rowFieldsetId("rooms", rowId); // "rooms-row-<rowId>"
 */
export function rowFieldsetId(id: string, key: string): string {
  return `${id}-row-${key}`;
}

/** What a press asked of focus, settled once the rows have changed. */
type FocusIntent =
  | { readonly kind: "added"; readonly before: readonly string[] }
  | { readonly kind: "removed"; readonly index: number };

/** Where focus goes once the rows changed: into a new row, onto the row in a removed one's place, or Add. */
export type FocusTarget =
  | { readonly kind: "first-field"; readonly key: string }
  | { readonly kind: "row"; readonly key: string }
  | { readonly kind: "add" };

/**
 * Where focus goes after a press, from the rows' keys once they changed: the new row's first field after
 * Add; after Remove, the row now in the removed one's place, else the row before it, else Add.
 *
 * @example
 * focusTargetAfter({ kind: "removed", index: 1 }, ["r1", "r3"]); // { kind: "row", key: "r3" }
 */
export function focusTargetAfter(intent: FocusIntent, keys: readonly string[]): FocusTarget | null {
  if (intent.kind === "added") {
    const added = keys.find((key) => !intent.before.includes(key));
    return added === undefined ? null : { kind: "first-field", key: added };
  }
  const key = keys[intent.index] ?? keys[intent.index - 1];
  return key === undefined ? { kind: "add" } : { kind: "row", key };
}

const FIRST_FIELD = "input:not([type=hidden]), select, textarea, button";

/** Moves focus as a press asked, once React has drawn the changed rows. */
function useRowFocus(id: string, keys: readonly string[]) {
  const intent = useRef<FocusIntent | null>(null);
  useEffect(() => {
    const pending = intent.current;
    if (pending === null) return;
    intent.current = null;
    const target = focusTargetAfter(pending, keys);
    if (target === null) return;
    if (target.kind === "add") {
      document.getElementById(`${id}-add`)?.focus();
      return;
    }
    const row = document.getElementById(rowFieldsetId(id, target.key));
    const field =
      target.kind === "first-field" ? row?.querySelector<HTMLElement>(FIRST_FIELD) : null;
    (field ?? row)?.focus();
  }, [id, keys]);
  return intent;
}

/** Add and Remove: each tells focus where to go once the rows change; a removal is also said aloud. */
function useRowPresses<R extends RepeatableRow>(props: RepeatableFieldsetsProps<R>) {
  const keys = props.rows.map((row) => row.key);
  const intent = useRowFocus(props.id, keys);
  const [announcement, setAnnouncement] = useState("");
  const add = () => {
    intent.current = { kind: "added", before: keys };
    props.onAdd();
  };
  const remove = (row: R, index: number) => {
    intent.current = { kind: "removed", index };
    setAnnouncement(props.removedText(row.legend));
    props.onRemove(row.key);
  };
  return { add, remove, announcement };
}

/** A pill button of the list (Add, Remove): the kit's secondary look at the 44px size. */
function ListButton({
  id,
  text,
  label,
  onPress,
}: {
  readonly id?: string | undefined;
  readonly text: string;
  readonly label?: string | undefined;
  readonly onPress: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      onClick={onPress}
      className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "self-start")}
    >
      <span className={buttonLabelStyles({ variant: "secondary", size: "sm" })}>{text}</span>
    </button>
  );
}

/** One row: its fieldset (the place focus goes after a removal), its legend, its fields and Remove. */
function RowFieldset<R extends RepeatableRow>({
  listId,
  row,
  children,
  removeText,
  removeLabel,
  onRemove,
}: {
  readonly listId: string;
  readonly row: R;
  readonly children: ReactNode;
  readonly removeText: string;
  readonly removeLabel: string;
  readonly onRemove: () => void;
}) {
  const isReadOnly = useIsReadOnly();
  return (
    <fieldset
      id={rowFieldsetId(listId, row.key)}
      tabIndex={-1}
      className={cn(flatTintStyles, focusRingStyles, "flex min-w-0 flex-col rounded p-4")}
    >
      {/* Floated, so the legend sits inside the row's tint instead of on its border. */}
      <legend
        className={cn(textStyles({ variant: "label", tone: "primary" }), "float-left w-full")}
      >
        {row.legend}
      </legend>
      <div className="clear-both flex flex-col gap-4 pt-3">
        {children}
        {isReadOnly ? null : (
          <ListButton text={removeText} label={removeLabel} onPress={onRemove} />
        )}
      </div>
    </fieldset>
  );
}

/** Over the rows: the list's help, and what shows while there are none. */
function ListIntro({
  id,
  help,
  emptyText,
}: {
  readonly id: string;
  readonly help: string | undefined;
  readonly emptyText: string | undefined;
}) {
  return (
    <>
      {help ? (
        <p id={`${id}-help`} className={fieldHelpStyles}>
          {help}
        </p>
      ) : null}
      {emptyText ? (
        <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>{emptyText}</p>
      ) : null}
    </>
  );
}

/** What describes the list for screen readers: its help, then its error once it has one. */
function describedByOf({
  id,
  help,
  error,
}: Pick<RepeatableFieldsetsProps<RepeatableRow>, "id" | "help" | "error">) {
  const ids = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length === 0 ? undefined : ids.join(" ");
}

/** Under the rows: Add while there is room, else why there is none; the list's error. */
function ListFooter<R extends RepeatableRow>({
  props,
  onAdd,
}: {
  readonly props: RepeatableFieldsetsProps<R>;
  readonly onAdd: () => void;
}) {
  const { id, rows, max, error } = props;
  const isReadOnly = useIsReadOnly();
  const isFull = rows.length >= max;
  return (
    <>
      {isReadOnly ? null : isFull ? (
        <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>{props.capText}</p>
      ) : (
        <ListButton id={`${id}-add`} text={props.addLabel} onPress={onAdd} />
      )}
      <FieldMessage id={id} error={error} />
    </>
  );
}

/**
 * Repeatable rows, each a fieldset with its legend (plan §4.4's field kit; D-190 §5): contacts, room
 * categories, venues, a venue's other layouts. A row is renamed by its own name field (the form passes the
 * legend), removed with its Remove, and added up to `max`. Focus moves with each press: into the new
 * row's first field after Add; after Remove, onto the row that took its place (or the one before it, or
 * Add), with what went said in a polite region. Rows are keyed, never placed, so typing survives a removal.
 * The list's help and error describe the list itself (aria-describedby), as a field's describe it.
 *
 *   <RepeatableFieldsets id="rooms" legend="Room categories" rows={rows} max={60}
 *     renderRow={(row) => <RoomFields row={row} />} onAdd={addRow} onRemove={removeRow}
 *     addLabel="Add a room category" removeText="Remove" removeLabel={(name) => `Remove ${name}`}
 *     removedText={(name) => `${name} removed`} capText="That is the most this form takes." />
 */
export function RepeatableFieldsets<R extends RepeatableRow>(props: RepeatableFieldsetsProps<R>) {
  const { id, legend, rows, renderRow, help, className } = props;
  const { add, remove, announcement } = useRowPresses(props);
  return (
    <fieldset
      id={id}
      aria-describedby={describedByOf(props)}
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      <legend className={cn(textStyles({ variant: "subheading", tone: "primary" }), "mb-1")}>
        {legend}
      </legend>
      <ListIntro id={id} help={help} emptyText={rows.length === 0 ? props.emptyText : undefined} />
      <ol className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <li key={row.key}>
            <RowFieldset
              listId={id}
              row={row}
              removeText={props.removeText}
              removeLabel={props.removeLabel(row.legend)}
              onRemove={() => remove(row, index)}
            >
              {renderRow(row, index)}
            </RowFieldset>
          </li>
        ))}
      </ol>
      <ListFooter props={props} onAdd={add} />
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  );
}
