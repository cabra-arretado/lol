import { describe, expect, it } from "vitest";
import { extractChecklist } from "./checklist.js";

describe("extractChecklist", () => {
  it("moves checkbox lines out of the description and keeps the rest", () => {
    expect(
      extractChecklist(
        "Intro\n\n- [ ] one\n- [x] two\n  * [X] nested\n\nOutro",
      ),
    ).toEqual({
      items: [
        { title: "one", done: false },
        { title: "two", done: true },
        { title: "nested", done: true },
      ],
      description: "Intro\n\nOutro",
    });
  });

  it("leaves everything else byte-for-byte, including blank-line runs", () => {
    expect(extractChecklist("A\n\n\n\nB\n- [ ] x\nC\n\n\n").description).toBe(
      "A\n\n\n\nB\nC\n\n\n",
    );
  });

  it("returns an empty description when only checkboxes remain", () => {
    expect(extractChecklist("- [ ] a\n- [x] b").description).toBe("");
  });

  it("leaves plain bullets and empty boxes alone", () => {
    const text = "- plain\n- [ ]\n- [] nope";
    expect(extractChecklist(text)).toEqual({ items: [], description: text });
  });

  it("does not touch code fences, including blank runs inside them", () => {
    const text = "```\n- [ ] sample\n\n\n\nmore\n```\n\n- [ ] real";
    expect(extractChecklist(text)).toEqual({
      items: [{ title: "real", done: false }],
      description: "```\n- [ ] sample\n\n\n\nmore\n```",
    });
  });

  it("closes a fence only with the same marker", () => {
    const text = "```\n~~~\n- [ ] still code\n```\n- [ ] real";
    expect(extractChecklist(text)).toEqual({
      items: [{ title: "real", done: false }],
      description: "```\n~~~\n- [ ] still code\n```",
    });
  });

  it("ignores indented code and items nested under plain bullets", () => {
    const text = "Para\n\n    - [ ] code\n\n- parent\n  - [ ] child";
    expect(extractChecklist(text)).toEqual({ items: [], description: text });
  });

  it("converts nested items under converted ones", () => {
    expect(
      extractChecklist("- [ ] a\n    - [x] deep\n").items.map((i) => i.title),
    ).toEqual(["a", "deep"]);
  });
});
