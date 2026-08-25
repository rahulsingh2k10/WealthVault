export const COLOR_THEMES = ["warm", "blue", "violet", "purple", "red", "pink", "teal", "green", "black"] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];
export const DEFAULT_COLOR_THEME: ColorTheme = "warm";

export function isColorTheme(value: string): value is ColorTheme {
  return (COLOR_THEMES as readonly string[]).includes(value);
}
