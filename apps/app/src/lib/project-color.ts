import type { ProjectColor } from "@bb/domain";

const PROJECT_COLOR_HUES: Record<ProjectColor, number> = {
  red: 25,
  orange: 55,
  amber: 85,
  green: 150,
  teal: 190,
  blue: 250,
  violet: 295,
  pink: 345,
};

export function projectColorCss(color: ProjectColor): string {
  return `oklch(0.68 0.17 ${PROJECT_COLOR_HUES[color]})`;
}

export function projectColorLabel(color: ProjectColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}
