import { type ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Icon } from "../icon";
import { Row } from "../layout";
import { Text } from "../text";
import { internalPanelBoxStyles } from "./internal-panel.styles";

export interface InternalPanelProps extends ViewProps {
  /** The header, shown uppercase; defaults to "Internal · never sent to clients". */
  readonly label?: string | undefined;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly testID?: string | undefined;
}

/**
 * Cost, margin and internal notes on a staff screen: a dashed gold panel headed by a lock and
 * "INTERNAL · NEVER SENT TO CLIENTS".
 *
 * Staff screens only: never render one on a client screen. The panel is a reminder, not the
 * protection: the server never sends a client the internal amounts and notes it would hold
 * (.claude/rules/security.md), and MoneyText never formats them (client amounts only).
 *
 *   <InternalPanel>
 *     <Text variant="data">{`Cost ${formatAmount(line.cost)} · margin ${line.marginPercent}%`}</Text>
 *   </InternalPanel>
 */
export function InternalPanel({
  label = uiCopy.internalPanel.label,
  children,
  className,
  ...rest
}: InternalPanelProps) {
  return (
    <View className={cn(internalPanelBoxStyles(), className)} {...rest}>
      <Row gap={2}>
        <Icon name="lock" tone="brand" size="sm" />
        <Text variant="eyebrow" tone="brand" className="shrink">
          {label}
        </Text>
      </Row>
      {children}
    </View>
  );
}
