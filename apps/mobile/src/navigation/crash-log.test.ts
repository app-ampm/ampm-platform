import { createMemoryLogger } from "@ampm/core";

import { logCrash } from "./crash-log";

describe("logCrash", () => {
  it("logs where the crash was caught with the error's name and message, nothing more", () => {
    const { logger, entries } = createMemoryLogger();
    logCrash("screen", new TypeError("Cannot read properties of undefined"), logger);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "error",
      event: "ui.crash",
      fields: {
        scope: "screen",
        name: "TypeError",
        message: "Cannot read properties of undefined",
      },
    });
    expect(Object.keys(entries[0]?.fields ?? {})).toEqual(["scope", "name", "message"]);
  });
});
