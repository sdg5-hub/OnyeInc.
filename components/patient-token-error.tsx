import Link from "next/link";

import { cn } from "@/lib/utils";

export type PatientTokenErrorProps = {
  title: string;
  message: string;
  supportHref?: string;
  className?: string;
};

export function PatientTokenError({
  title,
  message,
  supportHref = "mailto:support@onyesync.com",
  className,
}: PatientTokenErrorProps) {
  return (
    <main
      className={cn(
        "flex min-h-screen w-full items-center justify-center bg-white px-5 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100",
        className,
      )}
    >
      <section className="mx-auto flex w-full max-w-xl flex-col items-start gap-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-900 text-body font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
            O
          </div>
          <span className="text-heading font-semibold">OnyeSync</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-display font-semibold text-neutral-950 dark:text-white">{title}</h1>
          <p className="max-w-prose text-body text-neutral-700 dark:text-neutral-300">{message}</p>
        </div>

        <Link
          className="inline-flex min-h-10 items-center rounded-md border border-neutral-300 px-4 text-body font-medium text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          href={supportHref}
        >
          Contact support
        </Link>
      </section>
    </main>
  );
}
