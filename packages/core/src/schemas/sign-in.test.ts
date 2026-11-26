import { describe, expect, it } from "vitest";

import { signInRequest, typedEmail } from "./sign-in";

describe("typedEmail", () => {
  it("removes the spaces a phone keyboard adds inside or around an address", () => {
    expect(typedEmail(" app.ampm.1 @gmail.com ")).toBe("app.ampm.1@gmail.com");
    expect(typedEmail("app. ampm.1@gmail. com")).toBe("app.ampm.1@gmail.com");
  });

  it("removes non-breaking and zero-width characters from copied text", () => {
    expect(typedEmail("\u00A0sana@ampm.example\u200B")).toBe("sana@ampm.example");
    expect(typedEmail("sana\u200C@ampm\u2060.example\u200D")).toBe("sana@ampm.example");
    expect(typedEmail("\uFEFFsana@ampm.example")).toBe("sana@ampm.example");
  });

  it("lower-cases the address, as the API compares it", () => {
    expect(typedEmail("Sana@AMPM.Example")).toBe("sana@ampm.example");
  });

  it("turns an address the API refused into one it accepts", () => {
    const typed = "App.ampm.1 @gmail.com\u200B";
    expect(signInRequest.safeParse({ email: typed, password: "x" }).success).toBe(false);
    expect(signInRequest.safeParse({ email: typedEmail(typed), password: "x" }).success).toBe(true);
  });

  it("leaves something that is not an address for the schema to refuse", () => {
    expect(typedEmail("admin")).toBe("admin");
    expect(signInRequest.safeParse({ email: typedEmail("admin"), password: "x" }).success).toBe(
      false,
    );
  });
});
