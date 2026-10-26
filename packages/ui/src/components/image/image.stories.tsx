import { defineStories } from "../../stories/define";
import { Row } from "../layout";
import { Image } from "./image";

const sample = { uri: "https://picsum.photos/seed/ampm/640/400" };

export const stories = defineStories({
  title: "Image",
  stories: [
    {
      name: "Cover, radius and avatar",
      render: () => (
        <Row gap={3} align="start">
          <Image
            source={sample}
            alt="Lakeside pavilion at dusk"
            className="h-32 flex-1"
            radius="lg"
          />
          <Image source={sample} alt="" className="h-16 w-16" radius="full" />
        </Row>
      ),
    },
  ],
});
