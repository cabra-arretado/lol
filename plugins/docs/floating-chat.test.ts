import { describe, expect, it } from "vitest";
import {
  addTab,
  closeTab,
  initialChatState,
  MAX_CHAT_TABS,
  openThreadInTab,
  parseChatState,
  resizedChat,
  type FloatingChatState,
} from "./floating-chat";

function withTabs(threadIds: (string | null)[]): FloatingChatState {
  const tabs = threadIds.map((threadId, index) => ({ id: `t${index}`, threadId }));
  return { ...initialChatState(), tabs, activeTabId: "t0" };
}

describe("floating chat state", () => {
  it("parses stored state defensively", () => {
    expect(parseChatState({ tabs: [] }).tabs).toHaveLength(1);
    const parsed = parseChatState({
      open: true,
      view: "past",
      tabs: [
        { id: "a", threadId: "thr_1" },
        { id: "a", threadId: "thr_2" },
        { id: "bad id!", threadId: null },
        ...Array.from({ length: 8 }, (_, index) => ({ id: `x${index}`, threadId: null })),
      ],
      activeTabId: "missing",
      width: 10,
      height: "tall",
    });
    expect(parsed.open).toBe(true);
    expect(parsed.view).toBe("past");
    expect(parsed.tabs.map((tab) => tab.id)).toEqual(["a", "x0", "x1", "x2", "x3"]);
    expect(parsed.activeTabId).toBe("a");
    expect(parsed.width).toBe(320);
    expect(parsed.height).toBe(560);
  });

  it("reuses an empty tab and stops at the tab limit", () => {
    const empty = withTabs(["thr_1", null]);
    expect(addTab(empty).activeTabId).toBe("t1");
    const full = withTabs(Array.from({ length: MAX_CHAT_TABS }, (_, i) => `thr_${i}`));
    expect(addTab(full)).toBe(full);
    expect(addTab(withTabs(["thr_1"])).tabs).toHaveLength(2);
  });

  it("selects a neighbour when closing the active tab and never leaves zero tabs", () => {
    const state = { ...withTabs(["thr_1", "thr_2", "thr_3"]), activeTabId: "t2" };
    expect(closeTab(state, "t2").activeTabId).toBe("t1");
    expect(closeTab(state, "t0").activeTabId).toBe("t2");
    const last = closeTab(withTabs(["thr_1"]), "t0");
    expect(last.tabs).toHaveLength(1);
    expect(last.tabs[0]!.threadId).toBeNull();
  });

  it("opens a past chat in its existing tab, an empty tab, a new tab, then the active tab", () => {
    expect(openThreadInTab(withTabs(["thr_1", "thr_2"]), "thr_2").activeTabId).toBe("t1");
    expect(openThreadInTab(withTabs(["thr_1", null]), "thr_9").tabs[1]!.threadId).toBe("thr_9");
    expect(openThreadInTab(withTabs(["thr_1"]), "thr_9").tabs).toHaveLength(2);
    const full = withTabs(Array.from({ length: MAX_CHAT_TABS }, (_, i) => `thr_${i}`));
    const replaced = openThreadInTab(full, "thr_9");
    expect(replaced.tabs).toHaveLength(MAX_CHAT_TABS);
    expect(replaced.tabs[0]!.threadId).toBe("thr_9");
  });

  it("clamps sizes to the minimum and the viewport", () => {
    const state = initialChatState();
    expect(resizedChat(state, { width: 5000, height: 10 }, { width: 900, height: 700 })).toMatchObject({
      width: 900,
      height: 360,
    });
    expect(resizedChat(state, { width: 400, height: 400 }, { width: 250, height: 300 })).toMatchObject({
      width: 250,
      height: 300,
    });
    expect(resizedChat(state, { width: state.width, height: state.height }, { width: 2000, height: 2000 })).toBe(state);
  });
});
