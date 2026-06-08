"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Toggles between light and dark mode (next-themes' resolvedTheme), the
 * decided dark-mode entry point — see docs/styling-conventions.md.
 *
 * Renders nothing meaningful until mounted: next-themes can't know the
 * resolved theme during SSR, and rendering an icon that flips on hydration
 * would itself cause the flash this whole setup exists to avoid.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {mounted ? (
              isDark ? (
                <Sun className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5" aria-hidden="true" />
              )
            ) : (
              <span className="block h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={6}
            className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-caption text-white shadow-md dark:bg-neutral-100 dark:text-neutral-900"
          >
            {label}
            <Tooltip.Arrow className="fill-neutral-900 dark:fill-neutral-100" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
