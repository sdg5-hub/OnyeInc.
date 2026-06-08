import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Onye Radiology",
  description: "Radiology image review and collaboration platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is required by next-themes — it sets the
    // `dark`/`light` class on <html> before hydration to avoid a flash of
    // the wrong theme; React would otherwise warn about the SSR/client
    // class mismatch. Do not remove — see docs/styling-conventions.md.
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "max-w-[100vw] overflow-x-hidden font-sans antialiased",
          "bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100",
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
