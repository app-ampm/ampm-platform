import { useId } from "react";
import { View, type ViewProps } from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";

import { colors } from "@ampm/tokens";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/theme-provider";
import { Text } from "../text";
import {
  STRIPE_BAND,
  photoCaptionStyles,
  photoPlaceholderStyles,
  photoStripes,
  type PhotoPlaceholderTone,
} from "./photo-placeholder.styles";

export interface PhotoPlaceholderProps extends Omit<ViewProps, "children"> {
  /** What the photo will show ("Palace photo · Lake Pichola"): the caption and the image's name. */
  readonly label: string;
  /** The bands' colour: gold (default), peacock, or midnight (pearl on a neutral pearl 6% well). */
  readonly tone?: PhotoPlaceholderTone | undefined;
  /** False hides the caption (thumbnails); the label still names the image for screen readers. */
  readonly showLabel?: boolean | undefined;
  /** Size, aspect and radius: `h-40 w-full`, `aspect-video rounded-2xl`. Default radius 22. */
  readonly className?: string;
  readonly testID?: string | undefined;
}

/** The period: a band and the empty gap after it, as the tokens' 135° stripe recipe repeats. */
const PERIOD = 2 * STRIPE_BAND;

/**
 * The bands, drawn with SVG from the same tokens the website's `bg-stripes-*` uses: SVG takes its
 * colour and opacity as values, so they come from @ampm/tokens instead of classes. The pattern's
 * vertical bands turned 45° run as the gradient's do.
 */
function Stripes({ tone }: { readonly tone: PhotoPlaceholderTone }) {
  const { resolved } = useTheme();
  const stripe = photoStripes[tone];
  // SVG references need an id without the punctuation React puts in useId values.
  const id = `photo-stripes-${useId().replace(/[^\w-]/g, "")}`;
  return (
    // Absolute: the stripes cover the whole placeholder, under the caption.
    <View className="absolute inset-0">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id={id}
            patternUnits="userSpaceOnUse"
            width={PERIOD}
            height={PERIOD}
            patternTransform="rotate(45)"
          >
            <Rect
              x={0}
              y={0}
              width={STRIPE_BAND}
              height={PERIOD}
              fill={colors[stripe.color][resolved]}
              fillOpacity={stripe.opacity}
            />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function Caption({ label }: { readonly label: string }) {
  return (
    // Absolute: the caption sits top-left, clear of the overlays screens put along the foot.
    <View className="absolute inset-x-3 top-3 flex-row">
      <View className={photoCaptionStyles}>
        <Text variant="eyebrow" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/**
 * The striped stand-in for photography in every Peacock Night mock (gold 14% bands by default),
 * captioned with what the photo will be. It is an image to screen readers, named by its label.
 *
 *   <PhotoPlaceholder label="Palace photo · Lake Pichola" className="h-72 w-full md:rounded-xl" />
 *   <PhotoPlaceholder label="Raj Niwas Palace" tone="peacock" showLabel={false} className="h-10 w-12 rounded-sm" />
 */
export function PhotoPlaceholder({
  label,
  tone = "gold",
  showLabel = true,
  className,
  ...rest
}: PhotoPlaceholderProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label || uiCopy.photo.placeholder}
      className={cn(photoPlaceholderStyles({ tone }), className)}
      {...rest}
    >
      <Stripes tone={tone} />
      {showLabel && label ? <Caption label={label} /> : null}
    </View>
  );
}
