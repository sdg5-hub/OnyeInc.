import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:ring-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus-visible:ring-neutral-100",
        secondary:
          "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus-visible:ring-neutral-400 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
        outline:
          "border border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-100 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800",
        ghost:
          "bg-transparent text-neutral-900 hover:bg-neutral-100 focus-visible:ring-neutral-400 dark:text-neutral-100 dark:hover:bg-neutral-800",
        destructive:
          "bg-status-failed text-white hover:bg-status-failed/90 focus-visible:ring-status-failed",
      },
      size: {
        sm: "h-8 px-3 text-caption",
        default: "h-10 px-4",
        lg: "h-12 px-6 text-heading",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/**
 * Reference Button — Tailwind utilities only, composed via cva + cn().
 * Every variant carries a `dark:` counterpart per the project's `class`
 * dark-mode strategy (docs/styling-conventions.md).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export { buttonVariants };
