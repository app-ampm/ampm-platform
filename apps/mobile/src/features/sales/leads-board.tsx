import { ScrollView } from "react-native";

import type { LeadStatus, LeadView } from "@ampm/core";
import { Card, Row, Stack, Text } from "@ampm/ui";

import { LeadBoardCard } from "./lead-board-card";
import { PIPELINE_STATUSES, statusLabel } from "./sales.format";

export interface LeadsBoardProps {
  /** The loaded leads, newest first; each column keeps that order. */
  readonly leads: readonly LeadView[];
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
  readonly leads: readonly LeadView[];
  readonly now: number;
  readonly onOpen: (leadId: string) => void;
}

/**
 * One stage: a glass column headed by its name and its count in muted numerals (T2; a count is not a
 * highlight, so no peacock), its leads as flat cards.
 */
function BoardColumn({ status, leads, now, onOpen }: ColumnProps) {
  return (
    <Card padding="none" className="w-56 px-2.5 py-3.5" testID={`leads-column-${status}`}>
      <Row gap={2} justify="between" className="px-1.5 pb-2">
        <Text variant="label" accessibilityRole="header" numberOfLines={1} className="flex-1">
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
 * order, New to Closed, scrolling sideways once the stages run wider than the window.
 *
 *   <LeadsBoard leads={page.items} onOpen={openLead} />
 */
export function LeadsBoard({ leads, onOpen }: LeadsBoardProps) {
  const columns = byStatus(leads);
  const now = Date.now();
  return (
    <ScrollView
      horizontal
      contentContainerClassName="gap-2.5 pb-2"
      accessibilityLabel="Pipeline by stage"
      testID="leads-board"
    >
      {PIPELINE_STATUSES.map((status) => (
        <BoardColumn
          key={status}
          status={status}
          leads={columns.get(status) ?? []}
          now={now}
          onOpen={onOpen}
        />
      ))}
    </ScrollView>
  );
}
