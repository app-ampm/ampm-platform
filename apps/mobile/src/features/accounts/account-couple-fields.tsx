import { COUPLE_PERSON_NAME_MAX } from "@ampm/core";
import { Input, Stack, Text } from "@ampm/ui";

import type { DetailsDraft } from "./account-details.form";

type CoupleDraft = Pick<
  DetailsDraft,
  "brideName" | "brideFatherName" | "groomName" | "groomFatherName"
>;

type Side = "bride" | "groom";

const SIDE: Record<
  Side,
  { readonly label: string; readonly name: keyof CoupleDraft; readonly father: keyof CoupleDraft }
> = {
  bride: { label: "Bride", name: "brideName", father: "brideFatherName" },
  groom: { label: "Groom", name: "groomName", father: "groomFatherName" },
};

export interface AccountCoupleFieldsProps {
  readonly draft: CoupleDraft;
  readonly patch: (next: Partial<CoupleDraft>) => void;
}

/** One of the couple: their name and their father's ("Bride's name", "Bride's father's name"). */
function PartnerFields({ side, draft, patch }: AccountCoupleFieldsProps & { readonly side: Side }) {
  const { label, name, father } = SIDE[side];
  return (
    <>
      <Input
        label={`${label}'s name`}
        value={draft[name]}
        onChangeText={(value) => patch({ [name]: value })}
        maxLength={COUPLE_PERSON_NAME_MAX}
        autoCapitalize="words"
        testID={`account-${side}-name`}
      />
      <Input
        label={`${label}'s father's name`}
        value={draft[father]}
        onChangeText={(value) => patch({ [father]: value })}
        maxLength={255}
        autoCapitalize="words"
        testID={`account-${side}-father`}
      />
    </>
  );
}

/**
 * The couple in the edit-details sheet: the bride and the groom, each with their father's name. Once
 * both the bride's and the groom's names are given the client takes their names ("Priya & Arjun").
 *
 *   <AccountCoupleFields draft={draft} patch={patch} />
 */
export function AccountCoupleFields({ draft, patch }: AccountCoupleFieldsProps) {
  return (
    <Stack gap={4} testID="account-couple-fields">
      <Stack gap={1}>
        <Text variant="subheading">Couple</Text>
        <Text variant="bodySmall" tone="muted">
          Once the bride and the groom are both named, the client takes their names.
        </Text>
      </Stack>
      <PartnerFields side="bride" draft={draft} patch={patch} />
      <PartnerFields side="groom" draft={draft} patch={patch} />
    </Stack>
  );
}
