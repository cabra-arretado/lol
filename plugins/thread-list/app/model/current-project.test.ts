import { describe, expect, it } from "vitest";
import { resolveCurrentProjectId } from "./current-project.js";
import { makeSidebarThread } from "./fixtures.js";

describe("resolveCurrentProjectId", () => {
  const threads = [makeSidebarThread({ id: "thread-1", projectId: "proj_b" })];

  it("uses the route project when no thread is selected", () => {
    expect(
      resolveCurrentProjectId({
        activeProjectId: "proj_a",
        selectedThreadId: undefined,
        threads,
      }),
    ).toBe("proj_a");
  });

  it("prefers the route project over the selected thread's project", () => {
    expect(
      resolveCurrentProjectId({
        activeProjectId: "proj_a",
        selectedThreadId: "thread-1",
        threads,
      }),
    ).toBe("proj_a");
  });

  it("falls back to the selected thread's project", () => {
    expect(
      resolveCurrentProjectId({
        activeProjectId: null,
        selectedThreadId: "thread-1",
        threads,
      }),
    ).toBe("proj_b");
  });

  it("marks nothing without a route project or known thread", () => {
    expect(
      resolveCurrentProjectId({
        activeProjectId: null,
        selectedThreadId: "missing",
        threads,
      }),
    ).toBeNull();
  });
});
