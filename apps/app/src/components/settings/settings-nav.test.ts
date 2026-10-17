import { describe, expect, it } from "vitest";
import {
  filterSettingsNavSections,
  resolveSettingsRoute,
} from "./settings-nav";

describe("resolveSettingsRoute", () => {
  it.each([
    {
      pathname: "/settings/providers",
      activeSection: "providers",
      hasUnknownSection: false,
    },
    {
      pathname: "/settings/archived",
      activeSection: "archived",
      hasUnknownSection: false,
    },
    {
      pathname: "/settings/plugins",
      activeSection: "plugins",
      hasUnknownSection: false,
    },
  ])("resolves $pathname", ({ pathname, ...expected }) => {
    expect(resolveSettingsRoute({ pathname, search: "" })).toMatchObject(
      expected,
    );
  });
});

describe("filterSettingsNavSections", () => {
  it.each([
    {
      name: "hides Files without a daemon, helper access or file opener",
      hasDaemon: false,
      accessState: "unavailable",
      fileOpenerCount: 0,
      showsFiles: false,
    },
    {
      name: "shows Files when local helper access can be enabled",
      hasDaemon: false,
      accessState: "permission-required",
      fileOpenerCount: 0,
      showsFiles: true,
    },
  ] as const)("$name", ({ showsFiles, ...input }) => {
    const ids = filterSettingsNavSections(input).map((section) => section.id);
    expect(ids.includes("files")).toBe(showsFiles);
    expect(ids).toContain("archived");
  });

  it("hides Mobile but keeps Updates for agent CLIs in the personal edition", () => {
    const ids = filterSettingsNavSections({
      hasDaemon: true,
      accessState: "unavailable",
      fileOpenerCount: 0,
    }).map((section) => section.id);
    expect(ids).not.toContain("mobile");
    expect(ids).toContain("updates");
    expect(ids).toContain("machines");
  });

  it("treats a denied section route as unknown", () => {
    expect(
      resolveSettingsRoute({ pathname: "/settings/mobile", search: "" }),
    ).toMatchObject({ activeSection: "general", hasUnknownSection: true });
    expect(
      resolveSettingsRoute({ pathname: "/settings/updates", search: "" }),
    ).toMatchObject({ activeSection: "updates", hasUnknownSection: false });
  });
});
