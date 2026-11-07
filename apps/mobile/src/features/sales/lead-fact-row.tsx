import { Row, Stack, Text } from "@ampm/ui";

export interface LeadFactRowProps {
  readonly label: string;
  /** Null shows a dash, read aloud as "not given". */
  readonly value: string | null;
  /** Dates, counts and phone numbers: tabular data figures. */
  readonly isData?: boolean | undefined;
  /** `row` (default) puts the label beside the value; `stacked` above it, for long text. */
  readonly layout?: "row" | "stacked" | undefined;
  /** `body` (pearl 80%) on gold or peacock glass, where pearl 58% falls under 4.5:1. */
  readonly labelTone?: "muted" | "body" | undefined;
}

/**
 * One fact on a lead's glass card (T3): the label in pearl 58% (80% on gold glass), the value in
 * pearl, read aloud as one line ("Dates: 12–14 FEB 2027").
 *
 *   <LeadFactRow label="Dates" value={formatStay(lead.tentativeDateFrom, lead.tentativeDateTo)} isData />
 *   <LeadFactRow label="Requirements" value={lead.requirements} layout="stacked" />
 */
export function LeadFactRow({
  label,
  value,
  isData = false,
  layout = "row",
  labelTone = "muted",
}: LeadFactRowProps) {
  const spoken = `${label}: ${value ?? "not given"}`;
  const variant = isData ? "data" : "bodySmall";
  if (layout === "stacked") {
    return (
      <Stack gap={1} accessible accessibilityLabel={spoken}>
        <Text variant="bodySmall" tone={labelTone}>
          {label}
        </Text>
        <Text variant={variant} tone="primary">
          {value ?? "—"}
        </Text>
      </Stack>
    );
  }
  return (
    <Row gap={4.5} align="start" accessible accessibilityLabel={spoken}>
      <Text variant="bodySmall" tone={labelTone} className="w-32">
        {label}
      </Text>
      <Text variant={variant} tone="primary" className="flex-1">
        {value ?? "—"}
      </Text>
    </Row>
  );
}
