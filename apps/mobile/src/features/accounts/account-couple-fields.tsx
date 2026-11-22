import { COUPLE_PERSON_NAME_MAX } from "@ampm/core";
import { Input, Stack, Text } from "@ampm/ui";

import type { DetailsDraft } from "./account-details.form";

type CoupleDraft = Pick<
  DetailsDraft,
  "brideName" | "brideFatherName" | "groomName" | "groomFatherName"
>;

export interface AccountCoupleFieldsProps {
  readonly draft: CoupleDraft;
  readonly patch: (next: Partial<CoupleDraft>) => void;
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
      <Input
        label="Bride's name"
        value={draft.brideName}
        onChangeText={(brideName) => patch({ brideName })}
        maxLength={COUPLE_PERSON_NAME_MAX}
        autoCapitalize="words"
        testID="account-bride-name"
      />
      <Input
        label="Bride's father's name"
        value={draft.brideFatherName}
        onChangeText={(brideFatherName) => patch({ brideFatherName })}
        maxLength={255}
        autoCapitalize="words"
        testID="account-bride-father"
      />
      <Input
        label="Groom's name"
        value={draft.groomName}
        onChangeText={(groomName) => patch({ groomName })}
        maxLength={COUPLE_PERSON_NAME_MAX}
        autoCapitalize="words"
        testID="account-groom-name"
      />
      <Input
        label="Groom's father's name"
        value={draft.groomFatherName}
        onChangeText={(groomFatherName) => patch({ groomFatherName })}
        maxLength={255}
        autoCapitalize="words"
        testID="account-groom-father"
      />
    </Stack>
  );
}
