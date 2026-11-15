import { ScreenHeader, useSignInLayoutMode } from "@ampm/ui";

/** The headline for each tab: D1's "Welcome back." to sign in, "Join AMPM." to sign up. */
const HEADLINE = {
  "sign-in": { title: "Welcome", emphasis: "back." },
  "sign-up": { title: "Join", emphasis: "AMPM." },
} as const;

/**
 * The headline over the line saying how to sign in: D1's 88 hero beside the form from 1024, the
 * screen title below that (P1 and the centred card), so a phone keeps its header. Both headlines stay
 * on one line at 88, so switching tabs never reflows the column.
 */
export function SignInHero({
  subtitle,
  tab = "sign-in",
}: {
  readonly subtitle: string;
  readonly tab?: keyof typeof HEADLINE | undefined;
}) {
  const mode = useSignInLayoutMode();
  return (
    <ScreenHeader
      size={mode === "split" ? "hero" : "title"}
      title={HEADLINE[tab].title}
      emphasis={HEADLINE[tab].emphasis}
      subtitle={subtitle}
      // D1 sets the hero 2% tight; at 88 that keeps "Welcome back." on one line in its 576 column.
      titleClassName="lg:tracking-tight"
    />
  );
}
