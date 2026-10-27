import type { ReactNode } from "react";

/** One variant or state of a component, rendered in the gallery (and later in Storybook). */
export interface Story {
  readonly name: string;
  readonly render: () => ReactNode;
  readonly description?: string | undefined;
}

export interface StoryModule {
  readonly title: string;
  readonly stories: readonly Story[];
}

/** `<name>.stories.tsx` next to each component exports `stories = defineStories({...})` (ui.md). */
export function defineStories(module: StoryModule): StoryModule {
  return module;
}
