import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import { cssInterop } from "nativewind";
import { useState } from "react";
import { View } from "react-native";

import { motionMs } from "@ampm/tokens";

import { cn } from "../../lib/cn";
import { Skeleton } from "../skeleton";

const StyledImage = cssInterop(ExpoImage, { className: "style" });

export interface ImageProps extends Omit<
  ExpoImageProps,
  "alt" | "accessibilityLabel" | "style" | "className"
> {
  /** What the picture shows; an empty string marks it decorative. Required (accessibility rules). */
  readonly alt: string;
  readonly radius?: "none" | "md" | "lg" | "full" | undefined;
  /** Size through classes on the frame: `h-40 w-full`, `h-12 w-12`. */
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
}

const RADIUS = {
  none: "rounded-none",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const;

/**
 * The shared image (expo-image on every platform: caching, content fit, a fade in from the motion
 * tokens). A skeleton fills the frame until the picture has loaded.
 */
export function Image({
  alt,
  radius = "md",
  className,
  testID,
  contentFit = "cover",
  onLoadEnd,
  ...rest
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const decorative = alt === "";
  return (
    <View className={cn("overflow-hidden", RADIUS[radius], className)} testID={testID}>
      {!loaded ? (
        // Absolute: the placeholder covers the frame until the image reports it has loaded.
        <Skeleton
          className={cn("absolute inset-0", RADIUS[radius])}
          testID={testID ? `${testID}-skeleton` : undefined}
        />
      ) : null}
      <StyledImage
        className="h-full w-full"
        contentFit={contentFit}
        transition={motionMs.base}
        {...(decorative
          ? { accessibilityElementsHidden: true }
          : { alt, accessibilityLabel: alt, accessible: true })}
        onLoadEnd={() => {
          setLoaded(true);
          onLoadEnd?.();
        }}
        {...rest}
      />
    </View>
  );
}
