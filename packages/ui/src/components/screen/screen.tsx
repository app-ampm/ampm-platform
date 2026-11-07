import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type PlatformOSType,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";

import { cn } from "../../lib/cn";
import { GlassPanel } from "../glass-panel";
import { GlowBackdrop, type GlowVariant } from "../glow-backdrop";
import {
  screenContentStyles,
  screenFooterContentStyles,
  screenFooterStyles,
  screenStyles,
  type ScreenWidth,
} from "./screen.styles";

export interface ScreenProps extends Omit<ViewProps, "children"> {
  readonly children?: ReactNode;
  /** Scrolls by default; `false` for screens that fill the window (chat, a map, a console). */
  readonly scroll?: boolean | undefined;
  /** The orbs behind the screen: corners (default), top for heroes, center, none. */
  readonly glow?: GlowVariant | undefined;
  /** full (default) · content: a centred 768 column · wide: a centred 1152 column. */
  readonly width?: ScreenWidth | undefined;
  /** Above the content, inside the gutter, scrolling with it: usually a ScreenHeader. */
  readonly header?: ReactNode;
  /** A sticky bar on base glass along the bottom (price and action, form actions). */
  readonly footer?: ReactNode;
  /** A floating TabBar over the content; the content keeps room for it at the end. */
  readonly tabBar?: ReactNode;
  /** Classes for the column holding the header and children (gap, padding overrides). */
  readonly contentClassName?: string | undefined;
  readonly refreshControl?: ScrollViewProps["refreshControl"];
  /** Defaults to "handled", so a tap on a button works while the keyboard is up. */
  readonly keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
  readonly className?: string;
  readonly testID?: string | undefined;
}

type StageProps = Pick<
  ScreenProps,
  | "children"
  | "scroll"
  | "width"
  | "header"
  | "tabBar"
  | "contentClassName"
  | "refreshControl"
  | "keyboardShouldPersistTaps"
  | "testID"
> & {
  readonly insets: EdgeInsets;
  readonly hasFooter: boolean;
  /** iOS insets the scroll view for the keyboard itself (see `keyboardAvoidance`). */
  readonly adjustKeyboardInsets: boolean;
};

export interface KeyboardAvoidance {
  /** How the KeyboardAvoidingView around the stage and the footer makes room for the keyboard. */
  readonly behavior: "padding" | "height";
  /** Whether it does: not where iOS insets the scroll view instead, nor on the web. */
  readonly enabled: boolean;
  /** iOS insets a footer-less scroll view and scrolls the focused input into view. */
  readonly adjustScrollInsets: boolean;
}

/**
 * How a screen keeps its inputs and its footer clear of the keyboard. A scrolling screen without a
 * footer lets iOS inset the scroll view (and bring the focused input into view). Otherwise (a sticky
 * footer, a screen that does not scroll, or Android, whose edge-to-edge window no longer resizes for
 * the keyboard) a KeyboardAvoidingView lifts the stage and the footer above it. Never both, or iOS
 * would make room twice. The browser handles its own keyboard.
 */
export function keyboardAvoidance(
  os: PlatformOSType,
  scroll: boolean,
  hasFooter: boolean,
): KeyboardAvoidance {
  const adjustScrollInsets = os === "ios" && scroll && !hasFooter;
  return {
    behavior: os === "ios" ? "padding" : "height",
    enabled: os !== "web" && !adjustScrollInsets,
    adjustScrollInsets,
  };
}

const part = (testID: string | undefined, name: string) =>
  testID ? `${testID}-${name}` : undefined;

const isPresent = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

interface BodyProps {
  readonly scroll: boolean;
  readonly children: ReactNode;
  readonly insets: EdgeInsets;
  /** The home indicator's height, kept clear below the content when no footer takes it. */
  readonly insetBelow: number;
  /** The screen's test ID; the body adds the suffixes main, scroll or body, and inset. */
  readonly testID: string | undefined;
  readonly refreshControl: ScrollViewProps["refreshControl"];
  readonly keyboardShouldPersistTaps: ScrollViewProps["keyboardShouldPersistTaps"];
  readonly automaticallyAdjustKeyboardInsets: boolean;
}

/** The scroll view (or a plain view) inside the top and side safe areas. */
function ScreenBody({ scroll, children, insets, insetBelow, testID, ...scrollProps }: BodyProps) {
  const spacer =
    insetBelow > 0 ? <View style={{ height: insetBelow }} testID={part(testID, "inset")} /> : null;
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName="grow"
      testID={part(testID, "scroll")}
      {...scrollProps}
    >
      {children}
      {spacer}
    </ScrollView>
  ) : (
    <View className="flex-1" testID={part(testID, "body")}>
      {children}
      {spacer}
    </View>
  );
  return (
    <View
      className="flex-1"
      style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}
      testID={part(testID, "main")}
    >
      {body}
    </View>
  );
}

/** The body with the column of header and children, and the floating tab bar over it. */
function ScreenStage({
  children,
  scroll = true,
  width = "full",
  header,
  tabBar,
  contentClassName,
  refreshControl,
  keyboardShouldPersistTaps = "handled",
  testID,
  insets,
  hasFooter,
  adjustKeyboardInsets,
}: StageProps) {
  const hasTabBar = isPresent(tabBar);
  const room = hasTabBar ? "tabBar" : "none";
  return (
    <View className="flex-1">
      <ScreenBody
        scroll={scroll}
        insets={insets}
        insetBelow={hasFooter ? 0 : insets.bottom}
        testID={testID}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}
      >
        <View
          className={cn(screenContentStyles({ width, room, scroll }), contentClassName)}
          testID={part(testID, "content")}
        >
          {header}
          {children}
        </View>
      </ScreenBody>
      {/* Last, so it draws over the content: the TabBar floats itself (absolute, safe-area aware). */}
      {hasTabBar ? tabBar : null}
    </View>
  );
}

interface FooterProps {
  readonly children: ReactNode;
  readonly width: ScreenWidth;
  readonly insets: EdgeInsets;
  readonly testID: string | undefined;
}

function ScreenFooter({ children, width, insets, testID }: FooterProps) {
  const { bottom, left, right } = insets;
  return (
    <GlassPanel className={screenFooterStyles} testID={testID}>
      {/* The device's insets: the bar runs to the edges, its content stays clear of them. */}
      <View style={{ paddingBottom: bottom, paddingLeft: left, paddingRight: right }}>
        <View className={screenFooterContentStyles({ width, insetBelow: bottom > 0 })}>
          {children}
        </View>
      </View>
    </GlassPanel>
  );
}

type KeyboardAreaProps = Omit<StageProps, "adjustKeyboardInsets"> & { readonly footer: ReactNode };

/** The stage and the footer, kept clear of the keyboard one way per platform (`keyboardAvoidance`). */
function ScreenKeyboardArea({ footer, ...stage }: KeyboardAreaProps) {
  const keyboard = keyboardAvoidance(Platform.OS, stage.scroll !== false, stage.hasFooter);
  return (
    <KeyboardAvoidingView
      behavior={keyboard.behavior}
      enabled={keyboard.enabled}
      className="flex-1"
      testID={part(stage.testID, "keyboard")}
    >
      <ScreenStage {...stage} adjustKeyboardInsets={keyboard.adjustScrollInsets} />
      {stage.hasFooter ? (
        <ScreenFooter
          width={stage.width ?? "full"}
          insets={stage.insets}
          testID={part(stage.testID, "footer")}
        >
          {footer}
        </ScreenFooter>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/**
 * The scaffold every app screen stands on, instead of a hand-rolled ScrollView: the midnight canvas
 * with its glow orbs, the top safe area, the 18px phone gutter (32 tablet, 48 desktop), 16 between
 * children, and room at the end for a floating tab bar or a sticky glass footer. The keyboard never
 * covers the footer or the field being typed in (`keyboardAvoidance`). No navigation: the app passes
 * the header, the bar and the callbacks in.
 *
 *   <Screen header={<ScreenHeader title="Find your venue" />} tabBar={<TabBar … />}>
 *     <Card>…</Card>
 *   </Screen>
 *   <Screen footer={<Row justify="between">…<Button>Check availability</Button></Row>}>…</Screen>
 *   <Screen scroll={false} width="content" glow="center">…</Screen>
 */
export function Screen({
  children,
  scroll,
  glow = "corners",
  width = "full",
  header,
  footer,
  tabBar,
  contentClassName,
  refreshControl,
  keyboardShouldPersistTaps,
  className,
  testID,
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const hasFooter = isPresent(footer);
  const stage = { scroll, width, header, tabBar, contentClassName, testID, insets, hasFooter };
  return (
    <View className={cn(screenStyles(), className)} testID={testID} {...rest}>
      <GlowBackdrop variant={glow} testID={part(testID, "glow")} />
      <ScreenKeyboardArea
        {...stage}
        footer={footer}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      >
        {children}
      </ScreenKeyboardArea>
    </View>
  );
}
