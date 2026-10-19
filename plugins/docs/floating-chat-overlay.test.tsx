// @vitest-environment jsdom
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import {
  loadPluginApp,
  renderSlot,
  type RenderSlotOptions,
} from "@get-bb/plugin-sdk/testing/app";

const app = await loadPluginApp(() => import("./app"));
const { registerVaultView, setActiveVault } = await import("./active-note");
const overlay = app.appOverlays[0]!;
const STORAGE_KEY = "bb-docs-floating-chat-v1";

function stubViewport(compact: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: compact && query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderOverlay(sdk: RenderSlotOptions["sdk"] = {}) {
  return renderSlot(overlay, {}, {
    pluginId: "simple-notes",
    sdk,
    rpc: {
      listNotes: () => {
        const vault = {
          id: "personal",
          name: "Personal",
          hostId: null,
          rootPath: "/notes",
        };
        return {
          vaults: [vault],
          vault,
          hosts: [],
          entries: [],
          entryOrder: [],
          notes: [],
          truncated: false,
          error: null,
        };
      },
      resolveChatFolder: (input: unknown) =>
        typeof input === "object" &&
        input !== null &&
        "create" in input &&
        input.create === true
          ? {
              kind: "folder" as const,
              projectId: "proj_notes",
              hostId: "host_1",
              path: "/notes",
            }
          : {
              kind: "missing" as const,
              hostId: "host_1",
              path: "/notes",
              name: "Personal notes",
            },
    },
  });
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  stubViewport(false);
  setActiveVault("personal");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("floating chat overlay", () => {
  it("creates the vault project only when asked, then starts the thread there", async () => {
    const slot = renderOverlay({
      threads: { spawn: async () => makeThreadResponse({ id: "thr_1" }) },
    });
    fireEvent.click(slot.getByRole("button", { name: "Show chat" }));
    const useFolder = await slot.findByRole("button", { name: "Use this folder" });
    const composer = slot.getByTestId("bb-new-thread-composer");
    expect(composer.dataset.defaultProjectId).toBe("");
    expect(
      slot.inspection.rpcCalls
        .filter((call) => call.method === "resolveChatFolder")
        .map((call) => call.input),
    ).toEqual([{ vaultId: "personal", create: false }]);

    fireEvent.click(useFolder);
    await waitFor(() =>
      expect(
        slot.getByTestId("bb-new-thread-composer").dataset.defaultProjectId,
      ).toBe("proj_notes"),
    );
    expect(slot.queryByRole("button", { name: "Use this folder" })).toBeNull();

    fireEvent.click(slot.getByTestId("bb-new-thread-composer-submit"));
    expect(await slot.findByText("ThreadChat stub (thr_1)")).toBeTruthy();
    const spawn = slot.inspection.sdkCalls.find(
      (call) => call.method === "threads.spawn",
    );
    expect(spawn?.args[0]).toMatchObject({ projectId: "proj_notes" });
  });

  it("closes with Escape and keeps its state across a reload", async () => {
    const slot = renderOverlay();
    fireEvent.click(slot.getByRole("button", { name: "Show chat" }));
    const region = await slot.findByRole("region", { name: "Floating chat" });
    fireEvent.keyDown(region, { key: "Escape" });
    expect(slot.queryByRole("region", { name: "Floating chat" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      open: false,
    });
  });

  it("on compact screens, starts closed and shows the bubble only in the Vault view", async () => {
    stubViewport(true);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        open: true,
        view: "chat",
        tabs: [{ id: "t1", threadId: null }],
        activeTabId: "t1",
        width: 420,
        height: 560,
      }),
    );
    const slot = renderOverlay();
    expect(slot.queryByRole("button", { name: "Show chat" })).toBeNull();
    expect(slot.queryByRole("tablist", { name: "Chats" })).toBeNull();

    let unregister = () => {};
    act(() => {
      unregister = registerVaultView();
    });
    fireEvent.click(slot.getByRole("button", { name: "Show chat" }));
    expect(await slot.findByRole("tablist", { name: "Chats" })).toBeTruthy();
    expect(slot.queryByRole("separator", { name: "Resize chat window" })).toBeNull();
    act(() => unregister());
  });
});
