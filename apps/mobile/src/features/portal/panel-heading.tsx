import type { ReactNode } from "react";

import { Row, Text } from "@ampm/ui";

export interface PanelHeadingProps {
  /** The panel's name ("My selection", "Enquiries"). */
  readonly title: string;
  /** The panel's links at the right: "Compare →", "All →". */
  readonly children?: ReactNode;
}

/** A home panel's heading row (D4, P2): the name, and its links at the right. */
export function PanelHeading({ title, children }: PanelHeadingProps) {
  return (
    <Row gap={3} justify="between" align="center">
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      {children ? <Row gap={4}>{children}</Row> : null}
    </Row>
  );
}
