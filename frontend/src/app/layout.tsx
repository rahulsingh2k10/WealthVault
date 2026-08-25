import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { cookies } from "next/headers";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { LocaleProvider } from "@/context/LocaleContext";
import { ColorThemeProvider } from "@/context/ColorThemeContext";
import { COLOR_THEMES, DEFAULT_COLOR_THEME, type ColorTheme } from "@/lib/colorThemes";
import { AppBar } from "@/components/layout/AppBar";
import { PreferencesSync } from "@/components/layout/PreferencesSync";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Wealth Vault | Rahul Singh",
  description: "Wealth Vault — encrypted personal investment tracker. Stocks, MFs, NPS, crypto, and more. Zero-knowledge. Private by design.",
};

function readInitialColorTheme(): ColorTheme {
  const raw = cookies().get("preferred-color-theme")?.value;
  return raw && (COLOR_THEMES as readonly string[]).includes(raw) ? (raw as ColorTheme) : DEFAULT_COLOR_THEME;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialColorTheme = readInitialColorTheme();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <CurrencyProvider>
              <ColorThemeProvider initialTheme={initialColorTheme}>
                <PreferencesSync />
                <AppBar />
                {children}
              </ColorThemeProvider>
            </CurrencyProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
