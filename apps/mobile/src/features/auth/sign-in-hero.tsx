import { ScreenHeader, useSignInLayoutMode } from "@ampm/ui";

/**
 * The headline for each tab: D1's "Welcome back." to sign in, "Join AMPM." to sign up; and
 * "Welcome aboard." on the activation screen an invitation link opens.
 */
const HEADLINE = {
  "sign-in": { title: "Welcome", emphasis: "back." },
  "sign-up": { title: "Join", emphasis: "AMPM." },
  activate: { title: "Welcome", emphasis: "aboard." },
} as const;

/**
 * The headline over the line saying how to sign in: the hero beside the form from 1024 (64, and D1's
 * 88 from 1280, where the column has room for it), the screen title below that (P1 and the centred
 * card), so a phone keeps its header. In D1's 576 column both headlines sit on one line at 88, so
 * switching tabs never reflows it.
 */
export function SignInHero({
  subtitle,
  headline = "sign-in",
}: {
  readonly subtitle: string;
  readonly headline?: keyof typeof HEADLINE | undefined;
}) {
  const mode = useSignInLayoutMode();
  return (
    <ScreenHeader
      size={mode === "split" ? "hero" : "title"}
      title={HEADLINE[headline].title}
      emphasis={HEADLINE[headline].emphasis}
      subtitle={subtitle}
      // D1 sets the hero 2% tight; at 88 that keeps "Welcome back." on one line in its 576 column.
      titleClassName="lg:tracking-tight"
    />
  );
}
