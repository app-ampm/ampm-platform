import { COUPLE_PERSON_NAME_MAX } from "@ampm/core";
import { Input, Stack, Text } from "@ampm/ui";

import { convertCoupleHint, type ConvertCoupleDraft } from "./lead-convert.form";

export interface LeadConvertCoupleProps {
  readonly couple: ConvertCoupleDraft;
  readonly onChange: (next: ConvertCoupleDraft) => void;
  /** While the convert is in flight the names cannot change under it. */
  readonly disabled: boolean;
}

/**
 * The couple on the Convert card: the bride's and groom's names, both optional. With both, the new client
 * is named after the couple; the line under them says which name the client will take.
 *
 *   <LeadConvertCouple couple={couple} onChange={setCouple} disabled={convert.isPending} />
 */
export function LeadConvertCouple({ couple, onChange, disabled }: LeadConvertCoupleProps) {
  return (
    <Stack gap={3} testID="convert-couple">
      <Input
        label="Bride's name"
        value={couple.brideName}
        onChangeText={(brideName) => onChange({ ...couple, brideName })}
        maxLength={COUPLE_PERSON_NAME_MAX}
        autoCapitalize="words"
        disabled={disabled}
        testID="convert-bride-name"
      />
      <Input
        label="Groom's name"
        value={couple.groomName}
        onChangeText={(groomName) => onChange({ ...couple, groomName })}
        maxLength={COUPLE_PERSON_NAME_MAX}
        autoCapitalize="words"
        disabled={disabled}
        testID="convert-groom-name"
      />
      <Text variant="bodySmall" tone="muted" testID="convert-couple-hint">
        {convertCoupleHint(couple)}
      </Text>
    </Stack>
  );
}
