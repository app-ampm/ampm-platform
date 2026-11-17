import { SignInLayout, Text } from "@ampm/ui";

import { ActivationCard } from "./activation-card";
import { SignInHero } from "./sign-in-hero";
import { useAccountActivation } from "./use-account-activation";

/**
 * Account activation, where the invitation email's link lands (`/activate?token=…`: the `staff.invite`
 * and `client.invite` templates). It wears the sign-in screen's arrangement (AUTH-06: P1 on a phone, one
 * centred card from 768, D1's split from 1024), since no artboard draws it: "Welcome aboard." beside a
 * card holding the one action. Signed out and outside both chromes (`chrome-audience.ts`).
 *
 *   <ActivateScreen inviteToken={token} />
 */
export function ActivateScreen({ inviteToken }: { readonly inviteToken: string | undefined }) {
  const activation = useAccountActivation(inviteToken);
  return (
    <SignInLayout
      testID="activate"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={
        <SignInHero
          headline="activate"
          subtitle="You've been invited to AMPM. Activate your account, and you're in."
        />
      }
      cardTitle="Activate your account"
      card={<ActivationCard activation={activation} />}
      footer="Invitation only · each link works once"
    />
  );
}
