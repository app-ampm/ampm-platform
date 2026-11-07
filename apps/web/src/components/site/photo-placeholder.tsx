import { cn, textStyles } from "@ampm/ui/styles";

export interface PhotoPlaceholderProps {
  /**
   * What the photo will show ("Wedding photo · Lake Pichola"): the caption and the image's name for
   * screen readers. Leave it out for a decorative tile whose text sits beside it.
   */
  readonly label?: string | undefined;
  /** The bands: gold 14% (default) or peacock 10%. */
  readonly tone?: "gold" | "peacock" | undefined;
  /** False keeps the name for screen readers but hides the caption pill. */
  readonly showLabel?: boolean | undefined;
  /** Size and aspect from the caller (`h-40 md:h-72`, `aspect-square`). Radius 22, 24 on desktop. */
  readonly className?: string | undefined;
}

/**
 * The striped stand-in for photography until the media library supplies the picture: the kit's
 * PhotoPlaceholder for the DOM. Bands at 135° (`bg-stripes-gold`, `bg-stripes-peacock`) over a pearl
 * 3% tint, a pearl 16% stroke, and the caption in a small glass pill.
 *
 *   <PhotoPlaceholder label="Wedding photo · Lake Pichola" className="aspect-square" />
 *   <PhotoPlaceholder tone="peacock" className="h-40 md:h-72" />
 */
export function PhotoPlaceholder({
  label,
  tone = "gold",
  showLabel = true,
  className,
}: PhotoPlaceholderProps) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative overflow-hidden rounded-lg border border-primary/16 bg-primary/3 md:rounded-xl",
        className,
      )}
    >
      {/* Absolute: the bands cover the whole placeholder, under the caption. */}
      <div
        className={cn(
          "absolute inset-0",
          tone === "peacock" ? "bg-stripes-peacock" : "bg-stripes-gold",
        )}
      />
      {label && showLabel ? (
        // Absolute: the caption sits top-left, clear of the cards pages lay along the foot.
        <div className="absolute inset-x-4 top-4 flex md:inset-x-5 md:top-5">
          <span
            className={cn(
              textStyles({ variant: "eyebrow", tone: "muted" }),
              "truncate rounded-full border border-primary/16 bg-surface/50 px-3 py-1.5",
            )}
          >
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
