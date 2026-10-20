import { describe, expect, it } from "vitest";
import { canonicalPromptReference, remarkPromptReferences } from "./promptReferences";

describe("prompt reference Markdown rendering", () => {
  it("keeps exact source tokens and surrounding prose while making references addressable", () => {
    const tree = { type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: "人物 {{Mixed 1}} 与 {{ mixed 02 }}，保持造型。" }] }] };
    remarkPromptReferences()(tree);
    const children = tree.children[0].children;
    expect(children.map((child) => child.type)).toEqual(["text", "promptReference", "text", "promptReference", "text"]);
    expect(children.map((child) => "children" in child
      ? (child.children as Array<{ value: string }>).map((text) => text.value).join("")
      : child.value).join("")).toBe("人物 {{Mixed 1}} 与 {{ mixed 02 }}，保持造型。");
    expect(canonicalPromptReference("{{ mixed 02 }}")).toBe("{{Mixed 2}}");
  });

  it("does not turn code, links, or raw HTML into buttons", () => {
    const tree = { type: "root", children: [
      { type: "code", value: "{{Mixed 1}}" },
      { type: "paragraph", children: [
        { type: "inlineCode", value: "{{Mixed 2}}" },
        { type: "link", children: [{ type: "text", value: "{{Mixed 3}}" }] },
        { type: "linkReference", children: [{ type: "text", value: "{{Mixed 4}}" }] },
        { type: "html", value: "<b>{{Mixed 5}}</b>" },
      ] },
    ] };
    const original = JSON.stringify(tree);
    remarkPromptReferences()(tree);
    expect(JSON.stringify(tree)).toBe(original);
  });
});
