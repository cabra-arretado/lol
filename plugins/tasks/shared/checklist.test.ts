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

  it("leaves code fences, plain bullets, and empty boxes alone", () => {
    const text = "```\n- [ ] sample\n```\n- plain\n- [ ]\n- [] nope";
    expect(extractChecklist(text)).toEqual({ items: [], description: text });
  });

  it("returns an empty description when only checkboxes remain", () => {
    expect(extractChecklist("- [ ] a\n- [x] b").description).toBe("");
  });
});
