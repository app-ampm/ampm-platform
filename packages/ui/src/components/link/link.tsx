import { Link as RouterLink, type Href } from "expo-router";
import {
  forwardRef,
  type ComponentRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type Ref,
  type RefAttributes,
} from "react";
import { Linking, Pressable, type PressableProps } from "react-native";

import { cn } from "../../lib/cn";
import { Icon } from "../icon";
import { Text, type TextVariant } from "../text";
import {
  linkDefaultTone,
  linkLabelStyles,
  linkStyles,
  linkTextVariant,
  type LinkTone,
  type LinkVariant,
} from "./link.styles";

type PressableRef = ComponentRef<typeof Pressable>;

export interface LinkProps extends Omit<
  PressableProps,
  "children" | "style" | "disabled" | "onPress" | "accessibilityRole"
> {
  /** A route of the app, or a full URL with `external`. */
  readonly href: Href | string;
  /** The words, with any arrow the design asks for ("Sign in →"); nothing is appended. */
  readonly children: string;
  /**
   * `inline` sits in running text (gold, underlined); `standalone` is a gold action with a 44px
   * target; `nav` is site and workspace navigation (pearl 80%, gold on hover).
   */
  readonly variant?: LinkVariant | undefined;
  /** Gold by default (pearl 80% for `nav`); any other tone turns gold on hover. */
  readonly tone?: LinkTone | undefined;
  readonly textVariant?: TextVariant | undefined;
  /** Opens the system browser instead of navigating in the app. */
  readonly external?: boolean | undefined;
  /**
   * The link to the page on screen, in site and workspace navigation: gold, and marked for screen
   * readers (aria-current="page" on the web, selected on iOS and Android), never by colour alone.
   */
  readonly current?: boolean | undefined;
  /** Runs before the link navigates or opens the browser (to close a menu, say). */
  readonly onPress?: (() => void) | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
  readonly accessibilityLabel?: string | undefined;
}

interface ContentProps {
  readonly children: string;
  readonly variant: LinkVariant;
  readonly external: boolean;
  readonly tone: LinkTone;
  readonly textVariant: TextVariant | undefined;
}

function LinkContent({ children, variant, external, tone, textVariant }: ContentProps) {
  return (
    <>
      <Text
        variant={textVariant ?? linkTextVariant[variant]}
        tone="inherit"
        className={linkLabelStyles({ variant, tone, textVariant })}
      >
        {children}
      </Text>
      {/* Leaving the app is worth a cue; inline links keep the sentence clean. */}
      {external && variant !== "inline" ? (
        <Icon name="external-link" size="sm" tone={tone} />
      ) : null}
    </>
  );
}

interface TargetProps {
  readonly href: Href | string;
  readonly external: boolean;
  readonly targetRef: Ref<PressableRef>;
  readonly onPress: (() => void) | undefined;
  /** Everything else for the Pressable: the caller's props, the classes, the name, the state. */
  readonly pressable: Omit<PressableProps, "children" | "onPress">;
  readonly children: ReactNode;
}

/**
 * External URLs open the browser; app routes go through Expo Router (an <a href> on the web), which
 * runs the caller's onPress before it navigates.
 */
function LinkTarget({ href, external, targetRef, onPress, pressable, children }: TargetProps) {
  const shared = { ...pressable, ref: targetRef, accessibilityRole: "link" as const };
  if (external) {
    const open = () => {
      onPress?.();
      void Linking.openURL(String(href));
    };
    return (
      <Pressable {...shared} onPress={open}>
        {children}
      </Pressable>
    );
  }
  return (
    <RouterLink href={href as Href} asChild {...(onPress ? { onPress } : {})}>
      <Pressable {...shared}>{children}</Pressable>
    </RouterLink>
  );
}

/** How a current link is marked: aria-current for the web, selected for native screen readers. */
const CURRENT = { "aria-current": "page", accessibilityState: { selected: true } } as const;

/**
 * The only way to navigate from shared UI: Expo Router inside the app, the browser for external
 * URLs. Links read as links to screen readers. Gold Manrope 700; nav links pearl 80%, gold on hover
 * and gold while `current`; the focus border and halo on the web. Other Pressable props (a hint, a
 * nativeID, aria attributes) reach the link itself. The website reuses `linkStyles` and
 * `linkLabelStyles`.
 *
 *   <Link href="/sign-in" variant="standalone">Sign in →</Link>
 *   <Link href="/how-it-works" variant="nav" current={pathname === "/how-it-works"}>How it works</Link>
 *   <Text>Read the <Link href="/privacy">privacy notice</Link> first.</Text>
 *   <Link href="https://ampm.example" external variant="standalone" onPress={closeMenu}>Website</Link>
 */
export const Link: ForwardRefExoticComponent<LinkProps & RefAttributes<PressableRef>> = forwardRef<
  PressableRef,
  LinkProps
>(function Link(
  {
    href,
    children,
    variant = "inline",
    tone,
    textVariant,
    external = false,
    current = false,
    onPress,
    className,
    accessibilityLabel,
    ...rest
  },
  ref,
) {
  const pressable = {
    ...rest,
    className: cn(linkStyles({ variant }), className),
    accessibilityLabel: accessibilityLabel ?? children,
    ...(current ? CURRENT : {}),
  };
  const ink = current ? "brand" : (tone ?? linkDefaultTone[variant]);
  return (
    <LinkTarget
      href={href}
      external={external}
      targetRef={ref}
      onPress={onPress}
      pressable={pressable}
    >
      <LinkContent variant={variant} external={external} tone={ink} textVariant={textVariant}>
        {children}
      </LinkContent>
    </LinkTarget>
  );
});
