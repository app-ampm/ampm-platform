/**
 * A full-area state (empty, error, offline) on base glass: a desktop panel's radius 24, padding 24,
 * everything centred with 12 between the parts. `flex` keeps the column on the web's DOM too.
 */
export const stateViewStyles = "flex flex-col items-center justify-center gap-3 rounded-xl p-6";

/** The 56 disc behind the state's icon: pearl 8% with a pearl 16% stroke. */
export const stateIconStyles =
  "flex h-14 w-14 items-center justify-center rounded-full border border-primary/16 bg-primary/8";
