"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Client-boundary wrapper around next-themes — toggles Tailwind's `dark`
 * class on <html> and persists the choice. Decision + rationale:
 * docs/styling-conventions.md ("Dark mode").
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
