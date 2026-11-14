import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";

import type { HotelCompareItem } from "@ampm/core";
import { spacingPx } from "@ampm/tokens";
import { cn, MoneyText, PhotoPlaceholder, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

import {
  compareAttrs,
  compareCellText,
  compareFreshnessChip,
  rateForType,
  type CompareAttr,
} from "./hotel-compare.format";
import {
  hasRateAmounts,
  percentLabel,
  rateAmounts,
  rateUnitLabel,
  starLabel,
} from "./hotels.format";

export interface HotelCompareTableProps {
  readonly items: readonly HotelCompareItem[];
  /**
   * Cover photos by hotel id, for the column headings. The compare read is media-free (its `coverUrl` is
   * null), so the screen passes the shortlist's covers; a hotel without one keeps the striped stand-in.
   */
  readonly covers?: ReadonlyMap<string, string> | undefined;
}

/**
 * Every column shares the row (`flex-1`) so the table fills its card on a desktop (D7's `1fr` columns),
 * and keeps a floor so a phone scrolls it sideways instead of crushing it: the labels 96, a hotel 160.
 * The labels stop at 320 (D7's is 314), so two hotels take the room rather than a wide empty margin.
 */
const LABEL_COLUMN = "min-w-24 max-w-80 flex-1 basis-0";
const HOTEL_COLUMN = "min-w-40 flex-1 basis-0";
/** D7's 20 between the columns on a desktop; 12 on a phone, where every point counts. */
const ROW = "flex-row gap-3 lg:gap-5";

/** The floors above plus the widest gap: below this the table scrolls rather than squeeze a column. */
function minTableWidth(hotels: number): number {
  return spacingPx["24"] + hotels * (spacingPx["40"] + spacingPx["5"]);
}

/**
 * The saved hotels side by side (CP-06, feature 9.4c; D7): a label column, then one column per hotel
 * headed by its photo and name, the decision fields as aligned rows (where, seats, rooms, each rate type
 * any of them prices, and the rates' freshness). The columns share the width, so the table fills a desktop
 * card and scrolls sideways on a phone. Every cell carries its own screen-reader label — "<hotel>,
 * <field>: <value>" — because the visual alignment that ties a value to its hotel and field is invisible
 * to VoiceOver/TalkBack (WCAG 1.3.1).
 */
export function HotelCompareTable({ items, covers }: HotelCompareTableProps) {
  const attrs = compareAttrs(items);
  const [visible, setVisible] = useState(0);
  // The table is the card's measured width, or its floor when that is wider (a phone): a sideways
  // ScrollView would otherwise size it to its longest unwrapped texts, scrolling where it could wrap.
  const width = Math.max(visible, minTableWidth(items.length));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Hotel comparison"
      onLayout={(event) => setVisible(event.nativeEvent.layout.width)}
    >
      <View style={{ width }} testID="compare-table">
        <View className={cn(ROW, "items-stretch pb-4.5 pt-1 lg:pt-4.5")}>
          <View className={LABEL_COLUMN} />
          {items.map((item, index) => (
            <Cell key={item.id} label={headerLabel(item)} className="justify-start">
              <HeaderCell item={item} cover={item.coverUrl ?? covers?.get(item.id)} index={index} />
            </Cell>
          ))}
        </View>
        {attrs.map((attr) => (
          <AttrRow key={attr.key} attr={attr} items={items} />
        ))}
      </View>
    </ScrollView>
  );
}

/** One field across every hotel: its label, then each hotel's value. */
function AttrRow({
  attr,
  items,
}: {
  readonly attr: CompareAttr;
  readonly items: readonly HotelCompareItem[];
}) {
  return (
    <View className={cn(ROW, "items-center border-t border-primary/10 py-3.5")}>
      <Text variant="caption" tone="muted" className={cn(LABEL_COLUMN, "uppercase tracking-label")}>
        {attr.label}
      </Text>
      {items.map((item) => (
        <Cell key={item.id} label={`${item.name}, ${attr.label}: ${compareCellText(attr, item)}`}>
          <CellValue attr={attr} item={item} />
        </Cell>
      ))}
    </View>
  );
}

interface CellProps {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/** A hotel's cell, announced as one screen-reader node with its full label. */
function Cell({ label, className, children }: CellProps) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      className={cn(HOTEL_COLUMN, "justify-center", className)}
    >
      {children}
    </View>
  );
}

function headerLabel(item: HotelCompareItem): string {
  return item.starCategory ? `${item.name}, ${starLabel(item.starCategory)}` : item.name;
}

interface HeaderCellProps {
  readonly item: HotelCompareItem;
  readonly cover: string | null | undefined;
  /** The column's place: the stand-ins alternate gold and peacock bands, as D7's do. */
  readonly index: number;
}

/** A hotel's column heading (D7): its photo (130 on a desktop), its name in Gilda (allowed to wrap) and star. */
function HeaderCell({ item, cover, index }: HeaderCellProps) {
  const photoClass = "h-24 w-full rounded-lg lg:h-32";
  return (
    <Stack gap={2.5}>
      {cover ? (
        <MediaImage
          uri={cover}
          alt={`Photo of ${item.name}`}
          radius="none"
          className={photoClass}
        />
      ) : (
        <PhotoPlaceholder
          label={`Hotel photo · ${item.destination.name}`}
          showLabel={false}
          tone={index % 2 === 0 ? "gold" : "peacock"}
          className={photoClass}
        />
      )}
      <Stack gap={1}>
        <Text variant="heading" className="text-xl lg:text-2xl">
          {item.name}
        </Text>
        <Text variant="caption" tone="muted">
          {item.starCategory ? starLabel(item.starCategory) : "—"}
        </Text>
      </Stack>
    </Stack>
  );
}

/** A cell's visible value; the enclosing Cell carries the spoken label, so this stays purely visual. */
function CellValue({
  attr,
  item,
}: {
  readonly attr: CompareAttr;
  readonly item: HotelCompareItem;
}) {
  if (attr.kind === "freshness") {
    const chip = compareFreshnessChip(item.rates);
    return (
      <View className="items-start">
        <StatusChip label={chip.label} tone={chip.tone} dot={chip.dot} size="sm" />
      </View>
    );
  }
  if (attr.kind === "rate") return <RateValue item={item} attr={attr} />;
  return (
    <Text tone="primary" className="text-sm lg:text-base">
      {attr.text(item)}
    </Text>
  );
}

/** One rate type's amounts with their unit; "On request" when the rates show none, "—" when not priced. */
function RateValue({
  item,
  attr,
}: {
  readonly item: HotelCompareItem;
  readonly attr: Extract<CompareAttr, { kind: "rate" }>;
}) {
  const rate = rateForType(item.rates, attr.type);
  if (!rate)
    return (
      <Text variant="bodySmall" tone="muted">
        {hasRateAmounts(item.rates) ? "—" : "On request"}
      </Text>
    );
  return (
    <Row gap={1} align="center" wrap>
      {rate.unit === "percent" ? (
        <Text variant="data" className="lg:text-base">
          {percentLabel(rate)}
        </Text>
      ) : (
        <MoneyText {...rateAmounts(rate)} className="lg:text-base" />
      )}
      <Text variant="caption" tone="muted">
        {rateUnitLabel(rate.unit)}
      </Text>
    </Row>
  );
}
