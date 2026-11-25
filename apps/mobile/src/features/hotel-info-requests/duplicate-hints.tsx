import { useHotelDuplicateHints } from "@ampm/api-client";
import type { HotelDuplicateHint } from "@ampm/core";
import {
  Button,
  Card,
  Icon,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useDebouncedValue,
} from "@ampm/ui";

import { hotelStatusLabel, hotelStatusTone } from "../hotels-admin/hotels-admin.format";
import { duplicateHintReasons } from "./info-requests.format";

/** A hinted hotel's name and status, where it is, and why it is a hint. */
function HintFacts({ hint }: { readonly hint: HotelDuplicateHint }) {
  const place = [hint.destinationName, hint.website].filter(Boolean).join(" · ");
  return (
    <Stack gap={1} className="flex-1">
      <Row gap={2} align="center" wrap>
        <Text variant="body">{hint.name}</Text>
        <StatusChip
          label={hint.deletedAt ? "Deleted" : hotelStatusLabel(hint.status)}
          tone={hint.deletedAt ? "neutral" : hotelStatusTone(hint.status)}
          size="sm"
        />
      </Row>
      <Text variant="bodySmall" tone="muted">
        {place}
      </Text>
      <Text variant="bodySmall" tone="body">
        {duplicateHintReasons(hint)}
      </Text>
    </Stack>
  );
}

/** One hinted hotel, and the way to its record (a deleted hotel has none). */
function HintRow({
  hint,
  onOpenHotel,
}: {
  readonly hint: HotelDuplicateHint;
  readonly onOpenHotel: ((hotelId: string) => void) | undefined;
}) {
  return (
    <Row gap={3} align="center" justify="between" testID={`duplicate-hint-${hint.hotelId}`}>
      <HintFacts hint={hint} />
      {onOpenHotel && !hint.deletedAt ? (
        <Button
          variant="ghost"
          size="sm"
          iconEnd="arrow-right"
          accessibilityLabel={`Open ${hint.name}`}
          onPress={() => onOpenHotel(hint.hotelId)}
          testID={`duplicate-hint-${hint.hotelId}-open`}
        >
          Open
        </Button>
      ) : null}
    </Row>
  );
}

/** The hinted hotels, strongest first, on a flat panel. */
function HintsList({
  hints,
  onOpenHotel,
}: {
  readonly hints: readonly HotelDuplicateHint[];
  readonly onOpenHotel: ((hotelId: string) => void) | undefined;
}) {
  return (
    <Card tone="flat" padding="sm">
      <Stack gap={3}>
        <Text variant="bodySmall" tone="brand" accessibilityLiveRegion="polite">
          {hints.length === 1
            ? "1 hotel in the catalogue may be this one"
            : `${hints.length} hotels in the catalogue may be this one`}
        </Text>
        {hints.map((hint) => (
          <HintRow key={hint.hotelId} hint={hint} onOpenHotel={onOpenHotel} />
        ))}
      </Stack>
    </Card>
  );
}

function HintsBody({
  hints,
  onOpenHotel,
}: {
  readonly hints: ReturnType<typeof useHotelDuplicateHints>;
  readonly onOpenHotel: ((hotelId: string) => void) | undefined;
}) {
  if (hints.isError) {
    return (
      <Row gap={2} align="center" wrap>
        <Text variant="bodySmall" tone="brand" accessibilityRole="alert">
          Could not check the catalogue for this hotel.
        </Text>
        <Button variant="ghost" size="sm" onPress={() => void hints.refetch()}>
          Try again
        </Button>
      </Row>
    );
  }
  if (!hints.data) return <Skeleton className="h-12 w-full" testID="duplicate-hints-loading" />;
  if (hints.data.length === 0) {
    return (
      <Row gap={2} align="center">
        <Icon name="check-circle" tone="primary" size="sm" />
        <Text variant="bodySmall" accessibilityLiveRegion="polite">
          No hotel in the catalogue matches so far.
        </Text>
      </Row>
    );
  }
  return <HintsList hints={hints.data} onOpenHotel={onOpenHotel} />;
}

export interface DuplicateHintsProps {
  /** The proposed name and web address as typed; asked after a pause in typing. */
  readonly name: string;
  readonly webAddress: string;
  /** Leaves the sheet for a hinted hotel's record; a deleted hotel has none to open. */
  readonly onOpenHotel?: ((hotelId: string) => void) | undefined;
}

/**
 * The catalogue hotels a proposed new hotel may already be (D-188 §3 and §7), as the name and the web
 * address are typed, after a pause: the same name or another of its names, the same web address or host,
 * deleted hotels included (their web address stays taken). A host several hotels share is weak evidence
 * and says so. Nothing shows until a name or an address has three characters.
 *
 *   <DuplicateHints name={draft.proposedName} webAddress={draft.proposedWebAddress} onOpenHotel={open} />
 */
export function DuplicateHints({ name, webAddress, onOpenHotel }: DuplicateHintsProps) {
  const settledName = useDebouncedValue(name.trim());
  const settledAddress = useDebouncedValue(webAddress.trim());
  const hints = useHotelDuplicateHints({ name: settledName, webAddress: settledAddress });
  // Idle with no answer: nothing typed reads as a name or an address yet.
  if (hints.fetchStatus === "idle" && !hints.data && !hints.isError) return null;
  return (
    <Stack gap={2} testID="duplicate-hints">
      <Text variant="eyebrow" tone="muted" accessibilityRole="header">
        Already in the catalogue?
      </Text>
      <HintsBody hints={hints} onOpenHotel={onOpenHotel} />
    </Stack>
  );
}
