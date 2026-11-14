import type { ReactNode } from "react";

import { Card, Row, Text } from "@ampm/ui";

export interface HotelSectionCardProps {
  /** The card's Gilda title: "Venues", "Rates", "Facilities". */
  readonly title: string;
  /** At the right of the title: a muted note ("Shown with the family's permission") or a chip. */
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
  readonly testID?: string | undefined;
}

/**
 * One glass panel of the desktop hotel page (D6): a 28px Gilda title with an optional note or chip at
 * its right, then the section. D6's panels have 30 above and below and 32 at the sides.
 */
export function HotelSectionCard({ title, trailing, children, testID }: HotelSectionCardProps) {
  return (
    <Card padding="lg" className="gap-4 lg:px-8 lg:py-7.5" testID={testID}>
      <Row gap={3} justify="between" align="center" wrap>
        <Text variant="heading" className="text-3xl">
          {title}
        </Text>
        {typeof trailing === "string" ? (
          <Text variant="eyebrow" tone="muted">
            {trailing}
          </Text>
        ) : (
          trailing
        )}
      </Row>
      {children}
    </Card>
  );
}
