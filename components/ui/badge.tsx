import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-medium", {
  variants: {
    variant: {
      neutral: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
      uploading: "bg-status-uploading/15 text-status-uploading dark:bg-status-uploading/25",
      processing: "bg-status-processing/15 text-status-processing dark:bg-status-processing/25",
      complete: "bg-status-complete/15 text-status-complete dark:bg-status-complete/25",
      failed: "bg-status-failed/15 text-status-failed dark:bg-status-failed/25",
      partialMissing: "bg-status-partialMissing/15 text-status-partialMissing dark:bg-status-partialMissing/25",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/**
 * Reference Badge — status variants map 1:1 to the status-* color tokens
 * (tailwind.config.js / docs/styling-conventions.md), the single source of
 * truth IC-101, IC-204, and IC-VIEWER-01 must use for status indicators.
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
