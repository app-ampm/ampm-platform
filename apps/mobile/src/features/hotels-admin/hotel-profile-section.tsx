import type { ReactNode } from "react";

import { Card, Stack, Text } from "@ampm/ui";

export interface ProfileSectionProps {
  /** The section's heading, read as a header: "Location and access". */
  readonly title: string;
  /** One line under the heading saying what the section holds or who sees it. */
  readonly description?: string | undefined;
  readonly children: ReactNode;
  readonly testID?: string | undefined;
}

/**
 * A titled group of fields inside an editor sheet: a flat card (the sheet is the only glass, so nested
 * sections never blur) with a subheading, then its fields stacked. The hotel profile editor groups its
 * location and access, and its food and beverage, this way.
 *
 *   <ProfileSection title="Food and beverage" testID="hotel-food">…fields…</ProfileSection>
 */
export function ProfileSection({ title, description, children, testID }: ProfileSectionProps) {
  return (
    <Card tone="flat" padding="sm" testID={testID}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Text variant="subheading" accessibilityRole="header">
            {title}
          </Text>
          {description ? (
            <Text variant="bodySmall" tone="muted">
              {description}
            </Text>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Card>
  );
}
