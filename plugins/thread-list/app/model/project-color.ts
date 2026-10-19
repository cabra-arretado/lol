import type { SidebarProjectColor } from "./use-sidebar-data.js";

const PROJECT_COLOR_HUES: Record<SidebarProjectColor, number> = {
  red: 25,
  orange: 55,
  amber: 85,
  green: 150,
  teal: 190,
  blue: 250,
  violet: 295,
  pink: 345,
};

export function projectColorCss(color: SidebarProjectColor): string {
  const hue = PROJECT_COLOR_HUES[color];
  return `light-dark(oklch(0.58 0.17 ${hue}), oklch(0.68 0.17 ${hue}))`;
}

const PROJECT_COLORS = Object.keys(PROJECT_COLOR_HUES) as SidebarProjectColor[];

export function resolveProjectColor(
  projectId: string,
  chosen: SidebarProjectColor | null,
): SidebarProjectColor {
  if (chosen !== null) return chosen;
  let hash = 0;
  for (const char of projectId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return PROJECT_COLORS[hash % PROJECT_COLORS.length] as SidebarProjectColor;
}
