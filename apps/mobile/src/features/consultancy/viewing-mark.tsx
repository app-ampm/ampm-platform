import { Text } from "@ampm/ui";

/**
 * The word that marks the card open beside a list (D8's requests, T6's queue), so the selected card
 * never rests on its peacock stroke and tint alone (code.md: never colour alone). Pearl, not peacock:
 * peacock is never small text. Nothing on the other cards.
 */
export function ViewingMark({ selected }: { readonly selected: boolean }) {
  if (!selected) return null;
  return (
    <Text variant="eyebrow" tone="primary">
      Viewing
    </Text>
  );
}
