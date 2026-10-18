export interface Wikilink {
  start: number;
  end: number;
  target: string;
  heading: string | null;
  label: string;
}

const WIKILINK = /\[\[([^[\]\n]+?)\]\]/g;

export function findWikilinks(text: string): Wikilink[] {
  const links: Wikilink[] = [];
  for (const match of text.matchAll(WIKILINK)) {
    const inner = match[1]!.replace(/\\\|/g, "|");
    const pipe = inner.indexOf("|");
    const destination = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
    const hash = destination.indexOf("#");
    const target = (hash === -1 ? destination : destination.slice(0, hash)).trim();
    if (!target) continue;
    links.push({
      start: match.index,
      end: match.index + match[0].length,
      target,
      heading: hash === -1 ? null : destination.slice(hash + 1).trim() || null,
      label: (pipe === -1 ? destination : inner.slice(pipe + 1)).trim(),
    });
  }
  return links;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function basename(value: string): string {
  return value.split("/").at(-1) ?? value;
}

export interface VaultFile {
  path: string;
  title: string | null;
}

function comparableTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function shallowest(paths: readonly string[]): string | null {
  return (
    [...paths].sort(
      (left, right) =>
        left.split("/").length - right.split("/").length ||
        left.localeCompare(right),
    )[0] ?? null
  );
}

export function resolveNotePath(
  target: string,
  files: readonly VaultFile[],
  options: { matchTitles: boolean },
): string | null {
  const cleaned = safeDecode(target.trim())
    .replace(/\\/g, "/")
    .replace(/^(?:\.\/)+/, "")
    .replace(/^\/+/, "");
  if (!cleaned || cleaned.split("/").includes("..")) return null;
  const paths = files.map((file) => file.path);
  const candidates = /\.(?:md|html?)$/i.test(cleaned)
    ? [cleaned]
    : [`${cleaned}.md`, cleaned];
  for (const candidate of candidates) {
    const lowered = candidate.toLowerCase();
    const exact = paths.find((entry) => entry.toLowerCase() === lowered);
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    if (candidate.includes("/")) continue;
    const lowered = candidate.toLowerCase();
    const byName = shallowest(
      paths.filter((entry) => basename(entry).toLowerCase() === lowered),
    );
    if (byName) return byName;
  }
  if (!options.matchTitles) return null;
  const title = comparableTitle(cleaned);
  return shallowest(
    files
      .filter((file) => file.title !== null && comparableTitle(file.title) === title)
      .map((file) => file.path),
  );
}

export function vaultRelativeHref(
  href: string,
  rootPath: string,
): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) && !href.startsWith("file://"))
    return null;
  if (/^(?:mailto|tel|bb|data|javascript):/i.test(href)) return null;
  if (href.startsWith("#")) return null;
  let value = href.startsWith("file://") ? href.slice("file://".length) : href;
  value = safeDecode(value.split("#")[0]!.split("?")[0]!);
  if (!value) return null;
  const root = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
    if (!normalized.startsWith(`${root}/`))
      return null;
    return normalized.slice(root.length + 1);
  }
  return normalized;
}
