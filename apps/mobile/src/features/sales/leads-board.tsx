import { ScrollView } from "react-native";

import type { LeadStatus, LeadView } from "@ampm/core";
import { Card, cn, Row, Stack, Text, useLayoutAt } from "@ampm/ui";

import { LeadBoardCard } from "./lead-board-card";
import { boardStatuses, statusLabel } from "./sales.format";

export interface LeadsBoardProps {
  /** The loaded leads, newest first; each column keeps that order. */
  readonly leads: readonly LeadView[];
  /** Adds the Closed column at the end; closed (lost) leads stay off the board until asked for. */
  readonly showClosed: boolean;
  readonly onOpen: (leadId: string) => void;
}

/** The leads of each stage, in the order they arrived. */
function byStatus(leads: readonly LeadView[]): ReadonlyMap<LeadStatus, readonly LeadView[]> {
  const columns = new Map<LeadStatus, LeadView[]>();
  for (const lead of leads) {
    const column = columns.get(lead.status);
    if (column) column.push(lead);
    else columns.set(lead.status, [lead]);
  }
  return columns;
}

const leadCount = (count: number): string => (count === 1 ? "1 lead" : `${count} leads`);

interface ColumnProps {
  readonly status: LeadStatus;
  /** The column's floor: T2's shared width from 1024, today's 224 on a tablet. */
  readonly floor: string;
  readonly leads: readonly LeadView[];
  readonly now: number;
  readonly onOpen: (leadId: string) => void;
}

/**
 * One stage: a glass column headed by its name and its count in muted numerals (T2; a count is not a
 * highlight, so no peacock), its leads as flat cards. The columns share the board's width equally (T2's
 * `flex: 1`) down to their floor, past which the board scrolls sideways; a long stage name takes a
 * second line rather than an ellipsis.
 */
function BoardColumn({ status, floor, leads, now, onOpen }: ColumnProps) {
  return (
    <Card
      padding="none"
      // w-0: on the web a sideways scroller sizes its row by each column's widest content; a zero width
      // makes the floor a column's whole claim, so the columns share the board instead. 8 and the
      // card's 10 at the sides (T2: 10 and 12) leave a flag chip its full width in seven columns at 1440.
      className={cn("w-0 flex-1 basis-0 px-2 py-3.5", floor)}
      testID={`leads-column-${status}`}
    >
      <Row gap={2} justify="between" align="start" className="px-1.5 pb-2">
        <Text variant="label" accessibilityRole="header" numberOfLines={2} className="flex-1">
          {statusLabel(status)}
        </Text>
        <Text variant="data" tone="muted" accessibilityLabel={leadCount(leads.length)}>
          {String(leads.length)}
        </Text>
      </Row>
      <Stack gap={2}>
        {leads.length === 0 ? (
          <Text variant="caption" className="px-1.5">
            No leads
          </Text>
        ) : (
          leads.map((lead) => (
            <LeadBoardCard key={lead.id} lead={lead} now={now} onPress={() => onOpen(lead.id)} />
          ))
        )}
      </Stack>
    </Card>
  );
}

/**
 * The pipeline as a board (T2, from 768 up): one glass column per stage in the status machine's
 * order, New to Converted, plus Closed at the end when `showClosed`. The columns fill the board's width
 * and scroll sideways once their floor runs wider than the window: 144 from 1024, so a 1440 desktop
 * holds every open stage and Converted; 224 on a tablet, where the cards would be too narrow to read.
 *
 *   <LeadsBoard leads={page.items} showClosed={false} onOpen={openLead} />
 */
export function LeadsBoard({ leads, showClosed, onOpen }: LeadsBoardProps) {
  const columns = byStatus(leads);
  const floor = useLayoutAt("lg") ? "min-w-36" : "min-w-56";
  const now = Date.now();
  return (
    <ScrollView
      horizontal
      // grow: the columns fill the board when they fit, and push it wider (scrolling) when not.
      contentContainerClassName="min-w-full grow gap-2.5 pb-2"
      accessibilityLabel="Pipeline by stage"
      testID="leads-board"
    >
      {boardStatuses(showClosed).map((status) => (
        <BoardColumn
          key={status}
          status={status}
          floor={floor}
          leads={columns.get(status) ?? []}
          now={now}
          onOpen={onOpen}
        />
      ))}
    </ScrollView>
  );
}
