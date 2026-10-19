import { useSyncExternalStore } from "react";

export interface ActiveNote {
  vaultId: string;
  path: string;
  title: string;
}

export interface NoteSelection {
  vaultId: string;
  path: string;
  text: string;
  lines: { start: number; end: number } | null;
}

export interface ActiveNoteState {
  note: ActiveNote | null;
  selection: NoteSelection | null;
  lastVaultId: string | null;
}

let state: ActiveNoteState = { note: null, selection: null, lastVaultId: null };
const listeners = new Set<() => void>();

function update(next: ActiveNoteState): void {
  state = next;
  for (const listener of listeners) listener();
}

function sameNote(left: ActiveNote | null, right: ActiveNote | null): boolean {
  return (
    left?.vaultId === right?.vaultId &&
    left?.path === right?.path &&
    left?.title === right?.title
  );
}

export function setActiveNote(note: ActiveNote | null): void {
  if (sameNote(state.note, note)) return;
  const selection =
    note &&
    state.selection?.vaultId === note.vaultId &&
    state.selection.path === note.path
      ? state.selection
      : null;
  update({
    note,
    selection,
    lastVaultId: note?.vaultId ?? state.lastVaultId,
  });
}

export function clearActiveNote(vaultId: string, path: string): void {
  if (state.note?.vaultId !== vaultId || state.note.path !== path) return;
  update({ ...state, note: null, selection: null });
}

export function setActiveVault(vaultId: string): void {
  if (state.lastVaultId === vaultId) return;
  update({ ...state, lastVaultId: vaultId });
}

export function setNoteSelection(selection: NoteSelection | null): void {
  const current = state.selection;
  if (
    current?.vaultId === selection?.vaultId &&
    current?.path === selection?.path &&
    current?.text === selection?.text &&
    current?.lines?.start === selection?.lines?.start &&
    current?.lines?.end === selection?.lines?.end
  )
    return;
  update({ ...state, selection });
}

export function useActiveNote(): ActiveNoteState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

const LINE_PREFIX = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)*/;

function plainLine(line: string): string {
  return line
    .replace(LINE_PREFIX, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~|\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function selectionLineRange(
  markdown: string,
  text: string,
): { start: number; end: number } | null {
  const wanted = text.split("\n").map(plainLine).filter(Boolean);
  const [first, ...rest] = wanted;
  if (first === undefined) return null;
  const lines = markdown.split("\n").map(plainLine);
  let match: { start: number; end: number } | null = null;
  for (let start = 0; start < lines.length; start += 1) {
    if (!lines[start]!.includes(first)) continue;
    let current = start;
    let matched = true;
    for (const part of rest) {
      let next = current + 1;
      while (next < lines.length && lines[next] === "") next += 1;
      if (next < lines.length && lines[next]!.includes(part)) current = next;
      else if (!lines[current]!.includes(part)) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    if (match) return null;
    match = { start: start + 1, end: current + 1 };
  }
  return match;
}

export function selectionPrompt(selection: NoteSelection): string {
  const where = selection.lines
    ? selection.lines.start === selection.lines.end
      ? ` (line ${selection.lines.start})`
      : ` (lines ${selection.lines.start}–${selection.lines.end})`
    : "";
  const fence = selection.text.includes("```") ? "````" : "```";
  return `Selected text from \`${selection.path}\`${where}:\n${fence}\n${selection.text}\n${fence}\n`;
}

let vaultViews = 0;
const vaultViewListeners = new Set<() => void>();

export function registerVaultView(): () => void {
  vaultViews += 1;
  for (const listener of vaultViewListeners) listener();
  return () => {
    vaultViews -= 1;
    for (const listener of vaultViewListeners) listener();
  };
}

export function useVaultViewOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      vaultViewListeners.add(listener);
      return () => vaultViewListeners.delete(listener);
    },
    () => vaultViews > 0,
    () => false,
  );
}
