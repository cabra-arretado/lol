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
  return `oklch(0.68 0.17 ${PROJECT_COLOR_HUES[color]})`;
}
