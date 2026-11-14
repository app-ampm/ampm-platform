import type { LeadView } from "@ampm/core";
import { Avatar, Card, Row, Stack, Text } from "@ampm/ui";

import { hasLeadFlags, LeadFlagChips } from "./lead-flag-chips";
import { formatAge, leadPlan, leadSummary } from "./sales.format";

export interface LeadBoardCardProps {
  readonly lead: LeadView;
  /** The time ages are measured to, in milliseconds: the board reads the clock once for every card. */
  readonly now: number;
  readonly onPress: () => void;
}

/** What the card says to a screen reader: the card is one button, so its label carries what it shows. */
function cardLabel(lead: LeadView, plan: string | null): string {
  return [
    `Lead from ${lead.name}: ${leadSummary(lead)}`,
    plan,
    `Source ${lead.source.name}`,
    lead.ownerName ? `Owner ${lead.ownerName}` : null,
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * One lead in a pipeline column (T2): the name, where and when as data, the flags Sales acts on, then
 * the source and age with the owner's initials. Flat, since the column around it is the glass.
 *
 *   <LeadBoardCard lead={lead} now={Date.now()} onPress={() => openLead(lead.id)} />
 */
export function LeadBoardCard({ lead, now, onPress }: LeadBoardCardProps) {
  const plan = leadPlan(lead);
  return (
    <Card
      tone="flat"
      padding="none"
      className="px-2.5 py-3"
      onPress={onPress}
      accessibilityLabel={cardLabel(lead, plan)}
      testID={`lead-card-${lead.id}`}
    >
      <Stack gap={1.5}>
        {/* Columns can be narrow on a laptop: a long name wraps once rather than losing its end. */}
        <Text variant="label" numberOfLines={2}>
          {lead.name}
        </Text>
        {plan ? (
          <Text variant="data" tone="muted" numberOfLines={2}>
            {plan}
          </Text>
        ) : null}
        {hasLeadFlags(lead) ? (
          <Row gap={1.5} wrap>
            <LeadFlagChips lead={lead} />
          </Row>
        ) : null}
        {/* A narrow column (seven stages share a laptop's width) wraps the owner under the source and
            age, at the end, rather than cutting the age off. */}
        <Row gap={2} justify="between" wrap className="pt-1">
          <Text variant="eyebrow" className="shrink">
            {`${lead.source.name} · ${formatAge(lead.createdAt, now)}`}
          </Text>
          {lead.ownerName ? (
            <Avatar name={lead.ownerName} size="sm" tone="highlight" className="ml-auto" />
          ) : null}
        </Row>
      </Stack>
    </Card>
  );
}
