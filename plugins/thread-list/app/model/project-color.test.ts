import { describe, expect, it } from "vitest";
import { resolveProjectColor } from "./project-color.js";

describe("resolveProjectColor", () => {
  it("keeps a chosen color", () => {
    expect(resolveProjectColor("proj_a", "pink")).toBe("pink");
  });

  it("assigns the same automatic color to the same project every time", () => {
    expect(resolveProjectColor("proj_a", null)).toBe(
      resolveProjectColor("proj_a", null),
    );
  });

  it("spreads different projects across several colors", () => {
    const colors = new Set(
      Array.from({ length: 40 }, (_, index) =>
        resolveProjectColor(`proj_${index}`, null),
      ),
    );
    expect(colors.size).toBeGreaterThan(3);
  });
});
