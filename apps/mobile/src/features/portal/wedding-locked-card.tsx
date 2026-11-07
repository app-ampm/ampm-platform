import { View } from "react-native";

import { Icon, Row, Text, cn } from "@ampm/ui";

/**
 * My Wedding and Approvals stay locked until AMPM is appointed (P2, D4): a dashed card without glass,
 * the lock and the word saying so, never colour alone.
 */
export function WeddingLockedCard({ className }: { readonly className?: string | undefined }) {
  return (
    <View
      className={cn(
        "gap-2 rounded-lg border border-dashed border-primary/32 p-4.5 md:rounded-xl md:p-6",
        className,
      )}
    >
      <Row gap={2}>
        <Icon name="lock" size="sm" tone="muted" label="Locked" />
        <Text variant="eyebrow">My Wedding · Approvals</Text>
      </Row>
      <Text variant="heading">Planning the whole wedding?</Text>
      <Text variant="bodySmall" tone="muted">
        My Wedding and Approvals open once AMPM is appointed.
      </Text>
    </View>
  );
}
