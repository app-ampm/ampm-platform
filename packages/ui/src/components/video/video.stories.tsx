import { defineStories } from "../../stories/define";
import { Video } from "./video";

// A public sample clip for the dev gallery only; real hotel videos are AMPM-hosted, signed links.
const sample =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

export const stories = defineStories({
  title: "Video",
  stories: [
    {
      name: "Hotel video with the platform's controls",
      render: () => (
        <Video source={sample} label="A short sample clip" className="h-56 w-full" radius="lg" />
      ),
    },
  ],
});
