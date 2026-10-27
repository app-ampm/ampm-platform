import { Link as RouterLink, type Href } from "expo-router";
import { Linking, Pressable } from "react-native";

import { cn } from "../../lib/cn";
import { Icon } from "../icon";
import { Text, type TextTone, type TextVariant } from "../text";

type LinkTone = Extract<TextTone, "brand" | "primary" | "muted">;

export interface LinkProps {
  /** A route of the app, or a full URL with `external`. */
  readonly href: Href | string;
  readonly children: string;
  /** `inline` sits in running text; `standalone` is a row with a chevron and a 44px target. */
  readonly variant?: "inline" | "standalone" | undefined;
  readonly tone?: LinkTone | undefined;
  readonly textVariant?: TextVariant | undefined;
  /** Opens the system browser instead of navigating in the app. */
  readonly external?: boolean | undefined;
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
  readonly accessibilityLabel?: string | undefined;
}

interface ContentProps {
  readonly children: string;
  readonly standalone: boolean;
  readonly external: boolean;
  readonly tone: LinkTone;
  readonly textVariant: TextVariant | undefined;
}

function LinkContent({ children, standalone, external, tone, textVariant }: ContentProps) {
  return (
    <>
      <Text
        variant={textVariant ?? (standalone ? "subheading" : "body")}
        tone={tone}
        className={cn(!standalone && "underline")}
      >
        {children}
      </Text>
      {standalone ? <Icon name={external ? "external-link" : "chevron-right"} tone={tone} /> : null}
    </>
  );
}

function linkClasses(standalone: boolean, className: string | undefined): string {
  return cn(
    "web:rounded web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-focus",
    standalone
      ? "min-h-touch flex-row items-center justify-between gap-2 self-stretch"
      : "self-start",
    className,
  );
}

/**
 * The only way to navigate from shared UI: Expo Router inside the app, the browser for external
 * URLs. Links read as links to screen readers and underline inline.
 *
 *   <Link href="/hotels">All hotels</Link>
 *   <Link href="https://ampm.example" external variant="standalone">Website</Link>
 */
export function Link({
  href,
  children,
  variant = "inline",
  tone = "brand",
  textVariant,
  external = false,
  className,
  testID,
  accessibilityLabel,
}: LinkProps) {
  const standalone = variant === "standalone";
  const classes = linkClasses(standalone, className);
  const a11y = {
    accessibilityRole: "link" as const,
    accessibilityLabel: accessibilityLabel ?? children,
    testID,
  };
  const content = (
    <LinkContent standalone={standalone} external={external} tone={tone} textVariant={textVariant}>
      {children}
    </LinkContent>
  );
  if (external) {
    return (
      <Pressable {...a11y} className={classes} onPress={() => void Linking.openURL(String(href))}>
        {content}
      </Pressable>
    );
  }
  return (
    <RouterLink href={href as Href} asChild>
      <Pressable {...a11y} className={classes}>
        {content}
      </Pressable>
    </RouterLink>
  );
}
