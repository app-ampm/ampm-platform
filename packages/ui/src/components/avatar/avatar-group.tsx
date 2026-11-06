import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Text } from "../text";
import { Avatar } from "./avatar";
import {
  avatarGroupStyles,
  avatarGroupTone,
  avatarInitialsSize,
  avatarOverflowStyles,
  avatarOverlapStyles,
  avatarRingStyles,
  avatarStyles,
  type AvatarSize,
} from "./avatar.styles";

export interface AvatarGroupProps extends Omit<ViewProps, "children"> {
  /** Everyone in the group, in order; the circles alternate gold and peacock. */
  readonly names: readonly string[];
  /** How many avatars to draw before the rest collapse into one "+n" circle; all by default. */
  readonly max?: number | undefined;
  /** sm 32 (default) · md 40 · lg 48 · xl 56. */
  readonly size?: AvatarSize | undefined;
  /** Defaults to the names shown and how many more ("Ravi Kumar, Isha Shah, 5 more"). */
  readonly accessibilityLabel?: string | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
}

interface OverflowCountProps {
  readonly count: number;
  readonly size: AvatarSize;
  /** False when no avatar is drawn before it (`max={0}`). */
  readonly overlaps: boolean;
}

function OverflowCount({ count, size, overlaps }: OverflowCountProps) {
  return (
    <View
      className={cn(
        avatarStyles({ size }),
        avatarOverflowStyles,
        avatarRingStyles,
        overlaps && avatarOverlapStyles,
      )}
    >
      <Text
        variant="label"
        tone="primary"
        weight="bold"
        className={avatarInitialsSize[size]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {uiCopy.avatar.overflow(count)}
      </Text>
    </View>
  );
}

/**
 * People in a row of overlapping circles (a wedding team, a function's crew): each circle wears a
 * 2px midnight ring and tucks 8px under the next, and past `max` the rest become one "+n" circle.
 * The group reads as one image named by everyone in it.
 *
 *   <AvatarGroup names={["Ananya Sharma", "Kabir Mehta"]} />
 *   <AvatarGroup names={team} max={2} size="md" />
 */
export function AvatarGroup({
  names,
  max,
  size = "sm",
  accessibilityLabel,
  className,
  ...rest
}: AvatarGroupProps) {
  const shown = max === undefined ? names : names.slice(0, Math.max(0, max));
  const more = names.length - shown.length;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? uiCopy.avatar.group(shown, more)}
      className={cn(avatarGroupStyles(), className)}
      {...rest}
    >
      {shown.map((name, index) => (
        <Avatar
          // Names repeat ("Guest", two Priyas); the position keeps each key unique.
          key={`${index}-${name}`}
          name={name}
          size={size}
          tone={avatarGroupTone(index)}
          // The group is the one image screen readers meet; its circles are not read on their own.
          accessible={false}
          className={cn(avatarRingStyles, index > 0 && avatarOverlapStyles)}
        />
      ))}
      {more > 0 ? <OverflowCount count={more} size={size} overlaps={shown.length > 0} /> : null}
    </View>
  );
}
