import { DOCUMENT_TYPES } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { DocumentType } from "../../generated/prisma/client.js";

describe("document types (D-187 §3)", () => {
  it("stores exactly the types @ampm/core names, the hotel library's three included", () => {
    expect([...Object.values(DocumentType)].sort()).toEqual([...DOCUMENT_TYPES].sort());
  });
});
