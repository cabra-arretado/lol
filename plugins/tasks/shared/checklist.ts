const CHECKLIST_LINE = /^\s*[-*+]\s+\[([ xX])\]\s+(\S.*?)\s*$/;
const FENCE_LINE = /^\s*(```|~~~)/;

export interface ChecklistItem {
  title: string;
  done: boolean;
}

export interface ExtractedChecklist {
  items: ChecklistItem[];
  description: string;
}

export function extractChecklist(description: string): ExtractedChecklist {
  const items: ChecklistItem[] = [];
  const kept: string[] = [];
  let fence: string | null = null;
  for (const line of description.split("\n")) {
    const fenceMatch = FENCE_LINE.exec(line);
    if (fenceMatch) {
      fence = fence === null ? (fenceMatch[1] ?? null) : null;
      kept.push(line);
      continue;
    }
    const match = fence === null ? CHECKLIST_LINE.exec(line) : null;
    if (match) {
      items.push({ title: match[2] ?? "", done: match[1] !== " " });
    } else {
      kept.push(line);
    }
  }
  if (items.length === 0) return { items, description };
  return {
    items,
    description: kept
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}
