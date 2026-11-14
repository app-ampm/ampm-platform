import { ScreenHeader, useSignInLayoutMode } from "@ampm/ui";

/**
 * "Welcome back." over the line saying how to sign in: D1's 88 hero beside the form from 1024, the
 * screen title below that (P1 and the centred card), so a phone keeps its header.
 */
export function SignInHero({ subtitle }: { readonly subtitle: string }) {
  const mode = useSignInLayoutMode();
  return (
    <ScreenHeader
      size={mode === "split" ? "hero" : "title"}
      title="Welcome"
      emphasis="back."
      subtitle={subtitle}
      // D1 sets the hero 2% tight; at 88 that keeps "Welcome back." on one line in its 576 column.
      titleClassName="lg:tracking-tight"
    />
  );
}
