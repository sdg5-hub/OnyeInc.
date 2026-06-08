import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge doesn't know about custom font-size tokens — without this,
// text-heading / text-caption are treated as color utilities and silently
// drop text-white / text-neutral-* from the resolved class list.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": ["text-display", "text-heading", "text-body", "text-caption"],
    },
  },
});

/**
 * Combines class names conditionally (clsx) and resolves Tailwind utility
 * conflicts deterministically (tailwind-merge) — e.g. cn("bg-blue-500", isError && "bg-red-500")
 * yields "bg-red-500", not both classes fighting over CSS source order.
 *
 * All conditional class-name composition must go through this — see
 * docs/styling-conventions.md ("The cn() helper").
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
