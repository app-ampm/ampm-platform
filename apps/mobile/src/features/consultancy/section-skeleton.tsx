import { Skeleton, Stack, Text } from "@ampm/ui";

export interface SectionSkeletonProps {
  /** The heading the section will have: it stays put while the records load. */
  readonly title: string;
  readonly testID?: string | undefined;
}

/**
 * An enquiry sub-section while its query loads, on the client's and the team's screens alike: the
 * Gilda heading it will have, over a placeholder the size and radius of a glass record card.
 */
export function SectionSkeleton({ title, testID }: SectionSkeletonProps) {
  return (
    <Stack gap={3} testID={testID}>
      <Text variant="heading">{title}</Text>
      <Skeleton className="h-32 w-full rounded-lg" />
    </Stack>
  );
}
