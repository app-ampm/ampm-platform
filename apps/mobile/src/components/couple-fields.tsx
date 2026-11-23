import { COUPLE_PERSON_NAME_MAX } from "@ampm/core";
import { Input, Stack, Text } from "@ampm/ui";

/** The couple as a form holds it: the bride and the groom, each with their father's name. */
export interface CoupleDraft {
  readonly brideName: string;
  readonly brideFatherName: string;
  readonly groomName: string;
  readonly groomFatherName: string;
}

type Side = "bride" | "groom";

const SIDE: Record<
  Side,
  { readonly label: string; readonly name: keyof CoupleDraft; readonly father: keyof CoupleDraft }
> = {
  bride: { label: "Bride", name: "brideName", father: "brideFatherName" },
  groom: { label: "Groom", name: "groomName", father: "groomFatherName" },
};

export interface CoupleFieldsProps {
  readonly couple: CoupleDraft;
  readonly onChange: (next: Partial<CoupleDraft>) => void;
  /** The line under the names, e.g. which name the client takes once both are given. */
  readonly hint: string;
  /** A heading above the names ("Couple"); none when the surrounding card already says it. */
  readonly heading?: string | undefined;
  /** While a save is in flight the names cannot change under it. */
  readonly disabled?: boolean | undefined;
  /** Prefix for each box's testID: `${testIDPrefix}-bride-name`, `-bride-father`, `-groom-…`. */
  readonly testIDPrefix: string;
}

type PartnerFieldsProps = Pick<CoupleFieldsProps, "couple" | "onChange" | "disabled"> & {
  readonly side: Side;
  readonly testIDPrefix: string;
};

/** One of the couple: their name and their father's ("Bride's name", "Bride's father's name"). */
function PartnerFields({ side, couple, onChange, disabled, testIDPrefix }: PartnerFieldsProps) {
  const { label, name, father } = SIDE[side];
  return (
    <>
      <Input
        label={`${label}'s name`}
        value={couple[name]}
        onChangeText={(value) => onChange({ [name]: value })}
        maxLength={COUPLE_PERSON_NAME_MAX}
        autoCapitalize="words"
        disabled={disabled}
        testID={`${testIDPrefix}-${side}-name`}
      />
      <Input
        label={`${label}'s father's name`}
        value={couple[father]}
        onChangeText={(value) => onChange({ [father]: value })}
        maxLength={255}
        autoCapitalize="words"
        disabled={disabled}
        testID={`${testIDPrefix}-${side}-father`}
      />
    </>
  );
}

/**
 * The couple's names as a form asks for them (D-158): the bride and the groom, each with their father's
 * name, and a line under them. Shared by the client hub's Edit details and the lead's Convert card, so
 * both ask in the same words.
 *
 *   <CoupleFields couple={draft} onChange={patch} heading="Couple" hint={hint} testIDPrefix="account" />
 */
export function CoupleFields({
  couple,
  onChange,
  hint,
  heading,
  disabled,
  testIDPrefix,
}: CoupleFieldsProps) {
  const sides = { couple, onChange, disabled, testIDPrefix };
  return (
    <Stack gap={4} testID={`${testIDPrefix}-couple`}>
      {heading ? <Text variant="subheading">{heading}</Text> : null}
      <PartnerFields side="bride" {...sides} />
      <PartnerFields side="groom" {...sides} />
      <Text variant="bodySmall" tone="muted" testID={`${testIDPrefix}-couple-hint`}>
        {hint}
      </Text>
    </Stack>
  );
}
