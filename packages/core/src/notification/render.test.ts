import { describe, expect, it } from "vitest";

import { CONFIG_REGISTRY, type NotificationTemplate } from "../schemas/config.js";
import { renderString, renderTemplate } from "./render.js";

describe("renderString", () => {
  it("fills placeholders from variables", () => {
    const out = renderString("Hi {{name}}, go to {{url}}", { name: "Pat", url: "x" });
    expect(out.text).toBe("Hi Pat, go to x");
    expect(out.missing).toEqual([]);
  });

  it("records a missing variable and renders it empty (fail closed)", () => {
    const out = renderString("Hi {{name}}", {});
    expect(out.text).toBe("Hi ");
    expect(out.missing).toEqual(["name"]);
  });

  it("dedupes a repeated missing variable", () => {
    const out = renderString("{{a}} {{a}} {{b}}", {});
    expect([...out.missing].sort()).toEqual(["a", "b"]);
  });

  it("does not HTML-escape substituted values by default", () => {
    expect(renderString("{{v}}", { v: "<b>&\"'" }).text).toBe("<b>&\"'");
  });

  it("HTML-escapes substituted values when asked, so a value cannot inject markup", () => {
    const out = renderString(
      '<a href="{{url}}">{{name}}</a>',
      { url: "x?a=1&b=2", name: "<script>" },
      { escapeHtml: true },
    );
    expect(out.text).toBe('<a href="x?a=1&amp;b=2">&lt;script&gt;</a>');
  });

  it("escapes attribute-breakout quotes so a value cannot escape an href", () => {
    const out = renderString('<a href="{{u}}">', { u: 'x" onmouseover="y' }, { escapeHtml: true });
    expect(out.text).toBe('<a href="x&quot; onmouseover=&quot;y">');
    expect(renderString("{{v}}", { v: "a'b" }, { escapeHtml: true }).text).toBe("a&#39;b");
  });

  it("flags a malformed placeholder as missing so the caller fails closed", () => {
    const out = renderString("Hi {{bad-name}} {{ok}}", { ok: "x" });
    expect(out.text).toContain("{{bad-name}}");
    expect(out.missing).toContain("{{bad-name}}");
  });
});

describe("renderTemplate", () => {
  const template: NotificationTemplate = {
    email: {
      subject: "Hi {{name}}",
      html: '<p>Hi {{name}}</p><a href="{{url}}">go</a>',
      text: "Hi {{name}} {{url}}",
    },
    sms: { text: "code {{code}}" },
    whatsapp: { providerTemplateId: "wa_1", params: ["{{name}}", "{{code}}"] },
    push: { title: "Hi {{name}}", body: "see {{url}}" },
  };

  it("renders email content with only the html part escaped", () => {
    const out = renderTemplate(template, "email", { name: "A&B", url: "u?x=1&y=2" });
    expect(out.missing).toEqual([]);
    expect(out.content).toEqual({
      kind: "email",
      subject: "Hi A&B",
      html: '<p>Hi A&amp;B</p><a href="u?x=1&amp;y=2">go</a>',
      text: "Hi A&B u?x=1&y=2",
    });
  });

  it("collects the missing variables across every email part", () => {
    const out = renderTemplate(template, "email", {});
    expect([...out.missing].sort()).toEqual(["name", "url"]);
    expect(out.content?.kind).toBe("email");
  });

  it("renders sms, whatsapp and push content", () => {
    expect(renderTemplate(template, "sms", { code: "123" }).content).toEqual({
      kind: "sms",
      text: "code 123",
    });
    expect(renderTemplate(template, "whatsapp", { name: "Pat", code: "9" }).content).toEqual({
      kind: "whatsapp",
      providerTemplateId: "wa_1",
      params: ["Pat", "9"],
    });
    expect(renderTemplate(template, "push", { name: "Pat", url: "u" }).content).toEqual({
      kind: "push",
      title: "Hi Pat",
      body: "see u",
    });
  });

  it("returns null content when the template has no block for the channel", () => {
    expect(renderTemplate({ email: template.email }, "sms", {}).content).toBeNull();
  });
});

describe("invite template baselines", () => {
  it("staff.invite and client.invite render fully from { name, activationUrl }", () => {
    const templates = CONFIG_REGISTRY["notification.templates"].default;
    const vars = { name: "Pat", activationUrl: "https://app.example/activate?token=abc" };
    for (const key of ["staff.invite", "client.invite"] as const) {
      const template = templates[key];
      if (!template) throw new Error(`missing baseline ${key}`);
      const out = renderTemplate(template, "email", vars);
      expect(out.missing).toEqual([]);
      if (out.content?.kind !== "email") throw new Error("expected email content");
      expect(out.content.text).toContain("Pat");
      expect(out.content.text).toContain("https://app.example/activate?token=abc");
    }
  });
});
