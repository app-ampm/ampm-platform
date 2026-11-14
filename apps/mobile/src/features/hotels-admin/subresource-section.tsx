import type { ReactNode } from "react";

import { Button, Card, Icon, Row, Stack, StatusChip, Text } from "@ampm/ui";

export interface SubresourceRowProps {
  readonly name: string;
  readonly summary: string;
  /** A small chip beside the name, e.g. "Primary" for the primary contact. */
  readonly tag?: string | undefined;
  /** How many lines the summary may wrap to before it is cut off; default 1. */
  readonly summaryLines?: number | undefined;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly editLabel: string;
  readonly deleteLabel: string;
  readonly testID?: string | undefined;
}

/** A row's edit and delete, named after the row for screen readers. */
function SubresourceRowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  testID,
}: Pick<SubresourceRowProps, "onEdit" | "onDelete" | "editLabel" | "deleteLabel" | "testID">) {
  return (
    <Row gap={1}>
      <Button
        variant="ghost"
        size="sm"
        icon="edit"
        accessibilityLabel={editLabel}
        onPress={onEdit}
        testID={testID ? `${testID}-edit` : undefined}
      />
      <Button
        variant="ghost"
        size="sm"
        icon="trash"
        accessibilityLabel={deleteLabel}
        onPress={onDelete}
        testID={testID ? `${testID}-delete` : undefined}
      />
    </Row>
  );
}

/** One row of a subresource list: name (+ optional tag), a one-line summary, and edit / delete. */
export function SubresourceRow({
  name,
  summary,
  tag,
  summaryLines = 1,
  testID,
  ...actions
}: SubresourceRowProps) {
  return (
    <Row gap={3} align="center" justify="between" testID={testID}>
      <Stack gap={1} className="flex-1">
        <Row gap={2} align="center">
          <Text variant="body" numberOfLines={1} className="flex-1">
            {name}
          </Text>
          {tag ? <StatusChip label={tag} tone="brand" size="sm" /> : null}
        </Row>
        {summary ? (
          <Text
            variant="bodySmall"
            tone="muted"
            numberOfLines={summaryLines}
            testID={testID ? `${testID}-summary` : undefined}
          >
            {summary}
          </Text>
        ) : null}
      </Stack>
      <SubresourceRowActions {...actions} testID={testID} />
    </Row>
  );
}

/**
 * A persistent "never shown to clients" marker for a RESTRICTED staff-only collection (the lock + gold
 * vocabulary of `InternalPanel`, kept lightweight for a list rather than its amounts-scoped box). Unlike
 * an empty-state hint, this stays on screen once the collection is populated.
 */
export function InternalHint({
  text,
  testID,
}: {
  readonly text: string;
  readonly testID?: string | undefined;
}) {
  return (
    <Row gap={1} align="center" testID={testID}>
      <Icon name="lock" tone="brand" size="sm" />
      <Text variant="bodySmall" tone="brand">
        {text}
      </Text>
    </Row>
  );
}

export interface SubresourceSectionProps {
  readonly title: string;
  readonly addLabel: string;
  readonly onAdd: () => void;
  readonly isEmpty: boolean;
  readonly emptyText: string;
  /** A persistent "never shown to clients" marker shown under the title for a RESTRICTED collection. */
  readonly internalNote?: string | undefined;
  /** A side column's title: interface type (16) rather than a section heading (24), so it fits 288. */
  readonly compact?: boolean | undefined;
  readonly children?: ReactNode;
  readonly testID?: string | undefined;
}

/** The section's title beside its Add action; a side column's title is the smaller interface type. */
function SectionHeading({
  title,
  addLabel,
  onAdd,
  compact,
  testID,
}: Pick<SubresourceSectionProps, "title" | "addLabel" | "onAdd" | "testID"> & {
  readonly compact: boolean;
}) {
  return (
    <Row justify="between" align="center" gap={3}>
      <Text
        variant={compact ? "subheading" : "heading"}
        accessibilityRole="header"
        className="shrink"
      >
        {title}
      </Text>
      <Button
        variant="secondary"
        size="sm"
        icon="plus"
        onPress={onAdd}
        testID={testID ? `${testID}-add` : undefined}
      >
        {addLabel}
      </Button>
    </Row>
  );
}

/** A titled subresource section: a heading, an "Add" action, and either the rows or the empty guidance. */
export function SubresourceSection({
  title,
  addLabel,
  onAdd,
  isEmpty,
  emptyText,
  internalNote,
  compact = false,
  children,
  testID,
}: SubresourceSectionProps) {
  return (
    <Stack gap={2} testID={testID}>
      <SectionHeading
        title={title}
        addLabel={addLabel}
        onAdd={onAdd}
        compact={compact}
        testID={testID}
      />
      {internalNote ? (
        <InternalHint text={internalNote} testID={testID ? `${testID}-internal` : undefined} />
      ) : null}
      {isEmpty ? (
        <Text variant="bodySmall" tone="muted">
          {emptyText}
        </Text>
      ) : (
        <Card padding="sm">
          <Stack gap={3}>{children}</Stack>
        </Card>
      )}
    </Stack>
  );
}
