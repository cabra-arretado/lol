import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  experimental_NewThreadComposer as NewThreadComposer,
  experimental_usePluginId,
  experimental_useSidebarThreads,
  ThreadChat,
  ThreadTitle,
  useBbNavigate,
  useComposers,
  useRpc,
  useSdk,
  useSettings,
  type NewThreadRequest,
  type PluginComposerApi,
} from "@get-bb/plugin-sdk/app";
import BubbleChatIcon from "@hugeicons/core-free-icons/BubbleChatIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Clock01Icon from "@hugeicons/core-free-icons/Clock01Icon";
import FileAttachmentIcon from "@hugeicons/core-free-icons/FileAttachmentIcon";
import MinusSignIcon from "@hugeicons/core-free-icons/MinusSignIcon";
import PlusSignIcon from "@hugeicons/core-free-icons/PlusSignIcon";
import TextSelectionIcon from "@hugeicons/core-free-icons/TextSelectionIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { docsRpcContract } from "./server.js";
import {
  selectionPrompt,
  useActiveNote,
  type ActiveNote,
  type ActiveNoteState,
  type NoteSelection,
} from "./active-note.js";
import { isRecord } from "./markdown-document.js";
import {
  findWikilinks,
  resolveNotePath,
  vaultRelativeHref,
} from "./wikilinks.js";

export const VAULT_PANEL_PATH = "vault";
export const MAX_CHAT_TABS = 5;

const STORAGE_KEY = "bb-docs-floating-chat-v1";
const WIKILINK_HIGHLIGHT = "bb-docs-wikilink";
const DEFAULT_SIZE = { width: 420, height: 560 };
const MIN_SIZE = { width: 320, height: 360 };
const EDGE_GAP = 16;
const BUBBLE_SIZE = 44;

export interface ChatTab {
  id: string;
  threadId: string | null;
}

export interface FloatingChatState {
  open: boolean;
  view: "chat" | "past";
  tabs: ChatTab[];
  activeTabId: string;
  width: number;
  height: number;
}

function newTabId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function initialChatState(): FloatingChatState {
  const id = newTabId();
  return {
    open: false,
    view: "chat",
    tabs: [{ id, threadId: null }],
    activeTabId: id,
    ...DEFAULT_SIZE,
  };
}

export function parseChatState(value: unknown): FloatingChatState {
  const fallback = initialChatState();
  if (!isRecord(value) || !Array.isArray(value.tabs)) return fallback;
  const seen = new Set<string>();
  const tabs = value.tabs
    .filter(isRecord)
    .map((tab) => ({
      id: typeof tab.id === "string" && /^[\w-]+$/.test(tab.id) ? tab.id : "",
      threadId:
        typeof tab.threadId === "string" && tab.threadId ? tab.threadId : null,
    }))
    .filter((tab) => tab.id && !seen.has(tab.id) && seen.add(tab.id))
    .slice(0, MAX_CHAT_TABS);
  if (tabs.length === 0) return fallback;
  const activeTabId =
    typeof value.activeTabId === "string" &&
    tabs.some((tab) => tab.id === value.activeTabId)
      ? value.activeTabId
      : tabs[0]!.id;
  const size = (key: "width" | "height") =>
    typeof value[key] === "number" && Number.isFinite(value[key])
      ? Math.max(MIN_SIZE[key], Math.round(value[key] as number))
      : DEFAULT_SIZE[key];
  return {
    open: value.open === true,
    view: value.view === "past" ? "past" : "chat",
    tabs,
    activeTabId,
    width: size("width"),
    height: size("height"),
  };
}

function readChatState(): FloatingChatState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseChatState(JSON.parse(raw)) : initialChatState();
  } catch {
    return initialChatState();
  }
}

function writeChatState(state: FloatingChatState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function addTab(state: FloatingChatState): FloatingChatState {
  const empty = state.tabs.find((tab) => tab.threadId === null);
  if (empty) return { ...state, view: "chat", activeTabId: empty.id };
  if (state.tabs.length >= MAX_CHAT_TABS) return state;
  const id = newTabId();
  return {
    ...state,
    view: "chat",
    tabs: [...state.tabs, { id, threadId: null }],
    activeTabId: id,
  };
}

export function closeTab(
  state: FloatingChatState,
  tabId: string,
): FloatingChatState {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== tabId);
  if (tabs.length === 0) {
    const id = newTabId();
    return { ...state, tabs: [{ id, threadId: null }], activeTabId: id };
  }
  const activeTabId =
    state.activeTabId === tabId
      ? tabs[Math.min(index, tabs.length - 1)]!.id
      : state.activeTabId;
  return { ...state, tabs, activeTabId };
}

export function openThreadInTab(
  state: FloatingChatState,
  threadId: string,
): FloatingChatState {
  const existing = state.tabs.find((tab) => tab.threadId === threadId);
  if (existing)
    return { ...state, view: "chat", activeTabId: existing.id };
  const active = state.tabs.find((tab) => tab.id === state.activeTabId);
  const empty =
    active?.threadId === null
      ? active
      : state.tabs.find((tab) => tab.threadId === null);
  if (empty)
    return {
      ...state,
      view: "chat",
      tabs: state.tabs.map((tab) =>
        tab.id === empty.id ? { ...tab, threadId } : tab,
      ),
      activeTabId: empty.id,
    };
  if (state.tabs.length < MAX_CHAT_TABS) {
    const id = newTabId();
    return {
      ...state,
      view: "chat",
      tabs: [...state.tabs, { id, threadId }],
      activeTabId: id,
    };
  }
  return {
    ...state,
    view: "chat",
    tabs: state.tabs.map((tab) =>
      tab.id === state.activeTabId ? { ...tab, threadId } : tab,
    ),
  };
}

export function resizedChat(
  state: FloatingChatState,
  size: { width: number; height: number },
  bounds: { width: number; height: number },
): FloatingChatState {
  const fit = (value: number, key: "width" | "height") =>
    Math.round(
      Math.max(Math.min(MIN_SIZE[key], bounds[key]), Math.min(value, bounds[key])),
    );
  const width = fit(size.width, "width");
  const height = fit(size.height, "height");
  return width === state.width && height === state.height
    ? state
    : { ...state, width, height };
}

function draftKeyFor(tabId: string): string {
  return `docs-floating-chat-${tabId}`;
}

function percent(value: unknown, fallback: number): number {
  return typeof value === "number" && value >= 40 && value <= 100
    ? value / 100
    : fallback;
}

function composerForTab(
  composers: readonly PluginComposerApi[],
  tab: ChatTab,
): PluginComposerApi | null {
  const matches = composers.filter((composer) =>
    tab.threadId === null
      ? composer.scope.kind === "new-thread" &&
        composer.key.includes(draftKeyFor(tab.id))
      : composer.scope.kind === "thread" &&
        composer.scope.threadId === tab.threadId,
  );
  return matches.at(-1) ?? null;
}

type FolderState =
  | { status: "loading" }
  | { status: "ready"; projectId?: string; hostId?: string }
  | { status: "error"; message: string };

function NewChat({
  tabId,
  vaultId,
  onCreated,
}: {
  tabId: string;
  vaultId: string | null;
  onCreated(tabId: string, threadId: string): void;
}) {
  const rpc = useRpc<typeof docsRpcContract>();
  const sdk = useSdk();
  const [folder, setFolder] = useState<FolderState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    rpc
      .call("resolveChatFolder", { vaultId })
      .then((result) => {
        if (cancelled) return;
        setFolder(
          result.kind === "folder"
            ? {
                status: "ready",
                projectId: result.projectId,
                hostId: result.hostId,
              }
            : { status: "ready" },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFolder({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [rpc, vaultId]);

  const submit = useCallback(
    async (request: NewThreadRequest) => {
      const thread = await sdk.threads.spawn(request);
      onCreated(tabId, thread.id);
    },
    [onCreated, sdk, tabId],
  );
  const seed = useMemo(
    () =>
      folder.status === "ready" && folder.projectId && folder.hostId
        ? {
            defaultProjectId: folder.projectId,
            defaultEnvironment: {
              type: "host" as const,
              hostId: folder.hostId,
              workspace: { type: "unmanaged" as const, path: null },
            },
          }
        : {},
    [folder],
  );

  if (folder.status === "loading")
    return (
      <div
        className="flex flex-1 items-center justify-center p-4 text-xs text-muted-foreground"
        role="status"
      >
        Preparing chat…
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {folder.status === "error" ? (
        <p className="border-b border-border px-3 py-2 text-xs text-destructive">
          Could not use the default chat folder: {folder.message}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        <NewThreadComposer
          layout="document"
          draftKey={draftKeyFor(tabId)}
          placeholder="Ask about your notes…"
          {...seed}
          onSubmit={submit}
        />
      </div>
    </div>
  );
}

function PastChats({
  pluginId,
  openThreadIds,
  onOpen,
  onNewChat,
}: {
  pluginId: string;
  openThreadIds: ReadonlySet<string>;
  onOpen(threadId: string): void;
  onNewChat(): void;
}) {
  const { threads, status } = experimental_useSidebarThreads();
  const chats = threads.filter(
    (thread) => thread.originPluginId === pluginId && !thread.isArchived,
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-foreground">Past chats</span>
        <Button size="sm" variant="ghost" onClick={onNewChat}>
          New chat
        </Button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Past chats">
        {status === "loading" && chats.length === 0 ? (
          <li className="p-3 text-xs text-muted-foreground" role="status">
            Loading chats…
          </li>
        ) : chats.length === 0 ? (
          <li className="p-3 text-xs text-muted-foreground">
            No chats yet. Start one with New chat.
          </li>
        ) : (
          chats.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-state-hover"
                onClick={() => onOpen(thread.id)}
              >
                <span className="min-w-0 flex-1 truncate">
                  <ThreadTitle threadId={thread.id} />
                </span>
                {openThreadIds.has(thread.id) ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Open
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function useVaultLinks(
  root: HTMLElement | null,
  activeNote: ActiveNoteState,
): void {
  const rpc = useRpc<typeof docsRpcContract>();
  const navigate = useBbNavigate();
  const vaultId = activeNote.note?.vaultId ?? activeNote.lastVaultId;
  const vaultRef = useRef<{
    id: string;
    rootPath: string;
    paths: string[];
  } | null>(null);

  const loadVault = useCallback(async () => {
    const data = await rpc.call("listNotes", {
      ...(vaultId ? { vaultId } : {}),
    });
    const value = {
      id: data.vault.id,
      rootPath: data.vault.rootPath,
      paths: data.entries
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.path),
    };
    vaultRef.current = value;
    return value;
  }, [rpc, vaultId]);

  useEffect(() => {
    vaultRef.current = null;
    void loadVault().catch(() => undefined);
  }, [loadVault]);

  useEffect(() => {
    if (!root) return;
    const highlights =
      typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight === "function"
        ? CSS.highlights
        : null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const paint = () => {
      timer = null;
      if (!highlights) return;
      const ranges: Range[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest("[contenteditable='true'], textarea"))
          continue;
        for (const link of findWikilinks(node.textContent ?? "")) {
          const range = document.createRange();
          range.setStart(node, link.start);
          range.setEnd(node, link.end);
          ranges.push(range);
        }
      }
      highlights.set(WIKILINK_HIGHLIGHT, new Highlight(...ranges));
    };
    const observer = new MutationObserver(() => {
      if (timer === null) timer = setTimeout(paint, 60);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    paint();

    const openPath = (vault: { id: string }, path: string) =>
      navigate.toPluginPanel(VAULT_PANEL_PATH, {
        subPath: `${encodeURIComponent(vault.id)}/${path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
      });
    const wikilinkAt = (event: MouseEvent) => {
      const caret = document.caretRangeFromPoint?.(event.clientX, event.clientY);
      const node = caret?.startContainer;
      if (!caret || !node || node.nodeType !== Node.TEXT_NODE) return null;
      if (node.parentElement?.closest("[contenteditable='true'], textarea"))
        return null;
      return (
        findWikilinks(node.textContent ?? "").find(
          (link) => caret.startOffset > link.start && caret.startOffset < link.end,
        ) ?? null
      );
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.defaultPrevented) return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      const wikilink = anchor ? null : wikilinkAt(event);
      if (!anchor && !wikilink) return;
      const vault = vaultRef.current;
      const target = anchor
        ? vault
          ? vaultRelativeHref(anchor.getAttribute("href") ?? "", vault.rootPath)
          : null
        : wikilink!.target;
      if (target === null) return;
      const resolve = (current: NonNullable<typeof vault>) =>
        resolveNotePath(target, current.paths);
      if (vault) {
        const path = resolve(vault);
        if (!path) {
          if (wikilink) toast.error(`No note named “${wikilink.target}” in this vault`);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        openPath(vault, path);
        return;
      }
      if (!wikilink) return;
      event.preventDefault();
      void loadVault().then((fresh) => {
        const path = resolve(fresh);
        if (path) openPath(fresh, path);
        else toast.error(`No note named “${wikilink.target}” in this vault`);
      });
    };
    root.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      highlights?.delete(WIKILINK_HIGHLIGHT);
      root.removeEventListener("click", onClick, true);
    };
  }, [loadVault, navigate, root]);
}

const STYLE_MARKER = "data-bb-docs-floating-chat-styles";

function ensureChatStyles(): void {
  if (document.head.querySelector(`style[${STYLE_MARKER}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(STYLE_MARKER, "");
  style.textContent = `::highlight(${WIKILINK_HIGHLIGHT}) { color: var(--primary); text-decoration: underline; text-decoration-color: color-mix(in oklab, var(--primary) 50%, transparent); }`;
  document.head.append(style);
}

function AttachBar({
  tab,
  note,
  selection,
}: {
  tab: ChatTab;
  note: ActiveNote;
  selection: NoteSelection | null;
}) {
  const composers = useComposers();
  const insert = (parts: Parameters<PluginComposerApi["insert"]>[0]) => {
    const composer = composerForTab(composers, tab);
    if (!composer) {
      toast.error("The chat composer is not ready yet");
      return;
    }
    try {
      composer.insert(parts, { at: "end", block: true });
      composer.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 min-w-0 gap-1.5 px-2 text-xs"
        onClick={() =>
          insert([
            {
              provider: "note",
              id: `${note.vaultId}:${note.path}`,
              label: note.title,
            },
            " ",
          ])
        }
      >
        <HugeiconsIcon icon={FileAttachmentIcon} className="size-3.5 shrink-0" />
        <span className="truncate">+ File: {note.title}</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 gap-1.5 px-2 text-xs"
        disabled={!selection}
        onClick={() => selection && insert(selectionPrompt(selection))}
      >
        <HugeiconsIcon icon={TextSelectionIcon} className="size-3.5" />
        + Selection
        {selection?.lines
          ? ` (${selection.lines.start === selection.lines.end ? `L${selection.lines.start}` : `L${selection.lines.start}–${selection.lines.end}`})`
          : ""}
      </Button>
    </div>
  );
}

function FloatingChatWindow({
  state,
  setState,
  pluginId,
}: {
  state: FloatingChatState;
  setState(update: (current: FloatingChatState) => FloatingChatState): void;
  pluginId: string;
}) {
  const settings = useSettings().values;
  const activeNote = useActiveNote();
  const [engaged, setEngaged] = useState({ hover: false, focus: false });
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const resizeRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  useVaultLinks(root, activeNote);

  const activeTab =
    state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0]!;
  const vaultId = activeNote.note?.vaultId ?? activeNote.lastVaultId;
  const opacity =
    engaged.hover || engaged.focus
      ? percent(settings?.chatOpacityActive, 1)
      : percent(settings?.chatOpacityIdle, 0.85);
  const maxWidth = window.innerWidth - EDGE_GAP * 2;
  const maxHeight = window.innerHeight - EDGE_GAP * 3 - BUBBLE_SIZE;
  const width = Math.max(Math.min(state.width, maxWidth), Math.min(MIN_SIZE.width, maxWidth));
  const height = Math.max(Math.min(state.height, maxHeight), Math.min(MIN_SIZE.height, maxHeight));
  const openThreadIds = useMemo(
    () =>
      new Set(
        state.tabs.flatMap((tab) => (tab.threadId ? [tab.threadId] : [])),
      ),
    [state.tabs],
  );

  const note = activeNote.note;
  const selection =
    note &&
    activeNote.selection?.vaultId === note.vaultId &&
    activeNote.selection.path === note.path
      ? activeNote.selection
      : null;

  const bounds = { width: maxWidth, height: maxHeight };
  const attachThread = useCallback(
    (tabId: string, threadId: string) =>
      setState((current) => ({
        ...current,
        tabs: current.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, threadId } : tab,
        ),
      })),
    [setState],
  );
  const onGripPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { x: event.clientX, y: event.clientY, width, height };
  };
  const onGripPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = resizeRef.current;
    if (!start) return;
    setState((current) =>
      resizedChat(
        current,
        {
          width: start.width + start.x - event.clientX,
          height: start.height + start.y - event.clientY,
        },
        bounds,
      ),
    );
  };
  const onGripKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 80 : 20;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    setState((current) =>
      resizedChat(
        current,
        {
          width: Math.min(current.width, bounds.width) + delta[0],
          height: Math.min(current.height, bounds.height) + delta[1],
        },
        bounds,
      ),
    );
  };

  return (
    <section
      ref={setRoot}
      aria-label="Floating chat"
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-xl transition-opacity"
      style={{
        right: EDGE_GAP,
        bottom: EDGE_GAP * 2 + BUBBLE_SIZE - 8,
        width,
        height,
        opacity,
      }}
      onPointerEnter={() => setEngaged((value) => ({ ...value, hover: true }))}
      onPointerLeave={() => setEngaged((value) => ({ ...value, hover: false }))}
      onFocus={() => setEngaged((value) => ({ ...value, focus: true }))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setEngaged((value) => ({ ...value, focus: false }));
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        setState((current) => ({ ...current, open: false }));
      }}
    >
      <div
        role="separator"
        aria-label="Resize chat window"
        aria-orientation="horizontal"
        tabIndex={0}
        className="absolute left-0 top-0 z-10 size-3 cursor-nwse-resize rounded-br-sm hover:bg-state-hover focus-visible:bg-state-active focus-visible:outline-none"
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={() => {
          resizeRef.current = null;
        }}
        onKeyDown={onGripKeyDown}
      />
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border pl-3 pr-1">
        <div
          role="tablist"
          aria-label="Chats"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        >
          {state.tabs.map((tab) => {
            const selected = state.view === "chat" && tab.id === activeTab.id;
            return (
              <div
                key={tab.id}
                className={cn(
                  "group flex h-7 min-w-0 max-w-40 shrink-0 items-center rounded-md text-xs",
                  selected ? "bg-state-active" : "hover:bg-state-hover",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className="min-w-0 truncate px-2 text-left"
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      view: "chat",
                      activeTabId: tab.id,
                    }))
                  }
                >
                  {tab.threadId ? (
                    <ThreadTitle threadId={tab.threadId} />
                  ) : (
                    "New chat"
                  )}
                </button>
                {state.tabs.length > 1 || tab.threadId ? (
                  <button
                    type="button"
                    aria-label="Close chat tab"
                    className="mr-1 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() =>
                      setState((current) => closeTab(current, tab.id))
                    }
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <Button
          className="size-7 shrink-0"
          size="icon"
          variant="ghost"
          aria-label="New chat"
          disabled={
            state.tabs.length >= MAX_CHAT_TABS &&
            state.tabs.every((tab) => tab.threadId !== null)
          }
          onClick={() => setState(addTab)}
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
        </Button>
        <Button
          className="size-7 shrink-0"
          size="icon"
          variant="ghost"
          aria-label="Past chats"
          aria-pressed={state.view === "past"}
          onClick={() =>
            setState((current) => ({
              ...current,
              view: current.view === "past" ? "chat" : "past",
            }))
          }
        >
          <HugeiconsIcon icon={Clock01Icon} className="size-4" />
        </Button>
        <Button
          className="size-7 shrink-0"
          size="icon"
          variant="ghost"
          aria-label="Hide chat"
          onClick={() => setState((current) => ({ ...current, open: false }))}
        >
          <HugeiconsIcon icon={MinusSignIcon} className="size-4" />
        </Button>
      </div>
      {state.view === "past" ? (
        <PastChats
          pluginId={pluginId}
          openThreadIds={openThreadIds}
          onOpen={(threadId) =>
            setState((current) => openThreadInTab(current, threadId))
          }
          onNewChat={() => setState(addTab)}
        />
      ) : (
        <>
          {note ? (
            <AttachBar tab={activeTab} note={note} selection={selection} />
          ) : null}
          {activeTab.threadId ? (
            <ThreadChat
              key={activeTab.threadId}
              threadId={activeTab.threadId}
              variant="compact"
              layout="contained"
              permissionPolicy="editable"
              className="min-h-0 flex-1"
            />
          ) : (
            <NewChat
              key={`${activeTab.id}:${vaultId ?? ""}`}
              tabId={activeTab.id}
              vaultId={vaultId}
              onCreated={attachThread}
            />
          )}
        </>
      )}
    </section>
  );
}

function ChatBubble({
  open,
  attention,
  onToggle,
}: {
  open: boolean;
  attention: "none" | "running" | "waiting";
  onToggle(): void;
}) {
  return (
    <button
      type="button"
      aria-label={open ? "Hide chat" : "Show chat"}
      aria-expanded={open}
      className="fixed z-50 flex items-center justify-center rounded-full border border-border bg-popover text-popover-foreground shadow-lg transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        right: EDGE_GAP,
        bottom: EDGE_GAP,
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
      }}
      onClick={onToggle}
    >
      <HugeiconsIcon icon={open ? MinusSignIcon : BubbleChatIcon} className="size-5" />
      {attention !== "none" ? (
        <span
          aria-hidden
          className={cn(
            "absolute right-0.5 top-0.5 size-2.5 rounded-full border-2 border-popover",
            attention === "waiting" ? "bg-warning" : "bg-primary",
          )}
        />
      ) : null}
    </button>
  );
}

export function FloatingChat() {
  const settings = useSettings();
  if (settings.values?.floatingChat === false) return null;
  return <FloatingChatOverlay />;
}

function FloatingChatOverlay() {
  const pluginId = experimental_usePluginId();
  const { threads } = experimental_useSidebarThreads();
  const [state, setStateValue] = useState(readChatState);
  const setState = useCallback(
    (update: (current: FloatingChatState) => FloatingChatState) =>
      setStateValue((current) => {
        const next = update(current);
        if (next !== current) writeChatState(next);
        return next;
      }),
    [],
  );
  useEffect(() => {
    ensureChatStyles();
  }, []);
  const tabThreadIds = new Set(
    state.tabs.flatMap((tab) => (tab.threadId ? [tab.threadId] : [])),
  );
  const tabThreads = threads.filter((thread) => tabThreadIds.has(thread.id));
  const attention = tabThreads.some((thread) => thread.hasPendingInteraction)
    ? "waiting"
    : tabThreads.some((thread) =>
          ["starting", "active", "stopping"].includes(thread.status),
        )
      ? "running"
      : "none";

  return (
    <>
      {state.open ? (
        <FloatingChatWindow
          state={state}
          setState={setState}
          pluginId={pluginId}
        />
      ) : null}
      <ChatBubble
        open={state.open}
        attention={attention}
        onToggle={() => setState((current) => ({ ...current, open: !current.open }))}
      />
    </>
  );
}
