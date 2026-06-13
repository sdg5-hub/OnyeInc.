export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VerifyDobPlaceholderPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-white px-5 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-900 text-body font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
            O
          </div>
          <span className="text-heading font-semibold">OnyeSync</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-display font-semibold text-neutral-950 dark:text-white">Date of birth verification</h1>
          <p className="text-body text-neutral-700 dark:text-neutral-300">
            This secure verification step is ready for PAT-201 to complete. Your link has been accepted.
          </p>
        </div>
      </section>
    </main>
  );
}
