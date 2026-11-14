import { View } from "react-native";

import type { MediaRightsStatus, MediaVisibility } from "@ampm/core";
import { Input, Stack, Text } from "@ampm/ui";

import { MediaOptionPicker } from "./media-option-picker";
import {
  isClientFacing,
  RIGHTS_OPTIONS,
  rightsClearedForClients,
  rightsLabel,
  VISIBILITY_OPTIONS,
  visibilityLabel,
} from "./media.format";

/** The editable detail of a media asset: its caption, who can see it, and its rights. */
export interface MediaDraft {
  readonly caption: string;
  readonly visibility: MediaVisibility;
  readonly rights: MediaRightsStatus;
}

/** The GP-20 warning shown before a client-facing visibility is saved without cleared rights. */
function RightsHint() {
  return (
    // A live region so a screen reader announces the warning the moment a client-facing visibility is set.
    <View accessibilityLiveRegion="polite">
      <Text variant="bodySmall" tone="muted" testID="media-rights-hint">
        Set rights to Owned, Licensed or Consent on file before showing clients.
      </Text>
    </View>
  );
}

/**
 * The caption / who-can-see-it / rights fields shared by the add and edit sheets, with the GP-20 warning
 * mirrored from the server (an asset only reaches clients once its rights are cleared). Presentational:
 * the draft comes in, changes go out through `onChange`.
 */
export function MediaDetailsFields({
  draft,
  onChange,
}: {
  readonly draft: MediaDraft;
  readonly onChange: (patch: Partial<MediaDraft>) => void;
}) {
  const needsRights = isClientFacing(draft.visibility) && !rightsClearedForClients(draft.rights);
  return (
    <Stack gap={4}>
      <Input
        label="Caption"
        value={draft.caption}
        onChangeText={(value) => onChange({ caption: value })}
        placeholder="e.g. Lakeside pavilion at dusk"
        helpText="Shown to clients in the gallery"
        testID="media-caption"
      />
      <MediaOptionPicker
        label="Who can see it"
        value={draft.visibility}
        options={VISIBILITY_OPTIONS}
        optionLabel={visibilityLabel}
        onChange={(visibility) => onChange({ visibility })}
        testID="media-visibility"
      />
      <MediaOptionPicker
        label="Rights"
        value={draft.rights}
        options={RIGHTS_OPTIONS}
        optionLabel={rightsLabel}
        onChange={(rights) => onChange({ rights })}
        testID="media-rights"
      />
      {needsRights ? <RightsHint /> : null}
    </Stack>
  );
}
