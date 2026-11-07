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
      className="p-3"
      onPress={onPress}
      accessibilityLabel={cardLabel(lead, plan)}
      testID={`lead-card-${lead.id}`}
    >
      <Stack gap={1.5}>
        <Text variant="label" numberOfLines={1}>
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
        <Row gap={2} justify="between" className="pt-1">
          <Text variant="eyebrow" numberOfLines={1} className="flex-1">
            {`${lead.source.name} · ${formatAge(lead.createdAt, now)}`}
          </Text>
          {lead.ownerName ? <Avatar name={lead.ownerName} size="sm" tone="highlight" /> : null}
        </Row>
      </Stack>
    </Card>
  );
}
