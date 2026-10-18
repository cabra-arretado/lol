import { describe, expect, it } from "vitest";
import { findWikilinks, resolveNotePath, vaultRelativeHref } from "./wikilinks";

const wikilink = { matchTitles: true };
const markdownLink = { matchTitles: false };

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
    expect(resolveNotePath("Projects/launch plan", paths, wikilink)).toBe("Projects/Launch plan.md");
    expect(resolveNotePath("ideas", paths, wikilink)).toBe("Ideas.md");
    expect(resolveNotePath("Launch plan", paths, wikilink)).toBe("Projects/Launch plan.md");
    expect(resolveNotePath("Site/index.html", paths, wikilink)).toBe("Site/index.html");
    expect(resolveNotePath("Projects/Launch%20plan.md", paths, wikilink)).toBe("Projects/Launch plan.md");
    expect(resolveNotePath("../Ideas", paths, wikilink)).toBeNull();
    expect(resolveNotePath("Missing", paths, wikilink)).toBeNull();
  });

  it("falls back to note titles when no file name matches", () => {
    const files = [
      { path: "what-is-up.md", title: "what is up" },
      { path: "Archive/old-plan.md", title: "Launch plan" },
      { path: "plan.md", title: "Launch  Plan" },
      { path: "Ideas.md", title: "Something else" },
      { path: "Site/index.html", title: null },
    ];
    expect(resolveNotePath("what is up", files, wikilink)).toBe("what-is-up.md");
    expect(resolveNotePath("WHAT IS UP", files, wikilink)).toBe("what-is-up.md");
    expect(resolveNotePath("launch plan", files, wikilink)).toBe("plan.md");
    expect(resolveNotePath("Ideas", files, wikilink)).toBe("Ideas.md");
    expect(resolveNotePath("Something else", files, wikilink)).toBe("Ideas.md");
    expect(resolveNotePath("Not a title", files, wikilink)).toBeNull();
  });

  it("prefers file names over titles and breaks ties by path", () => {
    const files = [
      { path: "notes/b.md", title: "Plan" },
      { path: "notes/a.md", title: "Plan" },
      { path: "ideas-v2.md", title: "Ideas" },
      { path: "Archive/2019/Ideas.md", title: "Old ideas" },
    ];
    expect(resolveNotePath("Plan", files, wikilink)).toBe("notes/a.md");
    expect(resolveNotePath("Plan", [...files].reverse(), wikilink)).toBe("notes/a.md");
    expect(resolveNotePath("Ideas", files, wikilink)).toBe("Archive/2019/Ideas.md");
  });

  it("matches titles only for wikilinks, not Markdown links", () => {
    const files = [{ path: "readme-notes.md", title: "README" }];
    expect(resolveNotePath("README", files, wikilink)).toBe("readme-notes.md");
    expect(resolveNotePath("README", files, markdownLink)).toBeNull();
    expect(resolveNotePath("readme-notes.md", files, markdownLink)).toBe("readme-notes.md");
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
