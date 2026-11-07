import type { ReactNode } from "react";

import { Row, Stack, StatusChip, Text } from "@ampm/ui";

import type { Badge } from "../consultancy/consultancy.format";

/**
 * The frame the sections of the staff enquiry share (agreements, proposals, visits, milestones): a
 * Gilda section heading over glass record cards, the header row of each card, and the label-and-figure
 * row the internal panels list their amounts in. A section that is loading shows the client screens'
 * SectionSkeleton (consultancy/section-skeleton).
 */

/** A section heading, an optional line saying what creates the first record, then the records. */
export function SectionShell({
  title,
  empty,
  children,
}: {
  readonly title: string;
  /** Shown while there are no records yet; null once there are. */
  readonly empty: string | null;
  readonly children: ReactNode;
}) {
  return (
    <Stack gap={3}>
      <Text variant="heading">{title}</Text>
      {empty ? (
        <Text variant="bodySmall" tone="muted">
          {empty}
        </Text>
      ) : null}
      {children}
    </Stack>
  );
}

/** A record card's first row: its name and its status, which always carries a word. */
export function RecordHeader({ title, badge }: { readonly title: string; readonly badge: Badge }) {
  return (
    <Row gap={2} justify="between" align="start">
      <Text variant="subheading" className="flex-1">
        {title}
      </Text>
      <StatusChip label={badge.label} tone={badge.tone} size="sm" />
    </Row>
  );
}

/** A label and its figure on one line, read as one phrase ("Margin ₹1,50,000"). */
export function FigureRow({
  label,
  value,
  tone = "primary",
}: {
  readonly label: string;
  /** Already formatted: internal figures are formatted strings, never MoneyText (client amounts only). */
  readonly value: string;
  /** brand for the margin, as on the T5 rate card. */
  readonly tone?: "primary" | "brand" | undefined;
}) {
  return (
    <Row gap={3} justify="between" accessible accessibilityLabel={`${label} ${value}`}>
      <Text variant="bodySmall" tone="body" className="flex-1">
        {label}
      </Text>
      <Text variant="data" tone={tone}>
        {value}
      </Text>
    </Row>
  );
}
