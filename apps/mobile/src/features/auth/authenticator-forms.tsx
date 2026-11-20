import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Button, Stack, Text } from "@ampm/ui";

import { CodeForm } from "./staff-sign-in-forms";

interface EnrollFormProps {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly onSubmit: (code: string) => void;
  readonly pending: boolean;
  readonly errorText: string | undefined;
  readonly cta?: string | undefined;
}

/**
 * Adding the authenticator: the QR code to scan, the key to type when scanning is not possible, and the
 * first code to prove it works.
 */
export function EnrollForm({
  secret,
  otpauthUri,
  onSubmit,
  pending,
  errorText,
  cta,
}: EnrollFormProps) {
  return (
    <Stack gap={6}>
      <View className="items-center">
        <QRCode value={otpauthUri} size={180} />
      </View>
      <Stack gap={1}>
        <Text variant="caption">Can&rsquo;t scan? Enter this key in your authenticator app:</Text>
        <Text variant="mono" selectable>
          {secret}
        </Text>
      </Stack>
      <CodeForm
        label="Authenticator code"
        cta={cta ?? "Verify and finish"}
        onSubmit={onSubmit}
        pending={pending}
        errorText={errorText}
      />
    </Stack>
  );
}

interface RecoveryCodesFormProps {
  readonly codes: readonly string[];
  readonly onDone: () => void;
}

/**
 * The ten recovery codes, shown once (D-142): each signs in once in place of the authenticator code, for
 * a lost or replaced phone. Nothing shows them again; an administrator can reset the authenticator.
 */
export function RecoveryCodesForm({ codes, onDone }: RecoveryCodesFormProps) {
  return (
    <Stack gap={6}>
      <Text variant="body">
        Save these recovery codes somewhere safe, such as a password manager. Each one signs you in
        once if you lose your phone. They will not be shown again.
      </Text>
      <View className="flex-row flex-wrap gap-2" testID="recovery-codes">
        {codes.map((code) => (
          <View key={code} className="w-5/12 rounded-lg border border-primary/16 p-2">
            <Text variant="mono" selectable>
              {code}
            </Text>
          </View>
        ))}
      </View>
      <Button fullWidth size="lg" onPress={onDone}>
        I&rsquo;ve saved them
      </Button>
    </Stack>
  );
}
