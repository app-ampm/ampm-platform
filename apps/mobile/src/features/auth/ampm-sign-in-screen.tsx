import { useRouter } from "expo-router";
import { useState } from "react";

import { Button, SignInLayout, Text } from "@ampm/ui";

import { ClientSignInCard } from "./client-sign-in-card";
import { SignInHero } from "./sign-in-hero";
import { StaffSignInScreen } from "./staff-sign-in-screen";
import { useAmpmClientSignIn, type AmpmClientSignIn } from "./use-ampm-client-sign-in";
import { useAmpmSignIn } from "./use-ampm-sign-in";

/** Who is signing in: a client by mobile and code (where the screen opens), or the AMPM team. */
type Audience = "client" | "team";

interface AudienceSwitchProps {
  readonly label: string;
  readonly hint: string;
  /** Forward to the team's sign-in, back to the client's. */
  readonly direction: "forward" | "back";
  readonly onPress: () => void;
}

/** The quiet way across to the other sign-in, under the card: text only, so gold stays on the form. */
function AudienceSwitch({ label, hint, direction, onPress }: AudienceSwitchProps) {
  return (
    <Button
      variant="ghost"
      className="self-center"
      icon={direction === "back" ? "arrow-left" : undefined}
      iconEnd={direction === "forward" ? "arrow-right" : undefined}
      accessibilityHint={hint}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

interface ClientSignInScreenProps {
  readonly signIn: AmpmClientSignIn;
  readonly onTeamSignIn: () => void;
}

/** D1 / P1 for a client: the mobile and its code in the card, the team's way in under it. */
function ClientSignInScreen({ signIn, onTeamSignIn }: ClientSignInScreenProps) {
  return (
    <SignInLayout
      testID="sign-in"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={<SignInHero subtitle="Sign in with your mobile and a one-time code." />}
      card={<ClientSignInCard signIn={signIn} />}
      // The code step has its own way back (Change); the switch belongs with the mobile form.
      aside={
        signIn.sent ? undefined : (
          <AudienceSwitch
            label="AMPM team sign-in"
            hint="Sign in with your work email, password and authenticator"
            direction="forward"
            onPress={onTeamSignIn}
          />
        )
      }
      footer="No sign-up · AMPM sets up every account"
    />
  );
}

/**
 * AMPM's own sign-in (`EXPO_PUBLIC_IDENTITY_PROVIDER=ampm`, D-142, D-147). It opens on the client card:
 * the mobile AMPM has on file, then the 6-digit code sent to it. "AMPM team sign-in" under the card
 * switches to the staff screen (the work email and password, then the authenticator code or a recovery
 * code, with a forgotten-password link), and "Client sign-in" under that one switches back. Both
 * sign-ins keep their state above the switch, so going across and back keeps what was typed.
 */
export function AmpmSignInScreen() {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("client");
  const team = useAmpmSignIn();
  const client = useAmpmClientSignIn();
  if (audience === "client") {
    return <ClientSignInScreen signIn={client} onTeamSignIn={() => setAudience("team")} />;
  }
  return (
    <StaffSignInScreen
      session={team}
      onForgot={() => {
        router.push("/forgot-password");
      }}
      aside={
        team.phase.kind === "credentials" ? (
          <AudienceSwitch
            label="Client sign-in"
            hint="Sign in with your mobile and a one-time code"
            direction="back"
            onPress={() => setAudience("client")}
          />
        ) : undefined
      }
    />
  );
}
