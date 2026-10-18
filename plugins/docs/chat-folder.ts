import path from "node:path";

export const CHAT_FOLDER_MODES = ["vault", "default", "folder"] as const;
export type ChatFolderMode = (typeof CHAT_FOLDER_MODES)[number];

export const CHAT_FOLDER_MODE_LABELS: Record<ChatFolderMode, string> = {
  vault: "The open vault's folder",
  default: "The usual new-thread default",
  folder: "The chat folder below",
};

export function parseChatFolderMode(value: unknown): ChatFolderMode {
  return CHAT_FOLDER_MODES.find((mode) => mode === value) ?? "vault";
}

interface ProjectWithSources {
  id: string;
  kind: string;
  sources: readonly { hostId: string; path: string }[];
}

function comparablePath(value: string): string {
  const windows = path.win32.isAbsolute(value) && !path.posix.isAbsolute(value);
  const normalized = windows
    ? path.win32.normalize(value).toLowerCase()
    : path.posix.normalize(value);
  return normalized.length > 1 ? normalized.replace(/[\\/]+$/, "") : normalized;
}

export function findProjectForFolder(
  projects: readonly ProjectWithSources[],
  hostId: string,
  folder: string,
): string | null {
  const wanted = comparablePath(folder);
  const match = projects.find(
    (project) =>
      project.kind !== "personal" &&
      project.sources.some(
        (source) =>
          source.hostId === hostId && comparablePath(source.path) === wanted,
      ),
  );
  return match?.id ?? null;
}

export function folderDisplayName(folder: string): string {
  const windows = path.win32.isAbsolute(folder) && !path.posix.isAbsolute(folder);
  const name = (windows ? path.win32 : path.posix).basename(
    folder.replace(/[\\/]+$/, ""),
  );
  return name || folder;
}
