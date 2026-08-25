"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { savePreference } from "@/lib/savePreference";
import { COLOR_THEMES, DEFAULT_COLOR_THEME, type ColorTheme } from "@/lib/colorThemes";

export { COLOR_THEMES };
export type { ColorTheme };

const COLOR_THEME_COOKIE = "preferred-color-theme";

interface ColorThemeContextValue {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextValue>({
  colorTheme: DEFAULT_COLOR_THEME,
  setColorTheme: () => {},
});

function writeCookie(key: string, value: string) {
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ColorThemeProvider({
  children,
  initialTheme = DEFAULT_COLOR_THEME,
}: {
  children: React.ReactNode;
  initialTheme?: ColorTheme;
}) {
  // initialTheme is resolved server-side from the cookie (see layout.tsx) so
  // the first render already matches the user's saved choice — no flash.
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(initialTheme);

  const setColorTheme = useCallback((next: ColorTheme) => {
    setColorThemeState(next);
    writeCookie(COLOR_THEME_COOKIE, next);
    savePreference("colorTheme", next);
  }, []);

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  return useContext(ColorThemeContext);
}
