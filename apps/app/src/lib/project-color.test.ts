import { PROJECT_COLORS } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { projectColorCss as pluginProjectColorCss } from "../../../../plugins/thread-list/app/model/project-color";
import { projectColorCss } from "./project-color";

describe("project color palette", () => {
  it("renders every domain color the same in the app and the thread-list plugin", () => {
    for (const color of PROJECT_COLORS) {
      expect(pluginProjectColorCss(color)).toBe(projectColorCss(color));
    }
  });

  it("uses a darker light-theme tone than dark-theme tone", () => {
    expect(projectColorCss("teal")).toBe(
      "light-dark(oklch(0.58 0.17 190), oklch(0.68 0.17 190))",
    );
  });
});
