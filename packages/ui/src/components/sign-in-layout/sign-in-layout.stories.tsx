import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Card } from "../card";
import { Input } from "../input";
import { Link } from "../link";
import { Stack } from "../layout";
import { ScreenHeader } from "../screen-header";
import { Text } from "../text";
import { SignInLayout } from "./sign-in-layout";
import { useSignInLayoutMode } from "./use-sign-in-layout-mode";

const noop = () => undefined;

// A story frame is not a device: no notch, no home indicator.
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={NO_INSETS}>
      <View className="h-96 overflow-hidden rounded-2xl border border-primary/16">{children}</View>
    </SafeAreaInsetsContext.Provider>
  );
}

function Hero({ subtitle }: { readonly subtitle: string }) {
  const mode = useSignInLayoutMode();
  return (
    <ScreenHeader
      size={mode === "split" ? "hero" : "title"}
      title="Welcome"
      emphasis="back."
      subtitle={subtitle}
    />
  );
}

function MobileForm() {
  return (
    <Stack gap={4}>
      <Input label="Mobile number" value="" onChangeText={noop} placeholder="98765 43210" />
      <Button fullWidth size="lg" onPress={noop}>
        Send code
      </Button>
    </Stack>
  );
}

/** The quieter block after the card: glass on a phone, a flat tint once it sits under the card. */
function HelpBlock() {
  const mode = useSignInLayoutMode();
  return (
    <Card tone={mode === "phone" ? "glass" : "flat"} padding="sm">
      <Link href="/gallery" variant="nav" accessibilityLabel="Need help? Contact AMPM">
        Need help? Contact AMPM
      </Link>
    </Card>
  );
}

export const stories = defineStories({
  title: "SignInLayout",
  stories: [
    {
      name: "Client sign-in (D1 split from 1024, one card from 768, P1 on a phone)",
      render: () => (
        <Frame>
          <SignInLayout
            brand={<Text variant="wordmark">AMPM</Text>}
            hero={<Hero subtitle="Sign in with the mobile number AMPM has on file." />}
            cardTitle="Enter your code"
            card={<MobileForm />}
            aside={<HelpBlock />}
            footer="No sign-up · AMPM invites every client"
          />
        </Frame>
      ),
    },
    {
      name: "Form only: no card title, nothing after the card",
      render: () => (
        <Frame>
          <SignInLayout
            brand={<Text variant="wordmark">AMPM</Text>}
            hero={<Hero subtitle="Sign in with your work email and password." />}
            card={<MobileForm />}
          />
        </Frame>
      ),
    },
  ],
});
