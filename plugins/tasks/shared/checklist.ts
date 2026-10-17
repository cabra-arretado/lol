const BULLET_LINE = /^( *)[-*+]\s/;
const CHECKLIST_LINE = /^( *)[-*+]\s+\[([ xX])\]\s+(\S.*?)\s*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

export interface ChecklistItem {
  title: string;
  done: boolean;
}

export interface ExtractedChecklist {
  items: ChecklistItem[];
  description: string;
}

interface ListFrame {
  indent: number;
  converted: boolean;
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

export function extractChecklist(description: string): ExtractedChecklist {
  const lines = description.split("\n");
  const removed = lines.map(() => false);
  const items: ChecklistItem[] = [];
  let fence: { char: string; length: number } | null = null;
  let frames: ListFrame[] = [];

  for (const [index, line] of lines.entries()) {
    if (fence !== null) {
      const closer = new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`);
      if (closer.test(line)) fence = null;
      continue;
    }
    const opener = FENCE_OPEN.exec(line);
    if (opener) {
      const marker = opener[1] ?? "```";
      fence = { char: marker.charAt(0), length: marker.length };
      frames = [];
      continue;
    }
    if (isBlank(line)) continue;
    const bullet = BULLET_LINE.exec(line);
    if (!bullet) {
      if (!line.startsWith(" ")) frames = [];
      continue;
    }
    const indent = (bullet[1] ?? "").length;
    while (frames.length > 0 && (frames.at(-1)?.indent ?? 0) >= indent) {
      frames.pop();
    }
    const parent = frames.at(-1);
    const eligible = parent === undefined ? indent < 4 : parent.converted;
    const match = eligible ? CHECKLIST_LINE.exec(line) : null;
    if (match) {
      items.push({ title: match[3] ?? "", done: match[2] !== " " });
      removed[index] = true;
    }
    frames.push({ indent, converted: match !== null });
  }

  if (items.length === 0) return { items, description };

  const dropped = [...removed];
  let start = 0;
  while (start < lines.length) {
    if (!removed[start]) {
      start += 1;
      continue;
    }
    let end = start;
    while (end + 1 < lines.length && removed[end + 1]) end += 1;
    const prevBlank =
      start > 0 && !removed[start - 1] && isBlank(lines[start - 1] ?? "");
    const atEnd = end === lines.length - 1;
    const nextBlank = !atEnd && isBlank(lines[end + 1] ?? "");
    if (prevBlank && (atEnd || nextBlank)) {
      dropped[start - 1] = true;
    } else if (start === 0 && nextBlank) {
      dropped[end + 1] = true;
    }
    start = end + 1;
  }

  return {
    items,
    description: lines.filter((_, index) => !dropped[index]).join("\n"),
  };
}
