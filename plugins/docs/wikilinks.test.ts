import { describe, expect, it } from "vitest";
import { findWikilinks, resolveNotePath, vaultRelativeHref } from "./wikilinks";

describe("wikilinks", () => {
  it("parses targets, headings, labels and escaped pipes", () => {
    expect(
      findWikilinks("See [[Projects/Plan#Goals|the plan]] and [[Ideas\\|Notes]] or [[]]."),
    ).toEqual([
      {
        start: 4,
        end: 36,
        target: "Projects/Plan",
        heading: "Goals",
        label: "the plan",
      },
      { start: 41, end: 57, target: "Ideas", heading: null, label: "Notes" },
    ]);
  });

  it("resolves exact paths before the shortest note with the same name", () => {
    const paths = ["Ideas.md", "Archive/Ideas.md", "Projects/Launch plan.md", "Site/index.html"].map(
      (path) => ({ path, title: null }),
    );
    expect(resolveNotePath("Projects/launch plan", paths)).toBe("Projects/Launch plan.md");
    expect(resolveNotePath("ideas", paths)).toBe("Ideas.md");
    expect(resolveNotePath("Launch plan", paths)).toBe("Projects/Launch plan.md");
    expect(resolveNotePath("Site/index.html", paths)).toBe("Site/index.html");
    expect(resolveNotePath("Projects/Launch%20plan.md", paths)).toBe("Projects/Launch plan.md");
    expect(resolveNotePath("../Ideas", paths)).toBeNull();
    expect(resolveNotePath("Missing", paths)).toBeNull();
  });

  it("falls back to note titles when no file name matches", () => {
    const files = [
      { path: "what-is-up.md", title: "what is up" },
      { path: "Archive/old-plan.md", title: "Launch plan" },
      { path: "plan.md", title: "Launch  Plan" },
      { path: "Ideas.md", title: "Something else" },
      { path: "Site/index.html", title: null },
    ];
    expect(resolveNotePath("what is up", files)).toBe("what-is-up.md");
    expect(resolveNotePath("WHAT IS UP", files)).toBe("what-is-up.md");
    expect(resolveNotePath("launch plan", files)).toBe("plan.md");
    expect(resolveNotePath("Ideas", files)).toBe("Ideas.md");
    expect(resolveNotePath("Something else", files)).toBe("Ideas.md");
    expect(resolveNotePath("Not a title", files)).toBeNull();
  });

  it("keeps only hrefs that point inside the vault", () => {
    expect(vaultRelativeHref("Projects/Plan.md#goals", "/notes")).toBe("Projects/Plan.md");
    expect(vaultRelativeHref("/notes/Ideas.md", "/notes/")).toBe("Ideas.md");
    expect(vaultRelativeHref("file:///notes/a%20b.md", "/notes")).toBe("a b.md");
    expect(vaultRelativeHref("/elsewhere/Ideas.md", "/notes")).toBeNull();
    expect(vaultRelativeHref("/notes-old/Ideas.md", "/notes")).toBeNull();
    expect(vaultRelativeHref("https://example.com/a.md", "/notes")).toBeNull();
    expect(vaultRelativeHref("mailto:me@example.com", "/notes")).toBeNull();
    expect(vaultRelativeHref("#heading", "/notes")).toBeNull();
  });
});
