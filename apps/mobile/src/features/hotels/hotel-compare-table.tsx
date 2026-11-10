import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import { formatAmount, type HotelCompareItem, type HotelRatesView } from "@ampm/core";
import { MoneyText, Row, Stack, Text } from "@ampm/ui";

import {
  destinationLabel,
  headlineCaption,
  headlineRate,
  rateAmounts,
  roomsLabel,
  starLabel,
} from "./hotels.format";

export interface HotelCompareTableProps {
  readonly items: readonly HotelCompareItem[];
}

interface CompareAttr {
  readonly label: string;
  /** The plain value — shown when there is no richer render, and always the cell's spoken value. */
  readonly text: (item: HotelCompareItem) => string;
  readonly render?: (item: HotelCompareItem) => ReactNode;
}

const ATTRS: readonly CompareAttr[] = [
  { label: "Destination", text: (item) => destinationLabel(item.destination) },
  { label: "Rooms", text: (item) => (item.totalRooms != null ? roomsLabel(item.totalRooms) : "—") },
  {
    label: "Rate",
    text: (item) => rateText(item.rates),
    render: (item) => <RateCell rates={item.rates} />,
  },
];

/**
 * The saved hotels side by side (CP-06, feature 9.4c): one column per hotel, the decision fields as aligned
 * rows (name/star, destination, rooms, indicative rate). Columns share a fixed width so the rows line up and
 * the table scrolls horizontally for three or four hotels. Every cell carries its own screen-reader label —
 * "<hotel>, <field>: <value>" — because the visual column alignment that ties a value to its hotel and field
 * is invisible to VoiceOver/TalkBack (WCAG 1.3.1).
 */
export function HotelCompareTable({ items }: HotelCompareTableProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Hotel comparison"
    >
      <Stack gap={0}>
        <CompareRow
          label=""
          cells={items.map((item) => (
            <Cell key={item.id} label={headerLabel(item)}>
              <HeaderCell item={item} />
            </Cell>
          ))}
        />
        {ATTRS.map((attr) => (
          <CompareRow
            key={attr.label}
            label={attr.label}
            cells={items.map((item) => (
              <Cell key={item.id} label={`${item.name}, ${attr.label}: ${attr.text(item)}`}>
                {attr.render ? (
                  attr.render(item)
                ) : (
                  <Text variant="bodySmall">{attr.text(item)}</Text>
                )}
              </Cell>
            ))}
          />
        ))}
      </Stack>
    </ScrollView>
  );
}

/** One attribute across every hotel: a fixed-width label cell then the hotel cells. */
function CompareRow({
  label,
  cells,
}: {
  readonly label: string;
  readonly cells: readonly ReactNode[];
}) {
  return (
    <Row gap={0} align="stretch" className="border-t border-primary/16">
      <Text variant="caption" tone="muted" className="w-24 px-3 py-2">
        {label}
      </Text>
      {cells}
    </Row>
  );
}

/** A fixed-width hotel cell that announces itself as one screen-reader node with its full label. */
function Cell({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Stack
      gap={0}
      accessible
      accessibilityLabel={label}
      className="w-40 border-l border-primary/16 px-3 py-2"
    >
      {children}
    </Stack>
  );
}

function headerLabel(item: HotelCompareItem): string {
  return item.starCategory ? `${item.name}, ${starLabel(item.starCategory)}` : item.name;
}

/** A hotel's column header: its name (allowed to wrap, never clipped, so it survives large font) and star. */
function HeaderCell({ item }: { readonly item: HotelCompareItem }) {
  return (
    <Stack gap={0}>
      <Text variant="label">{item.name}</Text>
      <Text variant="caption" tone="muted">
        {item.starCategory ? starLabel(item.starCategory) : "—"}
      </Text>
    </Stack>
  );
}

/** The hotel's indicative headline rate, or "On request", as one text string (the cell's spoken value). */
function rateText(rates: HotelRatesView): string {
  const item = headlineRate(rates);
  if (!item) return "On request";
  const { amount, amountMax } = rateAmounts(item);
  const money = amountMax
    ? `${formatAmount(amount)}–${formatAmount(amountMax)}`
    : formatAmount(amount);
  return `${money} ${headlineCaption(item, rates)}`;
}

/** The rate shown with MoneyText; the enclosing Cell carries the spoken label, so this stays purely visual. */
function RateCell({ rates }: { readonly rates: HotelRatesView }) {
  const item = headlineRate(rates);
  if (!item)
    return (
      <Text variant="bodySmall" tone="muted">
        On request
      </Text>
    );
  const { amount, amountMax } = rateAmounts(item);
  return (
    <Stack gap={0}>
      <MoneyText amount={amount} amountMax={amountMax} variant="body" />
      <Text variant="caption" tone="muted">
        {headlineCaption(item, rates)}
      </Text>
    </Stack>
  );
}
