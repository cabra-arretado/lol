import { describe, expect, it } from "vitest";
import {
  findProjectForFolder,
  folderDisplayName,
  parseChatFolderMode,
} from "./chat-folder";

describe("chat folder helpers", () => {
  it("falls back to the vault mode for unknown values", () => {
    expect(parseChatFolderMode("folder")).toBe("folder");
    expect(parseChatFolderMode("elsewhere")).toBe("vault");
    expect(parseChatFolderMode(undefined)).toBe("vault");
  });

  it("matches folders on the same host regardless of trailing separators", () => {
    const projects = [
      {
        id: "personal",
        kind: "personal",
        sources: [{ hostId: "h1", path: "/notes" }],
      },
      { id: "remote", kind: "standard", sources: [{ hostId: "h2", path: "/notes" }] },
      { id: "local", kind: "standard", sources: [{ hostId: "h1", path: "/notes/" }] },
      { id: "windows", kind: "standard", sources: [{ hostId: "h1", path: "C:\\Notes\\" }] },
    ];
    expect(findProjectForFolder(projects, "h1", "/notes")).toBe("local");
    expect(findProjectForFolder(projects, "h1", "/notes/sub")).toBeNull();
    expect(findProjectForFolder(projects, "h1", "c:\\notes")).toBe("windows");
  });

  it("names a project after the folder", () => {
    expect(folderDisplayName("/work/research/")).toBe("research");
    expect(folderDisplayName("C:\\Users\\me\\Notes")).toBe("Notes");
  });
});
