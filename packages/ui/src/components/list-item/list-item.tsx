import {
  forwardRef,
  type ComponentRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react";
import { Pressable, View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { Icon } from "../icon";
import { Text } from "../text";
import { listItemStyles, type ListItemTone } from "./list-item.styles";

export interface ListItemProps extends Omit<ViewProps, "children"> {
  /** One line, Manrope 600 in pearl. */
  readonly title: string;
  /** Up to two lines under the title, pearl 58%. */
  readonly subtitle?: string | undefined;
  /** Data under the subtitle, tabular: a price range, dates ("12–14 FEB"), a count. */
  readonly meta?: string | undefined;
  /**
   * A thumbnail (PhotoPlaceholder, Image) or an avatar before the text. Decorative: screen readers
   * skip it, since the title already names the row.
   */
  readonly leading?: ReactNode;
  /** A StatusChip or a figure after the text. Keep buttons out of a pressable row. */
  readonly trailing?: ReactNode;
  /** A chevron at the end, for rows that open a detail screen. */
  readonly showChevron?: boolean | undefined;
  /** Makes the whole row a button. */
  readonly onPress?: (() => void) | undefined;
  /** `flat` (default) tinted row with radius 16, `plain` row under a hairline. */
  readonly tone?: ListItemTone | undefined;
  readonly accessibilityLabel?: string | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
}

interface TextBlockProps {
  readonly title: string;
  readonly subtitle: string | undefined;
  readonly meta: string | undefined;
}

function ListItemText({ title, subtitle, meta }: TextBlockProps) {
  return (
    <View className="min-w-0 flex-1 gap-0.5">
      <Text variant="body" weight="semibold" tone="primary" numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodySmall" tone="muted" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {meta ? (
        <Text variant="data" tone="muted" numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

/** The thumbnail or avatar: decorative, so screen readers skip it (the title names the row). */
function ListItemLeading({ children }: { readonly children: ReactNode }) {
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="shrink-0"
    >
      {children}
    </View>
  );
}

interface RootProps extends Omit<ViewProps, "children"> {
  readonly onPress: (() => void) | undefined;
  readonly className: string;
  readonly children: ReactNode;
}

/** A button when the row is pressable, a plain view otherwise. */
const ListItemRoot = forwardRef<ComponentRef<typeof View>, RootProps>(function ListItemRoot(
  { onPress, children, ...rest },
  ref,
) {
  if (onPress) {
    return (
      <Pressable ref={ref} accessibilityRole="button" onPress={onPress} {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View ref={ref} {...rest}>
      {children}
    </View>
  );
});

/**
 * A row inside a panel: a saved hotel in "My selection", an enquiry, a lead. Title, subtitle and
 * data meta, with an optional thumbnail or avatar before and a chip after. With `onPress` the row
 * is a button (44px target, hover stroke, pressed tint, gold focus halo).
 *
 *   <ListItem
 *     title="Raj Niwas Palace"
 *     subtitle="Udaipur · Lake Pichola"
 *     leading={<PhotoPlaceholder label="Raj Niwas Palace" showLabel={false} className="h-10 w-12 rounded-sm" />}
 *     trailing={<StatusChip label="Available" tone="success" size="sm" />}
 *     onPress={() => openHotel(hotel.id)}
 *   />
 */
export const ListItem: ForwardRefExoticComponent<
  ListItemProps & RefAttributes<ComponentRef<typeof View>>
> = forwardRef<ComponentRef<typeof View>, ListItemProps>(function ListItem(
  {
    title,
    subtitle,
    meta,
    leading,
    trailing,
    showChevron = false,
    onPress,
    tone = "flat",
    className,
    testID,
    ...rest
  },
  ref,
) {
  const classes = cn(listItemStyles({ tone, pressable: Boolean(onPress) }), className);
  return (
    <ListItemRoot ref={ref} onPress={onPress} className={classes} testID={testID} {...rest}>
      {leading ? <ListItemLeading>{leading}</ListItemLeading> : null}
      <ListItemText title={title} subtitle={subtitle} meta={meta} />
      {trailing ? <View className="shrink-0">{trailing}</View> : null}
      {showChevron ? (
        <Icon
          name="chevron-right"
          tone="muted"
          size="sm"
          testID={testID ? `${testID}-chevron` : undefined}
        />
      ) : null}
    </ListItemRoot>
  );
});
