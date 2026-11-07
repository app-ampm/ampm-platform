import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import { cssInterop } from "nativewind";
import { useState } from "react";
import { View } from "react-native";

import { motionMs } from "@ampm/tokens";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
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

/** The surface a picture sits on while it loads, and stays on when it cannot load: pearl 6%. */
const PHOTO_SURFACE = "bg-primary/6";

type LoadState = "loading" | "loaded" | "failed";

/** Follows the picture from loading to loaded or failed; the caller's own handlers still run. */
function useLoadState(
  onLoad: ExpoImageProps["onLoad"],
  onError: ExpoImageProps["onError"],
  onLoadEnd: ExpoImageProps["onLoadEnd"],
) {
  const [state, setState] = useState<LoadState>("loading");
  const handleLoad: NonNullable<ExpoImageProps["onLoad"]> = (event) => {
    setState("loaded");
    onLoad?.(event);
  };
  const handleError: NonNullable<ExpoImageProps["onError"]> = (event) => {
    setState("failed");
    onError?.(event);
  };
  // Fires after either outcome; it only settles a load that reported neither.
  const handleLoadEnd = () => {
    setState((current) => (current === "loading" ? "loaded" : current));
    onLoadEnd?.();
  };
  return { state, handleLoad, handleError, handleLoadEnd };
}

/**
 * Named for screen readers, or hidden from them when the alt text is empty (decorative). On the web
 * expo-image writes the picture's alt from `accessibilityLabel` (`alt` reaches only its placeholder),
 * so a decorative picture passes an empty label too and gets `alt=""`, which screen readers skip
 * (an <img> with no alt is read out by its file name); aria-hidden hides its frame there as the two
 * native props do on iOS and Android.
 */
function imageAccessibility(alt: string) {
  return alt === ""
    ? {
        alt: "",
        accessibilityLabel: "",
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
        "aria-hidden": true,
      }
    : { alt, accessibilityLabel: alt, accessible: true };
}

/**
 * The shared image (expo-image on every platform: caching, content fit, a fade in from the motion
 * tokens, instant under reduced motion). A pearl 6% skeleton fills the frame until the picture has
 * loaded; a picture that cannot load leaves the frame on that pearl 6% surface.
 *
 *   <Image source={{ uri }} alt="Lakeside pavilion at dusk" className="h-40 w-full" radius="lg" />
 */
export function Image({
  alt,
  radius = "md",
  className,
  testID,
  contentFit = "cover",
  onLoad,
  onError,
  onLoadEnd,
  ...rest
}: ImageProps) {
  const load = useLoadState(onLoad, onError, onLoadEnd);
  const reducedMotion = useReducedMotion();
  const failed = load.state === "failed";
  return (
    <View
      className={cn("overflow-hidden", RADIUS[radius], failed && PHOTO_SURFACE, className)}
      testID={testID}
    >
      {load.state === "loading" ? (
        // Absolute: the placeholder covers the frame until the image reports it has loaded.
        <Skeleton
          className={cn("absolute inset-0", PHOTO_SURFACE, RADIUS[radius])}
          testID={testID ? `${testID}-skeleton` : undefined}
        />
      ) : null}
      <StyledImage
        className="h-full w-full"
        contentFit={contentFit}
        transition={reducedMotion ? 0 : motionMs.base}
        {...imageAccessibility(alt)}
        onLoad={load.handleLoad}
        onError={load.handleError}
        onLoadEnd={load.handleLoadEnd}
        {...rest}
      />
    </View>
  );
}
