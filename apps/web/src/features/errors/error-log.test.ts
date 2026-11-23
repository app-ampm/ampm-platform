import { describe, expect, it } from "vitest";

import { createMemoryLogger } from "@ampm/core";

import { logPageError } from "./error-log";

describe("logPageError", () => {
  it("logs the boundary, the error's name and message, and Next's digest", () => {
    const { logger, entries } = createMemoryLogger();
    const error = Object.assign(new Error("An error occurred in the Server Components render."), {
      digest: "2417362903",
    });
    logPageError("page", error, logger);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "error",
      event: "site.page_error",
      fields: {
        scope: "page",
        name: "Error",
        message: "An error occurred in the Server Components render.",
        digest: "2417362903",
      },
    });
  });

  it("logs a thrown value that is not an Error by its type only", () => {
    const { logger, entries } = createMemoryLogger();
    logPageError("root", { email: "guest@example.com" }, logger);
    expect(entries[0]?.fields).toEqual({ scope: "root", name: "object" });
  });
});
