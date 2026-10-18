import { describe, expect, it } from "vitest";
import { selectionLineRange, selectionPrompt } from "./active-note";

const NOTE = [
  "---",
  "title: Plan",
  "---",
  "# Launch **plan**",
  "",
  "- [ ] Ship the _vault_ view",
  "- Polish the chat",
  "",
  "| Step | Owner |",
  "| --- | --- |",
  "| Ship | Ana |",
  "",
  "Ship it.",
].join("\n");

describe("selectionLineRange", () => {
  it("maps rendered text back to file lines across Markdown syntax", () => {
    expect(selectionLineRange(NOTE, "Launch plan")).toEqual({ start: 4, end: 4 });
    expect(
      selectionLineRange(NOTE, "Ship the vault view\nPolish the chat"),
    ).toEqual({ start: 6, end: 7 });
  });

  it("allows several selected blocks on one source line", () => {
    expect(selectionLineRange(NOTE, "Step\nOwner")).toEqual({ start: 9, end: 9 });
  });

  it("returns null for ambiguous or missing text", () => {
    expect(selectionLineRange(NOTE, "Ship")).toBeNull();
    expect(selectionLineRange(NOTE, "Not in the note")).toBeNull();
    expect(selectionLineRange(NOTE, "   ")).toBeNull();
  });
});

describe("selectionPrompt", () => {
  it("quotes the selection with its path and lines, widening the fence when needed", () => {
    expect(
      selectionPrompt({
        vaultId: "personal",
        path: "plan.md",
        text: "a\nb",
        lines: { start: 2, end: 3 },
      }),
    ).toBe("Selected text from `plan.md` (lines 2–3):\n```\na\nb\n```\n");
    expect(
      selectionPrompt({
        vaultId: "personal",
        path: "code.md",
        text: "```js\nx\n```",
        lines: null,
      }),
    ).toBe("Selected text from `code.md`:\n````\n```js\nx\n```\n````\n");
  });
});
