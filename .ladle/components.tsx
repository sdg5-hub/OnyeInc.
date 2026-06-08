import type { GlobalProvider } from "@ladle/react";
import { ThemeProvider } from "../components/theme-provider";

import "./styles.js";

/** Wraps every story in the ThemeProvider so dark: variants work. */
export const Provider: GlobalProvider = ({ children }) => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    {children}
  </ThemeProvider>
);
