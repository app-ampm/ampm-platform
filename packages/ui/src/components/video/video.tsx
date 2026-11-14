import { useVideoPlayer, VideoView } from "expo-video";
import { cssInterop } from "nativewind";
import { View } from "react-native";

import { cn } from "../../lib/cn";

const StyledVideoView = cssInterop(VideoView, { className: "style" });

export interface VideoProps {
  /** The video's URL — a signed link; the caller resolves it against the API base before passing it. */
  readonly source: string;
  /** What the video shows, for screen readers. Required (accessibility rules). */
  readonly label: string;
  readonly radius?: "none" | "md" | "lg" | undefined;
  /** Size through classes on the frame: `h-56 w-full`. */
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
}

const RADIUS = {
  none: "rounded-none",
  md: "rounded-md",
  lg: "rounded-lg",
} as const;

/**
 * The shared video player (expo-video on every platform: the browser's own `<video>` on the web export, the
 * native player on iOS and Android). The platform's controls are shown and nothing autoplays — it loads
 * paused on its first frame, so a client chooses to watch. The frame sits on a pearl 6% surface; a video has
 * no poster derivative (AC-24.1), so that first frame is the still.
 *
 *   <Video source={uri} label="A walkthrough of the lawn" className="h-56 w-full" radius="lg" />
 */
export function Video({ source, label, radius = "md", className, testID }: VideoProps) {
  const player = useVideoPlayer(source);
  return (
    <View className={cn("overflow-hidden bg-primary/6", RADIUS[radius], className)} testID={testID}>
      <StyledVideoView
        className="h-full w-full"
        player={player}
        nativeControls
        playsInline
        contentFit="contain"
        accessibilityLabel={label}
        accessible
      />
    </View>
  );
}
