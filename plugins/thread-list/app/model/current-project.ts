import { createSidebarProjectIdResolver } from "./project-thread-groups.js";
import type { SidebarThread } from "./sidebar-thread.js";

interface ResolveCurrentProjectIdArgs {
  activeProjectId: string | null;
  selectedThreadId: string | undefined;
  threads: readonly SidebarThread[];
}

export function resolveCurrentProjectId({
  activeProjectId,
  selectedThreadId,
  threads,
}: ResolveCurrentProjectIdArgs): string | null {
  if (activeProjectId !== null) return activeProjectId;
  if (selectedThreadId === undefined) return null;
  const threadsById = new Map(threads.map((thread) => [thread.id, thread]));
  const selectedThread = threadsById.get(selectedThreadId);
  if (selectedThread === undefined) return null;
  return createSidebarProjectIdResolver(threadsById)(selectedThread);
}
