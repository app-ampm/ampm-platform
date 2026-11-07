/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { allStories } from "./index";

const COMPONENTS = join(__dirname, "..", "components");

// ui.md: every component's stories file is listed in src/stories/index.ts, so the gallery shows it.
describe("allStories", () => {
  it("registers every component's stories module", () => {
    const registry = readFileSync(join(__dirname, "index.ts"), "utf8");
    const missing = readdirSync(COMPONENTS).flatMap((folder) =>
      readdirSync(join(COMPONENTS, folder))
        .filter((file) => file.endsWith(".stories.tsx"))
        .map((file) => `../components/${folder}/${file.replace(/\.tsx$/, "")}`)
        .filter((specifier) => !registry.includes(`"${specifier}"`)),
    );
    expect(missing).toEqual([]);
  });

  it("gives every module a unique title and its stories unique names (the gallery's keys)", () => {
    const titles = allStories.map((module) => module.title);
    expect(titles.filter((title, index) => titles.indexOf(title) !== index)).toEqual([]);
    const repeated = allStories.flatMap((module) => {
      const names = module.stories.map((story) => story.name);
      return names
        .filter((name, index) => names.indexOf(name) !== index)
        .map((name) => `${module.title}: ${name}`);
    });
    expect(repeated).toEqual([]);
    expect(allStories.filter((module) => module.stories.length === 0)).toEqual([]);
  });

  it("opens with the tokens and ends with the screen scaffold and navigation", () => {
    const titles = allStories.map((module) => module.title);
    expect(titles.slice(0, 3)).toEqual(["Tokens", "Text", "Glass"]);
    expect(titles.indexOf("Screen")).toBeGreaterThan(titles.indexOf("Toast"));
  });
});
